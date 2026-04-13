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
import { explainError, normalizePhone, isValidPhone } from '../lib/utils'

export default function AdminStudents() {
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('students').select('*').eq('active', true).order('name')
    setRows(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const remove = async (row) => {
    if (!window.confirm(`Remove ${row.name}?`)) return
    const { error } = await supabase.from('students').update({ active: false }).eq('id', row.id)
    if (error) toast.push(explainError(error), 'error')
    else { toast.push('Student removed', 'success'); load() }
  }

  const filtered = rows.filter(r => {
    if (!search) return true
    const s = search.toLowerCase()
    return r.name?.toLowerCase().includes(s) || r.parent_phone?.includes(s) || r.parent_name?.toLowerCase().includes(s)
  })

  return (
    <>
      <TopBar title="Students" subtitle="Linked to parents for pickup verification">
        <Button size="sm" onClick={() => setEditing('new')}>Add student</Button>
      </TopBar>

      <div className="p-6 max-w-[1100px]">
        <Card>
          <CardHeader>
            <CardTitle>All students</CardTitle>
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or parent phone" className="h-9 w-72" />
          </CardHeader>
          {loading ? (
            <div className="py-12 text-center text-sm text-ink-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title={search ? 'No matches' : 'No students yet'}
              description="Adding students lets the scanner show which child a parent is picking up."
              action={!search && <Button size="sm" onClick={() => setEditing('new')}>Add first student</Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200">
                    {['Student','Class','Parent','Phone',''].map(h =>
                      <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500 px-3 py-3">{h}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} className="border-b border-ink-100 hover:bg-ink-50/60">
                      <td className="px-3 py-3 font-semibold text-ink-900">{r.name}</td>
                      <td className="px-3 py-3 text-ink-700">{r.class || '—'}{r.section ? `-${r.section}` : ''}</td>
                      <td className="px-3 py-3 text-ink-700">{r.parent_name || '—'}</td>
                      <td className="px-3 py-3 text-ink-700 font-mono text-[12px]">{r.parent_phone || '—'}</td>
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

      <StudentForm open={!!editing} onClose={() => setEditing(null)} row={editing === 'new' ? null : editing} onSaved={() => { load(); setEditing(null) }} />
    </>
  )
}

function StudentForm({ open, onClose, row, onSaved }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [klass, setKlass] = useState('')
  const [section, setSection] = useState('')
  const [parentName, setParentName] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (open) {
      setName(row?.name || ''); setKlass(row?.class || ''); setSection(row?.section || '')
      setParentName(row?.parent_name || ''); setParentPhone(row?.parent_phone || '')
      setErr('')
    }
  }, [open, row])

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return setErr('Student name required.')
    if (parentPhone && !isValidPhone(parentPhone)) return setErr('Parent phone must be 10 digits.')
    setBusy(true)
    try {
      const payload = {
        name: name.trim(), class: klass.trim() || null, section: section.trim() || null,
        parent_name: parentName.trim() || null, parent_phone: parentPhone || null,
      }
      const q = row
        ? supabase.from('students').update(payload).eq('id', row.id)
        : supabase.from('students').insert([payload])
      const { error } = await q
      if (error) { setErr(explainError(error)); return }
      toast.push(row ? 'Student updated' : 'Student added', 'success')
      onSaved()
    } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={row ? 'Edit student' : 'Add student'}>
      <form onSubmit={submit} className="space-y-4">
        <div><Label required>Student name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Class</Label><Input value={klass} onChange={e => setKlass(e.target.value)} placeholder="V" /></div>
          <div><Label>Section</Label><Input value={section} onChange={e => setSection(e.target.value)} placeholder="A" /></div>
        </div>
        <div><Label>Parent name</Label><Input value={parentName} onChange={e => setParentName(e.target.value)} /></div>
        <div><Label>Parent phone</Label><Input inputMode="numeric" maxLength={10} value={parentPhone} onChange={e => setParentPhone(normalizePhone(e.target.value))} placeholder="10-digit" /></div>
        <ErrorAlert>{err}</ErrorAlert>
        <Button type="submit" loading={busy} className="w-full">{row ? 'Save changes' : 'Add student'}</Button>
      </form>
    </Modal>
  )
}
