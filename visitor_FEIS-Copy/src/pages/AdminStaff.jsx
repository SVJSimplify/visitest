import { useEffect, useState } from 'react'
import TopBar from '../components/TopBar'
import Card, { CardHeader, CardTitle } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Label from '../components/ui/Label'
import Modal from '../components/ui/Modal'
import { EmptyState, ErrorAlert } from '../components/ui/Feedback'
import { useToast } from '../hooks/useToast.jsx'
import { supabase } from '../lib/supabase'
import { explainError } from '../lib/utils'

export default function AdminStaff() {
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // null | 'new' | row

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('staff').select('*').order('name')
    setRows(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const remove = async (row) => {
    if (!window.confirm(`Remove ${row.name}?`)) return
    const { error } = await supabase.from('staff').update({ active: false }).eq('id', row.id)
    if (error) toast.push(explainError(error), 'error')
    else { toast.push('Staff removed', 'success'); load() }
  }

  return (
    <>
      <TopBar title="Staff" subtitle="People visitors can come to meet">
        <Button size="sm" onClick={() => setEditing('new')}>Add staff</Button>
      </TopBar>

      <div className="p-6 max-w-[1100px]">
        <Card>
          <CardHeader><CardTitle>All staff</CardTitle></CardHeader>
          {loading ? (
            <div className="py-12 text-center text-sm text-ink-500">Loading…</div>
          ) : rows.filter(r => r.active).length === 0 ? (
            <EmptyState title="No staff yet" description="Add staff so visitors can pre-register to meet them and they get notified on arrival." action={<Button size="sm" onClick={() => setEditing('new')}>Add first staff member</Button>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200">
                    {['Name','Department','Email','Phone',''].map(h =>
                      <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500 px-3 py-3">{h}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.filter(r => r.active).map(r => (
                    <tr key={r.id} className="border-b border-ink-100 hover:bg-ink-50/60">
                      <td className="px-3 py-3 font-semibold text-ink-900">{r.name}</td>
                      <td className="px-3 py-3 text-ink-700">{r.department || '—'}</td>
                      <td className="px-3 py-3 text-ink-700 text-[12px]">{r.email || '—'}</td>
                      <td className="px-3 py-3 text-ink-700 font-mono text-[12px]">{r.phone || '—'}</td>
                      <td className="px-3 py-3 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>Edit</Button>
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

      <StaffForm open={!!editing} onClose={() => setEditing(null)} row={editing === 'new' ? null : editing} onSaved={() => { load(); setEditing(null) }} />
    </>
  )
}

function StaffForm({ open, onClose, row, onSaved }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [department, setDepartment] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (open) {
      setName(row?.name || '')
      setDepartment(row?.department || '')
      setEmail(row?.email || '')
      setPhone(row?.phone || '')
      setErr('')
    }
  }, [open, row])

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return setErr('Name is required.')
    if (phone && !/^[0-9]{10}$/.test(phone)) return setErr('Phone must be exactly 10 digits.')
    setBusy(true)
    try {
      const payload = { name: name.trim(), department: department.trim() || null, email: email.trim() || null, phone: phone.trim() || null }
      const q = row
        ? supabase.from('staff').update(payload).eq('id', row.id)
        : supabase.from('staff').insert([payload])
      const { error } = await q
      if (error) { setErr(explainError(error)); return }
      toast.push(row ? 'Staff updated' : 'Staff added', 'success')
      onSaved()
    } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={row ? 'Edit staff' : 'Add staff'}>
      <form onSubmit={submit} className="space-y-4">
        <div><Label required>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
        <div><Label>Department</Label><Input value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Class V Teacher" /></div>
        <div><Label>Email (used for arrival notifications)</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@feis.school" /></div>
        <div>
          <Label>Phone</Label>
          <Input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="10-digit number"
            maxLength={10}
          />
          {phone.length > 0 && phone.length !== 10 && (
            <p className="text-xs text-rose-600 mt-1">{phone.length}/10 digits</p>
          )}
        </div>
        <ErrorAlert>{err}</ErrorAlert>
        <Button type="submit" loading={busy} className="w-full">{row ? 'Save changes' : 'Add staff member'}</Button>
      </form>
    </Modal>
  )
}