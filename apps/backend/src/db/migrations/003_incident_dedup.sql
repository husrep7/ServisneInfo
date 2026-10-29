-- Stabilan ključ za deduplikaciju (source + naslov + početak) umjesto poređenja naslova u 24h prozoru
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS dedup_key TEXT;
-- Kada je obavijest zadnji put viđena na izvoru — incident bez ends_at je aktivan dok god je objavljen
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS incidents_dedup_key_uidx ON incidents (dedup_key);
