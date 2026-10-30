-- Evidencija poslanih obavijesti po trojci (prekid, uređaj, korak) — KTD3, R12
-- Postojeći zapisi su bile obavijesti pri objavi, pa dobijaju korak "najava"
ALTER TABLE sent_notifications ADD COLUMN IF NOT EXISTS step VARCHAR(10) NOT NULL DEFAULT 'announce';

DO $$ BEGIN
  ALTER TABLE sent_notifications ADD CONSTRAINT sent_notifications_step_chk
    CHECK (step IN ('announce', 'reminder', 'start'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE sent_notifications DROP CONSTRAINT IF EXISTS sent_notifications_incident_id_token_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS sent_notifications_step_uidx
  ON sent_notifications (incident_id, token_id, step);
