import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { useAuth } from '../hooks/useAuth.jsx'
import { supabase, isSecurityRole } from '../lib/supabase'
import { explainError, fmtTime, sanitizeFilename } from '../lib/utils'
import { STORAGE_BUCKET } from '../lib/constants'
import { SECURITY_LOGIN_PATH } from '../lib/routes'
import Button from '../components/ui/Button'
import { Select } from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import { Spinner } from '../components/ui/Feedback'
import PhotoCapture from '../components/PhotoCapture'
import BadgePrint from '../components/BadgePrint'

const GATE_KEY = 'visitour-gate'

/**
 * Scanner
 * ----------------------------------------------------------------------
 * - Auth check FIRST, then init scanner (issue #18 fix)
 * - Atomic check-in via check_in_visitor RPC (issue #3, #4 fix)
 * - Photo upload happens BEFORE the RPC call so the row goes from
 *   PENDING → INSIDE in one atomic update with a photo URL
 * - Visitor history shown on every scan (feature #4)
 * - Student lookup for parent role (feature #8)
 * - Multi-gate support via localStorage (feature #5)
 * - Auto-print badge after check-in (feature #7)
 * - Watchlist hits flagged in red banner (feature #3)
 */
export default function Scanner() {
  const navigate = useNavigate()
  const { session, role, loading } = useAuth()

  const [authReady, setAuthReady] = useState(false)
  const [gate, setGate] = useState(localStorage.getItem(GATE_KEY) || 'gate-main')
  const [gates, setGates] = useState([])
  const [scanResult, setScanResult] = useState(null) // { type, message }
  const [activeVisitor, setActiveVisitor] = useState(null) // visitor row mid-checkin
  const [activeMode, setActiveMode] = useState(null)       // 'in' | 'out'
  const [history, setHistory] = useState(null)
  const [studentInfo, setStudentInfo] = useState(null)
  const [printVisitor, setPrintVisitor] = useState(null)
  const [busy, setBusy] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [cameraFacing, setCameraFacing] = useState('environment')

  const scannerRef = useRef(null)
  const processingRef = useRef(false)

  // Auth gate
  useEffect(() => {
    if (loading) return
    if (!session || !isSecurityRole(role)) {
      navigate(SECURITY_LOGIN_PATH, { replace: true })
      return
    }
    setAuthReady(true)
  }, [session, role, loading, navigate])

  // Load gates
  useEffect(() => {
    if (!authReady) return
    supabase.from('gates').select('*').eq('active', true).then(({ data }) => {
      if (data) setGates(data)
    })
  }, [authReady])

  // Save gate to localStorage
  useEffect(() => {
    localStorage.setItem(GATE_KEY, gate)
  }, [gate])

  // Init scanner ONLY after auth + only when no active visitor flow
  useEffect(() => {
    if (!authReady || activeVisitor) return

    const scanner = new Html5Qrcode('reader')
    scannerRef.current = scanner

    scanner
      .start(
        { facingMode: cameraFacing },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => onScan(decoded),
        () => {} // ignore decode failures
      )
      .catch((e) => {
        setErrMsg('Camera unavailable: ' + e.message)
      })

    return () => {
      if (scanner && scanner.isScanning) {
        scanner.stop().then(() => scanner.clear()).catch(() => {})
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, activeVisitor, cameraFacing])

  const onScan = async (token) => {
    if (processingRef.current) return
    processingRef.current = true
    setErrMsg('')
    setScanResult(null)

    try {
      // Bug 5 fix: validate this is a UUID before querying a uuid column.
      // Otherwise Postgres throws a type error and the user sees gibberish.
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!UUID_RE.test(token)) {
        flash('error', 'Not a Visitour QR code')
        return
      }

      // First check what state the visitor is in
      const { data, error } = await supabase
        .from('visitors')
        .select('*')
        .eq('qr_token', token)
        .maybeSingle()

      if (error || !data) {
        flash('error', 'QR not recognized')
        return
      }

      // Watchlist guard (feature #3)
      if (data.watchlist_hit) {
        flash('error', `BLOCKED — ${data.name} is on the watchlist`)
        return
      }

      // Already-used guard
      if (data.scan_count >= 2 || data.status === 'LEFT' || data.status === 'FORCED_OUT') {
        flash('warn', `${data.name} already checked out`)
        return
      }
      if (data.status === 'EXPIRED') {
        flash('error', `${data.name}'s pass has expired`)
        return
      }

      // Look up history & student info
      const { data: hist } = await supabase.rpc('get_visitor_history', { p_phone: data.phone })
      setHistory(hist?.[0] || null)

      if (data.role === 'Parent') {
        const { data: stu } = await supabase.rpc('get_student_by_parent_phone', { p_phone: data.phone })
        setStudentInfo(stu?.[0] || null)
      } else {
        setStudentInfo(null)
      }

      // Stop scanner while we handle the flow
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop().catch(() => {})
      }

      setActiveVisitor(data)
      setActiveMode(data.scan_count === 0 ? 'in' : 'out')
    } finally {
      processingRef.current = false
    }
  }

  const flash = (type, message) => {
    setScanResult({ type, message })
    setTimeout(() => setScanResult(null), 4000)
  }

  // After photo: upload then call RPC
  const completeWithPhoto = async (blob) => {
    if (!activeVisitor) return
    setBusy(true)
    setErrMsg('')

    try {
      let photoUrl = null
      if (blob) {
        const sub = activeMode === 'in' ? 'entry' : 'exit'
        const path = `${sub}/${sanitizeFilename(activeVisitor.name)}_${activeVisitor.qr_token.slice(0, 8)}_${Date.now()}.jpg`
        const { error: upErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
        if (upErr) throw upErr
        const { data: { publicUrl } } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
        photoUrl = publicUrl
      }

      if (activeMode === 'in') {
        const { data, error } = await supabase.rpc('check_in_visitor', {
          p_token:     activeVisitor.qr_token,
          p_photo_url: photoUrl,
          p_gate:      gate,
        })
        if (error) throw error
        const v = Array.isArray(data) ? data[0] : data
        flash('success', `${v.name} checked IN`)
        setPrintVisitor(v) // Auto print badge
      } else {
        const { data, error } = await supabase.rpc('check_out_visitor', {
          p_token:              activeVisitor.qr_token,
          p_checkout_photo_url: photoUrl,
        })
        if (error) throw error
        const v = Array.isArray(data) ? data[0] : data
        flash('success', `${v.name} checked OUT`)
      }

      closeFlow()
    } catch (e) {
      setErrMsg(explainError(e))
    } finally {
      setBusy(false)
    }
  }

  const skipPhoto = () => completeWithPhoto(null)

  const closeFlow = () => {
    setActiveVisitor(null)
    setActiveMode(null)
    setHistory(null)
    setStudentInfo(null)
    setErrMsg('')
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate(SECURITY_LOGIN_PATH, { replace: true })
  }

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ink-50 scanner-page" style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
      {/* Header */}
      <header className="bg-white border-b border-ink-200 sticky top-0 z-40" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="h-1 bg-gradient-to-r from-brand-800 via-gold-400 to-brand-800" />
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="text-sm font-medium text-ink-600 hover:text-ink-900 inline-flex items-center gap-1.5 min-h-[44px] min-w-[44px]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="flex flex-col items-center">
            <span className="text-sm font-semibold text-ink-900 tracking-tight">Security Scanner</span>
            <span className="text-[10px] text-ink-400 font-medium">{gate}</span>
          </div>
          <button onClick={handleSignOut} className="text-xs font-semibold text-brand-800 hover:text-brand-900 min-h-[44px] px-2">
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-3 sm:px-4 pt-4">
        {/* Gate selector */}
        <div className="bg-white rounded-xl border border-ink-200 shadow-card p-3 sm:p-4 mb-3 scanner-gate-select">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 mb-1.5">Active gate</div>
          <Select value={gate} onChange={(e) => setGate(e.target.value)}>
            {gates.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </Select>
        </div>

        {/* Scanner viewport */}
        <div className="bg-white rounded-2xl border border-ink-200 shadow-card overflow-hidden">
          <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-ink-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-ink-900 tracking-tight">Scan visitor QR pass</h2>
              <p className="text-[11px] text-ink-500 mt-0.5 hidden sm:block">Point camera at the QR shown by the visitor.</p>
            </div>
            <button
              onClick={() => setCameraFacing(f => f === 'environment' ? 'user' : 'environment')}
              className="flex items-center gap-1.5 text-xs font-semibold text-brand-800 hover:text-brand-900 border border-ink-200 rounded-lg px-3 py-2 min-h-[40px] active:bg-ink-50"
              title="Flip camera"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              <span className="hidden xs:inline">{cameraFacing === 'environment' ? 'Front' : 'Back'}</span>
            </button>
          </div>

          {/* QR Reader — clean on mobile, no extra borders */}
          <div
            id="reader"
            className="[&_video]:rounded-lg [&_video]:!max-w-full [&_img]:hidden [&_div[style*='border']]:!border-0 [&_div[style*='box-shadow']]:!shadow-none"
            style={{ padding: '12px' }}
          />

          {/* Scan result banner */}
          {scanResult && (
            <div
              className={
                'mx-3 mb-3 px-4 py-3 rounded-xl text-sm font-semibold text-center animate-rise ' +
                (scanResult.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                 scanResult.type === 'warn'    ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                                                 'bg-rose-50 text-rose-800 border border-rose-200')
              }
            >
              {scanResult.message}
            </div>
          )}

          {/* Idle hint */}
          {!scanResult && (
            <p className="text-center text-[11px] text-ink-400 pb-3 px-4 sm:hidden">
              Point at visitor's QR pass to scan
            </p>
          )}
        </div>

        {/* Camera error */}
        {errMsg && !activeVisitor && (
          <div className="mt-3 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-800 font-medium animate-rise">
            {errMsg}
          </div>
        )}
      </main>

      {/* Check-in / out modal — bottom sheet on mobile */}
      <Modal
        open={!!activeVisitor}
        onClose={closeFlow}
        size="md"
        title={activeMode === 'in' ? '✅ Check in visitor' : '🚪 Check out visitor'}
        subtitle={activeMode === 'in'
          ? 'Verify identity and capture photo at the gate.'
          : 'Confirm exit and capture photo.'}
      >
        {activeVisitor && (
          <div className="space-y-3 sm:space-y-4">

            {/* Visitor identity card */}
            <div className="flex items-start gap-3 p-3 bg-ink-50 rounded-xl border border-ink-200">
              {activeVisitor.photo_url ? (
                <img src={activeVisitor.photo_url} alt="" className="w-14 h-14 rounded-lg object-cover ring-1 ring-ink-200 flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-brand-100 flex items-center justify-center text-brand-800 font-bold text-lg flex-shrink-0">
                  {activeVisitor.name?.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-ink-900 truncate text-base">{activeVisitor.name}</div>
                <div className="text-xs text-ink-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span className="bg-ink-200 text-ink-700 px-1.5 py-0.5 rounded font-medium">{activeVisitor.role}</span>
                  <span>{activeVisitor.phone}</span>
                </div>
                <div className="text-xs text-ink-700 mt-1 font-medium">{activeVisitor.purpose}</div>
                {activeVisitor.meet && (
                  <div className="text-xs text-ink-500 mt-0.5">
                    Meeting: <span className="text-ink-900 font-semibold">{activeVisitor.meet}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Visit history */}
            {history && history.total_visits > 0 && (
              <div className="text-xs bg-brand-50 border border-brand-100 rounded-lg px-3 py-2 text-brand-900">
                <strong>{history.total_visits}</strong> prior visit{history.total_visits === 1 ? '' : 's'}.
                {history.last_visit_at && <> Last seen {fmtTime(history.last_visit_at)}.</>}
              </div>
            )}

            {/* Student info for parent role */}
            {studentInfo && (
              <div className="text-xs bg-gold-100 border border-gold-400/40 rounded-lg px-3 py-2 text-brand-900">
                Picking up <strong>{studentInfo.student_name}</strong>
                {studentInfo.student_class && <> · Class {studentInfo.student_class}-{studentInfo.student_section}</>}
              </div>
            )}

            {/* ── Photo capture — for both check-in & check-out ── */}
            <div className="border-t border-ink-100 pt-3">
              <div className="flex items-center gap-2 mb-2.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-brand-800 flex-shrink-0">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <span className="text-xs font-semibold text-ink-700">
                  {activeMode === 'in' ? 'Capture entry photo' : 'Capture exit photo'}
                </span>
                {activeVisitor.photo_url && activeMode === 'out' && (
                  <span className="ml-auto text-[10px] text-ink-400 italic">Entry photo on file</span>
                )}
              </div>
              <PhotoCapture
                facing="environment"
                onCapture={completeWithPhoto}
                onCancel={closeFlow}
                onSkip={skipPhoto}
                confirmLabel={busy ? 'Saving…' : activeMode === 'in' ? 'Confirm check-in' : 'Confirm checkout'}
              />
            </div>

            {errMsg && (
              <div className="text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 animate-rise">{errMsg}</div>
            )}
          </div>
        )}
      </Modal>

      {/* Auto-trigger badge print on check-in (feature #7) */}
      {printVisitor && (
        <BadgePrint visitor={printVisitor} onDone={() => setPrintVisitor(null)} />
      )}
    </div>
  )
}
