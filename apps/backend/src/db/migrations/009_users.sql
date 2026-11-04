-- Korisnički računi (ADR-0003): email + lozinka ili Google prijava, sesije i reset lozinke.
-- Tokeni (sesija, reset) se čuvaju samo kao SHA-256 hash; sirovi token zna samo klijent.

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL,
  name          TEXT,
  -- NULL za račune napravljene samo preko Googlea
  password_hash TEXT,
  google_sub    TEXT UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_uidx ON users (lower(email));

CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON user_sessions (user_id);

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets (user_id);

-- Naknadno geokodiranje (jobs/backfill.job.ts): kad je pokušano, da se ista obavijest ne
-- pokušava u svakom krugu
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS geocode_attempted_at TIMESTAMPTZ;
