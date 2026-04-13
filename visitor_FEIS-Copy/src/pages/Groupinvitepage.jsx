import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { explainError } from '../lib/utils'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Label from '../components/ui/Label'
import { ErrorAlert, Spinner } from '../components/ui/Feedback'
import QRDisplay from '../components/QRDisplay'

/**
 * GroupInvitePage  /join/:token
 * -----------------------------------------------------------------------
 * A shareable link that many visitors/parents can use.
 * Each person fills in their own details and gets their own QR pass.
 * The invite is NOT marked 'used' — it stays active until it expires
 * or hits max_uses (if set by admin).
 *
 * Form collects: Name, Phone, Role (Visitor | Parent), Child Name (Parent only)
 * Purpose and host are pre-filled from the invite record.
 */
export default function GroupInvitePage() {
  const { token } = useParams()

  // Invite meta
  const [invite, setInvite]           = useState(null)
  const [loadErr, setLoadErr]         = useState('')
  const [loadingInvite, setLoadingInvite] = useState(true)

  // Form
  const [role, setRole]           = useState('Visitor')
  const [name, setName]           = useState('')
  const [phone, setPhone]         = useState('')
  const [childName, setChildName] = useState('')
  const [busy, setBusy]           = useState(false)
  const [err, setErr]             = useState('')

  // Success
  const [visitor, setVisitor] = useState(null)

  // ── Load invite ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setLoadErr('Invalid link.')
      setLoadingInvite(false)
      return
    }
    supabase
      .rpc('get_invite_by_token', { p_token: token })
      .then(({ data, error }) => {
        if (error || !data?.length) {
          setLoadErr('This link is invalid or has expired.')
          return
        }
        const inv = data[0]
        // Single-use check (multi_use invites are never marked used)
        if (!inv.multi_use && inv.used) {
          setLoadErr('This link has already been used.')
          return
        }
        if (new Date(inv.valid_until) < new Date()) {
          setLoadErr('This link has expired.')
          return
        }
        setInvite(inv)
      })
      .finally(() => setLoadingInvite(false))
  }, [token])

  // ── Submit ───────────────────────────────────────────────────────────
  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    if (!name.trim())                        return setErr('Full name is required.')
    if (!/^[0-9]{10}$/.test(phone))          return setErr('Phone must be exactly 10 digits.')
    if (role === 'Parent' && !childName.trim()) return setErr("Child's name is required.")

    setBusy(true)
    try {
      const { data, error } = await supabase.rpc('create_visitor', {
        p_role:         role,
        p_name:         name.trim(),
        p_phone:        phone,
        p_purpose:      invite.purpose,
        p_meet:         role === 'Parent'
                          ? childName.trim()
                          : (invite.host_name || null),
        p_notes:        null,
        p_photo_url:    null,
        p_invite_token: token,
      })
      if (error) throw error
      setVisitor(Array.isArray(data) ? data[0] : data)
    } catch (e) {
      setErr(explainError(e))
    } finally {
      setBusy(false)
    }
  }

  // ── States ───────────────────────────────────────────────────────────
  if (loadingInvite) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (loadErr) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-xs">
          <svg className="mx-auto mb-3 text-rose-400" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="font-semibold text-ink-900">{loadErr}</p>
          <p className="text-sm text-ink-500 mt-1">Please contact the school if you think this is an error.</p>
        </div>
      </div>
    )
  }

  if (visitor) {
    return (
      <div className="min-h-screen bg-ink-50 flex items-center justify-center px-4 py-10">
        <div className="bg-white rounded-2xl border border-ink-200 shadow-card p-6 max-w-sm w-full text-center">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-600">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-ink-900 mb-1">You're registered!</h2>
          <p className="text-sm text-ink-500 mb-5">Show this QR code to security at the gate.</p>
          <QRDisplay token={visitor.qr_token} name={visitor.name} />
          <div className="mt-4 text-[11px] text-ink-400">
            Pass valid until {new Date(visitor.valid_until).toLocaleString('en-IN', {
              dateStyle: 'medium', timeStyle: 'short'
            })}
          </div>
          <div className="mt-3 text-xs font-medium text-ink-700">{visitor.name} · {visitor.phone}</div>
        </div>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-ink-50 flex items-center justify-center px-4 py-10">
      <div className="bg-white rounded-2xl border border-ink-200 shadow-card p-6 max-w-sm w-full">

        {/* Header strip */}
        <div className="h-1 bg-gradient-to-r from-brand-800 via-gold-400 to-brand-800 rounded-full mb-5" />

        <div className="mb-5">
          <h1 className="text-base font-semibold text-ink-900">Visitor Registration</h1>
          <p className="text-xs text-ink-500 mt-0.5">{invite.purpose}</p>
          {invite.host_name && (
            <p className="text-xs text-ink-500 mt-0.5">
              Meeting: <span className="text-ink-900 font-medium">{invite.host_name}</span>
            </p>
          )}
        </div>

        <form onSubmit={submit} className="space-y-4">

          {/* Role toggle */}
          <div>
            <Label required>I am visiting as</Label>
            <div className="flex gap-2 mt-1.5">
              {['Visitor', 'Parent'].map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => { setRole(r); setChildName('') }}
                  className={[
                    'flex-1 py-2 rounded-lg border text-sm font-medium transition-colors',
                    role === r
                      ? 'bg-brand-800 text-white border-brand-800'
                      : 'bg-white text-ink-700 border-ink-200 hover:border-ink-400',
                  ].join(' ')}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <Label required>Full Name</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your full name"
              autoComplete="name"
            />
          </div>

          {/* Phone */}
          <div>
            <Label required>Phone Number</Label>
            <Input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit mobile number"
              maxLength={10}
              autoComplete="tel"
            />
            {phone.length > 0 && phone.length !== 10 && (
              <p className="text-xs text-rose-600 mt-1">{phone.length}/10 digits</p>
            )}
          </div>

          {/* Child name — Parent only */}
          {role === 'Parent' && (
            <div>
              <Label required>Child's Name</Label>
              <Input
                value={childName}
                onChange={e => setChildName(e.target.value)}
                placeholder="Your child's full name"
              />
            </div>
          )}

          <ErrorAlert>{err}</ErrorAlert>

          <Button type="submit" loading={busy} className="w-full">
            Get my pass →
          </Button>
        </form>

        <p className="text-[11px] text-ink-400 text-center mt-4">
          Your QR pass is valid for 8 hours from registration.
        </p>
      </div>
    </div>
  )
}