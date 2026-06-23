CREATE TABLE IF NOT EXISTS user_sync_data (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  collection TEXT NOT NULL,
  record_id TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, collection, record_id)
);

ALTER TABLE user_sync_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sync data"
  ON user_sync_data FOR ALL
  USING (auth.uid() = user_id);
