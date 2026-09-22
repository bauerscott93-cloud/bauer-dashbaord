import { useState } from 'react'
import { useAuth } from '../context/AuthProvider.jsx'
import { Button } from '../components/ui/Button.jsx'

/** Supabase's wording is for a login form with a username; ours has one box. */
function friendlyError(message) {
  if (/invalid login credentials/i.test(message)) return 'That password didn’t work.'
  if (/email not confirmed/i.test(message)) {
    return 'The household account isn’t confirmed yet. In Supabase → Authentication → Users, ' +
           'open the account and confirm it.'
  }
  if (/rate|too many/i.test(message)) return 'Too many attempts. Wait a minute and try again.'
  return message
}

export default function Login() {
  const { signIn } = useAuth()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function onSubmit(event) {
    event.preventDefault()
    if (!password) return
    setBusy(true)
    setError(null)
    const { error: signInError } = await signIn(password)
    if (signInError) {
      setError(friendlyError(signInError.message))
      setPassword('')
    }
    setBusy(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="hh-card w-full max-w-sm p-6">
        <h1 className="text-lg font-semibold">Household Hub</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          The things that cost money or cause pain if missed.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <div>
            <label htmlFor="password" className="hh-label">Password</label>
            <input
              id="password"
              type="password"
              required
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="hh-input mt-1"
            />
          </div>
          <Button type="submit" disabled={busy || !password} className="w-full">
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
          {error && (
            <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
          )}
        </form>
      </div>
    </div>
  )
}
