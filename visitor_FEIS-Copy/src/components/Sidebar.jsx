import { NavLink } from 'react-router-dom'
import { cn } from '../lib/utils'
import { useAuth } from '../hooks/useAuth.jsx'
import { supabase } from '../lib/supabase'
import { ADMIN_LOGIN_PATH } from '../lib/routes'

export default function Sidebar({ insideCount = 0, isSuperadmin = false, mobileOpen = false, onClose }) {
  const { session, role } = useAuth()
  const email    = session?.user?.email || ''
  const initials = email.slice(0, 2).toUpperCase()
  const handleSignOut = async () => { await supabase.auth.signOut(); window.location.href = ADMIN_LOGIN_PATH }
  const props = { insideCount, email, initials, role, onSignOut: handleSignOut, mobileOpen, onClose }
  return isSuperadmin ? <SystemSidebar {...props} /> : <AdminSidebar {...props} />
}

/* ══════════════════════════════════════════
   ADMIN — Maroon / Gold branded
   ══════════════════════════════════════════ */
function AdminSidebar({ insideCount, email, initials, onSignOut, mobileOpen, onClose }) {
  return (
    <aside className={cn('w-60 h-screen flex flex-col fixed left-0 top-0 z-40 admin-sidebar-drawer md:translate-x-0', mobileOpen && 'open')}
      style={{ background: 'linear-gradient(180deg,#1a0500 0%,#0f0200 100%)' }}>
      <div className="h-px" style={{ background: 'linear-gradient(90deg,transparent,#f9d423 40%,#e8c00f 60%,transparent)' }} />

      {/* Logo */}
      <div className="px-4 pt-4 pb-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(249,212,35,0.12)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-800 flex items-center justify-center font-bold text-sm animate-pop"
            style={{ boxShadow: '0 0 0 1px rgba(249,212,35,0.3)', color: '#f9d423' }}>V</div>
          <div>
            <div className="text-white font-semibold text-sm tracking-tight">Visitour</div>
            <div className="text-[10px]" style={{ color: 'rgba(249,212,35,0.45)' }}>FEIS Management</div>
          </div>
        </div>
        <button onClick={onClose} className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 scroll-ios stagger">
        <SLabel c="rgba(249,212,35,0.35)">Operations</SLabel>
        <ANav to="/admin/visitors" label="Visitors" badge={insideCount > 0 ? insideCount : null} icon={IUsers} />
        <ANav to="/admin/invites"  label="Invites"  icon={ILink} />
        <ANav to="/admin/staff"    label="Staff"    icon={IBriefcase} />
        <ANav to="/admin/students" label="Students" icon={IBook} />
        <SLabel c="rgba(249,212,35,0.35)" mt>Security</SLabel>
        <ANav to="/admin/watchlist" label="Watchlist" icon={IShield} />
        <ANav to="/scan"            label="Scanner"   icon={ICamera} />
        <SLabel c="rgba(249,212,35,0.35)" mt>Reports</SLabel>
        <ANav to="/admin/reports" label="Daily Report" icon={IChart} />
      </nav>

      <div className="px-2 py-3" style={{ borderTop: '1px solid rgba(249,212,35,0.10)' }}>
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors cursor-default">
          <div className="w-8 h-8 rounded-md bg-gold-400 text-brand-900 flex items-center justify-center font-bold text-xs flex-shrink-0">{initials || '?'}</div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-white font-semibold truncate">{email}</div>
            <div className="text-[10px]" style={{ color: 'rgba(249,212,35,0.4)' }}>Administrator</div>
          </div>
          <SOutBtn onClick={onSignOut} c="#f9d423" hc="#fff" />
        </div>
      </div>
    </aside>
  )
}

/* ══════════════════════════════════════════
   SYSTEM — Claude / Anthropic aesthetic
   "Superadmin" never appears in the UI
   ══════════════════════════════════════════ */
const S = {
  bg:       '#191716',
  bgh:      'rgba(255,255,255,0.05)',
  bga:      'rgba(255,255,255,0.09)',
  border:   'rgba(255,255,255,0.07)',
  text:     '#E8E3DC',
  muted:    '#6B6460',
  faint:    '#4A4542',
  accent:   '#CC785C',
  accentS:  'rgba(204,120,92,0.15)',
}

function SystemSidebar({ insideCount, email, initials, onSignOut, mobileOpen, onClose }) {
  return (
    <aside className={cn('w-60 h-screen flex flex-col fixed left-0 top-0 z-40 admin-sidebar-drawer md:translate-x-0', mobileOpen && 'open')}
      style={{ background: S.bg, color: S.text }}>
      <div className="h-px" style={{ background: `linear-gradient(90deg,transparent,${S.accent}70,transparent)` }} />

      <div className="px-4 pt-5 pb-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${S.border}` }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm animate-pop flex-shrink-0"
            style={{ background: `linear-gradient(135deg,${S.accent},#B5604A)`, color: '#FFF8F5', boxShadow: `0 2px 8px ${S.accent}40` }}>V</div>
          <div className="text-sm font-semibold tracking-tight" style={{ color: S.text }}>Visitour</div>
        </div>
        <button onClick={onClose} className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: S.muted }}
          onMouseEnter={e => { e.currentTarget.style.background = S.bgh; e.currentTarget.style.color = S.text }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = S.muted }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 scroll-ios stagger">
        <SLabel c={S.faint}>Operations</SLabel>
        <SNav to="/admin/visitors" label="Visitors" badge={insideCount > 0 ? insideCount : null} icon={IUsers} />
        <SNav to="/admin/invites"  label="Invites"  icon={ILink} />
        <SNav to="/admin/staff"    label="Staff"    icon={IBriefcase} />
        <SNav to="/admin/students" label="Students" icon={IBook} />
        <SLabel c={S.faint} mt>Security</SLabel>
        <SNav to="/admin/watchlist" label="Watchlist" icon={IShield} />
        <SNav to="/scan"            label="Scanner"   icon={ICamera} />
        <SLabel c={S.faint} mt>Reports</SLabel>
        <SNav to="/admin/reports" label="Daily Report" icon={IChart} />
        <SNav to="/admin/logs"    label="Audit Log"    icon={IClock} />
        <SLabel c={S.faint} mt>System</SLabel>
        <SNav to="/admin/managers" label="Manage Admins" icon={IKey} hi />
      </nav>

      <div className="px-2 py-3" style={{ borderTop: `1px solid ${S.border}` }}>
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl cursor-default transition-colors"
          onMouseEnter={e => e.currentTarget.style.background = S.bgh}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs flex-shrink-0"
            style={{ background: `linear-gradient(135deg,${S.accent},#B5604A)`, color: '#FFF8F5' }}>{initials || '?'}</div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate" style={{ color: S.text }}>{email}</div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: S.accent }} />
              <span className="text-[10px]" style={{ color: S.muted }}>System access</span>
            </div>
          </div>
          <SOutBtn onClick={onSignOut} c={S.muted} hc={S.text} />
        </div>
      </div>
    </aside>
  )
}

/* ── Helpers ─────────────────────────────────────────────────────────── */
function SLabel({ children, c, mt }) {
  return <div className={cn('px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider', mt && 'mt-4')} style={{ color: c }}>{children}</div>
}

function ANav({ to, label, badge, icon: Icon }) {
  return (
    <NavLink to={to}
      className={({ isActive }) => cn('nav-indicator group flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 mb-0.5', isActive ? 'active' : '')}
      style={({ isActive }) => isActive ? { background: 'rgba(249,212,35,0.12)', color: '#fff' } : { color: 'rgba(255,255,255,0.45)' }}
    >
      <Icon className="w-4 h-4 flex-shrink-0 transition-transform duration-150 group-hover:scale-110" />
      <span className="flex-1">{label}</span>
      {badge != null && <span className="bg-gold-400 text-brand-900 text-[10px] font-bold rounded px-1.5 py-0.5 leading-none badge-pop">{badge}</span>}
    </NavLink>
  )
}

function SNav({ to, label, badge, icon: Icon, hi }) {
  return (
    <NavLink to={to}
      className="nav-indicator group flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 mb-0.5"
      style={({ isActive }) => isActive
        ? { background: hi ? S.accentS : S.bga, color: hi ? S.accent : S.text }
        : { color: hi ? `${S.accent}88` : S.muted }}
      onMouseEnter={e => { if (!e.currentTarget.getAttribute('aria-current')) { e.currentTarget.style.background = hi ? S.accentS : S.bgh; e.currentTarget.style.color = hi ? S.accent : S.text } }}
      onMouseLeave={e => { if (!e.currentTarget.getAttribute('aria-current')) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = hi ? `${S.accent}88` : S.muted } }}
    >
      <Icon className="w-4 h-4 flex-shrink-0 transition-transform duration-150 group-hover:scale-110" />
      <span className="flex-1">{label}</span>
      {badge != null && <span className="text-[10px] font-bold rounded-md px-1.5 py-0.5 leading-none badge-pop" style={{ background: `${S.accent}25`, color: S.accent }}>{badge}</span>}
    </NavLink>
  )
}

function SOutBtn({ onClick, c, hc }) {
  return (
    <button onClick={onClick} className="w-7 h-7 rounded-md flex items-center justify-center transition-all duration-150 hover:scale-110 active:scale-95"
      style={{ color: c }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = hc }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = c }}
      aria-label="Sign out">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
    </button>
  )
}

/* ── Icons ──────────────────────────────────────────────────────────── */
const IUsers     = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
const ILink      = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
const IBriefcase = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
const IBook      = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
const IShield    = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
const ICamera    = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
const IChart     = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
const IClock     = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
const IKey       = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
