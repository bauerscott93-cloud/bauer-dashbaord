import { useState } from 'react'
import { useAuth } from '../context/AuthProvider.jsx'
import { Button } from '../components/ui/Button.jsx'

export default function Login() {
  const { signInWithEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [error, setError] = useState(null)

  async function onSubmit(event) {
    event.preventDefault()
    if (!email.trim()) return
    setStatus('sending')
    setError(null)
    const { error: signInError } = await signInWithEmail(email)
    if (signInError) {
      setError(signInError.message)
      setStatus('error')
    } else {
      setStatus('sent')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="hh-card w-full max-w-sm p-6">
        <h1 className="text-lg font-semibold">Household Hub</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          The things that cost money or cause pain if missed.
        </p>

        {status === 'sent' ? (
          <div className="mt-6 rounded-lg bg-teal-50 p-4 text-sm text-teal-900 dark:bg-teal-950/60 dark:text-teal-200">
            <p className="font-medium">Check your email</p>
            <p className="mt-1 text-xs">
              We sent a sign-in link to <span className="font-medium">{email}</span>. Open it on
              this device. The link expires shortly.
            </p>
            <button
              onClick={() => setStatus('idle')}
              className="mt-3 text-xs font-medium underline"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-3">
            <div>
              <label htmlFor="email" className="hh-label">Email</label>
              <input
                id="email"
                type="email"
                required
                autoFocus
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="hh-input mt-1"
              />
            </div>
            <Button type="submit" disabled={status === 'sending'} className="w-full">
              {status === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
            </Button>
            {error && (
              <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
            )}
            <p className="text-center text-xs text-slate-400 dark:text-slate-500">
              No passwords. We email you a one-time link.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
