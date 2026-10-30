-- Izvor (naziv scrapera) službenog prekida, da bi se planiran prekid koji izvor više ne
-- objavljuje mogao prepoznati kao povučen (KTD4). Stari redovi ga dobiju pri sljedećem scrapeu.
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS source VARCHAR(100);
CREATE INDEX IF NOT EXISTS incidents_source_status_idx ON incidents (source, status);
CREATE INDEX IF NOT EXISTS scraper_runs_source_ran_idx ON scraper_runs (source, ran_at DESC);
