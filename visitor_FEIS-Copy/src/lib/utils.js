// ============================================================================
// Visitour utilities
// ============================================================================

/** Sanitize a string for use as a Storage filename. */
export function sanitizeFilename(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 40) || 'visitor'
}

/** Format ISO timestamp for Indian locale, short. */
export function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) +
    ' ' +
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  )
}

/** Relative time, e.g. "5m ago". */
export function timeSince(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/** Validate Indian 10-digit phone. */
export function isValidPhone(p) {
  return /^[0-9]{10}$/.test(String(p || ''))
}

/** Strip non-digits, cap at 10. */
export function normalizePhone(p) {
  return String(p || '').replace(/[^0-9]/g, '').slice(0, 10)
}

/**
 * Map Postgres error codes from our RPCs to user-readable messages.
 * Codes defined in supabase/migrations/003_functions.sql.
 */
const ERROR_MAP = {
  P0001: 'QR code not found.',
  P0002: 'This QR has already been used.',
  P0003: 'This QR has expired.',
  P0004: 'Visitor is on the watchlist. Notify security.',
  P0005: 'Could not complete the action. Try again.',
  P0006: 'Visitor is already checked out.',
  P0010: 'Please enter a valid name.',
  P0011: 'Phone must be exactly 10 digits.',
  P0012: 'Please enter a purpose of visit.',
  P0013: 'Invalid role.',
  P0014: 'You already have an active visit. Wait 10 minutes or check out first.',
  P0015: 'Invite link is invalid, used, or expired.',
  '42501': 'You are not authorized to do this.',
}

export function explainError(err) {
  if (!err) return 'Unknown error.'
  const code = err.code || err.error_code || (err.message?.match(/P\d{4}|42501/)?.[0])
  if (code && ERROR_MAP[code]) return ERROR_MAP[code]
  if (err.message) {
    // Map raw exception messages from RPC
    for (const [k, v] of Object.entries({
      qr_not_found: ERROR_MAP.P0001,
      already_used: ERROR_MAP.P0002,
      qr_expired: ERROR_MAP.P0003,
      watchlist_blocked: ERROR_MAP.P0004,
      already_checked_out: ERROR_MAP.P0006,
      invalid_name: ERROR_MAP.P0010,
      invalid_phone: ERROR_MAP.P0011,
      invalid_purpose: ERROR_MAP.P0012,
      duplicate_active: ERROR_MAP.P0014,
      invalid_invite: ERROR_MAP.P0015,
      forbidden: ERROR_MAP['42501'],
    })) {
      if (err.message.includes(k)) return v
    }
    return err.message
  }
  return 'Something went wrong.'
}

/** Convert a canvas to a JPEG Blob. */
export function canvasToBlob(canvas, quality = 0.85) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', quality))
}

/** Class names helper. */
export function cn(...args) {
  return args.filter(Boolean).join(' ')
}
