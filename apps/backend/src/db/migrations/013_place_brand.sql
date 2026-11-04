-- Brend objekta iz OSM-a (brand, pa operator): bankomat se često zove samo "Bankomat",
-- a banka mu je u operator oznaci. Web po brendu prikazuje logo banke.
ALTER TABLE places ADD COLUMN IF NOT EXISTS brand TEXT;

-- Postojeći objekti nemaju brend: sljedeći start ih uveze ponovo (jobs/places.job.ts)
UPDATE places SET updated_at = NOW() - INTERVAL '2 days';
