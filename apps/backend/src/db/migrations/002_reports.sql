CREATE TABLE reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          incident_type NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  address       TEXT NOT NULL,
  municipality  VARCHAR(100) DEFAULT 'Sarajevo',
  reporter_name TEXT,
  contact       TEXT,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
