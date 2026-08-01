-- Profile fields on custom users
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;

-- Roles for custom users (new backend). Kept separate from the legacy
-- user_roles table which references auth.users for the old Supabase mode.
CREATE TABLE IF NOT EXISTS app_user_roles (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, role_name)
);

ALTER TABLE app_user_roles ENABLE ROW LEVEL SECURITY;

-- The API uses the service_role key.
CREATE POLICY "service_role_all_app_user_roles" ON app_user_roles
  FOR ALL
  USING (true)
  WITH CHECK (true);
