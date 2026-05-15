import { createClient } from '@supabase/supabase-js';

// Build marker — bump this string in every code change so you can verify which
// deployment Vercel is serving. Echoed in every response from this handler.
const BUILD_VERSION = 'phonepe-v2-full-checkout-2026-05-16';

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
 *
 * Creates a PhonePe Standard Checkout v2 payment session and returns the
 * redirectUrl. The client redirects the user there; PhonePe's hosted page
 * presents the full payment method UI (UPI apps + Card + Net Banking), which
 * is responsive across desktop, tablet, and mobile.
 *
 * Security hardened:
 *  - Amount + customer info are ALWAYS read from Supabase, never from the body.
 *  - Origin is verified against an allowlist.
 *  - Job state is validated (no double-pay, no cancelled-order pay).
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
    const { jobId } = req.body || {};

    if (!jobId) {
      return res.status(400).json({ error: 'Missing required field: jobId' });
    }

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
        buildVersion: BUILD_VERSION,
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
        buildVersion: BUILD_VERSION,
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

    // Use DB values — client has zero control over amount.
    const amount = job.total_cost;

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
    // PhonePe constraint: max 63 chars, only [a-zA-Z0-9_-].
    const merchantOrderId = `PG-${jobId.replace(/-/g, '').slice(0, 20)}-${Date.now().toString().slice(-8)}`;

    // PhonePe expects amount in paise (₹1 = 100 paise)
    const amountPaise = Math.round(parseFloat(amount) * 100);

    // ── Initiate payment ────────────────────────────────────────────────────
    //
    // We deliberately omit `paymentModeConfig` so PhonePe's hosted page shows
    // its full responsive UI: UPI apps (PhonePe / Google Pay / Paytm / Apps &
    // UPI QR), Debit/Credit Card, and Net Banking. PhonePe's page adapts itself
    // to desktop, tablet, and mobile — we don't need to pre-select a method.
    //
    // If we ever need to restrict modes again (e.g. UPI-only for low-ticket
    // orders), add:
    //   paymentModeConfig: {
    //     version: 'V2',
    //     enabledPaymentModes: [{ type: 'UPI' }, { type: 'CARD' }, { type: 'NET_BANKING' }],
    //   }
    // See: https://developer.phonepe.com/payment-gateway/website-integration/standard-checkout/api-integration/api-reference/create-payment/configure-payment-modes
    const payload = {
      merchantOrderId,
      amount: amountPaise,
      expireAfter: 1200, // 20 minutes
      paymentFlow: {
        type: 'PG_CHECKOUT',
        message: 'PrintGet Print Order',
        merchantUrls: {
          // Route must match an actual React Router path in src/App.jsx.
          // PaymentPage detects the `orderId` query param and calls
          // /api/phonepe-status to server-verify the result.
          redirectUrl: `${APP_URL}/payment/${jobId}?orderId=${merchantOrderId}`,
        },
      },
      // Skip the PhonePe login screen when we have the customer's phone on file.
      // Schema column is `customer_phone` (NOT customer_mobile).
      ...(job.customer_phone
        ? { prefillUserLoginDetails: { phoneNumber: String(job.customer_phone) } }
        : {}),
      // Stash the internal jobId for traceability via PhonePe's status/webhook payloads.
      metaInfo: { udf1: `jobId:${jobId}` },
    };

    const pgRes = await fetch(`${baseURL}/checkout/v2/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `O-Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const pgRawText = await pgRes.text();
    let pgData = {};
    try { pgData = JSON.parse(pgRawText); } catch { /* non-JSON */ }

    if (!pgRes.ok || pgData.state === 'FAILED') {
      console.error('❌ PhonePe initiation failed:', {
        status: pgRes.status,
        body: pgData && Object.keys(pgData).length ? pgData : pgRawText?.slice(0, 500),
      });
      return res.status(502).json({
        error: 'PhonePe payment initiation failed',
        buildVersion: BUILD_VERSION,
        code: pgData.code,
        message: pgData.message,
        phonepeStatus: pgRes.status,
        phonepeBody: pgData,
      });
    }

    const redirectUrl = pgData?.redirectUrl;

    if (!redirectUrl) {
      console.error('❌ No redirectUrl in PhonePe response:', pgData);
      return res.status(502).json({
        error: 'No redirect URL returned from PhonePe',
        buildVersion: BUILD_VERSION,
        phonepeBody: pgData,
      });
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
