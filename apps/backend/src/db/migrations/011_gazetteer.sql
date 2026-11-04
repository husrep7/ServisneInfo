-- Lokalni registar ulica i naselja Kantona iz OpenStreetMapa (ADR-0004). Pretraga mjesta
-- ("pošta kod Ferhadije") i geokodiranje ulica iz obavijesti idu prvo ovdje, a javni
-- Nominatim samo kad naziv nije pronađen.

CREATE TABLE IF NOT EXISTS gazetteer (
  name       TEXT NOT NULL,
  -- Normalizovan naziv bez dijakritika i padežnih završetaka ("ferhadij", "kralj tvrtk")
  name_stem  TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('street', 'area')),
  -- Ulica: središta svih njenih segmenata; naselje: jedna tačka
  location   GEOMETRY(MULTIPOINT, 4326) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (name, kind)
);

CREATE INDEX IF NOT EXISTS gazetteer_stem_idx ON gazetteer (name_stem text_pattern_ops);
CREATE INDEX IF NOT EXISTS gazetteer_location_gix ON gazetteer USING GIST (location);
