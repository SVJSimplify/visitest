-- ============================================================================
-- Visitour 2.0.2 — Storage bucket and policies
-- Run AFTER 005_fixes.sql.
-- ============================================================================
-- Creates the visitor-photos bucket and the policies allowing anon/authenticated
-- to upload (their own photo during registration) and read (publicly via QR).
--
-- Equivalent to clicking through Supabase Dashboard → Storage → New bucket →
-- Policies, but as a single SQL block you can paste in the SQL editor.
-- ============================================================================

-- Create bucket if it doesn't exist
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'visitor-photos',
  'visitor-photos',
  true,
  5242880,                           -- 5 MB
  array['image/jpeg','image/jpg']::text[]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── Storage policies ────────────────────────────────────────────────────────
-- Drop and recreate so this script is idempotent.

drop policy if exists "visitor photos: anon upload"  on storage.objects;
drop policy if exists "visitor photos: public read"  on storage.objects;
drop policy if exists "visitor photos: staff delete" on storage.objects;

-- Anyone can upload to the bucket (the create_visitor RPC validates
-- the corresponding row first, so orphan uploads are limited).
create policy "visitor photos: anon upload"
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'visitor-photos'
    and (storage.foldername(name))[1] in ('entry','exit','signup')
  );

-- Public read so the admin dashboard, scanner, and printable badge can
-- display photos via the public URL without needing auth tokens in image src.
create policy "visitor photos: public read"
  on storage.objects for select
  to anon, authenticated
  using ( bucket_id = 'visitor-photos' );

-- Only admins can delete photos (cleanup, GDPR-style takedowns).
create policy "visitor photos: staff delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'visitor-photos'
    and public.is_admin()
  );
