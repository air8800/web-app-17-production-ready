/**
 * POST /api/phonepe-warm
 * Pre-fetches OAuth token so /api/phonepe-initiate is faster on Submit.
 */
let cachedToken = null;
let tokenExpiresAt = 0;

async function getPhonePeToken({ clientId, clientSecret, clientVersion, authURL }) {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

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

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(data.message || 'PhonePe OAuth warm failed');
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const CLIENT_ID = process.env.PHONEPE_CLIENT_ID;
    const CLIENT_SECRET = process.env.PHONEPE_CLIENT_SECRET;
    const CLIENT_VERSION = process.env.PHONEPE_CLIENT_VERSION || '1';
    const IS_PROD = process.env.PHONEPE_ENV === 'production';

    if (!CLIENT_ID || !CLIENT_SECRET) {
      return res.status(500).json({ ok: false, error: 'Not configured' });
    }

    const AUTH_URL = process.env.PHONEPE_AUTH_URL || (IS_PROD
      ? 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token'
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token');

    await getPhonePeToken({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      clientVersion: CLIENT_VERSION,
      authURL: AUTH_URL,
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(200).json({ ok: false });
  }
}
