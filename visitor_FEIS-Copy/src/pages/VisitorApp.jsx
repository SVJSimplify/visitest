import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth.jsx'
import { sanitizeFilename, normalizePhone, isValidPhone, explainError } from '../lib/utils'
import { STORAGE_BUCKET } from '../lib/constants'
import Button from '../components/ui/Button'
import Input, { Textarea } from '../components/ui/Input'
import Label from '../components/ui/Label'
import { ErrorAlert, Spinner } from '../components/ui/Feedback'
import PhotoCapture from '../components/PhotoCapture'
import QRDisplay from '../components/QRDisplay'
import VisitorAuthModal from '../components/VisitorAuthModal'

/* ─── localStorage key for pass history ─── */
const HISTORY_KEY = 'visitour-pass-history'
const MAX_HISTORY = 10

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') }
  catch { return [] }
}
function saveToHistory(visitor) {
  const prev = loadHistory().filter(v => v.qr_token !== visitor.qr_token)
  const next = [{ ...visitor, saved_at: new Date().toISOString() }, ...prev].slice(0, MAX_HISTORY)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
}

export default function VisitorApp() {
  const navigate      = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteToken   = searchParams.get('invite')
  const { session, role: accountRole } = useAuth()

  /* ── tabs ── */
  const [tab, setTab] = useState('register') // 'register' | 'history'

  /* ── form state ── */
  const [stage,   setStage]   = useState('details') // details | photo | done
  const [role,    setRole]    = useState('')
  const [name,    setName]    = useState('')
  const [phone,   setPhone]   = useState('')
  const [purpose, setPurpose] = useState('')
  const [meet,    setMeet]    = useState('')
  const [notes,   setNotes]   = useState('')
  const [err,     setErr]     = useState('')
  const [busy,    setBusy]    = useState(false)
  const [visitor, setVisitor] = useState(null)
  const [invite,  setInvite]  = useState(null)
  const [profile, setProfile] = useState(null)
  const [history, setHistory] = useState(null)
  const [authModal, setAuthModal] = useState(null)

  /* ── pass history (localStorage) ── */
  const [passHistory,    setPassHistory]    = useState(loadHistory)
  const [selectedPass,   setSelectedPass]   = useState(null)

  const refreshHistory = useCallback(() => setPassHistory(loadHistory()), [])

  // Autofill from logged-in profile
  useEffect(() => {
    if (!session) { setProfile(null); setHistory(null); return }
    ;(async () => {
      const { data, error } = await supabase.rpc('get_my_profile')
      if (error || !data?.[0]) return
      const p = data[0]
      setProfile(p)
      setName(cur => cur || p.name || '')
      setPhone(cur => cur || p.phone || '')
      if (accountRole === 'parent'  && !role) setRole('Parent')
      if (accountRole === 'visitor' && !role) setRole('Visitor')
      if (p.phone) {
        const { data: hist } = await supabase.rpc('get_visitor_history', { p_phone: p.phone })
        if (hist?.[0]) setHistory(hist[0])
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, accountRole])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setName(''); setPhone(''); setProfile(null); setHistory(null)
  }

  // Resolve invite
  useEffect(() => {
    if (!inviteToken) return
    ;(async () => {
      const { data, error } = await supabase.rpc('get_invite_by_token', { p_token: inviteToken })
      if (error || !data?.[0]) { setErr('Invite link is invalid or expired.'); return }
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

  const onPhoto      = async (blob) => { await submit(blob) }
  const onSkipPhoto  = async ()      => { await submit(null) }

  const submit = async (blob) => {
    setBusy(true); setErr('')
    try {
      let photoUrl = null
      const { data, error } = await supabase.rpc('create_visitor', {
        p_role: role, p_name: name.trim(), p_phone: phone,
        p_purpose: purpose.trim(), p_meet: meet.trim() || null,
        p_notes: notes.trim() || null, p_photo_url: null,
        p_invite_token: inviteToken || null,
      })
      if (error) { setErr(explainError(error)); return }
      const created = Array.isArray(data) ? data[0] : data
      if (!created) { setErr('Could not create visitor.'); return }

      if (blob) {
        const token = created.qr_token ?? created.id
        const path  = `entry/${sanitizeFilename(created.name)}_${token.slice(0, 8)}.jpg`
        const { error: upErr } = await supabase.storage
          .from(STORAGE_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: true })
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
          photoUrl = publicUrl
          const { error: photoErr } = await supabase.rpc('set_visitor_photo', {
            p_token: created.qr_token, p_photo_url: publicUrl,
          })
          if (photoErr) console.warn('Could not attach photo:', photoErr.message)
        }
      }

      const finalVisitor = { ...created, photo_url: photoUrl ?? created.photo_url }
      setVisitor(finalVisitor)
      saveToHistory(finalVisitor)
      refreshHistory()
      setStage('done')
    } catch (e) {
      setErr(explainError(e))
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setStage('details'); setVisitor(null); setRole('')
    setName(''); setPhone(''); setPurpose(''); setMeet(''); setNotes(''); setErr('')
  }

  /* ── helpers ── */
  const fmtDate = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }
  const statusColor = (status) => {
    if (!status) return 'bg-ink-100 text-ink-600'
    const s = status.toUpperCase()
    if (s === 'PENDING')    return 'bg-gold-100 text-brand-900 border border-gold-400/40'
    if (s === 'INSIDE')     return 'bg-emerald-100 text-emerald-800 border border-emerald-300'
    if (s === 'LEFT')       return 'bg-ink-100 text-ink-600'
    if (s === 'EXPIRED')    return 'bg-rose-100 text-rose-700'
    if (s === 'FORCED_OUT') return 'bg-rose-100 text-rose-700'
    return 'bg-ink-100 text-ink-600'
  }

  /* ═══════════════════════ RENDER ═══════════════════════ */
  return (
    <div className="min-h-screen pb-12" style={{ background: 'linear-gradient(160deg, #fdf4f3 0%, #fafafa 40%, #fffde7 100%)' }}>

      {/* ── Header ── */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-ink-200 sticky top-0 z-30">
        <div className="h-1 bg-gradient-to-r from-brand-800 via-gold-400 to-brand-800" />
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-700 to-brand-900 flex items-center justify-center text-gold-400 font-bold text-sm flex-shrink-0 shadow-sm">
              V
            </div>
            <span className="text-sm font-semibold text-ink-900 tracking-tight truncate">Visitour · FEIS</span>
          </div>

          {/* Auth */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {session ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-brand-50 border border-brand-200">
                  <div className="w-6 h-6 rounded-md bg-brand-800 text-gold-400 flex items-center justify-center font-bold text-[10px]">
                    {(profile?.name || session.user.email || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-xs font-medium text-brand-900 max-w-[100px] truncate">
                    {profile?.name || session.user.email}
                  </span>
                </div>
                <button onClick={handleSignOut} className="text-xs font-semibold text-ink-600 hover:text-brand-800 px-2 py-1 min-h-[36px]">
                  Sign out
                </button>
              </div>
            ) : (
              <>
                <button onClick={() => setAuthModal('signin')} className="text-xs font-semibold text-ink-700 hover:text-brand-800 px-2.5 py-1.5 rounded-md hover:bg-brand-50 transition-colors min-h-[36px]">
                  Sign in
                </button>
                <button onClick={() => setAuthModal('signup')} className="text-xs font-bold text-gold-400 bg-brand-800 hover:bg-brand-900 px-3 py-1.5 rounded-md transition-colors min-h-[36px]">
                  Sign up
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div className="max-w-md mx-auto px-4 flex gap-1 pb-0">
          {[
            { id: 'register', label: 'Register Visit' },
            { id: 'history',  label: `My Passes${passHistory.length > 0 ? ` (${passHistory.length})` : ''}` },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={
                'relative px-4 py-2.5 text-[13px] font-semibold transition-colors min-h-[40px] ' +
                (tab === t.id
                  ? 'text-brand-800 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-gradient-to-r after:from-brand-800 after:via-gold-400 after:to-brand-800'
                  : 'text-ink-500 hover:text-ink-800')
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-5">

        {/* ══════════ HISTORY TAB ══════════ */}
        {tab === 'history' && (
          <div className="space-y-3 stagger">
            {passHistory.length === 0 ? (
              <div className="card-branded animate-rise">
                <div className="brand-stripe" />
                <div className="p-10 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center mx-auto mb-4">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand-400">
                      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                    </svg>
                  </div>
                  <div className="text-sm font-semibold text-ink-900">No passes yet</div>
                  <p className="text-xs text-ink-500 mt-1">Your generated QR passes will appear here.</p>
                  <Button variant="secondary" size="sm" className="mt-4" onClick={() => setTab('register')}>
                    Register a visit
                  </Button>
                </div>
              </div>
            ) : selectedPass ? (
              /* ── Full pass view ── */
              <div className="card-branded animate-rise">
                <div className="brand-stripe" />
                <div className="p-5">
                  <button
                    onClick={() => setSelectedPass(null)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-ink-600 hover:text-ink-900 mb-4 min-h-[36px]"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                    Back to history
                  </button>

                  <div className="text-center">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-3 ${statusColor(selectedPass.status)}`}>
                      {selectedPass.status || 'PENDING'}
                    </div>
                    <QRDisplay value={selectedPass.qr_token} size={200} className="flex justify-center mb-4" />
                    <div className="text-base font-bold text-ink-900">{selectedPass.name}</div>
                    <div className="text-xs text-ink-500 mt-0.5">{selectedPass.role} · {selectedPass.purpose}</div>
                    {selectedPass.meet && (
                      <div className="text-xs text-ink-500 mt-0.5">Meeting: <span className="font-medium text-ink-800">{selectedPass.meet}</span></div>
                    )}
                    <div className="text-[11px] text-ink-400 mt-2">Generated {fmtDate(selectedPass.saved_at)}</div>

                    {/* Warning if expired */}
                    {selectedPass.status === 'EXPIRED' || selectedPass.status === 'LEFT' ? (
                      <div className="mt-4 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
                        This pass has expired. Please register a new visit.
                      </div>
                    ) : (
                      <div className="mt-4 text-[11px] text-ink-400 max-w-xs mx-auto">
                        Show this QR at the gate when you arrive and again when you leave.
                      </div>
                    )}

                    <div className="flex gap-2 mt-5">
                      <Button variant="secondary" size="md" className="flex-1" onClick={() => setSelectedPass(null)}>
                        Back
                      </Button>
                      <Button
                        variant="primary"
                        size="md"
                        className="flex-1"
                        onClick={() => { setTab('register'); reset() }}
                      >
                        New visit
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ── History list ── */
              <>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 px-1 mb-1">
                  Recent passes — tap to view QR
                </div>
                {passHistory.map((pass, i) => (
                  <button
                    key={pass.qr_token || i}
                    onClick={() => setSelectedPass(pass)}
                    className="w-full text-left card-lift bg-white rounded-xl border border-ink-200 shadow-card px-4 py-3.5 flex items-center gap-3 hover:border-brand-300 transition-all"
                  >
                    {pass.photo_url ? (
                      <img src={pass.photo_url} alt="" className="w-11 h-11 rounded-lg object-cover ring-1 ring-ink-200 flex-shrink-0" />
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-brand-700 to-brand-900 flex items-center justify-center text-gold-400 font-bold text-sm flex-shrink-0">
                        {pass.name?.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-ink-900 truncate">{pass.name}</div>
                      <div className="text-xs text-ink-500 mt-0.5 truncate">{pass.purpose}</div>
                      <div className="text-[11px] text-ink-400 mt-0.5">{fmtDate(pass.saved_at)}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor(pass.status)}`}>
                        {pass.status || 'PENDING'}
                      </span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-ink-400">
                        <path d="M9 18l6-6-6-6"/>
                      </svg>
                    </div>
                  </button>
                ))}

                <button
                  onClick={() => { localStorage.removeItem(HISTORY_KEY); refreshHistory() }}
                  className="w-full text-center text-[11px] text-ink-400 hover:text-rose-600 py-2 transition-colors"
                >
                  Clear history
                </button>
              </>
            )}
          </div>
        )}

        {/* ══════════ REGISTER TAB ══════════ */}
        {tab === 'register' && (
          <>
            {/* Invite banner */}
            {invite && (
              <div className="mb-4 bg-gold-50 border border-gold-400/50 rounded-xl px-4 py-3 animate-rise">
                <div className="text-[11px] font-bold uppercase tracking-wider text-brand-900">Invited Visitor</div>
                <div className="text-sm text-brand-900 mt-0.5">
                  You're here to see <strong>{invite.host_name}</strong>. Just confirm details below.
                </div>
              </div>
            )}

            {/* Welcome-back banner */}
            {session && profile && stage === 'details' && (
              <div className="mb-4 bg-white border border-ink-200 rounded-xl px-4 py-3 shadow-card animate-rise">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-700 to-brand-900 text-gold-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {(profile.name || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-ink-900">Welcome back, {profile.name?.split(' ')[0] || 'visitor'}</div>
                    <div className="text-[11px] text-ink-500 mt-0.5">
                      {history?.total_visits > 0
                        ? `${history.total_visits} prior visit${history.total_visits === 1 ? '' : 's'} · Details filled in below`
                        : 'Your details are filled in below'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Details stage ── */}
            {stage === 'details' && (
              <form onSubmit={onContinue}>
                <div className="card-branded animate-rise">
                  <div className="brand-stripe" />
                  <div className="p-5 sm:p-6">
                    <h1 className="text-lg font-bold text-ink-900 tracking-tight">Register your visit</h1>
                    <p className="text-sm text-ink-500 mt-1">Fill in your details and you'll get a QR pass.</p>

                    {/* Role picker */}
                    <div className="grid grid-cols-2 gap-2.5 mt-5">
                      {['Visitor', 'Parent'].map((r) => (
                        <button
                          key={r} type="button" onClick={() => setRole(r)}
                          className={
                            'h-16 rounded-xl border-2 font-semibold text-sm transition-all relative overflow-hidden ' +
                            (role === r
                              ? 'border-brand-800 bg-gradient-to-br from-brand-800 to-brand-950 text-gold-400 shadow-card scale-[1.02]'
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

                    <div className="space-y-4 mt-5">
                      <div><Label htmlFor="name" required>Full name</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" /></div>
                      <div>
                        <Label htmlFor="phone" required>Phone</Label>
                        <Input id="phone" inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(normalizePhone(e.target.value))} placeholder="10-digit number" />
                      </div>
                      <div><Label htmlFor="purpose" required>Purpose of visit</Label><Input id="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Reason for visiting" /></div>
                      <div><Label htmlFor="meet">Whom to meet</Label><Input id="meet" value={meet} onChange={(e) => setMeet(e.target.value)} placeholder="Optional" /></div>
                      <div><Label htmlFor="notes">Notes</Label><Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything else (optional)" /></div>

                      <ErrorAlert>{err}</ErrorAlert>

                      <Button type="submit" size="lg" className="w-full">
                        Continue to photo →
                      </Button>
                    </div>
                  </div>
                </div>
              </form>
            )}

            {/* ── Photo stage ── */}
            {stage === 'photo' && (
              <div className="card-branded animate-rise">
                <div className="brand-stripe" />
                <div className="p-5 sm:p-6">
                  <button onClick={() => setStage('details')} className="flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-ink-900 mb-4 min-h-[36px]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                    Back
                  </button>
                  <h1 className="text-lg font-bold text-ink-900 tracking-tight">Take your photo</h1>
                  <p className="text-sm text-ink-500 mt-1 mb-5">Face the camera and tap Capture. This photo is attached to your visitor pass.</p>

                  <PhotoCapture
                    facing="user"
                    onCapture={onPhoto}
                    onCancel={() => setStage('details')}
                    onSkip={onSkipPhoto}
                    confirmLabel={busy ? 'Saving…' : 'Generate QR Pass'}
                  />

                  {busy && (
                    <div className="flex items-center justify-center gap-2 text-sm text-ink-600 mt-3">
                      <Spinner /><span>Saving</span>
                    </div>
                  )}
                  <ErrorAlert>{err}</ErrorAlert>
                </div>
              </div>
            )}

            {/* ── Done stage ── */}
            {stage === 'done' && visitor && (
              <div className="card-branded animate-rise">
                <div className="brand-stripe" />
                <div className="p-5 sm:p-6 text-center">
                  {/* Success badge */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-[11px] font-bold uppercase tracking-wider mb-4 animate-pop">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    Pass Ready
                  </div>

                  {/* Photo if available */}
                  {visitor.photo_url && (
                    <div className="flex justify-center mb-3">
                      <img src={visitor.photo_url} alt="" className="w-16 h-16 rounded-xl object-cover ring-2 ring-brand-200 shadow-card animate-pop" />
                    </div>
                  )}

                  {/* QR Code */}
                  <QRDisplay value={visitor.qr_token} size={210} className="flex justify-center my-3" />

                  <div className="text-base font-bold text-ink-900 mt-3">{visitor.name}</div>
                  <div className="text-xs text-ink-500 mt-0.5">{visitor.role} · {visitor.purpose}</div>
                  {visitor.meet && <div className="text-xs text-ink-500 mt-0.5">Meeting: <strong>{visitor.meet}</strong></div>}

                  {/* Gold info strip */}
                  <div className="mt-4 mx-auto max-w-xs bg-gold-50 border border-gold-300 rounded-xl px-4 py-2.5">
                    <p className="text-[11px] text-brand-900 font-medium">
                      Show this QR at the gate on arrival and again on departure. Pass expires in 8 hours.
                    </p>
                  </div>

                  <div className="flex gap-2 mt-5">
                    <Button variant="secondary" size="md" className="flex-1" onClick={() => setTab('history')}>
                      View history
                    </Button>
                    <Button variant="primary" size="md" className="flex-1" onClick={reset}>
                      New visit
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
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
