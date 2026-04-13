import { cn } from '../lib/utils'
import { useAuth } from '../hooks/useAuth.jsx'

export default function TopBar({ title, subtitle, children }) {
  const { role } = useAuth()
  const isSuperadmin = role === 'superadmin'

  return isSuperadmin
    ? <SuperTopBar title={title} subtitle={subtitle}>{children}</SuperTopBar>
    : <AdminTopBar title={title} subtitle={subtitle}>{children}</AdminTopBar>
}

/* ── Admin TopBar — branded with maroon/gold stripe ─────────────────────── */
function AdminTopBar({ title, subtitle, children }) {
  return (
    <>
      <div className="h-0.5 bg-gradient-to-r from-brand-800 via-gold-400 to-brand-800 opacity-90" />
      <header className="h-14 bg-white border-b border-ink-200 px-6 flex items-center justify-between sticky top-0 z-20">
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold text-ink-900 tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-[11px] text-ink-500 truncate">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">{children}</div>
      </header>
    </>
  )
}

/* ── Superadmin TopBar — minimal, Claude.ai inspired ────────────────────── */
function SuperTopBar({ title, subtitle, children }) {
  return (
    <header
      className="h-14 px-6 flex items-center justify-between sticky top-0 z-20"
      style={{
        backgroundColor: 'rgba(245,240,232,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(28,25,23,0.08)',
      }}
    >
      <div className="min-w-0">
        <h1
          className="text-[15px] font-semibold tracking-tight truncate"
          style={{ color: '#1C1917' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-[11px] truncate" style={{ color: '#78716C' }}>{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </header>
  )
}

export function LivePill() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-700">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
      </span>
      Live
    </span>
  )
}