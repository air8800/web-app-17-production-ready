# Partner desktop signup — deploy checklist

API routes added for the PrintGet **desktop app** partner signup. All emails send from **`hello@printget.in`** (same SMTP as order emails).

## 1. Run SQL once in Supabase

Open Supabase → **SQL Editor** → run:

`supabase/migrations/20260524000000_partner_otp.sql`

(Lat/long on `shops` already exists — no action needed.)

## 2. Vercel env vars (you probably have these already)

| Variable | Value |
|----------|--------|
| `EMAIL_USER` | `hello@printget.in` |
| `EMAIL_PASS` | Gmail app password for hello@ |
| `SUPABASE_URL` | Same as production Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (server only) |
| `PARTNER_OTP_SECRET` | Optional random string (OTP hashing) |

## 3. Deploy this web app to Vercel

Push / redeploy. New endpoints:

| URL | Purpose |
|-----|---------|
| `POST /api/partner/auth/request-code` | Send 6-digit OTP email |
| `POST /api/partner/auth/verify-code` | Verify OTP → return Supabase session |
| `POST /api/partner/auth/complete-signup` | Send welcome email |

## 4. Test with curl

```bash
curl -X POST https://printget.in/api/partner/auth/request-code \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"you@example.com\"}"
```

Check inbox for code from **hello@printget.in**, then verify in desktop app.

## 5. Google OAuth (optional)

Supabase → Auth → URL Configuration → add redirect:

`https://printget.in/auth/desktop-callback`

Desktop opens Google in browser; user lands on `/auth/desktop-callback` after sign-in.

## Files added

- `api/lib/partnerAuthUtils.js` — shared mail + OTP + Supabase session
- `api/partner/auth/request-code.js`
- `api/partner/auth/verify-code.js`
- `api/partner/auth/complete-signup.js`
- `src/pages/DesktopAuthCallbackPage.jsx`
- `supabase/migrations/20260524000000_partner_otp.sql`
