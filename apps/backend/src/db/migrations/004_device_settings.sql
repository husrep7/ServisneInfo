-- Postavke i adrese uređaja (U2). Uređaj = red u device_tokens, a njegov id je tokenId (KTD1).

-- Push token postaje opcion: uređaj se registruje i bez dozvole za push
ALTER TABLE device_tokens ALTER COLUMN expo_token DROP NOT NULL;

-- Lokacija je opt-in (KTD11); podsjetnik u minutama, NULL = isključen; isključeni tipovi usluga
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS location_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS reminder_minutes INTEGER DEFAULT 60;
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS muted_types incident_type[] NOT NULL DEFAULT '{}';

DO $$ BEGIN
  ALTER TABLE device_tokens ADD CONSTRAINT device_tokens_reminder_chk
    CHECK (reminder_minutes IS NULL OR reminder_minutes BETWEEN 1 AND 1440);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS device_addresses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id  UUID NOT NULL REFERENCES device_tokens(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  address    TEXT NOT NULL,
  -- Tačka koju je korisnik potvrdio ili pomjerio na mapi (KTD12)
  location   GEOMETRY(POINT, 4326) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS device_addresses_location_gix ON device_addresses USING GIST (location);
CREATE INDEX IF NOT EXISTS device_addresses_device_idx   ON device_addresses (device_id);
