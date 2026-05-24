import {
  cors,
  getSupabaseAdmin,
  sendPartnerWelcomeEmail,
} from '../../lib/partnerAuthUtils.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ success: false, error: 'Missing authorization token' });
    }

    const supabase = getSupabaseAdmin();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return res.status(401).json({ success: false, error: 'Invalid or expired session' });
    }

    const user = userData.user;
    const body = req.body || {};
    const shopName = body.shopName?.trim() || '';
    const ownerName = body.name?.trim() || '';

    const { data: shops } = await supabase
      .from('shops')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1);

    const shopId = shops?.[0]?.id || body.shopId || null;

    if (user.email) {
      await sendPartnerWelcomeEmail(user.email, shopName, ownerName);
      console.log(`📧 Partner welcome email sent to ${user.email}`);
    }

    return res.status(200).json({
      success: true,
      shopId,
      message: 'Welcome email sent from hello@printget.in',
    });
  } catch (error) {
    console.error('❌ partner/auth/complete-signup:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to complete signup',
      details: error.message,
    });
  }
}
