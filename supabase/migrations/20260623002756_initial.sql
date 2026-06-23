CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, role_name)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own roles"
  ON user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON user_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles AS ur
      WHERE ur.user_id = auth.uid()
      AND ur.role_name = 'admin'
    )
  );

CREATE TABLE IF NOT EXISTS admins (
  email TEXT PRIMARY KEY
);

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read admins"
  ON admins FOR SELECT
  USING (auth.email() = email OR auth.uid() IN (SELECT user_id FROM user_roles WHERE role_name = 'admin'));

CREATE POLICY "Admins can manage admins"
  ON admins FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles AS ur
      WHERE ur.user_id = auth.uid()
      AND ur.role_name = 'admin'
    )
  );

INSERT INTO admins (email) VALUES ('mjrinker@gmail.com')
ON CONFLICT (email) DO NOTHING;

CREATE OR REPLACE FUNCTION get_all_users_with_roles()
RETURNS TABLE (id UUID, email TEXT, roles TEXT[])
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role_name = 'admin'
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT
    au.id,
    au.email::TEXT,
    COALESCE(ARRAY_AGG(ur.role_name) FILTER (WHERE ur.role_name IS NOT NULL), '{}'::TEXT[])
  FROM auth.users au
  LEFT JOIN user_roles ur ON ur.user_id = au.id
  GROUP BY au.id, au.email;
END;
$$;
