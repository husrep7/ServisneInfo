-- Zadnje poznato zdravlje svakog izvora, da se alarm šalje samo pri promjeni (#19)
CREATE TABLE IF NOT EXISTS scraper_alerts (
  source      VARCHAR(100) PRIMARY KEY,
  health      VARCHAR(10) NOT NULL,
  detail      TEXT,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
