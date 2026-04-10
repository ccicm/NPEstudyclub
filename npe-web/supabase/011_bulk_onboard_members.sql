-- Bulk onboard known members into approved_users.
-- Replace sample rows with real member data before running.
-- Safe to rerun: existing emails are updated to approved.

insert into public.approved_users (email, full_name, status)
values
  ('member1@example.com', 'Member One', 'approved'),
  ('member2@example.com', 'Member Two', 'approved'),
  ('member3@example.com', 'Member Three', 'approved'),
  ('member4@example.com', 'Member Four', 'approved'),
  ('member5@example.com', 'Member Five', 'approved'),
  ('member6@example.com', 'Member Six', 'approved')
on conflict (email)
do update set
  full_name = excluded.full_name,
  status = 'approved';
