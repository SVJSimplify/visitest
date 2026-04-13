-- ============================================================================
-- Visitour 2.0 — Functions, Triggers, RPCs
-- Fixes: #3 race condition, #4 atomic check-in, #9 stale visitors,
--        #10 expiry, #11 dedupe, #25 audit logs, #26 watchlist matching
-- Implements features: 1, 2, 3, 4, 6
-- ============================================================================

-- ── Helper: log admin login (issue #25, replaces client-side insert) ─────────
create or replace function public.log_login()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.last_sign_in_at is distinct from old.last_sign_in_at then
    insert into public.admin_logs(user_id, email, role)
    values (
      new.id,
      new.email,
      new.raw_app_meta_data ->> 'role'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_login on auth.users;
create trigger trg_log_login
  after update on auth.users
  for each row
  execute function public.log_login();

-- ── Helper: strip role from user_metadata (issue #1) ─────────────────────────
-- Belt and braces. RLS already prevents privilege escalation, but this trigger
-- nukes any 'role' key in user_metadata so it can never be confused with
-- app_metadata anywhere in the codebase.
create or replace function public.strip_role_from_user_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raw_user_meta_data ? 'role' then
    new.raw_user_meta_data = new.raw_user_meta_data - 'role';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_strip_role on auth.users;
create trigger trg_strip_role
  before insert or update on auth.users
  for each row
  execute function public.strip_role_from_user_metadata();

-- ============================================================================
-- check_in_visitor — atomic check-in (issue #3, #4)
-- ============================================================================
-- Returns the visitor row on success, or raises an exception on failure.
-- Caller passes the photo URL up front so the row goes from PENDING → INSIDE
-- in a single transaction with no orphan window.
create or replace function public.check_in_visitor(
  p_token uuid,
  p_photo_url text default null,
  p_gate text default null
)
returns public.visitors
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.visitors;
begin
  if not public.is_security() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Atomic update: only proceed if scan_count is still 0 AND not expired.
  update public.visitors
     set scan_count   = 1,
         status       = 'INSIDE',
         checked_in_at = now(),
         photo_url    = coalesce(p_photo_url, photo_url),
         gate         = coalesce(p_gate, gate)
   where qr_token   = p_token
     and scan_count = 0
     and valid_until > now()
     and watchlist_hit = false
   returning * into v;

  if v.id is null then
    -- Diagnose why
    select * into v from public.visitors where qr_token = p_token;
    if v.id is null then
      raise exception 'qr_not_found' using errcode = 'P0001';
    elsif v.scan_count > 0 then
      raise exception 'already_used' using errcode = 'P0002';
    elsif v.valid_until <= now() then
      raise exception 'qr_expired' using errcode = 'P0003';
    elsif v.watchlist_hit then
      raise exception 'watchlist_blocked' using errcode = 'P0004';
    else
      raise exception 'check_in_failed' using errcode = 'P0005';
    end if;
  end if;

  -- Feature #2: queue host notification
  if v.host_staff_id is not null then
    insert into public.notification_queue(staff_id, visitor_id, channel, payload)
    select v.host_staff_id, v.id, 'email',
           jsonb_build_object(
             'visitor_name', v.name,
             'visitor_phone', v.phone,
             'purpose', v.purpose,
             'gate', v.gate,
             'checked_in_at', v.checked_in_at
           )
    where exists (select 1 from public.staff where id = v.host_staff_id and active = true);
  end if;

  return v;
end;
$$;

-- ============================================================================
-- check_out_visitor — atomic checkout
-- ============================================================================
create or replace function public.check_out_visitor(
  p_token uuid,
  p_checkout_photo_url text default null
)
returns public.visitors
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.visitors;
begin
  if not public.is_security() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.visitors
     set scan_count        = 2,
         status            = 'LEFT',
         checked_out_at    = now(),
         checkout_photo_url = coalesce(p_checkout_photo_url, checkout_photo_url)
   where qr_token   = p_token
     and scan_count = 1
     and status     = 'INSIDE'
   returning * into v;

  if v.id is null then
    select * into v from public.visitors where qr_token = p_token;
    if v.id is null then
      raise exception 'qr_not_found' using errcode = 'P0001';
    elsif v.scan_count >= 2 then
      raise exception 'already_checked_out' using errcode = 'P0006';
    else
      raise exception 'check_out_failed' using errcode = 'P0005';
    end if;
  end if;

  return v;
end;
$$;

-- ============================================================================
-- create_visitor — single safe entry point for visitor self-registration
-- Fixes #20 (orphan photo): photo URL is passed AFTER upload but BEFORE row
-- exists (we check the URL belongs to this token's expected path in client).
-- ============================================================================
create or replace function public.create_visitor(
  p_role text,
  p_name text,
  p_phone text,
  p_purpose text,
  p_meet text,
  p_notes text,
  p_photo_url text default null,
  p_invite_token text default null
)
returns public.visitors
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.visitors;
  inv public.invites;
  hit boolean;
  host uuid;
begin
  -- Validation
  if length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'invalid_name' using errcode = 'P0010';
  end if;
  if p_phone !~ '^[0-9]{10}$' then
    raise exception 'invalid_phone' using errcode = 'P0011';
  end if;
  if length(trim(coalesce(p_purpose, ''))) < 2 then
    raise exception 'invalid_purpose' using errcode = 'P0012';
  end if;
  if p_role not in ('Visitor','Parent') then
    raise exception 'invalid_role' using errcode = 'P0013';
  end if;

  -- Issue #11 dedupe: block if same phone has an active INSIDE/PENDING visitor
  -- created in last 10 minutes.
  if exists (
    select 1 from public.visitors
     where phone = p_phone
       and status in ('PENDING','INSIDE')
       and created_at > now() - interval '10 minutes'
  ) then
    raise exception 'duplicate_active' using errcode = 'P0014';
  end if;

  -- Watchlist check (feature #3)
  select exists(
    select 1 from public.watchlist
     where active = true
       and (
         (phone is not null and phone = p_phone)
         or (name_pattern is not null and lower(p_name) like lower(name_pattern))
       )
  ) into hit;

  -- If invite token provided, validate and pull host
  if p_invite_token is not null then
    select * into inv
      from public.invites
     where token = p_invite_token
       and used = false
       and valid_from <= now()
       and valid_until > now();
    if inv.id is null then
      raise exception 'invalid_invite' using errcode = 'P0015';
    end if;
    host := inv.host_staff_id;
  end if;

  insert into public.visitors(
    role, name, phone, purpose, meet, notes, photo_url,
    invite_id, host_staff_id, watchlist_hit
  ) values (
    p_role, trim(p_name), p_phone, trim(p_purpose),
    nullif(trim(coalesce(p_meet,'')),''),
    nullif(trim(coalesce(p_notes,'')),''),
    p_photo_url, inv.id, host, coalesce(hit, false)
  )
  returning * into v;

  -- Mark invite used
  if inv.id is not null then
    update public.invites set used = true, used_visitor_id = v.id where id = inv.id;
  end if;

  return v;
end;
$$;

-- Allow anon to call create_visitor (the function itself does validation).
revoke all on function public.create_visitor(text,text,text,text,text,text,text,text) from public;
grant execute on function public.create_visitor(text,text,text,text,text,text,text,text) to anon, authenticated;

-- ============================================================================
-- get_invite_by_token — anonymous public lookup
-- ============================================================================
create or replace function public.get_invite_by_token(p_token text)
returns table (
  id uuid,
  visitor_name text,
  visitor_phone text,
  purpose text,
  host_name text,
  valid_until timestamptz,
  used boolean
)
language sql
security definer
set search_path = public
as $$
  select i.id, i.visitor_name, i.visitor_phone, i.purpose,
         s.name as host_name, i.valid_until, i.used
    from public.invites i
    left join public.staff s on s.id = i.host_staff_id
   where i.token = p_token;
$$;

grant execute on function public.get_invite_by_token(text) to anon, authenticated;

-- ============================================================================
-- get_visitor_history — show prior visits by phone (feature #4)
-- ============================================================================
create or replace function public.get_visitor_history(p_phone text)
returns table (
  total_visits bigint,
  last_visit_at timestamptz,
  last_purpose text
)
language sql
security definer
set search_path = public
as $$
  select count(*)::bigint as total_visits,
         max(checked_in_at) as last_visit_at,
         (array_agg(purpose order by checked_in_at desc nulls last))[1] as last_purpose
    from public.visitors
   where phone = p_phone
     and checked_in_at is not null;
$$;

grant execute on function public.get_visitor_history(text) to authenticated;

-- ============================================================================
-- get_student_by_parent_phone — feature #8
-- ============================================================================
create or replace function public.get_student_by_parent_phone(p_phone text)
returns table (
  student_name text,
  student_class text,
  student_section text
)
language sql
security definer
set search_path = public
as $$
  select name, class, section
    from public.students
   where parent_phone = p_phone
     and active = true;
$$;

grant execute on function public.get_student_by_parent_phone(text) to authenticated;

-- ============================================================================
-- daily_report — feature #6
-- ============================================================================
create or replace function public.daily_report(p_date date default current_date)
returns table (
  date date,
  total_visitors bigint,
  inside_now bigint,
  checked_out bigint,
  peak_hour int,
  peak_count bigint,
  by_gate jsonb,
  by_purpose jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  start_ts timestamptz := p_date::timestamptz;
  end_ts   timestamptz := (p_date + 1)::timestamptz;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  with day as (
    select * from public.visitors
     where created_at >= start_ts and created_at < end_ts
  ),
  hourly as (
    select extract(hour from checked_in_at)::int as h, count(*) as c
      from day where checked_in_at is not null
     group by 1 order by 2 desc limit 1
  ),
  gates as (
    select coalesce(gate,'unknown') as g, count(*) as c
      from day group by 1
  ),
  purposes as (
    select purpose as p, count(*) as c
      from day group by 1 order by 2 desc limit 10
  )
  select
    p_date,
    (select count(*) from day),
    (select count(*) from day where status = 'INSIDE'),
    (select count(*) from day where status = 'LEFT'),
    coalesce((select h from hourly), 0),
    coalesce((select c from hourly), 0),
    coalesce((select jsonb_object_agg(g, c) from gates), '{}'::jsonb),
    coalesce((select jsonb_object_agg(p, c) from purposes), '{}'::jsonb);
end;
$$;

grant execute on function public.daily_report(date) to authenticated;

-- ============================================================================
-- expire_stale_visitors — issue #9, #10
-- Auto-marks visitors LEFT after 12h INSIDE, EXPIRED if PENDING > 8h.
-- Schedule via pg_cron or call from admin UI.
-- ============================================================================
create or replace function public.expire_stale_visitors()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
begin
  with f as (
    update public.visitors
       set status = 'FORCED_OUT',
           checked_out_at = now()
     where status = 'INSIDE'
       and checked_in_at < now() - interval '12 hours'
    returning 1
  )
  select count(*) into n from f;

  update public.visitors
     set status = 'EXPIRED'
   where status = 'PENDING'
     and valid_until < now();

  return n;
end;
$$;

grant execute on function public.expire_stale_visitors() to authenticated;
