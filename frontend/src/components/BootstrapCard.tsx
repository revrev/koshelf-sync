import { useState } from 'react'
interface BootstrapCardProps {
  onCreate: (payload: { username: string; password: string }) => Promise<void> | void
  isPending: boolean
  errorMessage?: string | null
  successMessage?: string | null
}

export function BootstrapCard({ onCreate, isPending, errorMessage, successMessage }: BootstrapCardProps) {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [localStatus, setLocalStatus] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!username || !password || !confirm) {
      setLocalStatus('Fill all fields')
      return
    }
    if (password !== confirm) {
      setLocalStatus('Passwords must match')
      return
    }
    setLocalStatus(null)
    await onCreate({ username, password })
    setPassword('')
    setConfirm('')
  }

  return (
    <section className="rounded-2xl border border-ctp-lavender/40 bg-ctp-surface0/60 p-6 shadow-floating">
      <h2 className="text-xl font-semibold text-ctp-lavender">Create the first KoShelf account</h2>
      <p className="mt-2 text-sm text-ctp-subtext0">
        No KoShelf users exist yet. Create the initial admin account so you can sign into the dashboard.
      </p>
      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        <label className="block text-sm text-ctp-subtext0">
          Admin username
          <input
            className="mt-1 w-full rounded-xl border border-white/10 bg-ctp-mantle/40 px-4 py-2 text-base text-ctp-text focus:border-ctp-lavender focus:outline-none focus:ring-2 focus:ring-ctp-lavender/30"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="admin"
          />
        </label>
        <label className="block text-sm text-ctp-subtext0">
          Password
          <input
            type="password"
            className="mt-1 w-full rounded-xl border border-white/10 bg-ctp-mantle/40 px-4 py-2 text-base text-ctp-text focus:border-ctp-lavender focus:outline-none focus:ring-2 focus:ring-ctp-lavender/30"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
          />
        </label>
        <label className="block text-sm text-ctp-subtext0">
          Confirm password
          <input
            type="password"
            className="mt-1 w-full rounded-xl border border-white/10 bg-ctp-mantle/40 px-4 py-2 text-base text-ctp-text focus:border-ctp-lavender focus:outline-none focus:ring-2 focus:ring-ctp-lavender/30"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="••••••••"
          />
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-ctp-green to-ctp-teal px-4 py-2 font-semibold text-ctp-crust transition disabled:opacity-60"
        >
          {isPending ? 'Creating…' : 'Create admin account'}
        </button>
        {localStatus ? <p className="text-sm text-ctp-yellow">{localStatus}</p> : null}
        {errorMessage ? <p className="text-sm text-ctp-red">{errorMessage}</p> : null}
        {successMessage ? <p className="text-sm text-ctp-green">{successMessage}</p> : null}
      </form>
    </section>
  )
}
