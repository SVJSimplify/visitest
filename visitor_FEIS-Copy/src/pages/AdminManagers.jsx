import { useEffect, useState } from 'react'
import TopBar from '../components/TopBar'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import { ErrorAlert, Spinner } from '../components/ui/Feedback'
import { useToast } from '../hooks/useToast.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { supabase } from '../lib/supabase'
import { explainError } from '../lib/utils'

/* Anthropic palette (matches SystemSidebar) */
const S = { accent: '#CC785C', accentS: 'rgba(204,120,92,0.12)', border: 'rgba(28,25,23,0.10)', text: '#1C1917', muted: '#78716C' }

export default function AdminManagers() {
  const toast        = useToast()
  const { role }     = useAuth()
  const isSuperadmin = role === 'superadmin'

  const [admins,    setAdmins]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [target,    setTarget]    = useState(null)  // admin being kicked
  const [kickBusy,  setKickBusy]  = useState(false)
  const [kickErr,   setKickErr]   = useState('')
  const [kickReason, setKickReason] = useState('')

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('list_admin_accounts')
    if (!error && data) setAdmins(data)
    setLoading(false)
  }

  useEffect(() => { if (isSuperadmin) load() }, [isSuperadmin])

  const confirmKick = (admin) => {
    setTarget(admin)
    setKickErr('')
    setKickReason('')
  }

  const doKick = async () => {
    if (!target) return
    setKickBusy(true)
    setKickErr('')
    try {
      const { error } = await supabase.rpc('kick_admin', {
        p_user_id: target.id,
        p_reason:  kickReason.trim() || 'Removed by system administrator',
      })
      if (error) throw error
      toast.push(`${target.email} has been removed`, 'success')
      setTarget(null)
      load()
    } catch (e) {
      setKickErr(explainError(e))
    } finally {
      setKickBusy(false)
    }
  }

  const fmtDate = (iso) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  if (!isSuperadmin) {
    return (
      <>
        <TopBar title="Access Denied" />
        <div className="p-8 text-center text-sm text-ink-500">You don't have permission to view this page.</div>
      </>
    )
  }

  return (
    <>
      {/* TopBar uses the system (superadmin) style automatically */}
      <TopBar title="Manage Admins" subtitle="View and revoke admin access" />

      <div className="p-4 sm:p-6 max-w-[900px] page-enter">

        {/* Info banner */}
        <div className="mb-5 rounded-2xl border px-5 py-4 animate-rise"
          style={{ background: S.accentS, borderColor: `${S.accent}30` }}>
          <div className="flex items-start gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0 mt-0.5" style={{ color: S.accent }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div>
              <div className="text-sm font-semibold" style={{ color: S.text }}>Administrator accounts</div>
              <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                Revoking access signs out the admin immediately and disables their account. This action is logged in the audit trail. It cannot be undone from the UI — re-enable requires direct database access.
              </p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-ink-200 shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-ink-900">All administrators</div>
              <div className="text-[11px] text-ink-500 mt-0.5">{admins.length} account{admins.length !== 1 ? 's' : ''}</div>
            </div>
            <button onClick={load} className="text-xs font-medium text-ink-500 hover:text-ink-900 transition-colors flex items-center gap-1.5 min-h-[36px] px-2">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="py-16 flex justify-center"><Spinner /></div>
          ) : admins.length === 0 ? (
            <div className="py-16 text-center text-sm text-ink-400">No admin accounts found.</div>
          ) : (
            <div className="divide-y divide-ink-100">
              {admins.map(admin => (
                <div key={admin.id} className="flex items-center gap-4 px-5 py-4 hover:bg-ink-50/60 transition-colors stagger">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
                    style={{
                      background: admin.suspended ? '#f5f5f5' : `linear-gradient(135deg,${S.accent},#B5604A)`,
                      color: admin.suspended ? '#a3a3a3' : '#FFF8F5',
                    }}>
                    {admin.email?.slice(0, 2).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-ink-900 truncate">{admin.email}</span>
                      {admin.suspended ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                          Suspended
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-ink-500 mt-0.5">
                      Added {fmtDate(admin.created_at)}
                      {admin.last_sign_in_at && <> · Last login {fmtDate(admin.last_sign_in_at)}</>}
                    </div>
                  </div>

                  {/* Action */}
                  {!admin.suspended && (
                    <button
                      onClick={() => confirmKick(admin)}
                      className="flex-shrink-0 text-xs font-semibold px-3 py-2 rounded-lg border transition-all duration-150 hover:scale-105 active:scale-95 min-h-[36px]"
                      style={{ borderColor: `${S.accent}40`, color: S.accent, background: S.accentS }}
                      onMouseEnter={e => { e.currentTarget.style.background = `${S.accent}22`; e.currentTarget.style.borderColor = S.accent }}
                      onMouseLeave={e => { e.currentTarget.style.background = S.accentS; e.currentTarget.style.borderColor = `${S.accent}40` }}
                    >
                      Revoke access
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Kick confirm modal */}
      <Modal
        open={!!target}
        onClose={() => setTarget(null)}
        title="Revoke admin access"
        subtitle={target ? `This will immediately sign out ${target.email} and disable their account.` : ''}
        size="sm"
      >
        {target && (
          <div className="space-y-4">
            {/* Target card */}
            <div className="flex items-center gap-3 p-3 rounded-xl border" style={{ background: S.accentS, borderColor: `${S.accent}30` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
                style={{ background: `linear-gradient(135deg,${S.accent},#B5604A)`, color: '#FFF8F5' }}>
                {target.email?.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-semibold text-ink-900">{target.email}</div>
                <div className="text-xs text-ink-500">Administrator account</div>
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="text-xs font-semibold text-ink-700 block mb-1.5">
                Reason <span className="text-ink-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={kickReason}
                onChange={e => setKickReason(e.target.value)}
                placeholder="e.g. Left the organisation, security breach..."
                rows={3}
                className="w-full text-sm border border-ink-200 rounded-xl px-3 py-2.5 text-ink-900 resize-none focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': S.accent }}
              />
            </div>

            <ErrorAlert>{kickErr}</ErrorAlert>

            <div className="flex gap-2">
              <Button variant="secondary" size="md" className="flex-1" onClick={() => setTarget(null)}>
                Cancel
              </Button>
              <button
                onClick={doKick}
                disabled={kickBusy}
                className="flex-1 h-10 px-4 text-sm font-semibold rounded-lg text-white transition-all duration-150 disabled:opacity-60 hover:brightness-110 active:scale-95"
                style={{ background: `linear-gradient(135deg,${S.accent},#B5604A)` }}
              >
                {kickBusy ? 'Revoking…' : 'Yes, revoke access'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
