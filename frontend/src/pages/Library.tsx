import { LibraryCard } from '../components/LibraryCard'
import type { AuthState } from '../hooks/useAuth'
import { useLibraryShelves } from '../hooks/useLibrary'

interface LibraryProps {
  auth: AuthState
}

export function Library({ auth }: LibraryProps) {
  const { data, isLoading, error, refetch } = useLibraryShelves(auth)
  const shelves = data?.shelves

  if (isLoading) {
    return <div className="text-sm text-ctp-subtext0">Loading your library…</div>
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
        Failed to load library: {(error as Error).message}
        <button onClick={() => refetch()} className="ml-3 text-ctp-lavender underline">Retry</button>
      </div>
    )
  }

  if (!shelves) {
    return <div className="text-sm text-ctp-subtext0">No items to show yet.</div>
  }

  const renderShelf = (title: string, items: typeof data.shelves.all) => (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ctp-text">{title}</h2>
        <span className="text-xs uppercase tracking-wide text-ctp-overlay0">{items.length} items</span>
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-white/5 bg-ctp-mantle/40 p-4 text-sm text-ctp-subtext0">Nothing here yet.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((item) => (
            <LibraryCard key={`${item.document}-${item.libraryItemId || 'unlinked'}`} auth={auth} item={item} />
          ))}
        </div>
      )}
    </section>
  )

  return (
    <div className="space-y-10">
      <div className="rounded-2xl border border-white/5 bg-ctp-surface0/40 p-6 shadow-lg shadow-ctp-lavender/5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-ctp-overlay0">Library</p>
            <h1 className="text-2xl font-bold text-ctp-text">Your linked books & audiobooks</h1>
            <p className="text-sm text-ctp-subtext0">
              Showing only items you have linked or have progress for. Use the detail page to adjust links.
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="self-start rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ctp-subtext0 transition hover:border-ctp-lavender/50"
          >
            Refresh
          </button>
        </div>
      </div>

      {renderShelf('Unlinked Items', shelves.unlinked)}
      {renderShelf('Continue Listening', shelves.continueListening)}
      {renderShelf('Continue Reading', shelves.continueReading)}
      {renderShelf('Recently Linked', shelves.recentlyLinked)}
      {renderShelf('All Linked', shelves.all.filter((i) => i.libraryItemId))}
    </div>
  )
}
