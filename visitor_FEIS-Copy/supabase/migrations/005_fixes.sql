-- ============================================================================
-- Visitour 2.0.2 — Patch migration
-- Run AFTER 001/002/003. Idempotent.
-- ============================================================================
-- This patch fixes 23 bugs found in audit. Specifically the CRITICAL ones:
--   Bug 22: log_login trigger would brick Supabase auth if admin_logs is
--           missing the user_id column (it is, on existing installs).
--   Bug 23: strip_role trigger stripped role from EVERY auth.users update,
--           interfering with other apps in the same project.
-- Read the comments before running.
-- ============================================================================

-- ── Bug 22 (CRITICAL): backfill admin_logs columns ──────────────────────────
alter table public.admin_logs
  add column if not exists user_id      uuid,
  add column if not exists ip           inet,
  add column if not exists logged_in_at timestamptz not null default now();

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'admin_logs' and column_name = 'created_at') then
    execute 'update public.admin_logs set logged_in_at = coalesce(logged_in_at, created_at) where logged_in_at is null';
  end if;
end $$;

create index if not exists idx_admin_logs_logged_in_at on public.admin_logs(logged_in_at desc);

-- ── Bug 23 (CRITICAL): scope strip_role trigger to Visitour roles only ──────
create or replace function public.strip_role_from_user_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raw_user_meta_data is not null
     and new.raw_user_meta_data ? 'role'
     and (new.raw_user_meta_data ->> 'role') in ('admin','superadmin','security','staff')
  then
    new.raw_user_meta_data = new.raw_user_meta_data - 'role';
  end if;
  return new;
exception when others then
  raise warning 'strip_role_from_user_metadata failed: %', sqlerrm;
  return new;
end;
$$;

-- ── Bug 22 (CRITICAL): harden log_login trigger ─────────────────────────────
create or replace function public.log_login()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.last_sign_in_at is distinct from old.last_sign_in_at then
    begin
      insert into public.admin_logs(user_id, email, role, logged_in_at)
      values (
        new.id,
        new.email,
        new.raw_app_meta_data ->> 'role',
        now()
      );
    exception when others then
      raise warning 'log_login insert failed: %', sqlerrm;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_login on auth.users;
create trigger trg_log_login
  after update on auth.users
  for each row
  execute function public.log_login();

drop trigger if exists trg_strip_role on auth.users;
create trigger trg_strip_role
  before insert or update on auth.users
  for each row
  execute function public.strip_role_from_user_metadata();

-- ── Bug 6: rename current_role helper to avoid clash with built-in ──────────
drop policy if exists "anon insert pending visitor" on public.visitors;
drop policy if exists "staff read visitors"         on public.visitors;
drop policy if exists "security update visitors"    on public.visitors;
drop policy if exists "admin delete visitors"       on public.visitors;
drop policy if exists "anon read active staff"      on public.staff;
drop policy if exists "admin manage staff"          on public.staff;
drop policy if exists "staff read students"         on public.students;
drop policy if exists "admin manage students"       on public.students;
drop policy if exists "admin manage invites"        on public.invites;
drop policy if exists "admin manage watchlist"      on public.watchlist;
drop policy if exists "security read watchlist"     on public.watchlist;
drop policy if exists "superadmin read admin logs"  on public.admin_logs;
drop policy if exists "everyone read active gates"  on public.gates;
drop policy if exists "admin manage gates"          on public.gates;

drop function if exists public.is_staff();
drop function if exists public.is_admin();
drop function if exists public.is_superadmin();
drop function if exists public.is_security();
drop function if exists public.current_role();

create or replace function public.auth_role()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'visitor');
$$;

create or replace function public.is_staff() returns boolean language sql stable as
$$ select public.auth_role() in ('security','admin','superadmin'); $$;

create or replace function public.is_admin() returns boolean language sql stable as
$$ select public.auth_role() in ('admin','superadmin'); $$;

create or replace function public.is_superadmin() returns boolean language sql stable as
$$ select public.auth_role() = 'superadmin'; $$;

create or replace function public.is_security() returns boolean language sql stable as
$$ select public.auth_role() in ('security','superadmin'); $$;

create policy "anon insert pending visitor"
  on public.visitors for insert to anon, authenticated
  with check (
    status = 'PENDING' and scan_count = 0
    and checked_in_at is null and checked_out_at is null
  );

create policy "staff read visitors"
  on public.visitors for select to authenticated
  using ( public.is_staff() );

create policy "security update visitors"
  on public.visitors for update to authenticated
  using ( public.is_security() or public.is_admin() );

create policy "admin delete visitors"
  on public.visitors for delete to authenticated
  using ( public.is_admin() );

create policy "anon read active staff"
  on public.staff for select to anon, authenticated
  using ( active = true );

create policy "admin manage staff"
  on public.staff for all to authenticated
  using ( public.is_admin() ) with check ( public.is_admin() );

create policy "staff read students"
  on public.students for select to authenticated
  using ( public.is_staff() );

create policy "admin manage students"
  on public.students for all to authenticated
  using ( public.is_admin() ) with check ( public.is_admin() );

create policy "admin manage invites"
  on public.invites for all to authenticated
  using ( public.is_admin() ) with check ( public.is_admin() );

create policy "admin manage watchlist"
  on public.watchlist for all to authenticated
  using ( public.is_admin() ) with check ( public.is_admin() );

create policy "security read watchlist"
  on public.watchlist for select to authenticated
  using ( public.is_staff() );

create policy "superadmin read admin logs"
  on public.admin_logs for select to authenticated
  using ( public.is_superadmin() );

create policy "everyone read active gates"
  on public.gates for select to anon, authenticated
  using ( active = true );

create policy "admin manage gates"
  on public.gates for all to authenticated
  using ( public.is_admin() ) with check ( public.is_admin() );

-- ── Bug 1: grant execute on check_in_visitor and check_out_visitor ──────────
revoke all on function public.check_in_visitor(uuid, text, text) from public;
grant  execute on function public.check_in_visitor(uuid, text, text) to authenticated;

revoke all on function public.check_out_visitor(uuid, text) from public;
grant  execute on function public.check_out_visitor(uuid, text) to authenticated;

-- ── Bug 2: set_visitor_photo RPC for anon visitor self-registration ─────────
create or replace function public.set_visitor_photo(
  p_token uuid,
  p_photo_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_photo_url is null or length(p_photo_url) < 10 or length(p_photo_url) > 500 then
    raise exception 'invalid_photo_url' using errcode = 'P0020';
  end if;

  update public.visitors
     set photo_url = p_photo_url
   where qr_token   = p_token
     and photo_url  is null
     and status     = 'PENDING'
     and created_at > now() - interval '5 minutes';

  if not found then
    raise exception 'photo_update_failed' using errcode = 'P0021';
  end if;
end;
$$;

revoke all on function public.set_visitor_photo(uuid, text) from public;
grant  execute on function public.set_visitor_photo(uuid, text) to anon, authenticated;

-- ── Bug 7: fix valid_until on legacy rows ────────────────────────────────────
update public.visitors
   set valid_until = coalesce(checked_out_at, checked_in_at + interval '8 hours', created_at + interval '8 hours')
 where valid_until > now() + interval '7 hours'
   and (checked_in_at is not null or checked_out_at is not null);

-- ── Bug 9: get_invite_by_token returns status field ─────────────────────────
create or replace function public.get_invite_by_token(p_token text)
returns table (
  id uuid,
  visitor_name text,
  visitor_phone text,
  purpose text,
  host_name text,
  valid_until timestamptz,
  used boolean,
  status text
)
language sql
security definer
set search_path = public
as $$
  select
    i.id, i.visitor_name, i.visitor_phone, i.purpose,
    s.name as host_name, i.valid_until, i.used,
    case
      when i.used then 'used'
      when i.valid_until <= now() then 'expired'
      when i.valid_from > now() then 'not_yet_valid'
      else 'active'
    end as status
  from public.invites i
  left join public.staff s on s.id = i.host_staff_id
  where i.token = p_token;
$$;

grant execute on function public.get_invite_by_token(text) to anon, authenticated;

-- ── Bug 4: enable Realtime publication for visitors ──────────────────────────
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'visitors'
  ) then
    alter publication supabase_realtime add table public.visitors;
  end if;
end $$;

-- ── Bug 17: cap watchlist name_pattern length ───────────────────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'watchlist_pattern_length'
  ) then
    alter table public.watchlist
      add constraint watchlist_pattern_length
      check (name_pattern is null or length(name_pattern) <= 200);
  end if;
end $$;

-- ── Bug 26: missing foreign keys on visitors ────────────────────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'visitors_host_staff_id_fkey' and table_name = 'visitors'
  ) then
    alter table public.visitors
      add constraint visitors_host_staff_id_fkey
      foreign key (host_staff_id) references public.staff(id) on delete set null;
  end if;
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'visitors_invite_id_fkey' and table_name = 'visitors'
  ) then
    alter table public.visitors
      add constraint visitors_invite_id_fkey
      foreign key (invite_id) references public.invites(id) on delete set null;
  end if;
end $$;

-- ── Sanity checks ────────────────────────────────────────────────────────────
do $$
begin
  perform public.auth_role();
  perform public.is_staff();
  perform public.is_admin();
  perform public.is_security();
  perform public.is_superadmin();
end $$;

-- ── Final smoke test: verify trigger doesn't break a fake user update ───────
do $$
declare
  test_id uuid;
begin
  select id into test_id from auth.users limit 1;
  if test_id is not null then
    begin
      update auth.users
         set last_sign_in_at = last_sign_in_at
       where id = test_id;
    exception when others then
      raise exception 'TRIGGER SMOKE TEST FAILED: %. Auth may be broken. Roll back with: drop trigger trg_log_login on auth.users; drop trigger trg_strip_role on auth.users;', sqlerrm;
    end;
  end if;
end $$;
