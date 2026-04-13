import { useMemo, useState } from 'react'
import TopBar, { LivePill } from '../components/TopBar'
import StatsCards from '../components/StatsCards'
import VisitorTable from '../components/VisitorTable'
import Card, { CardHeader, CardTitle } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input, { Select } from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import { useRealtimeVisitors } from '../hooks/useRealtimeVisitors'
import { useToast } from '../hooks/useToast.jsx'
import { supabase } from '../lib/supabase'
import { explainError } from '../lib/utils'

export default function AdminVisitors() {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [gate, setGate] = useState('')
  const [dateRange, setDateRange] = useState('today')
  const [lightbox, setLightbox] = useState(null) // { src, name }

  const { from, to } = useMemo(() => {
    const now = new Date()
    const start = new Date(now); start.setHours(0, 0, 0, 0)
    if (dateRange === 'today') {
      const end = new Date(start); end.setDate(end.getDate() + 1)
      return { from: start, to: end }
    }
    if (dateRange === 'week') {
      const end = new Date(start); end.setDate(end.getDate() + 1)
      const begin = new Date(start); begin.setDate(begin.getDate() - 7)
      return { from: begin, to: end }
    }
    return { from: null, to: null } // all time
  }, [dateRange])

  const { rows, loading } = useRealtimeVisitors({ from, to, gate: gate || null, search })

  const stats = useMemo(() => {
    let inside = 0, left = 0, expired = 0
    for (const v of rows) {
      if (v.status === 'INSIDE')                                      inside++
      else if (v.status === 'LEFT' || v.status === 'FORCED_OUT')      left++
      else if (v.status === 'EXPIRED')                                expired++
    }
    return { inside, total: rows.length, left, expired }
  }, [rows])

  const onForceCheckout = async (v) => {
    const ok = window.confirm(`Force-checkout ${v.name}? They will be marked as checked out at the current time.`)
    if (!ok) return
    const { error } = await supabase
      .from('visitors')
      .update({ status: 'FORCED_OUT', checked_out_at: new Date().toISOString() })
      .eq('id', v.id)
    if (error) toast.push(explainError(error), 'error')
    else toast.push(`${v.name} marked checked out`, 'success')
  }

  const exportCsv = () => {
    const headers = ['name','role','phone','purpose','meet','gate','status','checked_in_at','checked_out_at']
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `visitors-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <TopBar title="Visitor Log" subtitle={`${stats.total} record${stats.total === 1 ? '' : 's'} · ${stats.inside} inside now`}>
        <LivePill />
        <Button variant="secondary" size="sm" onClick={exportCsv}>Export CSV</Button>
      </TopBar>

      <div className="p-6 max-w-[1400px]">
        <StatsCards inside={stats.inside} total={stats.total} left={stats.left} expired={stats.expired} />

        <Card>
          <CardHeader>
            <CardTitle>All visitors</CardTitle>
            <div className="flex items-center gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, phone, purpose"
                className="h-9 w-64"
              />
              <Select value={gate} onChange={(e) => setGate(e.target.value)} className="h-9 w-36">
                <option value="">All gates</option>
                <option value="gate-main">Main Gate</option>
                <option value="gate-east">East Gate</option>
              </Select>
              <Select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="h-9 w-32">
                <option value="today">Today</option>
                <option value="week">Last 7 days</option>
                <option value="all">All time</option>
              </Select>
            </div>
          </CardHeader>
          {loading ? (
            <div className="py-12 text-center text-sm text-ink-500">Loading…</div>
          ) : (
            <VisitorTable
              rows={rows}
              onPhoto={(src, name) => setLightbox({ src, name })}
              onForceCheckout={onForceCheckout}
            />
          )}
        </Card>
      </div>

      <Modal open={!!lightbox} onClose={() => setLightbox(null)} size="xl" title={lightbox?.name}>
        {lightbox && (
          <img src={lightbox.src} alt={lightbox.name} className="w-full rounded-lg" />
        )}
      </Modal>
    </>
  )
}
