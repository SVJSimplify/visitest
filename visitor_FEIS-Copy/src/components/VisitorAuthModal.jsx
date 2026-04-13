import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { explainError, isValidPhone, normalizePhone } from '../lib/utils'
import Modal from './ui/Modal'
import Button from './ui/Button'
import Input from './ui/Input'
import Label from './ui/Label'
import { ErrorAlert } from './ui/Feedback'

/**
 * VisitorAuthModal
 * ----------------------------------------------------------------------
 * Sign-in / sign-up flow for visitors and parents. Lives inside the
 * visitor app, NOT a separate page. Admins/security have their own
 * hidden login slugs and never see this modal.
 *
 * Roles:
 *   - 'visitor' (default)
 *   - 'parent'
 *
 * Roles are placed in user_metadata at signup time and the
 * `on_auth_user_created` trigger promotes them to app_metadata
 * server-side. Direct app_metadata writes from the client are blocked.
 */
export default function VisitorAuthModal({ open, onClose, mode: initialMode = 'signin' }) {
  const [mode, setMode] = useState(initialMode) // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [accountRole, setAccountRole] = useState('visitor') // visitor | parent
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setEmail(''); setPassword(''); setName(''); setPhone('')
    setAccountRole('visitor'); setErr(''); setBusy(false)
  }

  const close = () => { reset(); onClose?.() }

  const switchMode = (m) => { setErr(''); setMode(m) }

  const onSignIn = async (e) => {
    e.preventDefault()
    setErr('')
    if (!email || !password) { setErr('Enter your email and password.'); return }
    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setErr(error.message); return }
      close()
    } catch (e) {
      setErr(explainError(e))
    } finally {
      setBusy(false)
    }
  }

  const onSignUp = async (e) => {
    e.preventDefault()
    setErr('')
    if (!email || !password) { setErr('Enter your email and password.'); return }
    if (password.length < 6) { setErr('Password must be at least 6 characters.'); return }
    if (!name.trim() || name.trim().length < 2) { setErr('Enter your full name.'); return }
    if (!isValidPhone(phone)) { setErr('Phone must be exactly 10 digits.'); return }

    setBusy(true)
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name.trim(),
            phone,
            role: accountRole, // server-side trigger promotes to app_metadata
          },
        },
      })
      if (error) { setErr(error.message); return }
      close()
    } catch (e) {
      setErr(explainError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={mode === 'signin' ? 'Sign in' : 'Create your account'}
      subtitle={mode === 'signin'
        ? 'Welcome back. Sign in to skip filling your details every visit.'
        : 'Save your details for faster check-in next time.'}
    >
      {mode === 'signin' ? (
        <form onSubmit={onSignIn} className="space-y-4">
          <div>
            <Label htmlFor="vsi-email">Email</Label>
            <Input id="vsi-email" type="email" autoComplete="email" value={email}
                   onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <Label htmlFor="vsi-password">Password</Label>
            <Input id="vsi-password" type="password" autoComplete="current-password" value={password}
                   onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <ErrorAlert>{err}</ErrorAlert>
          <Button type="submit" loading={busy} className="w-full" size="lg">
            Sign in
          </Button>
          <div className="text-center text-xs text-ink-500">
            No account yet?{' '}
            <button type="button" onClick={() => switchMode('signup')}
                    className="text-brand-800 font-semibold hover:underline">
              Sign up
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={onSignUp} className="space-y-4">
          {/* Account type */}
          <div>
            <Label>I am a</Label>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: 'visitor', label: 'Visitor' },
                { id: 'parent',  label: 'Parent'  },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setAccountRole(r.id)}
                  className={
                    'h-12 rounded-lg border-2 font-semibold text-sm transition-all relative overflow-hidden ' +
                    (accountRole === r.id
                      ? 'border-brand-800 bg-brand-800 text-gold-400 shadow-card'
                      : 'border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:bg-brand-50')
                  }
                >
                  {accountRole === r.id && (
                    <span className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gold-400 to-transparent" />
                  )}
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="vsu-name" required>Full name</Label>
            <Input id="vsu-name" value={name} onChange={(e) => setName(e.target.value)}
                   placeholder="Your full name" autoComplete="name" />
          </div>
          <div>
            <Label htmlFor="vsu-phone" required>Phone</Label>
            <Input id="vsu-phone" inputMode="numeric" maxLength={10} value={phone}
                   onChange={(e) => setPhone(normalizePhone(e.target.value))}
                   placeholder="10-digit number" autoComplete="tel-national" />
          </div>
          <div>
            <Label htmlFor="vsu-email" required>Email</Label>
            <Input id="vsu-email" type="email" autoComplete="email" value={email}
                   onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <Label htmlFor="vsu-password" required>Password</Label>
            <Input id="vsu-password" type="password" autoComplete="new-password" value={password}
                   onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" />
          </div>

          <ErrorAlert>{err}</ErrorAlert>
          <Button type="submit" loading={busy} className="w-full" size="lg">
            Create account
          </Button>
          <div className="text-center text-xs text-ink-500">
            Already have an account?{' '}
            <button type="button" onClick={() => switchMode('signin')}
                    className="text-brand-800 font-semibold hover:underline">
              Sign in
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
