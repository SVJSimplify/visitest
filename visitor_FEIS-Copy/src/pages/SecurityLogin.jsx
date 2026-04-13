import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, getRole, isSecurityRole } from '../lib/supabase'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Label from '../components/ui/Label'
import { ErrorAlert } from '../components/ui/Feedback'

export default function SecurityLogin() {
  const navigate = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  // Already logged in? Bounce to scanner.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isSecurityRole(getRole(session))) navigate('/scan', { replace: true })
    })
  }, [navigate])

  const onSubmit = async (e) => {
    e.preventDefault()
    setErr('')
    if (!email || !password) { setErr('Please fill in both fields.'); return }
    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setErr(error.message); return }
      const { data: { session } } = await supabase.auth.getSession()
      if (!isSecurityRole(getRole(session))) {
        await supabase.auth.signOut()
        setErr('This account is not authorized for the scanner.')
        return
      }
      navigate('/scan', { replace: true })
    } catch {
      setErr('Network error — check your connection.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        <button
          onClick={() => navigate(-1)}
          className="text-sm font-medium text-ink-600 hover:text-ink-900 inline-flex items-center gap-1 mb-5 animate-rise"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Back
        </button>

        <div className="card-branded animate-rise" style={{ animationDelay: '0.05s' }}>
          <div className="brand-stripe" />
          <div className="px-7 pt-7 pb-6">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center text-brand-800">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-ink-900 tracking-tight">Security login</h1>
                <p className="text-[11px] text-ink-500">Visitour · FEIS</p>
              </div>
            </div>

            <form onSubmit={onSubmit} className="mt-5 space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email" type="email" autoComplete="email"
                  placeholder="security@feis.school"
                  value={email} onChange={(e) => setEmail(e.target.value)} error={!!err}
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password" type="password" autoComplete="current-password"
                  placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)} error={!!err}
                />
              </div>

              <ErrorAlert>{err}</ErrorAlert>

              <Button type="submit" loading={busy} className="w-full" size="lg">
                Sign in
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
