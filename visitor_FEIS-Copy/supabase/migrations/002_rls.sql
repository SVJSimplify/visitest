-- ============================================================================
-- Visitour 2.0 — Row Level Security
-- Fixes original issues #1, #6, #7, #25
-- ============================================================================

-- ── Enable RLS on every table ────────────────────────────────────────────────
alter table public.visitors           enable row level security;
alter table public.staff              enable row level security;
alter table public.students           enable row level security;
alter table public.invites            enable row level security;
alter table public.watchlist          enable row level security;
alter table public.admin_logs         enable row level security;
alter table public.gates              enable row level security;
alter table public.notification_queue enable row level security;

-- ── Helper: role check via app_metadata (NOT user_metadata) ──────────────────
-- Issue #1: roles must live in app_metadata which is not user-writable.
create or replace function public.current_role()
returns text
language sql
stable
security definer
as $$
  select coalesce(
    auth.jwt() -> 'app_metadata' ->> 'role',
    'visitor'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
as $$ select public.current_role() in ('security','admin','superadmin'); $$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$ select public.current_role() in ('admin','superadmin'); $$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
as $$ select public.current_role() = 'superadmin'; $$;

create or replace function public.is_security()
returns boolean
language sql
stable
as $$ select public.current_role() in ('security','superadmin'); $$;

-- ============================================================================
-- visitors
-- ============================================================================
-- Anonymous users can ONLY insert new pending rows. They cannot read or update.
-- Security/admin can read and update.

drop policy if exists "anon insert pending visitor" on public.visitors;
create policy "anon insert pending visitor"
  on public.visitors
  for insert
  to anon, authenticated
  with check (
    status = 'PENDING'
    and scan_count = 0
    and checked_in_at is null
    and checked_out_at is null
    and watchlist_hit = false
  );

drop policy if exists "staff read visitors" on public.visitors;
create policy "staff read visitors"
  on public.visitors
  for select
  to authenticated
  using ( public.is_staff() );

drop policy if exists "security update visitors" on public.visitors;
create policy "security update visitors"
  on public.visitors
  for update
  to authenticated
  using ( public.is_security() or public.is_admin() );

drop policy if exists "admin delete visitors" on public.visitors;
create policy "admin delete visitors"
  on public.visitors
  for delete
  to authenticated
  using ( public.is_admin() );

-- ============================================================================
-- staff
-- ============================================================================
drop policy if exists "anon read active staff" on public.staff;
create policy "anon read active staff"
  on public.staff
  for select
  to anon, authenticated
  using ( active = true );

drop policy if exists "admin manage staff" on public.staff;
create policy "admin manage staff"
  on public.staff
  for all
  to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );

-- ============================================================================
-- students
-- ============================================================================
drop policy if exists "staff read students" on public.students;
create policy "staff read students"
  on public.students
  for select
  to authenticated
  using ( public.is_staff() );

drop policy if exists "anon lookup own student by phone" on public.students;
-- Allow anon to look up by phone match only via RPC, not direct select.

drop policy if exists "admin manage students" on public.students;
create policy "admin manage students"
  on public.students
  for all
  to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );

-- ============================================================================
-- invites
-- ============================================================================
drop policy if exists "anon read invite by token" on public.invites;
-- Reads only via RPC, not direct select.

drop policy if exists "admin manage invites" on public.invites;
create policy "admin manage invites"
  on public.invites
  for all
  to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );

-- ============================================================================
-- watchlist
-- ============================================================================
drop policy if exists "admin manage watchlist" on public.watchlist;
create policy "admin manage watchlist"
  on public.watchlist
  for all
  to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );

drop policy if exists "security read watchlist" on public.watchlist;
create policy "security read watchlist"
  on public.watchlist
  for select
  to authenticated
  using ( public.is_staff() );

-- ============================================================================
-- admin_logs
-- ============================================================================
-- Issue #25: NO insert from client. Only superadmin can read.
drop policy if exists "superadmin read admin logs" on public.admin_logs;
create policy "superadmin read admin logs"
  on public.admin_logs
  for select
  to authenticated
  using ( public.is_superadmin() );

-- No insert policy → no client can write. Trigger does it.

-- ============================================================================
-- gates
-- ============================================================================
drop policy if exists "everyone read active gates" on public.gates;
create policy "everyone read active gates"
  on public.gates
  for select
  to anon, authenticated
  using ( active = true );

drop policy if exists "admin manage gates" on public.gates;
create policy "admin manage gates"
  on public.gates
  for all
  to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );

-- ============================================================================
-- notification_queue
-- ============================================================================
-- No client policies. Only the service role (used by Edge Function) touches it.
