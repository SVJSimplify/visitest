-- ============================================================================
-- Visitour 2.0 — Role assignment & seed data
-- ============================================================================
--
-- IMPORTANT: Roles MUST be set in app_metadata, never user_metadata.
-- The trigger in 003_functions.sql strips 'role' from user_metadata to
-- enforce this on every insert/update.
--
-- To create your first superadmin:
--
--   1. Sign up the user normally via the Supabase dashboard or app
--   2. Find their user id in Authentication → Users
--   3. Run:
--
--   update auth.users
--      set raw_app_meta_data = raw_app_meta_data || '{"role":"superadmin"}'::jsonb
--    where email = 'you@feis.school';
--
-- Repeat with role = 'admin' or 'security' for other staff.
--
-- After updating, the user must SIGN OUT and SIGN IN AGAIN for the new role
-- to appear in their JWT.
--
-- ============================================================================
-- Seed data (optional, edit before running)
-- ============================================================================

insert into public.staff (name, email, department) values
  ('Reception Desk', 'reception@feis.school', 'Admin'),
  ('Principal',      'principal@feis.school', 'Leadership')
on conflict do nothing;

-- Sample students (replace with real data)
-- insert into public.students (name, class, section, parent_phone, parent_name) values
--   ('Aarav Sharma', 'V',  'A', '9876543210', 'Rohan Sharma'),
--   ('Diya Patel',   'VII','B', '9123456780', 'Meera Patel');
