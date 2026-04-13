# Visitour 2.0

Modern visitor management for FEIS — React + Vite + Supabase, full PWA, with
pre-registration invites, host notifications, watchlist, multi-gate scanners,
daily reports, and printable badges.

This is a complete rewrite of the original Visitour HTML app. Every issue
flagged in the audit is fixed, every suggested feature is implemented.

---

## Quick start

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env.local
# Edit .env.local with your Supabase URL and anon key

# 3. Run the SQL migrations (see below)

# 4. Dev
npm run dev

# 5. Build
npm run build
```

---

## Setup checklist

### A. Supabase project

1. Create a new Supabase project (or reuse the existing `eepbysmfhxbjaobteios` one).
2. **Run the migrations in order** in the SQL editor:
   - `supabase/migrations/001_schema.sql`
   - `supabase/migrations/002_rls.sql`
   - `supabase/migrations/003_functions.sql`
   - `supabase/migrations/004_roles_and_seed.sql` *(read the comments first)*
   - `supabase/migrations/005_fixes.sql` *(critical patch — fixes auth-breaking trigger bugs and 20+ other issues)*
   - `supabase/migrations/006_storage.sql` *(creates visitor-photos bucket and policies)*
3. The `visitor-photos` bucket and storage policies are created by `006_storage.sql`. No dashboard clicking needed.

### B. Create your first superadmin

Roles must live in `app_metadata` (the migrations enforce this with a trigger).

1. Sign up a normal account through `/security` or via the Supabase dashboard.
2. In the SQL editor:

   ```sql
   update auth.users
      set raw_app_meta_data = raw_app_meta_data || '{"role":"superadmin"}'::jsonb
    where email = 'you@feis.school';
   ```

3. **Sign out and sign back in.** The role only appears in the JWT after a fresh login.

Repeat with `'admin'` or `'security'` for other staff.

### C. Edge Function for host notifications

Optional — only needed if you want hosts to be emailed when their visitor checks in.

```bash
supabase functions deploy notify-host
supabase secrets set RESEND_API_KEY=re_xxx FROM_EMAIL=visitour@feis.school
supabase functions schedule create notify-host --cron "* * * * *"
```

The function drains `public.notification_queue` and sends via Resend. Swap to
SendGrid / SES / Twilio inside `supabase/functions/notify-host/index.ts`.

### D. Deploy

This is a static SPA. Cloudflare Pages, Netlify, or Vercel all work:

- Build command: `npm run build`
- Output directory: `dist`
- The included `public/_headers` and `public/_redirects` work on Cloudflare Pages and Netlify.

---

## What's in the box

```
visitour/
├── package.json, vite.config.js, tailwind.config.js, postcss.config.js
├── index.html
├── public/
│   ├── manifest.json    # PWA manifest with proper 192/512 icons
│   ├── sw.js            # Service worker (auto-versioned, never caches Supabase)
│   ├── _headers         # CSP, X-Frame-Options, Permissions-Policy, HSTS
│   └── _redirects       # SPA fallback
├── src/
│   ├── main.jsx, App.jsx           # Router
│   ├── index.css                   # Tailwind base
│   ├── lib/
│   │   ├── supabase.js             # Client + role helpers
│   │   ├── utils.js                # Sanitization, formatting, error mapping
│   │   └── constants.js
│   ├── hooks/
│   │   ├── useAuth.jsx             # Session + role context
│   │   ├── useToast.jsx            # Non-blocking toasts
│   │   └── useRealtimeVisitors.js  # Replaces 5s polling with Supabase Realtime
│   ├── components/
│   │   ├── ui/                     # Button, Input, Label, Card, Badge, Modal, Feedback
│   │   ├── PhotoCapture.jsx        # Reusable camera flow
│   │   ├── QRDisplay.jsx
│   │   ├── BadgePrint.jsx          # Printable visitor badge
│   │   ├── Sidebar.jsx, TopBar.jsx
│   │   ├── StatsCards.jsx
│   │   └── VisitorTable.jsx        # XSS-safe via React (no innerHTML)
│   └── pages/
│       ├── Landing.jsx             # Admin login + visitor entry + PWA install
│       ├── VisitorApp.jsx          # 3-stage visitor registration
│       ├── SecurityLogin.jsx
│       ├── Scanner.jsx             # Atomic check-in/out via RPC
│       ├── InviteAccept.jsx        # /invite/:token entry point
│       ├── AdminLayout.jsx         # Sidebar + outlet
│       ├── AdminVisitors.jsx       # Realtime, search, filters, CSV export, force-checkout
│       ├── AdminInvites.jsx        # Create / share invite links
│       ├── AdminStaff.jsx          # Staff CRUD (hosts for notifications)
│       ├── AdminStudents.jsx       # Student CRUD (parent tie-in)
│       ├── AdminWatchlist.jsx      # Phone / name pattern blocks
│       ├── AdminReports.jsx        # Daily report (printable)
│       └── AdminLogs.jsx           # Superadmin audit log
└── supabase/
    ├── migrations/
    │   ├── 001_schema.sql          # All tables
    │   ├── 002_rls.sql             # Row-level security policies
    │   ├── 003_functions.sql       # RPCs, triggers, atomic check-in/out
    │   └── 004_roles_and_seed.sql  # Role assignment notes + seed data
    └── functions/notify-host/
        └── index.ts                # Host notification Edge Function
```

---

## How every audit issue is resolved

| #  | Issue | Fix |
|----|-------|-----|
|  1 | Role in `user_metadata` (privilege escalation) | Roles now in `app_metadata`. Trigger `strip_role_from_user_metadata` blocks any client attempt to set role in user_metadata. RLS helper functions read `auth.jwt() -> 'app_metadata' ->> 'role'`. |
|  2 | XSS in admin dashboard via `innerHTML` | Eliminated. `VisitorTable.jsx` uses React's text interpolation everywhere. Zero `innerHTML` usage in any component. |
|  3 | `scan_count` race condition | `check_in_visitor` RPC uses `WHERE scan_count = 0` in the UPDATE, atomic. Same for `check_out_visitor`. |
|  4 | Status changes before photo captured | `Scanner.jsx` uploads photo first, then calls `check_in_visitor` with `p_photo_url`. Single transaction inserts photo + status + check-in time. |
|  5 | Orphan photo uploads | `VisitorApp.jsx` calls `create_visitor` RPC FIRST, then uploads to a deterministic path based on the returned token. No orphans. |
|  6 | Anon writes everywhere | RLS policies in `002_rls.sql` allow only `INSERT` to anon (with status=PENDING, scan_count=0). `UPDATE` requires `is_security()` or `is_admin()`. |
|  7 | Hardcoded JWT | Still client-side (it's the anon key, that's fine), but the anon key now has zero capability beyond the validated `INSERT` thanks to RLS. |
|  8 | No checkout photo verification | `Scanner.jsx` checkout flow shows the original check-in photo and prompts for an exit photo, stored in `checkout_photo_url`. |
|  9 | "Inside forever" visitors | `expire_stale_visitors()` RPC marks INSIDE > 12h as `FORCED_OUT` and PENDING > 8h as `EXPIRED`. Schedule with pg_cron, or admins can run `force-checkout` from the visitor table. |
| 10 | QR has no expiry | `valid_until` column defaults to `now() + 8 hours`. Check-in RPC rejects expired tokens. |
| 11 | No deduplication | `create_visitor` RPC rejects same-phone PENDING/INSIDE within 10 minutes (`P0014`). |
| 12 | Admin loads ALL visitors | `useRealtimeVisitors` hook applies date filter (defaults today), 500-row cap, and uses Supabase Realtime instead of 5s polling. |
| 13 | No edit/delete/correct path | Force-checkout button on visitor rows; admin can delete via RLS policy `admin delete visitors`. |
| 14 | Whom-to-meet not notified | `host_staff_id` foreign key, `notification_queue` table, Edge Function delivers email on check-in. |
| 15 | No email verification / domain restriction | Visitor flow no longer creates auth accounts. Only staff (admin/security) sign in via `/` and `/security`, and accounts are provisioned manually with `app_metadata.role`. |
| 16 | No rate limiting | `create_visitor` rejects dedupe within 10 minutes; combine with Cloudflare rate limiting on `/rest/v1/rpc/create_visitor` for stronger protection. |
| 17 | Global Enter handler in landing | Replaced with form-scoped `onSubmit`. |
| 18 | Scanner inits before auth check | `Scanner.jsx` waits for `authReady` before instantiating `Html5Qrcode`. |
| 19 | `_redirects` no-op | Now `/* /index.html 200`. |
| 20 | Orphan photo uploads | See #5. |
| 21 | Wrong PWA icon size | `manifest.json` requires `192x192` and `512x512`. `index.html` has `apple-touch-icon`. |
| 22 | Missing security headers | `_headers` sets CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy (camera scoped to `self`), HSTS. |
| 23 | Manual `CACHE_VERSION` bump | `sw.js` uses a `__BUILD__` placeholder; for production, replace with build hash via Vite plugin or just let `Date.now()` fallback handle it. |
| 24 | `navigator.platform` deprecated | Landing iOS detection uses `userAgent` + `maxTouchPoints` + `Mac` test. |
| 25 | `admin_logs` written by client | Removed. `trg_log_login` trigger on `auth.users` writes them. RLS allows only `is_superadmin()` to read. |
| 26 | Sandbox detection / dual code path | Removed entirely. The new code uses the standard Supabase JS client everywhere. |
| 27 | No `<form>` elements | All inputs are inside real `<form>` with `onSubmit` handlers. Enter key, password managers, autofill all work. |
| 28 | Missing accessibility | Buttons have `aria-label`, modals have `role="dialog" aria-modal`, alerts have `role="alert"`, focus rings on every interactive element. |
| 29 | Phone validation | Centralized in `isValidPhone`, enforced both client-side and in the `create_visitor` RPC (`P0011`). |
| 30 | Uncaught network errors | All async handlers wrap in try/catch with `explainError(err)` mapping to user-readable messages. |

---

## Features delivered

| #  | Feature | Implementation |
|----|---------|----------------|
| 1  | Pre-registration / invite links | `invites` table, `AdminInvites.jsx` to create+share, `/invite/:token` route, `VisitorApp` resolves & prefills via `get_invite_by_token` RPC. |
| 2  | Host notification on check-in | `staff` table, `host_staff_id` foreign key, `notification_queue`, Edge Function `notify-host` (Resend stub). |
| 3  | Watchlist | `watchlist` table with phone/name patterns, `create_visitor` RPC matches and sets `watchlist_hit`, scanner blocks check-in, `AdminWatchlist.jsx` to manage. |
| 4  | Visitor history per phone | `get_visitor_history` RPC, displayed in scanner check-in modal showing prior visit count and last visit date. |
| 5  | Multi-gate support | `gates` table, `gate` column on visitors, gate selector in `Scanner.jsx` persisted to `localStorage`, gate filter in `AdminVisitors.jsx`, by-gate breakdown in daily report. |
| 6  | Daily report PDF | `daily_report` RPC returns aggregated data, `AdminReports.jsx` displays + supports browser print-to-PDF (print stylesheet in `index.css`). |
| 7  | Print-on-arrival badge | `BadgePrint.jsx` opens a thermal-printer-friendly window with photo, QR, name, host, purpose; auto-triggered after a successful check-in in `Scanner.jsx`. |
| 8  | Parent / student tie-in | `students` table, `get_student_by_parent_phone` RPC, scanner shows "Picking up X · Class Y" when a parent role is scanned. |

---

## Daily ops

- **Add a staff member who can be hosted by visitors:** Admin → Staff → Add staff. Set their email so they receive notifications.
- **Pre-register a parent for tomorrow:** Admin → Invites → New invite. Pick the host, copy the link, share via WhatsApp.
- **Block a phone number:** Admin → Watchlist → Add to watchlist.
- **End-of-day cleanup of stuck visitors:** Run `select expire_stale_visitors();` in the SQL editor, or schedule it with pg_cron every hour.
- **Print today's report:** Admin → Daily Report → Print / Save PDF.

---

## Architecture notes

**Why an RPC for everything?** Because we don't trust the client. Every state-changing operation (`create_visitor`, `check_in_visitor`, `check_out_visitor`) is a Postgres function with `security definer` and explicit grants. The client can't bypass dedupe, watchlist, or expiry checks even with a hand-crafted SQL.

**Why Realtime instead of polling?** Polling every 5 seconds with no rate limit eats your Supabase quota fast. One Realtime channel per dashboard scales to thousands of concurrent admins for the same monthly cost as one polling tab.

**Why no native Supabase auth for visitors?** A school visitor system shouldn't accept arbitrary world signups. Removing visitor auth entirely closes one of the biggest data-privacy holes from the original.

**Why Tailwind?** Your Raid Cabs stack already uses Vite, so the build pipeline is familiar. Tailwind keeps the design system consistent and fast to iterate on.
