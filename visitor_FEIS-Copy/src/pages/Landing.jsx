import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, getRole, isAdminRole } from '../lib/supabase'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Label from '../components/ui/Label'
import { ErrorAlert } from '../components/ui/Feedback'

export default function Landing() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showIosHelp, setShowIosHelp] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // PWA install prompt
    const onPrompt = (e) => { e.preventDefault(); setDeferredPrompt(e) }
    window.addEventListener('beforeinstallprompt', onPrompt)

    // iOS detection
    const ua = navigator.userAgent || ''
    const ios = /iphone|ipad|ipod/i.test(ua) ||
      (typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1 && /Mac/.test(ua))
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
    setIsIOS(ios && !standalone)

    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  // Form-scoped Enter handler (issue #17 fix)
  const onSubmit = async (e) => {
    e.preventDefault()
    setErr('')
    if (!email || !password) {
      setErr('Please enter email and password.')
      return
    }
    setBusy(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setErr(error.message); return }

      // Wait one tick for the JWT to be available, then re-pull the session
      // so app_metadata.role is populated.
      const { data: { session } } = await supabase.auth.getSession()
      const role = getRole(session)
      if (!isAdminRole(role)) {
        await supabase.auth.signOut()
        setErr('This account is not authorized for the dashboard.')
        return
      }
      navigate('/admin/visitors')
    } catch (e) {
      setErr('Network error — check your connection.')
    } finally {
      setBusy(false)
    }
  }

  const installPwa = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        {/* Brand mark above the card */}
        <div className="text-center mb-6 animate-rise">
          <div className="inline-flex items-center gap-3">
            <div className="relative animate-float">
              <div className="w-12 h-12 rounded-xl bg-brand-800 flex items-center justify-center text-gold-400 font-bold text-xl shadow-elevated">
                V
              </div>
              <div className="absolute -bottom-0.5 left-1 right-1 h-0.5 bg-gold-400 rounded-full" />
            </div>
            <div className="text-left">
              <div className="font-bold text-ink-900 text-xl tracking-tight">Visitour</div>
              <div className="text-[11px] text-ink-500 -mt-0.5 uppercase tracking-wider font-semibold">FEIS Visitor Management</div>
            </div>
          </div>
        </div>

        <div className="card-branded animate-rise" style={{ animationDelay: '0.1s' }}>
          <div className="brand-stripe" />

          <div className="px-7 pt-7 pb-6">
            <h1 className="text-xl font-bold text-ink-900 tracking-tight">Sign in to dashboard</h1>
            <p className="text-sm text-ink-500 mt-1">Admin and superadmin access only.</p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@feis.school"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={!!err}
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={!!err}
                />
              </div>

              <ErrorAlert>{err}</ErrorAlert>

              <Button type="submit" loading={busy} className="w-full" size="lg">
                Sign in to dashboard
              </Button>
            </form>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-ink-200" /></div>
              <div className="relative flex justify-center"><span className="bg-white px-3 text-[11px] uppercase tracking-wider text-ink-400 font-semibold">or</span></div>
            </div>

            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={() => navigate('/')}
            >
              Visitor / parent — open app
            </Button>

            {deferredPrompt && (
              <Button variant="gold" size="md" className="w-full mt-3" onClick={installPwa}>
                Install Visitour app
              </Button>
            )}

            {isIOS && (
              <button
                onClick={() => setShowIosHelp(true)}
                className="w-full mt-3 text-xs text-ink-500 hover:text-ink-800 underline underline-offset-2"
              >
                How to install on iPhone / iPad
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-[11px] text-ink-400 mt-6">
          Visitour 2.0 — Built for FEIS
        </p>
      </div>

      {showIosHelp && (
        <div
          className="fixed inset-0 z-50 bg-ink-950/50 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setShowIosHelp(false)}
        >
          <div
            className="bg-white w-full max-w-md rounded-t-2xl p-6 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-ink-200 rounded-full mx-auto mb-5" />
            <h3 className="text-base font-semibold text-ink-900 mb-4">Install on iPhone or iPad</h3>
            <ol className="space-y-3 text-sm text-ink-700">
              <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-brand-800 text-gold-400 text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>Tap the Share button at the bottom of Safari.</li>
              <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-brand-800 text-gold-400 text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>Scroll and tap <strong>Add to Home Screen</strong>, then tap Add.</li>
            </ol>
            <Button variant="secondary" className="w-full mt-5" onClick={() => setShowIosHelp(false)}>
              Got it
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
