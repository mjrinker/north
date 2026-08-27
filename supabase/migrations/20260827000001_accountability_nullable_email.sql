-- Make invitee_email nullable for shareable links without email
alter table accountability_invitations
  alter column invitee_email drop not null;