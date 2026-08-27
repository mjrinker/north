-- Fix foreign keys to reference public users table instead of auth.users
alter table accountability_invitations
  drop constraint if exists accountability_invitations_inviter_id_fkey,
  add constraint accountability_invitations_inviter_id_fkey foreign key (inviter_id) references users(id) on delete cascade;

alter table accountability_invitations
  drop constraint if exists accountability_invitations_invitee_id_fkey,
  add constraint accountability_invitations_invitee_id_fkey foreign key (invitee_id) references users(id) on delete cascade;

alter table accountability_partnerships
  drop constraint if exists accountability_partnerships_user_id_fkey,
  add constraint accountability_partnerships_user_id_fkey foreign key (user_id) references users(id) on delete cascade;

alter table accountability_partnerships
  drop constraint if exists accountability_partnerships_partner_id_fkey,
  add constraint accountability_partnerships_partner_id_fkey foreign key (partner_id) references users(id) on delete cascade;