-- OTP storage for desktop partner email signup (hello@printget.in)
CREATE TABLE IF NOT EXISTS partner_otp (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_otp_expires ON partner_otp (expires_at);

-- Service role only — desktop API routes use SUPABASE_SERVICE_ROLE_KEY
ALTER TABLE partner_otp ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE partner_otp IS 'Hashed 6-digit OTP codes for PrintGet desktop partner signup';
