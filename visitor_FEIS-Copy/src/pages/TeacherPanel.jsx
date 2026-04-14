import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function TeacherLogin() {
  const navigate = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [err,      setErr]      = useState('')
  const [busy,     setBusy]     = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setBusy(true); setErr('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setErr(error.message); setBusy(false); return }

    const role = data.session?.user?.app_metadata?.role
    if (role !== 'teacher') {
      await supabase.auth.signOut()
      setErr('This login is for teachers only.')
      setBusy(false)
      return
    }
    navigate('/teacher', { replace: true })
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(160deg,#fdf4f3 0%,#fafafa 40%,#fffde7 100%)' }}
    >
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-700 to-brand-900 flex items-center justify-center text-gold-400 font-bold text-base shadow-md">
            V
          </div>
          <div>
            <div className="text-base font-bold text-ink-900 tracking-tight">Visitour · FEIS</div>
            <div className="text-xs text-ink-500">Teacher Portal</div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-ink-200 shadow-card overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-brand-800 via-gold-400 to-brand-800" />
          <div className="p-6">
            <h1 className="text-lg font-bold text-ink-900 mb-1">Teacher Sign In</h1>
            <p className="text-sm text-ink-500 mb-6">Sign in to view parent arrival notifications.</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@school.edu"
                  className="w-full rounded-lg border border-ink-300 px-3.5 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-ink-300 px-3.5 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                />
              </div>

              {err && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-700 font-medium">
                  {err}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full h-11 rounded-xl bg-gradient-to-br from-brand-800 to-brand-950 text-gold-400 font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {busy ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>

        {/* Link to visitor app */}
        <p className="text-center text-xs text-ink-500 mt-5">
          Registering a visit?{' '}
          <a href="/" className="font-semibold text-brand-800 hover:underline">
            Use the visitor app →
          </a>
        </p>
      </div>
    </div>
  )
}
