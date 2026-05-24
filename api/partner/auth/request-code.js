import {
  cors,
  normalizeEmail,
  isValidEmail,
  generateOtpCode,
  getSupabaseAdmin,
  storeOtp,
  sendPartnerOtpEmail,
} from '../../lib/partnerAuthUtils.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address' });
    }

    const supabase = getSupabaseAdmin();

    // Rate limit: one code per email per 60 seconds
    const { data: existing } = await supabase
      .from('partner_otp')
      .select('created_at')
      .eq('email', email)
      .maybeSingle();

    if (existing?.created_at) {
      const ageMs = Date.now() - new Date(existing.created_at).getTime();
      if (ageMs < 60_000) {
        return res.status(429).json({
          success: false,
          error: 'Please wait a minute before requesting another code.',
        });
      }
    }

    const code = generateOtpCode();
    await storeOtp(supabase, email, code);
    await sendPartnerOtpEmail(email, code);

    console.log(`📧 Partner OTP sent to ${email}`);

    return res.status(200).json({
      success: true,
      message: 'Verification code sent from hello@printget.in',
    });
  } catch (error) {
    console.error('❌ partner/auth/request-code:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send verification code',
      details: error.message,
    });
  }
}
