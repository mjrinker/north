-- Accountability Partner feature tables

-- Invitations sent from one user to another
create table if not exists accountability_invitations (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references users(id) on delete cascade,
  invitee_email text,
  invitee_id uuid references users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  message text,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days')
);

-- Active partnerships between users
create table if not exists accountability_partnerships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  partner_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, partner_id)
);

-- Which habits are shared with which partners
create table if not exists shared_habits (
  id uuid primary key default gen_random_uuid(),
  partnership_id uuid not null references accountability_partnerships(id) on delete cascade,
  habit_id uuid not null references habits(id) on delete cascade,
  shared_at timestamptz not null default now(),
  unique (partnership_id, habit_id)
);

-- Enable RLS
alter table accountability_invitations enable row level security;
alter table accountability_partnerships enable row level security;
alter table shared_habits enable row level security;

-- Policies for accountability_invitations
-- Allow all access (authorization handled in GraphQL layer)
create policy "allow all access" on accountability_invitations
  for all using (true);

create policy "allow all access" on accountability_partnerships
  for all using (true);

create policy "allow all access" on shared_habits
  for all using (true);

-- Indexes
create index if not exists idx_invitations_invitee_email on accountability_invitations(invitee_email);
create index if not exists idx_invitations_invitee_id on accountability_invitations(invitee_id);
create index if not exists idx_invitations_status on accountability_invitations(status);
create index if not exists idx_partnerships_user on accountability_partnerships(user_id);
create index if not exists idx_partnerships_partner on accountability_partnerships(partner_id);
create index if not exists idx_shared_habits_partnership on shared_habits(partnership_id);
create index if not exists idx_shared_habits_habit on shared_habits(habit_id);