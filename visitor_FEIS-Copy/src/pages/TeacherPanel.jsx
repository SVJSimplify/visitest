import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth.jsx'
import { TEACHER_LOGIN_PATH } from '../lib/routes'

/* ── helpers ─────────────────────────────────────────────────────────── */
function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short',
  })
}

function todayStart() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d
}

/* ── ArrivalCard ─────────────────────────────────────────────────────── */
function ArrivalCard({ n, isNew }) {
  const [expanded, setExpanded] = useState(false)
  const p = n.payload ?? {}

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      className={[
        'bg-white rounded-2xl border shadow-sm cursor-pointer transition-all duration-200 overflow-hidden',
        isNew    ? 'border-brand-300 ring-2 ring-brand-200'  : 'border-ink-200',
        expanded ? 'shadow-md' : 'hover:shadow-md hover:-translate-y-0.5',
      ].join(' ')}
    >
      {/* Top stripe for new arrivals */}
      {isNew && <div className="h-0.5 bg-gradient-to-r from-brand-800 via-gold-400 to-brand-800" />}

      <div className="p-4 flex items-start gap-3">
        {/* Avatar / photo */}
        {p.photo_url ? (
          <img
            src={p.photo_url} alt=""
            className="w-12 h-12 rounded-xl object-cover ring-1 ring-ink-200 flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-700 to-brand-900 flex items-center justify-center text-gold-400 font-bold text-sm flex-shrink-0">
            {(p.visitor_name ?? '?').slice(0, 2).toUpperCase()}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-ink-900 truncate">{p.visitor_name ?? '—'}</div>
              <div className="text-xs text-ink-500 mt-0.5">{p.role ?? 'Parent'}</div>
            </div>
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              {!n.is_read && (
                <span className="w-2 h-2 rounded-full bg-brand-800 mt-1" />
              )}
              <span className="text-[10px] text-ink-400">{timeAgo(n.created_at)}</span>
            </div>
          </div>

          {/* Summary row */}
          <div className="flex flex-wrap gap-2 mt-2">
            {p.gate && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Gate: {p.gate}
              </span>
            )}
            {p.meet && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700">
                Seeing: {p.meet}
              </span>
            )}
            {p.purpose && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-gold-50 border border-gold-200 text-brand-900">
                {p.purpose}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Expanded full details */}
      {expanded && (
        <div className="border-t border-ink-100 px-4 py-3 bg-ink-50/50">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
            {[
              ['Phone',      p.visitor_phone],
              ['Purpose',    p.purpose],
              ['Meeting',    p.meet],
              ['Notes',      p.notes],
              ['Gate',       p.gate ?? 'Main'],
              ['Arrived',    fmtTime(p.checked_in_at)],
            ].map(([label, value]) => value ? (
              <div key={label}>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">{label}</div>
                <div className="text-ink-800 font-medium mt-0.5">{value}</div>
              </div>
            ) : null)}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── TeacherPanel ────────────────────────────────────────────────────── */
export default function TeacherPanel() {
  const navigate = useNavigate()
  const { session, role, loading } = useAuth()

  const [notifications, setNotifications] = useState([])
  const [fetching,      setFetching]      = useState(true)
  const [tab,           setTab]           = useState('today')   // 'today' | 'all'
  const [newIds,        setNewIds]        = useState(new Set())

  /* ── Auth guard ── */
  useEffect(() => {
    if (loading) return
    if (!session || role !== 'teacher') {
      navigate(TEACHER_LOGIN_PATH, { replace: true })
    }
  }, [session, role, loading, navigate])

  /* ── Fetch ── */
  const fetchNotifications = useCallback(async () => {
    setFetching(true)
    const { data } = await supabase.rpc('get_teacher_notifications')
    setNotifications(data ?? [])
    setFetching(false)
  }, [])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  /* ── Realtime ── */
  useEffect(() => {
    const ch = supabase
      .channel(`teacher-rt-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'admin_notifications',
      }, (payload) => {
        // Mark as "new" for highlight
        setNewIds(prev => new Set([...prev, payload.new.id]))
        // Remove highlight after 8 seconds
        setTimeout(() => setNewIds(prev => { const s = new Set(prev); s.delete(payload.new.id); return s }), 8000)
        fetchNotifications()
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [fetchNotifications])

  /* ── Mark read on mount ── */
  useEffect(() => {
    if (!session || role !== 'teacher') return
    supabase.rpc('mark_teacher_notifications_read')
  }, [session, role])

  /* ── Sign out ── */
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate(TEACHER_LOGIN_PATH, { replace: true })
  }

  /* ── Derived ── */
  const todayNotifs = notifications.filter(n =>
    new Date(n.created_at) >= todayStart()
  )
  const displayed = tab === 'today' ? todayNotifs : notifications
  const unread    = notifications.filter(n => !n.is_read).length

  const teacherName = session?.user?.user_metadata?.name
    || session?.user?.email?.split('@')[0]
    || 'Teacher'

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-50">
        <div className="w-6 h-6 border-2 border-brand-800 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  /* ═══════════════════════ RENDER ═══════════════════════ */
  return (
    <div className="min-h-screen pb-12" style={{ background: 'linear-gradient(160deg,#fdf4f3 0%,#fafafa 40%,#fffde7 100%)' }}>

      {/* ── Header ── */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-ink-200 sticky top-0 z-30">
        <div className="h-1 bg-gradient-to-r from-brand-800 via-gold-400 to-brand-800" />
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-3">

          {/* Logo + name */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-700 to-brand-900 flex items-center justify-center text-gold-400 font-bold text-sm flex-shrink-0 shadow-sm">
              V
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-ink-900 tracking-tight">Visitour · FEIS</div>
              <div className="text-[10px] text-ink-500 truncate">Welcome, {teacherName}</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Live indicator */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-semibold text-emerald-700">Live</span>
            </div>

            {/* Visitor app link */}
            <a
              href="/"
              className="text-xs font-semibold text-ink-600 hover:text-brand-800 px-2.5 py-1.5 rounded-md hover:bg-brand-50 transition-colors"
            >
              Visitor App
            </a>

            {/* Sign out */}
            <button
              onClick={handleSignOut}
              className="text-xs font-semibold text-ink-600 hover:text-brand-800 px-2.5 py-1.5 rounded-md hover:bg-brand-50 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-5 space-y-5">

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: 'Today\'s Arrivals',
              value: todayNotifs.length,
              color: 'from-brand-700 to-brand-900',
              textColor: 'text-gold-400',
            },
            {
              label: 'Unread',
              value: unread,
              color: unread > 0 ? 'from-amber-500 to-amber-700' : 'from-ink-400 to-ink-600',
              textColor: 'text-white',
            },
            {
              label: 'Total',
              value: notifications.length,
              color: 'from-ink-600 to-ink-800',
              textColor: 'text-white',
            },
          ].map(s => (
            <div
              key={s.label}
              className={`rounded-2xl bg-gradient-to-br ${s.color} p-4 shadow-sm`}
            >
              <div className={`text-2xl font-bold ${s.textColor}`}>{s.value}</div>
              <div className="text-[11px] text-white/70 mt-0.5 font-medium">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-white border border-ink-200 rounded-xl p-1 shadow-sm">
          {[
            { id: 'today', label: `Today (${todayNotifs.length})` },
            { id: 'all',   label: `All (${notifications.length})` },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={[
                'flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all',
                tab === t.id
                  ? 'bg-gradient-to-br from-brand-800 to-brand-950 text-gold-400 shadow-sm'
                  : 'text-ink-500 hover:text-ink-800',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Notification list ── */}
        {fetching ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-brand-800 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="bg-white rounded-2xl border border-ink-200 shadow-sm p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand-400">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div className="text-sm font-semibold text-ink-900">
              {tab === 'today' ? 'No parent arrivals today yet' : 'No arrivals recorded'}
            </div>
            <p className="text-xs text-ink-500 mt-1">
              You'll see a notification here the moment a parent checks in.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map(n => (
              <ArrivalCard
                key={n.id}
                n={n}
                isNew={newIds.has(n.id)}
              />
            ))}
          </div>
        )}

        {/* ── Footer note ── */}
        <p className="text-center text-[11px] text-ink-400 pb-4">
          Notifications update in real-time. Tap any card to expand full details.
        </p>
      </main>
    </div>
  )
}
