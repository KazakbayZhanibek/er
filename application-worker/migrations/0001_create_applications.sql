CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('candidate', 'employer')),
  applicant_email TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  manager_status TEXT NOT NULL DEFAULT 'pending',
  acknowledgement_status TEXT NOT NULL DEFAULT 'not_required',
  manager_email_id TEXT,
  acknowledgement_email_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS applications_pending_idx
  ON applications (manager_status, acknowledgement_status, attempts, created_at);
