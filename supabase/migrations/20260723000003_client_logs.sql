-- Table for client-side remote logs (browser console capture)
-- Used to debug iOS Safari crash in production

CREATE TABLE client_logs (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  level TEXT NOT NULL DEFAULT 'log',
  message TEXT NOT NULL,
  stack TEXT,
  url TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Allow inserts for anon role (no auth required for logging)
ALTER TABLE client_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert logs"
  ON client_logs FOR INSERT
  WITH CHECK (true);

-- Only authenticated users can see logs (for reading later)
CREATE POLICY "Authenticated users can view logs"
  ON client_logs FOR SELECT
  USING (auth.role() = 'authenticated');
