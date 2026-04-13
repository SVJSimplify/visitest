import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar'
import Card, { CardHeader, CardTitle } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import { EmptyState, Spinner } from '../components/ui/Feedback'
import { useAuth } from '../hooks/useAuth.jsx'
import { supabase } from '../lib/supabase'
import { fmtTime, timeSince } from '../lib/utils'

export default function AdminLogs() {
  const navigate = useNavigate()
  const { role, loading: authLoading } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (role !== 'superadmin') {
      navigate('/admin/visitors', { replace: true })
      return
    }
    supabase.from('admin_logs').select('*').order('logged_in_at', { ascending: false }).limit(200)
      .then(({ data }) => { setRows(data || []); setLoading(false) })
  }, [role, authLoading, navigate])

  return (
    <>
      <TopBar title="Audit Log" subtitle="Sign-in history for admin and security users" />

      <div className="p-6 max-w-[1100px]">
        <Card>
          <CardHeader><CardTitle>Recent sign-ins</CardTitle></CardHeader>
          {loading ? (
            <div className="py-12 flex justify-center"><Spinner /></div>
          ) : rows.length === 0 ? (
            <EmptyState title="No login events" description="Sign-ins will appear here automatically." />
          ) : (
            <div className="divide-y divide-ink-100">
              {rows.map(log => (
                <div key={log.id} className="flex items-center gap-3 px-5 py-3 hover:bg-ink-50/60">
                  <div className="w-9 h-9 rounded-md bg-brand-50 text-brand-800 flex items-center justify-center font-bold text-xs">
                    {(log.email || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-ink-900 truncate">{log.email || 'Unknown'}</div>
                    <div className="mt-0.5">
                      <Badge tone={log.role === 'superadmin' ? 'gold' : 'brand'}>{log.role || 'admin'}</Badge>
                    </div>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <div className="text-xs text-ink-700">{fmtTime(log.logged_in_at)}</div>
                    <div className="text-[11px] text-ink-400">{timeSince(log.logged_in_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
