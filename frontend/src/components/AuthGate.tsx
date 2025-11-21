import { useState } from 'react'
import { hashCredential } from '../utils/credentials'
import type { AuthState } from '../hooks/useAuth'

interface AuthGateProps {
  auth: AuthState | null
  onSave: (auth: AuthState) => void
  onClear: () => void
}

export function AuthGate({ auth, onSave, onClear }: AuthGateProps) {
  const [username, setUsername] = useState(auth?.username ?? '')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!username || !password) {
      setStatus('Enter username and password')
      return
    }
    const key = hashCredential(password)
    if (!key) {
      setStatus('Invalid password')
      return
    }
    onSave({ username, key })
    setPassword('')
    setStatus('Credentials saved')
  }

  return (
    <section className="rounded-2xl border border-white/5 bg-white/5/10 bg-[rgba(49,50,68,0.35)] p-6 shadow-floating backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ctp-lavender">KoShelf credentials</h2>
        {auth ? (
          <span className="rounded-full border border-ctp-green/30 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ctp-green">
            Connected
          </span>
        ) : (
          <span className="rounded-full border border-ctp-yellow/30 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ctp-yellow">
            Required
          </span>
        )}
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-ctp-subtext0">
          Username
          <input
            className="mt-1 w-full rounded-xl border border-white/10 bg-ctp-mantle/40 px-4 py-2 text-base text-ctp-text focus:border-ctp-lavender focus:outline-none focus:ring-2 focus:ring-ctp-lavender/30"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="alice"
            autoComplete="username"
          />
        </label>
        <label className="block text-sm font-medium text-ctp-subtext0">
          Password (plain or MD5)
          <input
            className="mt-1 w-full rounded-xl border border-white/10 bg-ctp-mantle/40 px-4 py-2 text-base text-ctp-text focus:border-ctp-lavender focus:outline-none focus:ring-2 focus:ring-ctp-lavender/30"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            type="password"
            autoComplete="current-password"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-ctp-mauve to-ctp-blue px-4 py-2 text-sm font-semibold text-ctp-crust transition hover:scale-[1.01]"
          >
            Save credentials
          </button>
          {auth ? (
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-ctp-subtext0 transition hover:border-white/40"
              onClick={() => {
                onClear()
                setUsername('')
                setPassword('')
                setStatus('Disconnected')
              }}
            >
              Clear
            </button>
          ) : null}
          {status ? <p className="text-sm text-ctp-subtext0">{status}</p> : null}
        </div>
        {auth ? (
          <p className="text-xs text-ctp-subtext0">
            Requests will include <code className="font-mono">{auth.username}</code> /{' '}
            <code className="font-mono">{auth.key}</code>
          </p>
        ) : (
          <p className="text-xs text-ctp-subtext0">
            We reuse the existing KoShelf headers (<code className="font-mono">X-Auth-User</code> &amp;{' '}
            <code className="font-mono">X-Auth-Key</code>) in every API call.
          </p>
        )}
      </form>
    </section>
  )
}
