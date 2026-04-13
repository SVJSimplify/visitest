import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { isAdminRole } from '../lib/supabase'
import { supabase } from '../lib/supabase'
import { ADMIN_LOGIN_PATH } from '../lib/routes'
import Sidebar from '../components/Sidebar'
import { Spinner } from '../components/ui/Feedback'

export default function AdminLayout() {
  const navigate = useNavigate()
  const { session, role, loading } = useAuth()
  const [insideCount, setInsideCount] = useState(0)

  useEffect(() => {
    if (loading) return
    if (!session || !isAdminRole(role)) {
      navigate(ADMIN_LOGIN_PATH, { replace: true })
    }
  }, [session, role, loading, navigate])

  // Subscribe to inside count for sidebar badge
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
    const channelName = `sidebar-rt-${Math.random().toString(36).slice(2, 10)}`
    const ch = supabase
      .channel(channelName)
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
    <div
      className="min-h-screen"
      style={{ backgroundColor: isSuperadmin ? '#F5F0E8' : undefined }}
      data-theme={isSuperadmin ? 'superadmin' : 'admin'}
    >
      {!isSuperadmin && <div className="fixed inset-0 bg-ink-50 -z-10" />}
      <Sidebar insideCount={insideCount} isSuperadmin={isSuperadmin} />
      <div className="ml-60 min-h-screen flex flex-col">
        <Outlet />
      </div>
    </div>
  )
}