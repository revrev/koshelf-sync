import { useState } from 'react'
interface CreateAccountCardProps {
  onCreate: (payload: { username: string; password: string }) => Promise<void> | void
  isPending: boolean
  disabled: boolean
  reason?: string
  errorMessage?: string | null
  successMessage?: string | null
}

export function CreateAccountCard({
  onCreate,
  isPending,
  disabled,
  reason,
  errorMessage,
  successMessage,
}: CreateAccountCardProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (disabled) return
    if (!username || !password) {
      setStatus('Enter username and password')
      return
    }
    setStatus(null)
    await onCreate({ username, password })
    setUsername('')
    setPassword('')
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-ctp-mantle/50 p-5">
      <h3 className="text-lg font-semibold text-ctp-lavender">Create additional accounts</h3>
      <p className="text-sm text-ctp-subtext0">Admin only. Passwords can be plain text or pre-hashed MD5.</p>
      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        <label className="block text-sm text-ctp-subtext0">
          Username
          <input
            className="mt-1 w-full rounded-xl border border-white/10 bg-ctp-surface0/60 px-4 py-2 text-base text-ctp-text focus:border-ctp-lavender focus:outline-none focus:ring-2 focus:ring-ctp-lavender/30"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            disabled={disabled}
            placeholder="reader"
          />
        </label>
        <label className="block text-sm text-ctp-subtext0">
          Password
          <input
            type="password"
            className="mt-1 w-full rounded-xl border border-white/10 bg-ctp-surface0/60 px-4 py-2 text-base text-ctp-text focus:border-ctp-lavender focus:outline-none focus:ring-2 focus:ring-ctp-lavender/30"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={disabled}
            placeholder="••••••••"
          />
        </label>
        <button
          type="submit"
          disabled={disabled || isPending}
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-ctp-mauve to-ctp-blue px-4 py-2 font-semibold text-ctp-crust transition disabled:opacity-60"
        >
          {isPending ? 'Saving…' : 'Create account'}
        </button>
        {reason && disabled ? <p className="text-sm text-ctp-yellow">{reason}</p> : null}
        {status ? <p className="text-sm text-ctp-yellow">{status}</p> : null}
        {errorMessage ? <p className="text-sm text-ctp-red">{errorMessage}</p> : null}
        {successMessage ? <p className="text-sm text-ctp-green">{successMessage}</p> : null}
      </form>
    </section>
  )
}
