-- Zona prekida je unija krugova oko svake ulice, a ne konveksni omotač svih ulica (ADR-0006).
-- Obavijest ViK-a nabraja ulice po cijelom gradu; omotač oko njih je pokrivao pola Sarajeva i
-- javljao "bez vode na vašoj lokaciji" ljudima daleko od radova. Kolona zato prima i
-- MultiPolygon; prijave građana i dalje prave jedan Polygon.
ALTER TABLE incidents ALTER COLUMN affected_area TYPE GEOMETRY(GEOMETRY, 4326);

DO $$ BEGIN
  ALTER TABLE incidents ADD CONSTRAINT incidents_affected_area_type_chk
    CHECK (affected_area IS NULL OR GeometryType(affected_area) IN ('POLYGON', 'MULTIPOLYGON'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Službene obavijesti koje su još aktuelne dobijaju novu zonu (jobs/backfill.job.ts)
UPDATE incidents SET affected_area = NULL, geocode_attempted_at = NULL
 WHERE origin = 'official' AND status <> 'resolved' AND affected_area IS NOT NULL;
