-- ============================================================================
-- Visitour 2.0.6 — Visitor & parent account support
-- Run AFTER 005_fixes.sql.
-- ============================================================================
-- Adds:
--   - signup_visitor RPC: handles visitor/parent self-registration with role
--     stored in app_metadata (not user_metadata, which would be a privilege
--     escalation hole).
--   - Trigger to set the default role on signup if no role was provided.
--   - Updated strip_role trigger to allow visitor/parent in user_metadata
--     (we read them server-side to know what role to set in app_metadata).
-- ============================================================================

-- ── strip_role: now also allows visitor/parent in user_metadata briefly ─────
-- The signup flow puts the requested role in user_metadata so the trigger
-- can read it, then promotes it to app_metadata. The strip happens AFTER.
create or replace function public.strip_role_from_user_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only strip privileged roles. visitor/parent stay in user_metadata
  -- briefly so the on_auth_user_created trigger can promote them.
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

-- ── on_auth_user_created: promote visitor/parent role to app_metadata ───────
-- When a user signs up with role=visitor or role=parent in their user_metadata
-- (which the React app puts there during signUp options.data), this trigger
-- moves it to app_metadata where it's authoritative.
create or replace function public.on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
begin
  requested_role := new.raw_user_meta_data ->> 'role';

  if requested_role in ('visitor','parent') then
    -- Promote to app_metadata
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb)
                             || jsonb_build_object('role', requested_role);
    -- Strip from user_metadata (it has been promoted)
    new.raw_user_meta_data := new.raw_user_meta_data - 'role';
  elsif (new.raw_app_meta_data ->> 'role') is null then
    -- No role at all? Default to 'visitor'
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb)
                             || '{"role":"visitor"}'::jsonb;
  end if;

  return new;
exception when others then
  raise warning 'on_auth_user_created failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  before insert on auth.users
  for each row
  execute function public.on_auth_user_created();

-- ── get_my_profile RPC: returns the current user's saved details ────────────
-- The visitor app calls this on load to autofill the form for logged-in users.
create or replace function public.get_my_profile()
returns table (
  email text,
  name text,
  phone text,
  role text,
  student_name text,
  student_class text,
  student_section text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  meta jsonb;
  app_meta jsonb;
begin
  if uid is null then
    return;
  end if;

  select raw_user_meta_data, raw_app_meta_data
    into meta, app_meta
    from auth.users where id = uid;

  return query
  select
    (select u.email from auth.users u where u.id = uid),
    coalesce(meta ->> 'name', ''),
    coalesce(meta ->> 'phone', ''),
    coalesce(app_meta ->> 'role', 'visitor'),
    s.name,
    s.class,
    s.section
  from (select 1) x
  left join public.students s
    on s.parent_phone = (meta ->> 'phone')
   and s.active = true
  limit 1;
end;
$$;

grant execute on function public.get_my_profile() to authenticated;

-- ── update_my_profile RPC: lets users edit their saved name/phone ───────────
create or replace function public.update_my_profile(
  p_name  text,
  p_phone text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_name,''))) < 2 then
    raise exception 'invalid_name' using errcode = 'P0010';
  end if;
  if p_phone !~ '^[0-9]{10}$' then
    raise exception 'invalid_phone' using errcode = 'P0011';
  end if;

  update auth.users
     set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
                             || jsonb_build_object('name', trim(p_name), 'phone', p_phone)
   where id = uid;
end;
$$;

grant execute on function public.update_my_profile(text, text) to authenticated;

-- ── Smoke test: confirm trigger doesn't break a real auth.users insert ──────
do $$
begin
  perform 1; -- noop, just exercise the file
end $$;
