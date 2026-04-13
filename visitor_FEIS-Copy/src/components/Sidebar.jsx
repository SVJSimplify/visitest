import { NavLink } from 'react-router-dom'
import { cn } from '../lib/utils'
import { useAuth } from '../hooks/useAuth.jsx'
import { supabase } from '../lib/supabase'
import { ADMIN_LOGIN_PATH } from '../lib/routes'

export default function Sidebar({ insideCount = 0, isSuperadmin = false }) {
  const { session, role } = useAuth()
  const email = session?.user?.email || ''
  const initials = email.slice(0, 2).toUpperCase()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = ADMIN_LOGIN_PATH
  }

  return isSuperadmin
    ? <SuperadminSidebar insideCount={insideCount} email={email} initials={initials} role={role} onSignOut={handleSignOut} />
    : <AdminSidebar insideCount={insideCount} email={email} initials={initials} role={role} onSignOut={handleSignOut} />
}

/* ── Admin sidebar — branded maroon/gold ──────────────────────────────────── */
function AdminSidebar({ insideCount, email, initials, role, onSignOut }) {
  return (
    <aside className="w-60 h-screen bg-ink-950 text-ink-200 flex flex-col fixed left-0 top-0 z-30">
      <div className="px-4 pt-5 pb-4 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-800 flex items-center justify-center text-gold-400 font-bold text-sm">V</div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-semibold text-sm tracking-tight">Visitour</div>
            <div className="text-[11px] text-ink-500">FEIS Management</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <SectionLabel dark>Operations</SectionLabel>
        <NavItem dark to="/admin/visitors" label="Visitors" badge={insideCount > 0 ? insideCount : null} icon={IconUsers} />
        <NavItem dark to="/admin/invites"   label="Invites"   icon={IconLink} />
        <NavItem dark to="/admin/staff"     label="Staff"     icon={IconBriefcase} />
        <NavItem dark to="/admin/students"  label="Students"  icon={IconBook} />
        <SectionLabel dark className="mt-4">Security</SectionLabel>
        <NavItem dark to="/admin/watchlist" label="Watchlist" icon={IconShield} />
        <NavItem dark to="/scan"            label="Scanner"   icon={IconCamera} />
        <SectionLabel dark className="mt-4">Reports</SectionLabel>
        <NavItem dark to="/admin/reports"   label="Daily Report" icon={IconChart} />
      </nav>

      <div className="px-2 py-3 border-t border-white/5">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors">
          <div className="w-8 h-8 rounded-md bg-gold-400 text-brand-900 flex items-center justify-center font-bold text-xs">{initials || '?'}</div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-white font-semibold truncate">{email}</div>
            <div className="text-[10px] text-ink-500 capitalize">{role || 'user'}</div>
          </div>
          <SignOutBtn onClick={onSignOut} dark />
        </div>
      </div>
    </aside>
  )
}

/* ── Superadmin sidebar — Claude.ai inspired ──────────────────────────────── */
function SuperadminSidebar({ insideCount, email, initials, role, onSignOut }) {
  return (
    <aside
      className="w-60 h-screen flex flex-col fixed left-0 top-0 z-30"
      style={{ backgroundColor: '#1C1917', color: '#D6D0C8' }}
    >
      {/* Logo */}
      <div className="px-4 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
            style={{ background: 'rgba(245,240,232,0.12)', color: '#E8C00F' }}
          >V</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold tracking-tight" style={{ color: '#F5F0E8' }}>Visitour</div>
            <div className="text-[11px]" style={{ color: '#78716C' }}>Superadmin</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <SuperSectionLabel>Operations</SuperSectionLabel>
        <SuperNavItem to="/admin/visitors" label="Visitors" badge={insideCount > 0 ? insideCount : null} icon={IconUsers} />
        <SuperNavItem to="/admin/invites"   label="Invites"   icon={IconLink} />
        <SuperNavItem to="/admin/staff"     label="Staff"     icon={IconBriefcase} />
        <SuperNavItem to="/admin/students"  label="Students"  icon={IconBook} />

        <SuperSectionLabel className="mt-4">Security</SuperSectionLabel>
        <SuperNavItem to="/admin/watchlist" label="Watchlist" icon={IconShield} />
        <SuperNavItem to="/scan"            label="Scanner"   icon={IconCamera} />

        <SuperSectionLabel className="mt-4">Reports</SuperSectionLabel>
        <SuperNavItem to="/admin/reports"   label="Daily Report" icon={IconChart} />
        <SuperNavItem to="/admin/logs"      label="Audit Log"    icon={IconClock} />
      </nav>

      {/* User */}
      <div className="px-2 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div
          className="flex items-center gap-2.5 px-2 py-2 rounded-xl transition-colors cursor-default"
          style={{ '--hover-bg': 'rgba(245,240,232,0.06)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,240,232,0.06)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs flex-shrink-0"
            style={{ background: 'rgba(245,240,232,0.15)', color: '#F5F0E8' }}
          >{initials || '?'}</div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate" style={{ color: '#F5F0E8' }}>{email}</div>
            <div className="text-[10px]" style={{ color: '#78716C' }}>Superadmin</div>
          </div>
          <SignOutBtn onClick={onSignOut} />
        </div>
      </div>
    </aside>
  )
}

/* ── Shared sub-components ────────────────────────────────────────────────── */

function SectionLabel({ children, dark, className }) {
  return (
    <div className={cn(
      'px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider',
      dark ? 'text-ink-500' : 'text-[#78716C]',
      className
    )}>
      {children}
    </div>
  )
}

function SuperSectionLabel({ children, className }) {
  return (
    <div className={cn('px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider', className)}
      style={{ color: '#57534E' }}>
      {children}
    </div>
  )
}

function NavItem({ to, label, badge, icon: Icon, dark }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => cn(
        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors mb-0.5',
        dark
          ? isActive ? 'bg-white/10 text-white' : 'text-ink-400 hover:text-white hover:bg-white/5'
          : isActive ? 'bg-white/10 text-white' : 'text-ink-400 hover:text-white hover:bg-white/5'
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1">{label}</span>
      {badge != null && (
        <span className="bg-gold-400 text-brand-900 text-[10px] font-bold rounded px-1.5 py-0.5 leading-none">
          {badge}
        </span>
      )}
    </NavLink>
  )
}

function SuperNavItem({ to, label, badge, icon: Icon }) {
  return (
    <NavLink
      to={to}
      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all mb-0.5"
      style={({ isActive }) => isActive
        ? { background: 'rgba(245,240,232,0.10)', color: '#F5F0E8' }
        : { color: '#A8A29E' }
      }
      onMouseEnter={e => { if (!e.currentTarget.dataset.active) e.currentTarget.style.background = 'rgba(245,240,232,0.05)'; e.currentTarget.style.color = '#F5F0E8' }}
      onMouseLeave={e => { if (!e.currentTarget.getAttribute('aria-current')) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#A8A29E' } }}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1">{label}</span>
      {badge != null && (
        <span
          className="text-[10px] font-bold rounded-md px-1.5 py-0.5 leading-none"
          style={{ background: 'rgba(245,240,232,0.15)', color: '#E8C00F' }}
        >
          {badge}
        </span>
      )}
    </NavLink>
  )
}

function SignOutBtn({ onClick, dark }) {
  return (
    <button
      onClick={onClick}
      className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
      style={{ color: dark ? undefined : '#57534E' }}
      onMouseEnter={e => { e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.1)' : 'rgba(245,240,232,0.1)'; e.currentTarget.style.color = '#F5F0E8' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = dark ? '' : '#57534E' }}
      aria-label="Sign out"
      title="Sign out"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
      </svg>
    </button>
  )
}

/* ── Icons ───────────────────────────────────────────────────────────────── */
const IconUsers     = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
const IconLink      = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
const IconBriefcase = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
const IconBook      = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
const IconShield    = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
const IconCamera    = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
const IconChart     = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
const IconClock     = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>