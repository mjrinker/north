-- Role definitions table for feature flag system
create table if not exists app_role_defs (
  name text primary key,
  label text not null,
  description text,
  features text[] not null default '{}',
  permissions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table app_role_defs enable row level security;

-- Admins can read all role definitions
create policy "admins can read role defs" on app_role_defs
  for select
  using (
    exists (
      select 1 from app_user_roles
      where user_id = auth.uid() and role_name = 'admin'
    )
  );

-- Admins can insert/update role definitions
create policy "admins can manage role defs" on app_role_defs
  for all
  using (
    exists (
      select 1 from app_user_roles
      where user_id = auth.uid() and role_name = 'admin'
    )
  );

-- Insert default roles
insert into app_role_defs (name, label, description, features, permissions) values
  ('default', 'Default', 'Standard user with no special access', '{}', '{}'),
  ('beta', 'Beta Tester', 'Access to preview features', '{"stats","beta"}', '{}'),
  ('admin', 'Admin', 'Full access to all features and user management', '{"stats","sync","beta"}', '{"access_admin","manage_roles"}')
on conflict (name) do update set
  label = excluded.label,
  description = excluded.description,
  features = excluded.features,
  permissions = excluded.permissions,
  updated_at = now();