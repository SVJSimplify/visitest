import { useEffect, useState } from 'react'
import TopBar from '../components/TopBar'
import Card, { CardHeader, CardTitle } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input, { Textarea } from '../components/ui/Input'
import Label from '../components/ui/Label'
import Modal from '../components/ui/Modal'
import { EmptyState, ErrorAlert } from '../components/ui/Feedback'
import { useToast } from '../hooks/useToast.jsx'
import { supabase } from '../lib/supabase'
import { explainError, fmtTime, normalizePhone } from '../lib/utils'

export default function AdminWatchlist() {
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [show, setShow] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('watchlist').select('*').eq('active', true).order('created_at', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const remove = async (row) => {
    if (!window.confirm('Remove from watchlist?')) return
    const { error } = await supabase.from('watchlist').update({ active: false }).eq('id', row.id)
    if (error) toast.push(explainError(error), 'error')
    else { toast.push('Removed', 'success'); load() }
  }

  return (
    <>
      <TopBar title="Watchlist" subtitle="Phone or name patterns that block check-in">
        <Button size="sm" variant="danger" onClick={() => setShow(true)}>Add to watchlist</Button>
      </TopBar>

      <div className="p-6 max-w-[1100px]">
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 mb-4 text-sm text-rose-900">
          <strong>Restricted use.</strong> Visitors matching these entries will be blocked at the gate and flagged on the dashboard. Use phone for exact match, name pattern with <code className="bg-rose-100 px-1 rounded">%</code> wildcards (e.g. <code className="bg-rose-100 px-1 rounded">john%</code>).
        </div>

        <Card>
          <CardHeader><CardTitle>Active entries</CardTitle></CardHeader>
          {loading ? (
            <div className="py-12 text-center text-sm text-ink-500">Loading…</div>
          ) : rows.length === 0 ? (
            <EmptyState title="Watchlist is empty" description="Add a phone or name pattern to block visitors at the gate." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200">
                    {['Phone','Name pattern','Reason','Added',''].map(h =>
                      <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500 px-3 py-3">{h}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="border-b border-ink-100 hover:bg-ink-50/60">
                      <td className="px-3 py-3 font-mono text-[12px] text-ink-900">{r.phone || '—'}</td>
                      <td className="px-3 py-3 font-mono text-[12px] text-ink-900">{r.name_pattern || '—'}</td>
                      <td className="px-3 py-3 text-ink-700 max-w-[300px] truncate">{r.reason || '—'}</td>
                      <td className="px-3 py-3 text-ink-500 text-[12px]">{fmtTime(r.created_at)}</td>
                      <td className="px-3 py-3 text-right">
                        <Button size="sm" variant="ghost" onClick={() => remove(r)}>Remove</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <AddForm open={show} onClose={() => setShow(false)} onSaved={() => { load(); setShow(false) }} />
    </>
  )
}

function AddForm({ open, onClose, onSaved }) {
  const toast = useToast()
  const [phone, setPhone] = useState('')
  const [pattern, setPattern] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { if (open) { setPhone(''); setPattern(''); setReason(''); setErr('') } }, [open])

  const submit = async (e) => {
    e.preventDefault()
    if (!phone && !pattern) return setErr('Provide a phone or a name pattern.')
    setBusy(true)
    try {
      const { error } = await supabase.from('watchlist').insert([{
        phone: phone || null,
        name_pattern: pattern || null,
        reason: reason || null,
      }])
      if (error) { setErr(explainError(error)); return }
      toast.push('Added to watchlist', 'success')
      onSaved()
    } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add to watchlist" subtitle="At least one of phone or name pattern is required.">
      <form onSubmit={submit} className="space-y-4">
        <div><Label>Phone (exact)</Label><Input inputMode="numeric" maxLength={10} value={phone} onChange={e => setPhone(normalizePhone(e.target.value))} placeholder="10-digit" /></div>
        <div><Label>Name pattern (SQL LIKE, case-insensitive)</Label><Input maxLength={200} value={pattern} onChange={e => setPattern(e.target.value)} placeholder="john% or %doe%" /></div>
        <div><Label>Reason</Label><Textarea maxLength={500} value={reason} onChange={e => setReason(e.target.value)} placeholder="Why this person is restricted" /></div>
        <ErrorAlert>{err}</ErrorAlert>
        <Button type="submit" loading={busy} variant="danger" className="w-full">Add to watchlist</Button>
      </form>
    </Modal>
  )
}
