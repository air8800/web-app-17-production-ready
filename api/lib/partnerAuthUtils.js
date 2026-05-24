import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

const FROM_EMAIL = process.env.EMAIL_USER || 'hello@printget.in';
const FROM_DOMAIN = (FROM_EMAIL.split('@')[1] || 'printget.in').toLowerCase();
const OTP_SECRET = process.env.PARTNER_OTP_SECRET || process.env.WEBHOOK_SECRET || 'printget-partner-otp';
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  pool: true,
  auth: {
    user: FROM_EMAIL,
    pass: process.env.EMAIL_PASS,
  },
});

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function generateOtpCode() {
  return String(crypto.randomInt(100000, 999999));
}

export function hashOtp(email, code) {
  return crypto.createHash('sha256').update(`${OTP_SECRET}:${email}:${code}`).digest('hex');
}

export async function storeOtp(supabase, email, code) {
  const { error } = await supabase.from('partner_otp').upsert(
    {
      email,
      code_hash: hashOtp(email, code),
      expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
      attempts: 0,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'email' }
  );
  if (error) throw error;
}

export async function verifyStoredOtp(supabase, email, code) {
  const { data: row, error } = await supabase
    .from('partner_otp')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (error) throw error;
  if (!row) return { ok: false, error: 'No verification code found. Request a new one.' };

  if (new Date(row.expires_at).getTime() < Date.now()) {
    await supabase.from('partner_otp').delete().eq('email', email);
    return { ok: false, error: 'Code expired. Request a new one.' };
  }

  if ((row.attempts || 0) >= MAX_ATTEMPTS) {
    await supabase.from('partner_otp').delete().eq('email', email);
    return { ok: false, error: 'Too many attempts. Request a new code.' };
  }

  if (row.code_hash !== hashOtp(email, code)) {
    await supabase
      .from('partner_otp')
      .update({ attempts: (row.attempts || 0) + 1 })
      .eq('email', email);
    return { ok: false, error: 'Invalid verification code.' };
  }

  await supabase.from('partner_otp').delete().eq('email', email);
  return { ok: true };
}

export async function findOrCreateAuthUser(supabase, email) {
  const { data: listed, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) throw listError;

  const existing = listed?.users?.find((u) => u.email?.toLowerCase() === email);
  if (existing) return existing;

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (createError) throw createError;
  return created.user;
}

export async function createSessionForEmail(supabase, email) {
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (linkError) throw linkError;

  const tokenHash = linkData?.properties?.hashed_token;
  if (!tokenHash) throw new Error('Could not generate auth session');

  const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'email',
  });
  if (sessionError) throw sessionError;
  if (!sessionData?.session) throw new Error('Could not establish session');

  return sessionData;
}

export async function checkNeedsOnboarding(supabase, userId) {
  const { data: shops } = await supabase
    .from('shops')
    .select('id, name, address, phone')
    .eq('owner_id', userId)
    .limit(1);

  if (!shops?.length) return true;
  const shop = shops[0];
  return !shop.name || !shop.address || !shop.phone;
}

function preheader(text) {
  return `<motionless style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f1f5f9;opacity:0;">${text}</motionless>`;
}

export async function sendPartnerOtpEmail(toEmail, code) {
  if (!process.env.EMAIL_PASS) {
    throw new Error('EMAIL_PASS is not configured on Vercel');
  }

  const subject = 'Your PrintGet verification code';
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:sans-serif;">
    ${preheader(`Your PrintGet verification code is ${code}. It expires in 10 minutes.`)}
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;"><tr><td align="center">
    <table width="100%" style="max-width:480px;background:#fff;border-radius:16px;overflow:hidden;">
      <tr><td style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:32px 24px;text-align:center;color:#fff;">
        <h1 style="margin:0;font-size:22px;">Verify your email</h1>
      </td></tr>
      <tr><td style="padding:28px 24px;">
        <p style="color:#1e293b;font-size:15px;">Enter this code in the desktop app:</p>
        <p style="text-align:center;font-size:36px;font-weight:800;letter-spacing:8px;color:#2563eb;">${code}</p>
        <p style="color:#64748b;font-size:13px;">Expires in 10 minutes.</p>
      </td></tr>
    </table></td></tr></table></body></html>`.replace(/<motionless/g, '<div').replace(/<\/motionless>/g, '</div>');

  await transporter.sendMail({
    from: `"PrintGet" <${FROM_EMAIL}>`,
    sender: FROM_EMAIL,
    replyTo: 'support@printget.in',
    to: toEmail,
    subject,
    text: `Your PrintGet verification code: ${code}\n\nExpires in 10 minutes.\n\n— PrintGet`,
    html,
    messageId: `<partner-otp.${Date.now()}@${FROM_DOMAIN}>`,
  });
}

export async function sendPartnerWelcomeEmail(toEmail, shopName, ownerName) {
  if (!process.env.EMAIL_PASS) {
    throw new Error('EMAIL_PASS is not configured on Vercel');
  }

  const subject = 'Welcome to PrintGet Shop Network';
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;"><tr><td align="center">
    <table width="100%" style="max-width:480px;background:#fff;border-radius:16px;overflow:hidden;">
      <tr><td style="background:linear-gradient(135deg,#0ea5e9,#3b82f6);padding:32px 24px;text-align:center;color:#fff;">
        <h1 style="margin:0;font-size:22px;">Welcome aboard!</h1>
      </td></tr>
      <tr><td style="padding:28px 24px;color:#1e293b;font-size:15px;line-height:1.6;">
        <p>Hi <strong>${ownerName || 'there'}</strong>,</p>
        <p><strong>${shopName || 'Your shop'}</strong> is now on PrintGet. Open the desktop app to connect printers and start receiving orders.</p>
      </td></tr>
    </table></td></tr></table></body></html>`;

  await transporter.sendMail({
    from: `"PrintGet" <${FROM_EMAIL}>`,
    sender: FROM_EMAIL,
    replyTo: 'support@printget.in',
    to: toEmail,
    subject,
    text: `Welcome to PrintGet!\n\nHi ${ownerName || 'there'},\n\n${shopName || 'Your shop'} is ready.\n\n— PrintGet`,
    html,
    messageId: `<partner-welcome.${Date.now()}@${FROM_DOMAIN}>`,
  });
}
