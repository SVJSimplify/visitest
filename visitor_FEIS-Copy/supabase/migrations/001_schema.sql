-- ============================================================================
-- Visitour 2.0 — Schema
-- Run in Supabase SQL editor in this order: 001 → 003 → 005 → 006 → 002
-- ============================================================================

-- ── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ── visitors ─────────────────────────────────────────────────────────────────
-- Main check-in/out table.
create table if not exists public.visitors (
  id              bigserial primary key,
  qr_token        uuid        not null default uuid_generate_v4() unique,
  role            text        not null check (role in ('Visitor','Parent')),
  name            text        not null,
  phone           text        not null,
  purpose         text        not null,
  meet            text,
  notes           text,
  photo_url       text,
  checkout_photo_url text,                       -- Issue #8: checkout face match
  scan_count      smallint    not null default 0,
  status          text        not null default 'PENDING' check (status in ('PENDING','INSIDE','LEFT','EXPIRED','FORCED_OUT')),
  gate            text,                          -- Feature #5: multi-gate
  invite_id       uuid,                          -- Feature #1: pre-registration
  host_staff_id   uuid,                          -- Feature #2: host notify
  watchlist_hit   boolean     not null default false, -- Feature #3
  valid_until     timestamptz not null default (now() + interval '8 hours'), -- Issue #10
  checked_in_at   timestamptz,
  checked_out_at  timestamptz,
  created_at      timestamptz not null default now()
);

-- ── Add new columns to existing visitors tables ─────────────────────────────
-- If the visitors table existed before this migration (from the old HTML app),
-- create-table-if-not-exists will have skipped it and the new columns won't
-- be present. Add them explicitly so the indexes below succeed.
alter table public.visitors
  add column if not exists checkout_photo_url text,
  add column if not exists gate               text,
  add column if not exists invite_id          uuid,
  add column if not exists host_staff_id      uuid,
  add column if not exists watchlist_hit      boolean not null default false,
  add column if not exists valid_until        timestamptz not null default (now() + interval '8 hours');

-- The existing status check constraint on the old table might be missing
-- the new statuses (EXPIRED, FORCED_OUT). Drop and recreate it.
do $$
begin
  -- Find and drop any existing status check constraint
  perform 1 from pg_constraint
   where conrelid = 'public.visitors'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%status%';
  if found then
    execute (
      select 'alter table public.visitors drop constraint ' || quote_ident(conname)
        from pg_constraint
       where conrelid = 'public.visitors'::regclass
         and contype = 'c'
         and pg_get_constraintdef(oid) ilike '%status%'
       limit 1
    );
  end if;
exception when others then
  raise warning 'Could not drop existing status constraint: %', sqlerrm;
end $$;

alter table public.visitors
  add constraint visitors_status_check
  check (status in ('PENDING','INSIDE','LEFT','EXPIRED','FORCED_OUT'));

create index if not exists idx_visitors_qr_token       on public.visitors(qr_token);
create index if not exists idx_visitors_phone          on public.visitors(phone);
create index if not exists idx_visitors_status         on public.visitors(status);
create index if not exists idx_visitors_created_at     on public.visitors(created_at desc);
create index if not exists idx_visitors_checked_in_at  on public.visitors(checked_in_at desc);
create index if not exists idx_visitors_host_staff_id  on public.visitors(host_staff_id);

-- ── staff ────────────────────────────────────────────────────────────────────
-- Feature #2: people visitors can come to meet, who get notified.
create table if not exists public.staff (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  email       text,
  phone       text,
  department  text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists idx_staff_name_lower on public.staff(lower(name));

-- ── students ─────────────────────────────────────────────────────────────────
-- Feature #8: parent/student tie-in.
create table if not exists public.students (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  class       text,
  section     text,
  parent_phone text,
  parent_name  text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists idx_students_parent_phone on public.students(parent_phone);

-- ── invites ──────────────────────────────────────────────────────────────────
-- Feature #1: pre-registration invite links.
create table if not exists public.invites (
  id            uuid primary key default uuid_generate_v4(),
  token         text unique not null default replace(gen_random_uuid()::text, '-', ''),
  visitor_name  text not null,
  visitor_phone text,
  purpose       text not null,
  host_staff_id uuid references public.staff(id) on delete set null,
  valid_from    timestamptz not null default now(),
  valid_until   timestamptz not null default (now() + interval '24 hours'),
  used          boolean not null default false,
  used_visitor_id bigint references public.visitors(id) on delete set null,
  created_by    uuid,
  created_at    timestamptz not null default now()
);

create index if not exists idx_invites_token on public.invites(token);

-- ── watchlist ────────────────────────────────────────────────────────────────
-- Feature #3: phone or name-based block list.
create table if not exists public.watchlist (
  id          uuid primary key default uuid_generate_v4(),
  phone       text,
  name_pattern text,
  reason      text,
  added_by    uuid,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  check (phone is not null or name_pattern is not null)
);

create index if not exists idx_watchlist_phone on public.watchlist(phone) where active = true;

-- ── admin_logs ───────────────────────────────────────────────────────────────
-- Issue #25: written by trigger, not client.
create table if not exists public.admin_logs (
  id           bigserial primary key,
  user_id      uuid,
  email        text,
  role         text,
  user_agent   text,
  ip           inet,
  logged_in_at timestamptz not null default now()
);

create index if not exists idx_admin_logs_logged_in_at on public.admin_logs(logged_in_at desc);

-- ── gates ────────────────────────────────────────────────────────────────────
-- Feature #5: list of physical gates a scanner can be assigned to.
create table if not exists public.gates (
  id     text primary key,    -- e.g. 'gate-a', 'gate-b'
  name   text not null,
  active boolean not null default true
);

insert into public.gates(id, name) values
  ('gate-main', 'Main Gate'),
  ('gate-east', 'East Gate')
on conflict (id) do nothing;

-- ── notification_queue ───────────────────────────────────────────────────────
-- Feature #2: rows here are picked up by an Edge Function / cron.
create table if not exists public.notification_queue (
  id           bigserial primary key,
  staff_id     uuid references public.staff(id) on delete cascade,
  visitor_id   bigint references public.visitors(id) on delete cascade,
  channel      text not null check (channel in ('email','sms','whatsapp')),
  payload      jsonb not null,
  sent         boolean not null default false,
  sent_at      timestamptz,
  error        text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_notification_queue_unsent on public.notification_queue(created_at) where sent = false;
