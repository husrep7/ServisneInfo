-- Objekti u blizini (ADR-0004): bankomati, pumpe, pošte, apoteke i banke iz OpenStreetMapa.
-- Uvoze se jednom dnevno za cijeli Kanton (jobs/places.job.ts), pa pretraga "u blizini" ide
-- iz naše baze umjesto upita prema javnom Overpass serveru za svakog korisnika.

CREATE TABLE IF NOT EXISTS places (
  osm_id        TEXT PRIMARY KEY,           -- "node/123", "way/456"
  category      TEXT NOT NULL CHECK (category IN ('atm', 'fuel', 'post', 'pharmacy', 'bank')),
  name          TEXT NOT NULL,
  address       TEXT,
  opening_hours TEXT,
  -- Banka koja ima bankomat (OSM atm=yes) pojavljuje se i u pretrazi bankomata
  has_atm       BOOLEAN NOT NULL DEFAULT false,
  location      GEOMETRY(POINT, 4326) NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS places_location_gix ON places USING GIST (location);
CREATE INDEX IF NOT EXISTS places_category_idx ON places (category);
