import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { explainError } from '../lib/utils'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Label from '../components/ui/Label'
import { ErrorAlert, Spinner } from '../components/ui/Feedback'
import QRDisplay from '../components/QRDisplay'

export default function GroupInvitePage() {
  const { token } = useParams()

  const [invite, setInvite]               = useState(null)
  const [loadErr, setLoadErr]             = useState('')
  const [loadingInvite, setLoadingInvite] = useState(true)
  const [role, setRole]                   = useState('Visitor')
  const [name, setName]                   = useState('')
  const [phone, setPhone]                 = useState('')
  const [childName, setChildName]         = useState('')
  const [busy, setBusy]                   = useState(false)
  const [err, setErr]                     = useState('')
  const [visitor, setVisitor]             = useState(null)

  useEffect(() => {
    if (!token) { setLoadErr('Invalid link.'); setLoadingInvite(false); return }
    supabase.rpc('get_invite_by_token', { p_token: token })
      .then(({ data, error }) => {
        if (error || !data?.length) { setLoadErr('This link is invalid or has expired.'); return }
        const inv = data[0]
        if (!inv.multi_use && inv.used)          { setLoadErr('This link has already been used.'); return }
        if (new Date(inv.valid_until) < new Date()) { setLoadErr('This link has expired.'); return }
        setInvite(inv)
      })
      .finally(() => setLoadingInvite(false))
  }, [token])

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    if (!name.trim())                            return setErr('Full name is required.')
    if (!/^[0-9]{10}$/.test(phone))              return setErr('Phone must be exactly 10 digits.')
    if (role === 'Parent' && !childName.trim())  return setErr("Child's name is required.")

    setBusy(true)
    try {
      const { data, error } = await supabase.rpc('create_visitor', {
        p_role:         role,
        p_name:         name.trim(),
        p_phone:        phone,
        p_purpose:      invite.purpose,
        p_meet:         role === 'Parent' ? childName.trim() : (invite.host_name || null),
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

  /* ── Loading ── */
  if (loadingInvite) {
    return <div className="min-h-screen flex items-center justify-center"><Spinner /></div>
  }

  /* ── Error ── */
  if (loadErr) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-xs">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-rose-500">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <p className="font-semibold text-ink-900">{loadErr}</p>
          <p className="text-sm text-ink-500 mt-1">Please contact the school if you think this is an error.</p>
        </div>
      </div>
    )
  }

  /* ── Success / QR pass ── */
  if (visitor) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10"
        style={{ background: 'linear-gradient(160deg,#fdf4f3 0%,#fafafa 50%,#fffde7 100%)' }}>
        <div className="bg-white rounded-2xl border border-ink-200 shadow-card p-6 max-w-sm w-full text-center animate-rise">
          {/* Brand stripe */}
          <div className="h-1 bg-gradient-to-r from-brand-800 via-gold-400 to-brand-800 rounded-full mb-5" />

          {/* Success badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-[11px] font-bold uppercase tracking-wider mb-4 animate-pop">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            Pass Ready
          </div>

          <h2 className="text-base font-semibold text-ink-900 mb-1">You're registered!</h2>
          <p className="text-sm text-ink-500 mb-5">Show this QR code to security at the gate.</p>

          {/*
            ✅ FIX: was <QRDisplay token={visitor.qr_token} name={visitor.name} />
            QRDisplay expects the prop named `value`, not `token`.
            That mismatch is why QR was blank on both mobile and laptop.
          */}
          <QRDisplay value={visitor.qr_token} size={220} className="flex justify-center" />

          <div className="mt-4 text-sm font-semibold text-ink-900">{visitor.name}</div>
          <div className="text-xs text-ink-500 mt-0.5">{visitor.role} · {visitor.phone}</div>

          {/* Gold info strip */}
          <div className="mt-4 bg-gold-50 border border-gold-300 rounded-xl px-4 py-2.5">
            <p className="text-[11px] text-brand-900 font-medium">
              Valid until {new Date(visitor.valid_until).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.
              Show QR on entry <strong>and</strong> exit.
            </p>
          </div>
        </div>
      </div>
    )
  }

  /* ── Registration form ── */
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: 'linear-gradient(160deg,#fdf4f3 0%,#fafafa 50%,#fffde7 100%)' }}>
      <div className="bg-white rounded-2xl border border-ink-200 shadow-card p-6 max-w-sm w-full animate-rise">

        <div className="h-1 bg-gradient-to-r from-brand-800 via-gold-400 to-brand-800 rounded-full mb-5" />

        <div className="mb-5">
          <h1 className="text-base font-bold text-ink-900">Visitor Registration</h1>
          <p className="text-xs text-ink-500 mt-0.5">{invite.purpose}</p>
          {invite.host_name && (
            <p className="text-xs text-ink-500 mt-0.5">
              Meeting: <span className="text-ink-900 font-semibold">{invite.host_name}</span>
            </p>
          )}
        </div>

        <form onSubmit={submit} className="space-y-4">
          {/* Role toggle */}
          <div>
            <Label required>I am visiting as</Label>
            <div className="flex gap-2 mt-1.5">
              {['Visitor', 'Parent'].map(r => (
                <button key={r} type="button" onClick={() => { setRole(r); setChildName('') }}
                  className={[
                    'flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all',
                    role === r
                      ? 'bg-gradient-to-br from-brand-800 to-brand-950 text-gold-400 border-brand-800 scale-[1.02] shadow-sm'
                      : 'bg-white text-ink-700 border-ink-200 hover:border-brand-300 hover:bg-brand-50',
                  ].join(' ')}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label required>Full Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" autoComplete="name" />
          </div>

          <div>
            <Label required>Phone Number</Label>
            <Input type="tel" inputMode="numeric" value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit mobile number" maxLength={10} autoComplete="tel" />
            {phone.length > 0 && phone.length !== 10 && (
              <p className="text-xs text-rose-600 mt-1">{phone.length}/10 digits</p>
            )}
          </div>

          {role === 'Parent' && (
            <div>
              <Label required>Child's Name</Label>
              <Input value={childName} onChange={e => setChildName(e.target.value)} placeholder="Your child's full name" />
            </div>
          )}

          <ErrorAlert>{err}</ErrorAlert>

          <Button type="submit" loading={busy} size="lg" className="w-full">
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
