import { createClient } from '@supabase/supabase-js';

// ── PhonePe OAuth Token Cache ───────────────────────────────────────────────
let cachedToken = null;
let tokenExpiresAt = 0;

async function getPhonePeToken(clientId, clientSecret, baseURL) {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) return cachedToken;

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`${baseURL}/v1/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'openid' }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    console.error('❌ PhonePe token error:', data);
    throw new Error(data.error_description || 'Failed to get PhonePe OAuth token');
  }

  cachedToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in - 60) * 1000;
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
    const { jobId, customerMobile } = req.body;

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
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: job, error: jobError } = await supabase
      .from('print_jobs')
      .select('id, total_cost, payment_status, job_status, customer_name, customer_email')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // ── Security Layer 3: Validate job state — prevent duplicate/invalid payments ──
    if (job.payment_status === 'paid') {
      return res.status(400).json({ error: 'This order has already been paid' });
    }
    if (job.job_status === 'cancelled') {
      return res.status(400).json({ error: 'This order has been cancelled' });
    }

    // Use DB values — client has zero control over amount or customer info
    const amount        = job.total_cost;
    const customerName  = job.customer_name;
    const customerEmail = job.customer_email;

    const baseURL = IS_PROD
      ? 'https://api.phonepe.com/apis/pg'
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

    // ── Get OAuth token ─────────────────────────────────────────────────────
    const token = await getPhonePeToken(CLIENT_ID, CLIENT_SECRET, baseURL);

    // ── Create unique merchant order ID ─────────────────────────────────────
    const merchantOrderId = `PG-${jobId.replace(/-/g, '').slice(0, 20)}-${Date.now().toString().slice(-8)}`;

    // PhonePe expects amount in paise (₹1 = 100 paise)
    const amountPaise = Math.round(parseFloat(amount) * 100);

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
      },
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
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
