import { useEffect, useState, createContext, useContext } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { isAdminRole } from '../lib/supabase'
import { supabase } from '../lib/supabase'
import { ADMIN_LOGIN_PATH } from '../lib/routes'
import Sidebar from '../components/Sidebar'
import { Spinner } from '../components/ui/Feedback'

// Context so child pages can trigger the sidebar open
export const SidebarContext = createContext({ open: false, setOpen: () => {} })
export const useSidebar = () => useContext(SidebarContext)

export default function AdminLayout() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { session, role, loading } = useAuth()
  const [insideCount, setInsideCount] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  useEffect(() => {
    if (loading) return
    if (!session || !isAdminRole(role)) {
      navigate(ADMIN_LOGIN_PATH, { replace: true })
    }
  }, [session, role, loading, navigate])

  // Realtime inside-count badge for sidebar
  useEffect(() => {
    if (!isAdminRole(role)) return
    let mounted = true
    const load = async () => {
      const { count } = await supabase
        .from('visitors')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'INSIDE')
      if (mounted) setInsideCount(count || 0)
    }
    load()
    const ch = supabase
      .channel(`sidebar-rt-${Math.random().toString(36).slice(2, 10)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visitors' }, load)
      .subscribe()
    return () => { mounted = false; supabase.removeChannel(ch) }
  }, [role])

  if (loading || !session || !isAdminRole(role)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  const isSuperadmin = role === 'superadmin'

  return (
    <SidebarContext.Provider value={{ open: sidebarOpen, setOpen: setSidebarOpen }}>
      <div
        className="min-h-screen"
        style={{ backgroundColor: isSuperadmin ? '#F5F0E8' : undefined }}
        data-theme={isSuperadmin ? 'superadmin' : 'admin'}
      >
        {!isSuperadmin && <div className="fixed inset-0 bg-ink-50 -z-10" />}

        {/* ── Sidebar overlay (mobile tap-outside to close) ── */}
        <div
          className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />

        {/* ── Sidebar ── */}
        <Sidebar
          insideCount={insideCount}
          isSuperadmin={isSuperadmin}
          mobileOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* ── Main content area ── */}
        <div className="admin-main min-h-screen flex flex-col">

          {/* Mobile top bar with hamburger */}
          <div className="md:hidden sticky top-0 z-30 bg-ink-950 border-b border-white/10 flex items-center px-4 h-14"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-10 h-10 flex items-center justify-center text-ink-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors mr-3"
              aria-label="Open menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-brand-800 flex items-center justify-center text-gold-400 font-bold text-xs">V</div>
              <span className="text-white font-semibold text-sm tracking-tight">Visitour</span>
            </div>
            {insideCount > 0 && (
              <span className="ml-auto bg-gold-400 text-brand-900 text-[10px] font-bold rounded px-2 py-0.5 badge-pop">
                {insideCount} inside
              </span>
            )}
          </div>

          {/* Page content */}
          <main className="flex-1 page-enter">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  )
}
