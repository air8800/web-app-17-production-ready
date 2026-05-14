// ── OAuth Token Cache ───────────────────────────────────────────────────────
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
  if (!res.ok || !data.access_token) throw new Error('Failed to get PhonePe token');
  cachedToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in - 60) * 1000;
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
    const IS_PROD        = process.env.PHONEPE_ENV === 'production';

    if (!MERCHANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
      return res.status(500).json({ error: 'PhonePe credentials not configured' });
    }

    const baseURL = IS_PROD
      ? 'https://api.phonepe.com/apis/pg'
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

    // ── Get OAuth token ─────────────────────────────────────────────────────
    const token = await getPhonePeToken(CLIENT_ID, CLIENT_SECRET, baseURL);

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
