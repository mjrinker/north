-- Fix infinite RLS recursion on user_roles and admins tables.
-- The "Admins can manage all roles" policy on user_roles queried user_roles
-- to check for the 'admin' role, causing infinite recursion.
--
-- Fix: use a SECURITY DEFINER function that bypasses RLS to check admin status.

-- Create a SECURITY DEFINER helper that checks the admins table without RLS.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (SELECT 1 FROM admins WHERE email = auth.email());
$$;

-- Drop the recursive policies on user_roles
DROP POLICY IF EXISTS "Admins can manage all roles" ON user_roles;

-- Recreate using the safe helper
CREATE POLICY "Admins can manage all roles"
  ON user_roles FOR ALL
  USING (is_admin());

-- Drop the recursive policies on admins (which also queried user_roles)
DROP POLICY IF EXISTS "Admins can read admins" ON admins;
DROP POLICY IF EXISTS "Admins can manage admins" ON admins;

CREATE POLICY "Admins can read admins"
  ON admins FOR SELECT
  USING (auth.email() = email OR is_admin());

CREATE POLICY "Admins can manage admins"
  ON admins FOR ALL
  USING (is_admin());
