import { useEffect, useState } from 'react'
import TopBar from '../components/TopBar'
import Card, { CardHeader, CardTitle } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { Spinner, EmptyState } from '../components/ui/Feedback'
import { supabase } from '../lib/supabase'
import { explainError, fmtTime } from '../lib/utils'
import { useToast } from '../hooks/useToast.jsx'

export default function AdminReports() {
  const toast = useToast()
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [report, setReport] = useState(null)
  const [visitors, setVisitors] = useState([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('daily_report', { p_date: date })
      if (error) { toast.push(explainError(error), 'error'); return }
      setReport(data?.[0] || null)

      // Use the same date range the RPC uses: [date 00:00, date+1 00:00)
      // local-time. Single source of truth, no off-by-millisecond drift.
      const start = new Date(date + 'T00:00:00')
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
      const { data: vs } = await supabase
        .from('visitors')
        .select('*')
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString())
        .order('checked_in_at', { ascending: true })
      setVisitors(vs || [])
    } finally { setLoading(false) }
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [date])

  const print = () => window.print()

  return (
    <>
      <TopBar title="Daily Report" subtitle="Visitor activity, peak times, gates and purposes">
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 w-44" />
        <Button size="sm" variant="secondary" onClick={print}>Print / Save PDF</Button>
      </TopBar>

      <div className="p-6 max-w-[1100px] print-area">
        {loading ? (
          <div className="py-16 flex justify-center"><Spinner /></div>
        ) : !report ? (
          <EmptyState title="No data" description="There are no visitors for this date yet." />
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <Stat label="Total visitors" value={report.total_visitors} />
              <Stat label="Inside now"     value={report.inside_now} accent="text-emerald-600" />
              <Stat label="Checked out"    value={report.checked_out} />
              <Stat label="Peak hour"      value={report.peak_count > 0 ? `${report.peak_hour}:00` : '—'} hint={`${report.peak_count} visits`} />
            </div>

            <div className="grid lg:grid-cols-2 gap-4 mb-6">
              <Card>
                <CardHeader><CardTitle>By gate</CardTitle></CardHeader>
                <div className="p-5">
                  {Object.keys(report.by_gate || {}).length === 0 ? (
                    <p className="text-sm text-ink-500">No gate data.</p>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(report.by_gate).map(([g, c]) => (
                        <BarRow key={g} label={g.replace('gate-', '')} value={c} max={report.total_visitors} />
                      ))}
                    </div>
                  )}
                </div>
              </Card>
              <Card>
                <CardHeader><CardTitle>Top purposes</CardTitle></CardHeader>
                <div className="p-5">
                  {Object.keys(report.by_purpose || {}).length === 0 ? (
                    <p className="text-sm text-ink-500">No purpose data.</p>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(report.by_purpose).map(([p, c]) => (
                        <BarRow key={p} label={p} value={c} max={report.total_visitors} />
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle>All visitors on {date}</CardTitle></CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-200">
                      {['Name','Role','Phone','Purpose','Check-in','Check-out'].map(h =>
                        <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500 px-3 py-3">{h}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {visitors.map(v => (
                      <tr key={v.id} className="border-b border-ink-100">
                        <td className="px-3 py-2.5 font-semibold text-ink-900">{v.name}</td>
                        <td className="px-3 py-2.5 text-ink-700">{v.role}</td>
                        <td className="px-3 py-2.5 font-mono text-[12px] text-ink-700">{v.phone}</td>
                        <td className="px-3 py-2.5 text-ink-700">{v.purpose}</td>
                        <td className="px-3 py-2.5 text-ink-700 text-[12px]">{fmtTime(v.checked_in_at)}</td>
                        <td className="px-3 py-2.5 text-ink-700 text-[12px]">{fmtTime(v.checked_out_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </>
  )
}

function Stat({ label, value, hint, accent = 'text-ink-900' }) {
  return (
    <div className="bg-white border border-ink-200 rounded-xl px-5 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">{label}</div>
      <div className={`text-3xl font-bold tracking-tight mt-1.5 ${accent}`}>{value}</div>
      {hint && <div className="text-[11px] text-ink-400 mt-0.5">{hint}</div>}
    </div>
  )
}

function BarRow({ label, value, max }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div>
      <div className="flex justify-between text-xs font-medium text-ink-700 mb-1">
        <span className="capitalize truncate pr-2">{label}</span>
        <span className="text-ink-900 font-semibold tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
        <div className="h-full bg-brand-800 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
