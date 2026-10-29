-- Enable PostGIS for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Incident types: water, electricity, gas, heating, internet
DO $$ BEGIN
  CREATE TYPE incident_type AS ENUM ('water', 'electricity', 'gas', 'heating', 'internet');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE incident_status AS ENUM ('active', 'resolved', 'scheduled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS incidents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          incident_type NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  source_url    TEXT,
  -- GeoJSON polygon of the affected area (SRID 4326 = WGS84)
  affected_area GEOMETRY(POLYGON, 4326),
  -- Raw address strings from source (for display)
  affected_addresses TEXT[],
  municipality  VARCHAR(100) DEFAULT 'Sarajevo',
  starts_at     TIMESTAMPTZ,
  ends_at       TIMESTAMPTZ,
  status        incident_status NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Spatial index — critical for fast geofence lookups
CREATE INDEX IF NOT EXISTS incidents_affected_area_gix ON incidents USING GIST (affected_area);
CREATE INDEX IF NOT EXISTS incidents_status_idx ON incidents (status);
CREATE INDEX IF NOT EXISTS incidents_type_idx ON incidents (type);

-- Push token registry: one row per device
CREATE TABLE IF NOT EXISTS device_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expo_token    TEXT NOT NULL UNIQUE,
  -- Last known location of the device
  last_lat      DOUBLE PRECISION,
  last_lng      DOUBLE PRECISION,
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Track which notifications were already sent (prevent duplicates)
CREATE TABLE IF NOT EXISTS sent_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  token_id    UUID NOT NULL REFERENCES device_tokens(id) ON DELETE CASCADE,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(incident_id, token_id)
);

-- Scraper run log
CREATE TABLE IF NOT EXISTS scraper_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source          VARCHAR(100) NOT NULL,
  incidents_found INTEGER NOT NULL DEFAULT 0,
  incidents_new   INTEGER NOT NULL DEFAULT 0,
  error           TEXT,
  ran_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
