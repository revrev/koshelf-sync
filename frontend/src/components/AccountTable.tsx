import type { AccountSummary } from '../api/types'

interface AccountTableProps {
  accounts?: AccountSummary[]
  isLoading: boolean
  isError: boolean
  errorMessage?: string
  onRetry: () => void
}

export function AccountTable({ accounts, isLoading, isError, errorMessage, onRetry }: AccountTableProps) {
  if (!accounts?.length && !isLoading && !isError) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-ctp-mantle/40 p-6 text-center text-sm text-ctp-subtext0">
        No accounts yet. Create one on the left to see Redis-backed data populate immediately.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/5 bg-ctp-mantle/60 shadow-floating">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/5">
          <thead className="bg-white/5 text-xs uppercase tracking-[0.3em] text-ctp-subtext0">
            <tr>
              <th className="px-6 py-3 text-left">User</th>
              <th className="px-6 py-3 text-left">Documents</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-sm">
            {(accounts ?? []).map((account) => (
              <tr key={account.username} className="transition hover:bg-white/5">
                <td className="px-6 py-4 font-medium text-ctp-text">{account.username}</td>
                <td className="px-6 py-4 font-mono text-ctp-blue">{account.documents}</td>
              </tr>
            ))}
            {isLoading ? (
              <tr>
                <td className="px-6 py-4 text-sm text-ctp-subtext0" colSpan={2}>
                  Loading accounts…
                </td>
              </tr>
            ) : null}
            {isError ? (
              <tr>
                <td className="px-6 py-4 text-sm text-ctp-red" colSpan={2}>
                  {errorMessage ?? 'Unable to load accounts.'}{' '}
                  <button className="underline decoration-dotted" onClick={onRetry}>
                    Retry
                  </button>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
