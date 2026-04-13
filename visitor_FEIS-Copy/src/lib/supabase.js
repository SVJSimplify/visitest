import { createClient } from '@supabase/supabase-js'

const url  = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anon) {
  const msg =
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
    'Add them to .env.local (local) or your Cloudflare/Vercel env vars (production), ' +
    'then rebuild. See README.'
  // Log AND show on the page so it's impossible to miss.
  // eslint-disable-next-line no-console
  console.error('[visitour] ' + msg)
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      const root = document.getElementById('root') || document.body
      root.innerHTML =
        '<div style="font-family:Inter,sans-serif;max-width:560px;margin:80px auto;padding:24px;border:2px solid #8e0e00;border-radius:12px;background:#fff">' +
        '<h1 style="color:#8e0e00;margin:0 0 12px;font-size:18px">Visitour configuration error</h1>' +
        '<p style="color:#404040;margin:0 0 8px;font-size:14px">' + msg + '</p>' +
        '<p style="color:#737373;margin:0;font-size:12px">URL: ' + (url || 'MISSING') + '</p>' +
        '<p style="color:#737373;margin:0;font-size:12px">Anon key: ' + (anon ? '(set)' : 'MISSING') + '</p>' +
        '</div>'
    })
  }
}

export const supabase = createClient(url || 'https://placeholder.supabase.co', anon || 'placeholder', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: { 'x-client-info': 'visitour-web/2.0' },
  },
})

/**
 * Pull the role from app_metadata. NEVER trust user_metadata for roles.
 * (Original code's #1 vulnerability.)
 */
export function getRole(session) {
  return session?.user?.app_metadata?.role ?? null
}

export function isAdminRole(role) {
  return role === 'admin' || role === 'superadmin'
}

export function isSecurityRole(role) {
  return role === 'security' || role === 'superadmin'
}
