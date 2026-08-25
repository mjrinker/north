-- Accountability Partner feature tables

-- Invitations sent from one user to another
create table if not exists accountability_invitations (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_email text not null,
  invitee_id uuid references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  message text,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days')
);

-- Active partnerships between users
create table if not exists accountability_partnerships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  partner_id uuid not null references auth.users(id) on delete cascade,
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
-- Inviter can see their sent invitations
create policy "inviter can view sent invitations" on accountability_invitations
  for select using (inviter_id = auth.uid());

-- Invitee can see invitations sent to their email or user_id
create policy "invitee can view received invitations" on accountability_invitations
  for select using (
    invitee_email = (select email from auth.users where id = auth.uid())
    or invitee_id = auth.uid()
  );

-- Inviter can create invitations
create policy "inviter can create invitations" on accountability_invitations
  for insert with check (inviter_id = auth.uid());

-- Inviter can update their invitations (e.g., cancel)
create policy "inviter can update own invitations" on accountability_invitations
  for update using (inviter_id = auth.uid());

-- Invitee can accept/decline invitations
create policy "invitee can accept invitations" on accountability_invitations
  for update using (
    invitee_id = auth.uid()
    or (invitee_email = (select email from auth.users where id = auth.uid()) and invitee_id is null)
  );

-- Policies for accountability_partnerships
-- Users can see partnerships they're part of
create policy "users can view own partnerships" on accountability_partnerships
  for select using (user_id = auth.uid() or partner_id = auth.uid());

-- System creates partnerships (via trigger or service role)
create policy "service role can manage partnerships" on accountability_partnerships
  for all using (auth.role() = 'service_role');

-- Policies for shared_habits
-- Users can see shared habits for their partnerships
create policy "users can view shared habits" on shared_habits
  for select using (
    exists (
      select 1 from accountability_partnerships p
      where p.id = shared_habits.partnership_id
      and (p.user_id = auth.uid() or p.partner_id = auth.uid())
    )
  );

-- User (the one sharing) can manage shared habits
create policy "user can manage shared habits" on shared_habits
  for all using (
    exists (
      select 1 from accountability_partnerships p
      where p.id = shared_habits.partnership_id
      and p.user_id = auth.uid()
    )
  );

-- Indexes
create index if not exists idx_invitations_invitee_email on accountability_invitations(invitee_email);
create index if not exists idx_invitations_invitee_id on accountability_invitations(invitee_id);
create index if not exists idx_invitations_status on accountability_invitations(status);
create index if not exists idx_partnerships_user on accountability_partnerships(user_id);
create index if not exists idx_partnerships_partner on accountability_partnerships(partner_id);
create index if not exists idx_shared_habits_partnership on shared_habits(partnership_id);
create index if not exists idx_shared_habits_habit on shared_habits(habit_id);