-- The app now supports two backends:
--   * legacy mode writes user_id from Supabase auth.users
--   * new mode writes user_id from the custom users table
-- A single FK cannot cover both, so relax these to plain UUID columns.
-- RLS is bypassed by the API's service_role key; app-level ownership checks
-- still use user_id equality in every resolver.
ALTER TABLE habits DROP CONSTRAINT IF EXISTS habits_user_id_fkey;
ALTER TABLE entries DROP CONSTRAINT IF EXISTS entries_user_id_fkey;
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_user_id_fkey;
ALTER TABLE identities DROP CONSTRAINT IF EXISTS identities_user_id_fkey;
ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS user_settings_user_id_fkey;
