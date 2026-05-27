/**
 * Partner auth router (single serverless function).
 * Rewrites preserve legacy paths:
 *   /api/partner/auth/request-code
 *   /api/partner/auth/verify-code
 *   /api/partner/auth/complete-signup
 */

import {
  cors,
  normalizeEmail,
  isValidEmail,
  generateOtpCode,
  getSupabaseAdmin,
  storeOtp,
  sendPartnerOtpEmail,
  verifyStoredOtp,
  findOrCreateAuthUser,
  createSessionForEmail,
  checkNeedsOnboarding,
  sendPartnerWelcomeEmail,
} from '../lib/partnerAuthUtils.js';

async function handleRequestCode(req, res) {
  const email = normalizeEmail(req.body?.email)
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email address' })
  }

  const supabase = getSupabaseAdmin()
  const { data: existing } = await supabase
    .from('partner_otp')
    .select('created_at')
    .eq('email', email)
    .maybeSingle()

  if (existing?.created_at) {
    const ageMs = Date.now() - new Date(existing.created_at).getTime()
    if (ageMs < 60_000) {
      return res.status(429).json({
        success: false,
        error: 'Please wait a minute before requesting another code.',
      })
    }
  }

  const code = generateOtpCode()
  await storeOtp(supabase, email, code)
  await sendPartnerOtpEmail(email, code)

  return res.status(200).json({
    success: true,
    message: 'Verification code sent from hello@printget.in',
  })
}

async function handleVerifyCode(req, res) {
  const email = normalizeEmail(req.body?.email)
  const code = String(req.body?.code || '').replace(/\D/g, '').slice(0, 6)

  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email address' })
  }
  if (code.length !== 6) {
    return res.status(400).json({ success: false, error: 'Enter the 6-digit code' })
  }

  const supabase = getSupabaseAdmin()
  const otpResult = await verifyStoredOtp(supabase, email, code)
  if (!otpResult.ok) {
    return res.status(401).json({ success: false, error: otpResult.error })
  }

  const user = await findOrCreateAuthUser(supabase, email)
  const sessionData = await createSessionForEmail(supabase, email)
  const needsOnboarding = await checkNeedsOnboarding(supabase, user.id)

  return res.status(200).json({
    success: true,
    access_token: sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token,
    user: { id: user.id, email: user.email || email },
    needsOnboarding,
  })
}

async function handleCompleteSignup(req, res) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return res.status(401).json({ success: false, error: 'Missing authorization token' })
  }

  const supabase = getSupabaseAdmin()
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user) {
    return res.status(401).json({ success: false, error: 'Invalid or expired session' })
  }

  const user = userData.user
  const body = req.body || {}
  const shopName = body.shopName?.trim() || ''
  const ownerName = body.name?.trim() || ''

  const { data: shops } = await supabase
    .from('shops')
    .select('id')
    .eq('owner_id', user.id)
    .limit(1)

  const shopId = shops?.[0]?.id || body.shopId || null

  if (user.email) {
    await sendPartnerWelcomeEmail(user.email, shopName, ownerName)
  }

  return res.status(200).json({
    success: true,
    shopId,
    message: 'Welcome email sent from hello@printget.in',
  })
}

export default async function handler(req, res) {
  if (cors(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const action = String(req.query.action || 'request-code')

  try {
    if (action === 'verify-code') return await handleVerifyCode(req, res)
    if (action === 'complete-signup') return await handleCompleteSignup(req, res)
    return await handleRequestCode(req, res)
  } catch (error) {
    console.error(`❌ partner/auth (${action}):`, error)
    return res.status(500).json({
      success: false,
      error: 'Partner auth request failed',
      details: error.message,
    })
  }
}
