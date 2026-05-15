// ── OAuth Token Cache ───────────────────────────────────────────────────────
let cachedToken = null;
let tokenExpiresAt = 0;

// PhonePe Standard Checkout v2 OAuth — see comment in api/phonepe-initiate.js.
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
  if (typeof data.expires_at === 'number') {
    tokenExpiresAt = data.expires_at * 1000 - 60_000;
  } else if (typeof data.expires_in === 'number') {
    tokenExpiresAt = now + (data.expires_in - 60) * 1000;
  } else {
    tokenExpiresAt = now + 25 * 60 * 1000;
  }
  return cachedToken;
}

/**
 * GET /api/phonepe-status?orderId=PG-xxx
 * Server-side verification of a PhonePe order status.
 * Always call this after PhonePe redirects the user back — never trust URL params alone.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orderId } = req.query;

    if (!orderId) {
      return res.status(400).json({ error: 'Missing orderId query param' });
    }

    const MERCHANT_ID    = process.env.PHONEPE_MERCHANT_ID;
    const CLIENT_ID      = process.env.PHONEPE_CLIENT_ID;
    const CLIENT_SECRET  = process.env.PHONEPE_CLIENT_SECRET;
    const CLIENT_VERSION = process.env.PHONEPE_CLIENT_VERSION || '1';
    const IS_PROD        = process.env.PHONEPE_ENV === 'production';

    if (!MERCHANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
      return res.status(500).json({ error: 'PhonePe credentials not configured' });
    }

    const baseURL = IS_PROD
      ? 'https://api.phonepe.com/apis/pg'
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

    const AUTH_URL = process.env.PHONEPE_AUTH_URL || (IS_PROD
      ? 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token'
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token');

    // ── Get OAuth token ─────────────────────────────────────────────────────
    const token = await getPhonePeToken({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      clientVersion: CLIENT_VERSION,
      authURL: AUTH_URL,
    });

    // ── Fetch order status ──────────────────────────────────────────────────
    const statusRes = await fetch(
      `${baseURL}/checkout/v2/order/${encodeURIComponent(orderId)}/status`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `O-Bearer ${token}`,
        },
      }
    );

    const data = await statusRes.json();

    console.log('📊 PhonePe status check:', JSON.stringify(data));

    const isSuccess = data?.state === 'COMPLETED';
    const amountRupees = data?.amount ? data.amount / 100 : null;

    return res.status(200).json({
      success: isSuccess,
      state: data?.state,               // COMPLETED | FAILED | PENDING
      merchantOrderId: data?.merchantOrderId,
      phonePeOrderId: data?.orderId,
      amount: amountRupees,
      paymentMethod: data?.paymentDetails?.[0]?.paymentMode || null,
      errorCode: data?.errorCode || null,
      message: data?.message || null,
    });

  } catch (error) {
    console.error('❌ PhonePe status check error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
