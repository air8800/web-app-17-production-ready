/**
 * GET /api/version
 *
 * Tiny diagnostic endpoint to confirm which build of the API is live in Vercel.
 * Hit this in a browser:  https://www.printget.in/api/version
 *
 * If the response does NOT contain { build: "phonepe-v2-oauth-fix" }, then Vercel
 * is still serving an older deployment — wait for the latest build to finish,
 * or trigger a manual redeploy with build cache disabled.
 */

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    build: 'phonepe-v2-oauth-fix',
    deployedAt: '2026-05-16T02:00:00Z',
    git: {
      commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
      branch: process.env.VERCEL_GIT_COMMIT_REF || null,
      message: process.env.VERCEL_GIT_COMMIT_MESSAGE || null,
    },
    env: {
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasPhonePeClientId: !!process.env.PHONEPE_CLIENT_ID,
      hasPhonePeClientSecret: !!process.env.PHONEPE_CLIENT_SECRET,
      hasPhonePeMerchantId: !!process.env.PHONEPE_MERCHANT_ID,
      phonePeClientVersion: process.env.PHONEPE_CLIENT_VERSION || '1 (default)',
      phonePeEnv: process.env.PHONEPE_ENV || 'sandbox (default)',
      appUrl: process.env.APP_URL || null,
      phonePeAuthUrlOverride: process.env.PHONEPE_AUTH_URL || null,
    },
  });
}
