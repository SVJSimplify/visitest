// ============================================================================
// notify-host — Supabase Edge Function (Deno runtime)
// ----------------------------------------------------------------------------
// Drains public.notification_queue and sends emails to hosts when their
// visitor checks in. Wire to Resend, SendGrid, AWS SES, or Twilio.
//
// Deploy:
//   supabase functions deploy notify-host
//
// Schedule (every minute):
//   supabase functions schedule create notify-host --cron "* * * * *"
//
// Required env vars (set in Supabase dashboard → Edge Functions → Secrets):
//   RESEND_API_KEY              (your provider's key)
//   FROM_EMAIL                  e.g. visitour@feis.school
//   (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-provided by Supabase)
// ============================================================================

// @ts-nocheck — this file runs in Deno, not Node. VS Code's TypeScript
// service uses Node types by default and doesn't know about `Deno`.
// The @ts-nocheck above silences VS Code; the file still runs fine when
// deployed to Supabase Edge Functions because Supabase provides Deno globals.
//
// To get proper IntelliSense without @ts-nocheck, install the Deno VS Code
// extension (denoland.vscode-deno) and enable Deno only for this folder by
// adding .vscode/settings.json with: { "deno.enable": true,
// "deno.enablePaths": ["./supabase/functions"] }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: { env: { get(key: string): string | undefined } }

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_KEY   = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL   = Deno.env.get('FROM_EMAIL') ?? 'visitour@feis.school'

const db = createClient(SUPABASE_URL, SERVICE_KEY)

/** Strip CR/LF and other control chars from header values to prevent
 *  header injection (bug 24). A malicious visitor name like
 *  "Bob\r\nBcc: attacker@evil.com" would otherwise inject headers. */
function sanitizeHeader(s: string, maxLen = 120): string {
  return String(s ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\r\n\t\x00-\x1f\x7f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen)
}

/** Validate an email address structurally (not deliverability). */
function isValidEmail(s: string): boolean {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_KEY) {
    console.log('[notify-host] No RESEND_API_KEY set, skipping send')
    return { skipped: true }
  }
  if (!isValidEmail(to)) {
    throw new Error(`invalid recipient email: ${to}`)
  }
  const cleanSubject = sanitizeHeader(subject, 120)
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject: cleanSubject, html }),
  })
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`)
  return r.json()
}

Deno.serve(async () => {
  const { data: rows, error } = await db
    .from('notification_queue')
    .select('id, staff_id, visitor_id, channel, payload, staff(email, name)')
    .eq('sent', false)
    .limit(50)

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  let sent = 0
  for (const row of rows ?? []) {
    const staff = (row as any).staff
    if (!staff?.email) {
      await db.from('notification_queue')
        .update({ sent: true, error: 'no_staff_email', sent_at: new Date().toISOString() })
        .eq('id', row.id)
      continue
    }

    const p = row.payload as any
    const html = `
      <div style="font-family:Inter,sans-serif;max-width:480px;padding:24px;border:1px solid #eee;border-radius:8px">
        <h2 style="color:#8e0e00;margin:0 0 12px">Visitor at the gate</h2>
        <p style="margin:0 0 8px"><strong>${escapeHtml(p.visitor_name)}</strong> is here to see you.</p>
        <table style="font-size:14px;color:#404040;margin-top:12px">
          <tr><td style="padding:4px 12px 4px 0">Purpose</td><td>${escapeHtml(p.purpose)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0">Phone</td><td>${escapeHtml(p.visitor_phone)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0">Gate</td><td>${escapeHtml(p.gate || '—')}</td></tr>
        </table>
        <p style="font-size:12px;color:#a3a3a3;margin-top:16px">Visitour · FEIS</p>
      </div>
    `

    try {
      const safeName = sanitizeHeader(p.visitor_name, 80)
      await sendEmail(staff.email, `Visitor at the gate: ${safeName}`, html)
      await db.from('notification_queue')
        .update({ sent: true, sent_at: new Date().toISOString() })
        .eq('id', row.id)
      sent++
    } catch (e: any) {
      await db.from('notification_queue')
        .update({ error: e.message })
        .eq('id', row.id)
    }
  }

  return new Response(JSON.stringify({ ok: true, sent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

function escapeHtml(s: string) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
