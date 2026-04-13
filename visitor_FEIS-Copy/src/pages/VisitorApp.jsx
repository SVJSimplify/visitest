import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth.jsx'
import { sanitizeFilename, normalizePhone, isValidPhone, explainError } from '../lib/utils'
import { STORAGE_BUCKET } from '../lib/constants'
import Button from '../components/ui/Button'
import Input, { Textarea } from '../components/ui/Input'
import Label from '../components/ui/Label'
import { ErrorAlert, SuccessAlert, Spinner } from '../components/ui/Feedback'
import PhotoCapture from '../components/PhotoCapture'
import QRDisplay from '../components/QRDisplay'
import VisitorAuthModal from '../components/VisitorAuthModal'

/**
 * VisitorApp
 * ----------------------------------------------------------------------
 * Three-stage flow:
 *   1. Pick role + fill details (auto-filled if logged in)
 *   2. Take selfie
 *   3. Show QR pass
 *
 * Anonymous visitors can register without an account. Logged-in visitors
 * and parents get autofill from their profile.
 */
export default function VisitorApp() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('invite')
  const { session, role: accountRole } = useAuth()

  const [stage, setStage] = useState('details') // details | photo | done
  const [role, setRole] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [purpose, setPurpose] = useState('')
  const [meet, setMeet] = useState('')
  const [notes, setNotes] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [visitor, setVisitor] = useState(null) // result from RPC
  const [invite, setInvite] = useState(null)
  const [photoBlob, setPhotoBlob] = useState(null)
  const [authModal, setAuthModal] = useState(null) // null | 'signin' | 'signup'
  const [profile, setProfile] = useState(null)
  const [history, setHistory] = useState(null)

  // Autofill from logged-in profile
  useEffect(() => {
    if (!session) {
      setProfile(null)
      setHistory(null)
      return
    }
    ;(async () => {
      const { data, error } = await supabase.rpc('get_my_profile')
      if (error || !data || !data[0]) return
      const p = data[0]
      setProfile(p)

      // Autofill if fields are empty (don't clobber user edits)
      setName((cur) => cur || p.name || '')
      setPhone((cur) => cur || p.phone || '')
      // Account role is the default visit role
      if (accountRole === 'parent' && !role) setRole('Parent')
      if (accountRole === 'visitor' && !role) setRole('Visitor')

      // Pull history (only meaningful for logged-in users)
      if (p.phone) {
        const { data: hist } = await supabase.rpc('get_visitor_history', { p_phone: p.phone })
        if (hist && hist[0]) setHistory(hist[0])
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, accountRole])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setName('')
    setPhone('')
    setProfile(null)
    setHistory(null)
  }

  // Resolve invite if present
  useEffect(() => {
    if (!inviteToken) return
    ;(async () => {
      const { data, error } = await supabase.rpc('get_invite_by_token', { p_token: inviteToken })
      if (error || !data || !data[0]) {
        setErr('Invite link is invalid or expired.')
        return
      }
      const inv = data[0]
      if (inv.used) { setErr('This invite has already been used.'); return }
      setInvite(inv)
      setRole('Visitor')
      setName(inv.visitor_name || '')
      setPhone(normalizePhone(inv.visitor_phone || ''))
      setPurpose(inv.purpose || '')
      if (inv.host_name) setMeet(inv.host_name)
    })()
  }, [inviteToken])

  const validateDetails = () => {
    if (!role) return 'Please select Visitor or Parent.'
    if (!name.trim() || name.trim().length < 2) return 'Please enter your full name.'
    if (!isValidPhone(phone)) return 'Phone must be exactly 10 digits.'
    if (purpose.trim().length < 2) return 'Please enter your purpose of visit (min 2 characters).'
    return null
  }

  const onContinue = (e) => {
    e?.preventDefault?.()
    setErr('')
    const v = validateDetails()
    if (v) { setErr(v); return }
    setStage('photo')
  }

  const onPhoto = async (blob) => {
    setPhotoBlob(blob)
    await submit(blob)
  }

  const onSkipPhoto = async () => {
    await submit(null)
  }

  const submit = async (blob) => {
    setBusy(true)
    setErr('')
    try {
      let photoUrl = null

      // Issue #20 fix: insert via RPC FIRST, get the qr_token back,
      // THEN upload the photo using that token as the filename.
      // If the upload fails afterwards, we just don't update the row;
      // the photo path is deterministic from the token, so no orphan.
      const { data, error } = await supabase.rpc('create_visitor', {
        p_role:         role,
        p_name:         name.trim(),
        p_phone:        phone,
        p_purpose:      purpose.trim(),
        p_meet:         meet.trim() || null,
        p_notes:        notes.trim() || null,
        p_photo_url:    null,
        p_invite_token: inviteToken || null,
      })

      if (error) { setErr(explainError(error)); return }
      const created = Array.isArray(data) ? data[0] : data
      if (!created) { setErr('Could not create visitor.'); return }

      // Upload photo if we have one
      if (blob) {
        const token = created.qr_token ?? created.id
        const path = `entry/${sanitizeFilename(created.name)}_${token.slice(0, 8)}.jpg`
        const { error: upErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
          photoUrl = publicUrl
          // Use the dedicated RPC to attach the URL — direct UPDATE is RLS-blocked for anon
          const { error: photoErr } = await supabase.rpc('set_visitor_photo', {
            p_token:     created.qr_token,
            p_photo_url: publicUrl,
          })
          if (photoErr) {
            // Non-fatal: visitor still has a valid pass, photo just isn't on the row
            console.warn('Could not attach photo to visitor row:', photoErr.message)
          }
        }
      }

      setVisitor({ ...created, photo_url: photoUrl ?? created.photo_url })
      setStage('done')
    } catch (e) {
      setErr(explainError(e))
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setStage('details')
    setVisitor(null)
    setPhotoBlob(null)
    setRole('')
    setName('')
    setPhone('')
    setPurpose('')
    setMeet('')
    setNotes('')
    setErr('')
  }

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-ink-200 sticky top-0 z-30">
        <div className="h-1 bg-gradient-to-r from-brand-800 via-gold-400 to-brand-800" />
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between gap-2">
          {stage === 'details' ? (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-brand-800 flex items-center justify-center text-gold-400 font-bold text-sm flex-shrink-0">
                V
              </div>
              <span className="text-sm font-semibold text-ink-900 tracking-tight truncate">Visitour · FEIS</span>
            </div>
          ) : (
            <button
              onClick={() => setStage('details')}
              className="text-sm font-medium text-ink-600 hover:text-ink-900 inline-flex items-center gap-1"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
              Back
            </button>
          )}

          {/* Auth area */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {session ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-ink-50 border border-ink-200">
                  <div className="w-6 h-6 rounded-md bg-brand-800 text-gold-400 flex items-center justify-center font-bold text-[10px]">
                    {(profile?.name || session.user.email || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-xs font-medium text-ink-800 max-w-[100px] truncate">
                    {profile?.name || session.user.email}
                  </span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="text-xs font-semibold text-ink-600 hover:text-brand-800 px-2 py-1"
                  title="Sign out"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setAuthModal('signin')}
                  className="text-xs font-semibold text-ink-700 hover:text-brand-800 px-2.5 py-1.5 rounded-md hover:bg-ink-100 transition-colors"
                >
                  Sign in
                </button>
                <button
                  onClick={() => setAuthModal('signup')}
                  className="text-xs font-bold text-gold-400 bg-brand-800 hover:bg-brand-900 px-3 py-1.5 rounded-md transition-colors"
                >
                  Sign up
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-6">
        {/* Invite banner */}
        {invite && (
          <div className="mb-4 bg-gold-100 border border-gold-400/50 rounded-xl px-4 py-3 animate-rise">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-900">Invited Visitor</div>
            <div className="text-sm text-brand-900 mt-0.5">
              You're here to see <strong>{invite.host_name}</strong>. Just confirm details below.
            </div>
          </div>
        )}

        {/* Welcome-back banner for logged-in users */}
        {session && profile && stage === 'details' && (
          <div className="mb-4 bg-white border border-ink-200 rounded-xl px-4 py-3 shadow-card animate-rise">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-800 text-gold-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
                {(profile.name || '?').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-ink-900">
                  Welcome back, {profile.name?.split(' ')[0] || 'visitor'}
                </div>
                <div className="text-[11px] text-ink-500 mt-0.5">
                  {history?.total_visits > 0
                    ? `${history.total_visits} prior visit${history.total_visits === 1 ? '' : 's'} · Your details are filled in below`
                    : 'Your details are filled in below'}
                  {profile.student_name && (
                    <> · Picking up <strong className="text-ink-800">{profile.student_name}</strong></>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {stage === 'details' && (
          <form onSubmit={onContinue}>
            <div className="card-branded animate-rise">
              <div className="brand-stripe" />
              <div className="p-6">
                <h1 className="text-lg font-bold text-ink-900 tracking-tight">Register your visit</h1>
                <p className="text-sm text-ink-500 mt-1">Fill in your details and you'll get a QR pass.</p>

                {/* Role picker */}
                <div className="grid grid-cols-2 gap-2.5 mt-5 stagger">
                  {['Visitor', 'Parent'].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={
                        'h-16 rounded-lg border-2 font-semibold text-sm transition-all relative overflow-hidden ' +
                        (role === r
                          ? 'border-brand-800 bg-brand-800 text-gold-400 shadow-card scale-[1.02]'
                          : 'border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:bg-brand-50 hover:-translate-y-0.5')
                      }
                    >
                      {role === r && (
                        <span className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gold-400 to-transparent" />
                      )}
                      {r}
                    </button>
                  ))}
                </div>

                <div className="space-y-4 mt-5 stagger">
                <div>
                  <Label htmlFor="name" required>Full name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
                </div>
                <div>
                  <Label htmlFor="phone" required>Phone</Label>
                  <Input
                    id="phone"
                    inputMode="numeric"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(normalizePhone(e.target.value))}
                    placeholder="10-digit number"
                  />
                </div>
                <div>
                  <Label htmlFor="purpose" required>Purpose of visit</Label>
                  <Input id="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Reason for visiting" />
                </div>
                <div>
                  <Label htmlFor="meet">Whom to meet</Label>
                  <Input id="meet" value={meet} onChange={(e) => setMeet(e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything else (optional)" />
                </div>

                <ErrorAlert>{err}</ErrorAlert>

                <Button type="submit" size="lg" className="w-full">
                  Continue to photo
                </Button>
                </div>
              </div>
            </div>
          </form>
        )}

        {stage === 'photo' && (
          <div className="card-branded animate-rise">
            <div className="brand-stripe" />
            <div className="p-6">
              <h1 className="text-lg font-bold text-ink-900 tracking-tight">Take your photo</h1>
              <p className="text-sm text-ink-500 mt-1 mb-5">
                Face the camera and tap Capture. This photo is attached to your visitor pass.
              </p>

              <PhotoCapture
                facing="user"
                onCapture={onPhoto}
                onCancel={() => setStage('details')}
                onSkip={onSkipPhoto}
                confirmLabel={busy ? 'Saving…' : 'Generate QR Pass'}
              />

              {busy && (
                <div className="flex items-center justify-center gap-2 text-sm text-ink-600 mt-3">
                  <Spinner />
                  <span>Saving</span>
                </div>
              )}

              <ErrorAlert>{err}</ErrorAlert>
            </div>
          </div>
        )}

        {stage === 'done' && visitor && (
          <div className="card-branded animate-rise">
            <div className="brand-stripe" />
            <div className="p-6 text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-100 border border-gold-400/40 text-brand-900 text-xs font-bold uppercase tracking-wider mb-4 animate-scale-in">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                Pass Ready
              </div>
              <div className="my-2 animate-scale-in">
                <QRDisplay value={visitor.qr_token} size={220} />
              </div>
              <div className="text-base font-semibold text-ink-900 mt-3">{visitor.name}</div>
              <div className="text-xs text-ink-500 mt-0.5">{visitor.role} · {visitor.purpose}</div>
              <div className="text-[11px] text-ink-400 mt-3 max-w-xs mx-auto">
                Show this QR at the gate when you arrive and again when you leave. Pass expires in 8 hours.
              </div>
              <Button variant="secondary" size="md" className="w-full mt-5" onClick={reset}>
                Register another
              </Button>
            </div>
          </div>
        )}
      </main>

      <VisitorAuthModal
        open={!!authModal}
        onClose={() => setAuthModal(null)}
        mode={authModal || 'signin'}
      />
    </div>
  )
}