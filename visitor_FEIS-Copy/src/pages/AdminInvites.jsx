import { useEffect, useState } from 'react'
import TopBar from '../components/TopBar'
import Card, { CardHeader, CardTitle } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input, { Select, Textarea } from '../components/ui/Input'
import Label from '../components/ui/Label'
import Modal from '../components/ui/Modal'
import Badge from '../components/ui/Badge'
import { EmptyState, ErrorAlert } from '../components/ui/Feedback'
import { useToast } from '../hooks/useToast.jsx'
import { supabase } from '../lib/supabase'
import { fmtTime, normalizePhone, isValidPhone, explainError } from '../lib/utils'

export default function AdminInvites() {
  const toast = useToast()
  const [invites, setInvites] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const load = async () => {
    setLoading(true)
    const [{ data: invs }, { data: stf }] = await Promise.all([
      supabase.from('invites').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('staff').select('*').eq('active', true).order('name'),
    ])
    setInvites(invs || [])
    setStaff(stf || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const copyLink = (token) => {
    const url = `${window.location.origin}/invite/${token}`
    navigator.clipboard?.writeText(url).then(
      () => toast.push('Invite link copied', 'success'),
      () => toast.push('Could not copy. Long-press to copy manually.', 'warn')
    )
  }

  return (
    <>
      <TopBar title="Invites" subtitle="Pre-register visitors with a personal QR link">
        <Button size="sm" onClick={() => setShowCreate(true)}>New invite</Button>
      </TopBar>

      <div className="p-6 max-w-[1200px]">
        <Card>
          <CardHeader><CardTitle>Active and recent invites</CardTitle></CardHeader>
          {loading ? (
            <div className="py-12 text-center text-sm text-ink-500">Loading…</div>
          ) : invites.length === 0 ? (
            <EmptyState
              title="No invites yet"
              description="Create an invite link to pre-register a parent or visitor. They'll skip the queue at the gate."
              action={<Button size="sm" onClick={() => setShowCreate(true)}>Create your first invite</Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200">
                    {['Visitor','Phone','Purpose','Host','Valid until','Status','Link'].map(h => (
                      <th key={h} className="text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500 px-3 py-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invites.map(i => {
                    const expired = new Date(i.valid_until) < new Date()
                    const host = staff.find(s => s.id === i.host_staff_id)
                    return (
                      <tr key={i.id} className="border-b border-ink-100 hover:bg-ink-50/60">
                        <td className="px-3 py-3 font-semibold text-ink-900">{i.visitor_name}</td>
                        <td className="px-3 py-3 text-ink-700 font-mono text-[12px]">{i.visitor_phone || '—'}</td>
                        <td className="px-3 py-3 text-ink-700 max-w-[200px] truncate">{i.purpose}</td>
                        <td className="px-3 py-3 text-ink-700">{host?.name || '—'}</td>
                        <td className="px-3 py-3 text-ink-700 text-[12px] whitespace-nowrap">{fmtTime(i.valid_until)}</td>
                        <td className="px-3 py-3">
                          {i.used      ? <Badge tone="left">Used</Badge> :
                           expired     ? <Badge tone="expired">Expired</Badge> :
                                         <Badge tone="inside">Active</Badge>}
                        </td>
                        <td className="px-3 py-3">
                          {!i.used && !expired && (
                            <Button size="sm" variant="ghost" onClick={() => copyLink(i.token)}>Copy link</Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <CreateInviteModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        staff={staff}
        onCreated={() => { load(); setShowCreate(false) }}
      />
    </>
  )
}

function CreateInviteModal({ open, onClose, staff, onCreated }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [purpose, setPurpose] = useState('')
  const [hostId, setHostId] = useState('')
  const [validHours, setValidHours] = useState('24')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [created, setCreated] = useState(null)

  const reset = () => {
    setName(''); setPhone(''); setPurpose(''); setHostId(''); setValidHours('24')
    setErr(''); setCreated(null)
  }

  useEffect(() => { if (open) reset() }, [open])

  const submit = async (e) => {
    e?.preventDefault?.()
    setErr('')
    if (!name.trim() || name.trim().length < 2) return setErr('Enter a visitor name.')
    if (phone && !isValidPhone(phone)) return setErr('Phone must be 10 digits.')
    if (!purpose.trim()) return setErr('Enter a purpose.')
    setBusy(true)
    try {
      const valid_until = new Date(Date.now() + Number(validHours) * 3600 * 1000).toISOString()
      const { data, error } = await supabase
        .from('invites')
        .insert([{
          visitor_name: name.trim(),
          visitor_phone: phone || null,
          purpose: purpose.trim(),
          host_staff_id: hostId || null,
          valid_until,
        }])
        .select()
        .single()
      if (error) { setErr(explainError(error)); return }
      setCreated(data)
      toast.push('Invite created', 'success')
    } catch (e) {
      setErr(explainError(e))
    } finally { setBusy(false) }
  }

  const inviteUrl = created ? `${window.location.origin}/invite/${created.token}` : ''

  return (
    <Modal open={open} onClose={onClose} title={created ? 'Invite ready' : 'New invite'} subtitle={created ? 'Share this link with the visitor.' : 'Create a pre-registered QR link.'}>
      {created ? (
        <div className="space-y-4">
          <div className="bg-ink-50 border border-ink-200 rounded-lg p-3 break-all text-xs font-mono text-ink-800">
            {inviteUrl}
          </div>
          <div className="flex gap-2">
            <Button variant="primary" className="flex-1" onClick={() => {
              navigator.clipboard?.writeText(inviteUrl)
              toast.push('Link copied', 'success')
            }}>Copy link</Button>
            <Button variant="secondary" className="flex-1" onClick={() => {
              const text = `Hi ${created.visitor_name}, your visitor pass for FEIS: ${inviteUrl}`
              window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
            }}>Share on WhatsApp</Button>
          </div>
          <Button variant="ghost" className="w-full" onClick={() => { onCreated?.(); }}>Done</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="iv-name" required>Visitor name</Label>
            <Input id="iv-name" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
          </div>
          <div>
            <Label htmlFor="iv-phone">Phone (optional)</Label>
            <Input id="iv-phone" inputMode="numeric" maxLength={10} value={phone} onChange={e => setPhone(normalizePhone(e.target.value))} placeholder="10-digit" />
          </div>
          <div>
            <Label htmlFor="iv-purpose" required>Purpose</Label>
            <Input id="iv-purpose" value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Reason for visit" />
          </div>
          <div>
            <Label htmlFor="iv-host">Host (staff member)</Label>
            <Select id="iv-host" value={hostId} onChange={e => setHostId(e.target.value)}>
              <option value="">— None —</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name}{s.department ? ` · ${s.department}` : ''}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="iv-valid">Valid for</Label>
            <Select id="iv-valid" value={validHours} onChange={e => setValidHours(e.target.value)}>
              <option value="1">1 hour</option>
              <option value="4">4 hours</option>
              <option value="24">24 hours</option>
              <option value="72">3 days</option>
              <option value="168">1 week</option>
            </Select>
          </div>
          <ErrorAlert>{err}</ErrorAlert>
          <Button type="submit" loading={busy} className="w-full">Create invite</Button>
        </form>
      )}
    </Modal>
  )
}
