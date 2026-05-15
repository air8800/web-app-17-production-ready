import { createClient } from '@supabase/supabase-js';

// Build marker — bump this string in every code change so you can verify which
// deployment Vercel is serving. Echoed in every response from this handler.
const BUILD_VERSION = 'phonepe-v2-upi-picker-2026-05-16';

// UPI apps we expose as direct-tap tiles in the checkout UI. PhonePe's
// `paymentModeConfig` `apps` field is case-sensitive lowercase.
const VALID_UPI_APPS = new Set(['phonepe', 'gpay', 'paytm']);

// Match a typical UPI VPA, e.g. "name@bank", "9999999999@upi", "name.surname-1@okhdfcbank".
// Intentionally loose on the local-part (UPI handles allow word chars, dot, dash);
// strict on the handle being [a-z]{2,}. Used identically on the client.
const VPA_REGEX = /^[\w.\-]{2,}@[a-z]{2,}$/i;

// ── PhonePe OAuth Token Cache ───────────────────────────────────────────────
let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * PhonePe Standard Checkout v2 OAuth token.
 *
 * IMPORTANT: PhonePe puts OAuth on a SEPARATE base path from the /checkout/v2/* APIs:
 *   - Production:  https://api.phonepe.com/apis/identity-manager/v1/oauth/token
 *   - UAT/Sandbox: https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token
 *
 * The request is form-encoded with client_id / client_version / client_secret / grant_type
 * (NOT HTTP Basic auth). The response includes `expires_at` as an absolute epoch (seconds).
 *
 * Override the URL with PHONEPE_AUTH_URL env var if PhonePe rotates endpoints.
 */
async function getPhonePeToken({ clientId, clientSecret, clientVersion, authURL }) {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) return cachedToken;

  const body = new URLSearchParams({
    client_id: clientId,
    client_version: String(clientVersion),
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  });

  const res = await fetch(authURL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const rawText = await res.text();
  let data = {};
  try { data = JSON.parse(rawText); } catch { /* non-JSON body */ }

  if (!res.ok || !data.access_token) {
    console.error('❌ PhonePe OAuth token error:', {
      authURL,
      status: res.status,
      statusText: res.statusText,
      body: data && Object.keys(data).length ? data : rawText?.slice(0, 500),
    });
    const err = new Error(
      data.error_description ||
      data.message ||
      data.error ||
      `PhonePe OAuth token request failed (HTTP ${res.status})`
    );
    err.status = res.status;
    err.body = data;
    err.authURL = authURL;
    throw err;
  }

  cachedToken = data.access_token;
  // PhonePe v2 returns `expires_at` as absolute epoch seconds.
  // Fall back to `expires_in` (seconds-from-now) if present, else 25 min.
  if (typeof data.expires_at === 'number') {
    tokenExpiresAt = data.expires_at * 1000 - 60_000;
  } else if (typeof data.expires_in === 'number') {
    tokenExpiresAt = now + (data.expires_in - 60) * 1000;
  } else {
    tokenExpiresAt = now + 25 * 60 * 1000;
  }
  return cachedToken;
}

function normalizeHost(urlString) {
  const host = new URL(urlString).hostname.toLowerCase();
  return host.startsWith('www.') ? host.slice(4) : host;
}

function isLocalOrigin(urlString) {
  try {
    const host = new URL(urlString).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

function isAllowedRequestOrigin(originHeader) {
  if (!originHeader) return true;

  const allowedHosts = new Set(['printget.in']);
  if (process.env.VERCEL_URL) {
    allowedHosts.add(process.env.VERCEL_URL.toLowerCase());
  }

  try {
    const host = normalizeHost(originHeader);
    return allowedHosts.has(host);
  } catch {
    return false;
  }
}

/**
 * POST /api/phonepe-initiate
 * Creates a PhonePe Standard Checkout payment session.
 * Security hardened: amount always read from DB, origin verified, job state validated.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Security Layer 1: Block requests not from your domain ─────────────────
  // Accepts printget.in, www.printget.in, localhost, and Vercel preview URLs.
  const APP_URL = (process.env.APP_URL || 'https://www.printget.in').replace(/\/$/, '');
  const origin  = req.headers['origin'] || req.headers['referer'] || '';

  if (origin && !isLocalOrigin(origin) && !isAllowedRequestOrigin(origin)) {
    console.warn('🚫 Blocked unauthorized origin:', origin);
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const { jobId, upiApp, upiVpa } = req.body || {};

    if (!jobId) {
      return res.status(400).json({ error: 'Missing required field: jobId' });
    }

    // ── Validate optional UPI hints from the client ───────────────────────────
    // Both fields are optional. If neither is supplied, the PhonePe page will
    // show all UPI flows (Intent + Collect + QR) with all supported apps.
    if (upiApp != null && !VALID_UPI_APPS.has(String(upiApp).toLowerCase())) {
      return res.status(400).json({
        error: 'Invalid upiApp',
        hint: `Allowed values: ${[...VALID_UPI_APPS].join(', ')}`,
      });
    }
    if (upiVpa != null && !VPA_REGEX.test(String(upiVpa).trim())) {
      return res.status(400).json({
        error: 'Invalid UPI ID',
        hint: 'Expected format like name@bank (e.g. 9999999999@upi)',
      });
    }
    const normalizedUpiApp = upiApp ? String(upiApp).toLowerCase() : null;
    const normalizedUpiVpa = upiVpa ? String(upiVpa).trim() : null;

    const CLIENT_ID      = process.env.PHONEPE_CLIENT_ID;
    const CLIENT_SECRET  = process.env.PHONEPE_CLIENT_SECRET;
    const CLIENT_VERSION = process.env.PHONEPE_CLIENT_VERSION || '1';
    const IS_PROD        = process.env.PHONEPE_ENV === 'production';

    if (!CLIENT_ID || !CLIENT_SECRET) {
      return res.status(500).json({ error: 'PhonePe credentials not configured' });
    }

    // ── Security Layer 2: Amount ALWAYS from Supabase — client cannot manipulate price ──
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Extract project ref (e.g. "abcd1234" from https://abcd1234.supabase.co) for diagnostics.
    // Safe to expose: it's already visible in the frontend's network tab via VITE_SUPABASE_URL.
    const serverProjectRef =
      (SUPABASE_URL || '').match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 'unset';

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ Supabase server env missing', {
        hasUrl: !!SUPABASE_URL,
        hasServiceKey: !!SUPABASE_SERVICE_ROLE_KEY,
      });
      return res.status(500).json({
        error: 'Server Supabase env not configured',
        hint: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel and redeploy.',
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Decode a couple of public fields from the service role JWT so we can tell, in production logs,
    // whether the env var is the right key for this project. We never log the signature.
    let serviceKeyDiagnostics = { keyProjectRef: 'unknown', role: 'unknown' };
    try {
      const payloadB64 = (SUPABASE_SERVICE_ROLE_KEY || '').split('.')[1] || '';
      // base64url → base64
      const padded = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
      const json = Buffer.from(padded, 'base64').toString('utf8');
      const payload = JSON.parse(json);
      serviceKeyDiagnostics = {
        keyProjectRef: payload.ref || 'unknown',
        role: payload.role || 'unknown',
      };
    } catch {
      // Not a JWT at all — likely an invalid value pasted into the env var.
    }

    const projectsMatch = serviceKeyDiagnostics.keyProjectRef === serverProjectRef;
    const roleIsServiceRole = serviceKeyDiagnostics.role === 'service_role';

    const { data: job, error: jobError } = await supabase
      .from('print_jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (jobError) {
      console.error('❌ Supabase job lookup error:', {
        jobId,
        serverProjectRef,
        serviceKeyDiagnostics,
        projectsMatch,
        roleIsServiceRole,
        error: jobError,
      });

      const reasons = [];
      if (!projectsMatch) {
        reasons.push(
          `SUPABASE_SERVICE_ROLE_KEY belongs to project "${serviceKeyDiagnostics.keyProjectRef}" but SUPABASE_URL points to "${serverProjectRef}". They must match.`
        );
      }
      if (!roleIsServiceRole) {
        reasons.push(
          `The JWT role is "${serviceKeyDiagnostics.role}" — it must be "service_role" (not "anon").`
        );
      }

      return res.status(500).json({
        error: 'Failed to load order',
        details: jobError.message || jobError.hint || jobError.code || JSON.stringify(jobError),
        code: jobError.code,
        hint: jobError.hint,
        name: jobError.name,
        serverProjectRef,
        keyProjectRef: serviceKeyDiagnostics.keyProjectRef,
        role: serviceKeyDiagnostics.role,
        projectsMatch,
        roleIsServiceRole,
        likelyCauses: reasons.length ? reasons : undefined,
      });
    }

    if (!job) {
      console.warn(
        '⚠️ Order not found in Supabase:',
        jobId,
        'on project:',
        serverProjectRef,
        '— check that this matches VITE_SUPABASE_URL.'
      );
      return res.status(404).json({
        error: 'Order not found',
        jobId,
        serverProjectRef,
        hint:
          'The server queried this Supabase project and got 0 rows. ' +
          'Confirm SUPABASE_URL (server) and VITE_SUPABASE_URL (client) point to the SAME project, ' +
          'and that SUPABASE_SERVICE_ROLE_KEY is the service_role key from that same project. ' +
          'Then redeploy.',
      });
    }

    // ── Security Layer 3: Validate job state — prevent duplicate/invalid payments ──
    if (job.payment_status === 'paid') {
      return res.status(400).json({ error: 'This order has already been paid' });
    }
    const jobStatus = job.job_status ?? job.status;
    if (jobStatus === 'cancelled') {
      return res.status(400).json({ error: 'This order has been cancelled' });
    }

    if (job.total_cost == null || Number.isNaN(Number(job.total_cost))) {
      return res.status(400).json({ error: 'Order has no valid amount' });
    }

    // Use DB values — client has zero control over amount or customer info
    const amount        = job.total_cost;
    const customerName  = job.customer_name;
    const customerEmail = job.customer_email ?? null;

    const baseURL = IS_PROD
      ? 'https://api.phonepe.com/apis/pg'
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

    // OAuth token endpoint lives on a DIFFERENT base path than /checkout/v2/*.
    // See PhonePe Standard Checkout v2 docs → Authorization.
    const AUTH_URL = process.env.PHONEPE_AUTH_URL || (IS_PROD
      ? 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token'
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token');

    // ── Get OAuth token ─────────────────────────────────────────────────────
    let token;
    try {
      token = await getPhonePeToken({
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        clientVersion: CLIENT_VERSION,
        authURL: AUTH_URL,
      });
    } catch (oauthErr) {
      console.error('❌ PhonePe OAuth failed in handler:', oauthErr);
      return res.status(502).json({
        error: 'PhonePe authentication failed',
        buildVersion: BUILD_VERSION,
        details: oauthErr.message,
        phonepeStatus: oauthErr.status,
        phonepeBody: oauthErr.body,
        authURL: oauthErr.authURL,
        env: IS_PROD ? 'production' : 'sandbox',
        clientVersionUsed: CLIENT_VERSION,
        hint:
          'Common causes: (1) PHONEPE_CLIENT_ID / PHONEPE_CLIENT_SECRET / PHONEPE_CLIENT_VERSION ' +
          'do not match what PhonePe issued, (2) PHONEPE_ENV=production but the credentials are ' +
          'for UAT (or vice-versa), (3) credentials not yet activated by PhonePe. ' +
          'Check Vercel env vars for stray whitespace and confirm the exact values in PhonePe ' +
          'Business Dashboard → Developer Settings → API Keys.',
      });
    }

    // ── Create unique merchant order ID ─────────────────────────────────────
    const merchantOrderId = `PG-${jobId.replace(/-/g, '').slice(0, 20)}-${Date.now().toString().slice(-8)}`;

    // PhonePe expects amount in paise (₹1 = 100 paise)
    const amountPaise = Math.round(parseFloat(amount) * 100);

    // ── Build payment-mode constraint ───────────────────────────────────────
    // 1. Named UPI app (PhonePe / GPay / Paytm) → restrict to Intent for that
    //    one app, so PhonePe's hosted page auto-launches it on mobile.
    // 2. UPI ID (VPA) → restrict to Collect flow; PhonePe will prompt the user
    //    to confirm the VPA on its page and push a collect request to it.
    // 3. Neither → fall back to all UPI flows (Intent + Collect + QR).
    let upiConstraint;
    if (normalizedUpiApp) {
      upiConstraint = { type: 'UPI', flows: ['INTENT'], apps: [normalizedUpiApp] };
    } else if (normalizedUpiVpa) {
      upiConstraint = { type: 'UPI', flows: ['COLLECT'] };
    } else {
      upiConstraint = { type: 'UPI', flows: ['INTENT', 'COLLECT', 'QR'] };
    }

    // ── Initiate payment ────────────────────────────────────────────────────
    const payload = {
      merchantOrderId,
      amount: amountPaise,
      expireAfter: 1200, // 20 minutes
      paymentFlow: {
        type: 'PG_CHECKOUT',
        message: 'PrintGet Print Order',
        merchantUrls: {
          redirectUrl: `${APP_URL}/payment/status/${jobId}?orderId=${merchantOrderId}`,
        },
        paymentModeConfig: {
          version: 'V2',
          enabledPaymentModes: [upiConstraint],
        },
      },
      // Skip the PhonePe login screen when we have the customer's mobile number on file.
      ...(job.customer_mobile
        ? { prefillUserLoginDetails: { phoneNumber: String(job.customer_mobile) } }
        : {}),
      // Stash the entered VPA in metaInfo for traceability (PhonePe v2 web has no
      // documented way to pre-fill it on the Collect page).
      ...(normalizedUpiVpa ? { metaInfo: { udf1: `vpa:${normalizedUpiVpa}` } } : {}),
    };

    const pgRes = await fetch(`${baseURL}/checkout/v2/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `O-Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const pgData = await pgRes.json();

    if (!pgRes.ok || pgData.state === 'FAILED') {
      console.error('❌ PhonePe initiation failed:', pgData);
      return res.status(502).json({
        error: 'PhonePe payment initiation failed',
        code: pgData.code,
        message: pgData.message,
      });
    }

    const redirectUrl = pgData?.redirectUrl;

    if (!redirectUrl) {
      console.error('❌ No redirectUrl in PhonePe response:', pgData);
      return res.status(502).json({ error: 'No redirect URL returned from PhonePe' });
    }

    // ── Save merchantOrderId to Supabase for webhook lookup ─────────────────
    await supabase
      .from('print_jobs')
      .update({ phonepe_merchant_txn_id: merchantOrderId, payment_method: 'PhonePe' })
      .eq('id', jobId);

    return res.status(200).json({
      success: true,
      redirectUrl,
      merchantOrderId,
    });

  } catch (error) {
    console.error('❌ PhonePe initiate error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      buildVersion: BUILD_VERSION,
      details: error.message,
    });
  }
}
