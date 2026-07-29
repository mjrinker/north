CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Only the service_role can manage users; the API uses the service_role key.
CREATE POLICY "service_role_all" ON users
  FOR ALL
  USING (true)
  WITH CHECK (true);
