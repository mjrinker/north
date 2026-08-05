-- Per-user API keys for external automation (e.g. iOS Shortcuts).
-- An API key in the x-api-key header resolves to a specific user_id so that
-- data resolvers scope to the owning user (the legacy __api__ mapping was
-- replaced by this real-user binding).
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- The API uses the service_role key.
CREATE POLICY "service_role_all_api_keys" ON api_keys
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON api_keys (user_id);