-- Prijave v2: tačka, prijavilac, IP hash, potvrda i veza na incident (U10)
ALTER TABLE reports ADD COLUMN IF NOT EXISTS location     GEOMETRY(POINT, 4326);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS reporter_key TEXT;
-- Sirova IP adresa se ne čuva, samo HMAC sa tajnom soli (KTD7)
ALTER TABLE reports ADD COLUMN IF NOT EXISTS ip_hash      TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS channel      VARCHAR(10) NOT NULL DEFAULT 'web';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS confirmed_by VARCHAR(10);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS incident_id  UUID REFERENCES incidents(id) ON DELETE SET NULL;
-- Tiho odbačena prijava (blokiran prijavilac ili preko limita) — čuva se, ali nikad nije javna (KTD9)
ALTER TABLE reports ADD COLUMN IF NOT EXISTS suppressed   VARCHAR(20);

DO $$ BEGIN
  ALTER TABLE reports ADD CONSTRAINT reports_status_chk
    CHECK (status IN ('pending', 'confirmed', 'rejected', 'expired'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE reports ADD CONSTRAINT reports_channel_chk CHECK (channel IN ('web', 'mobile'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE reports ADD CONSTRAINT reports_confirmed_by_chk CHECK (confirmed_by IN ('auto', 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS reports_location_gix     ON reports USING GIST (location);
CREATE INDEX IF NOT EXISTS reports_status_created   ON reports (status, created_at);
CREATE INDEX IF NOT EXISTS reports_reporter_created ON reports (reporter_key, created_at);
CREATE INDEX IF NOT EXISTS reports_ip_created       ON reports (ip_hash, created_at);
CREATE INDEX IF NOT EXISTS reports_incident_idx     ON reports (incident_id);

CREATE TABLE IF NOT EXISTS blocked_reporters (
  reporter_key TEXT PRIMARY KEY,
  reason       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Porijeklo incidenta: službeni izvor (scraper) ili potvrđena prijava korisnika (KTD5)
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS origin VARCHAR(10) NOT NULL DEFAULT 'official';
DO $$ BEGIN
  ALTER TABLE incidents ADD CONSTRAINT incidents_origin_chk CHECK (origin IN ('official', 'user'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
