import {
  cors,
  normalizeEmail,
  isValidEmail,
  getSupabaseAdmin,
  verifyStoredOtp,
  findOrCreateAuthUser,
  createSessionForEmail,
  checkNeedsOnboarding,
} from '../../lib/partnerAuthUtils.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || '').replace(/\D/g, '').slice(0, 6);

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address' });
    }
    if (code.length !== 6) {
      return res.status(400).json({ success: false, error: 'Enter the 6-digit code' });
    }

    const supabase = getSupabaseAdmin();

    const otpResult = await verifyStoredOtp(supabase, email, code);
    if (!otpResult.ok) {
      return res.status(401).json({ success: false, error: otpResult.error });
    }

    const user = await findOrCreateAuthUser(supabase, email);
    const sessionData = await createSessionForEmail(supabase, email);
    const needsOnboarding = await checkNeedsOnboarding(supabase, user.id);

    return res.status(200).json({
      success: true,
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      user: { id: user.id, email: user.email || email },
      needsOnboarding,
    });
  } catch (error) {
    console.error('❌ partner/auth/verify-code:', error);
    return res.status(500).json({
      success: false,
      error: 'Verification failed',
      details: error.message,
    });
  }
}
