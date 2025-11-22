import { useParams } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useLibraryItem, useLinkLibraryItem } from '../hooks/useLibrary'
import type { AuthState } from '../hooks/useAuth'
import { useAudiobookshelfCover } from '../hooks/useAudiobookshelfCover'
import { ProgressBadge } from '../components/ProgressBadge'
import { AudiobookshelfSearch } from '../components/AudiobookshelfSearch'
import type { SearchResult } from '../api/audiobookshelf'
import { useSyncPositions } from '../hooks/useSyncPositions'

interface LibraryDetailProps {
  auth: AuthState
}

export function LibraryDetail({ auth }: LibraryDetailProps) {
  const { document } = useParams<{ document: string }>()
  const { data, isLoading, error, refetch } = useLibraryItem(auth, document || null)
  const item = data?.item
  const hasCover = Boolean(item?.libraryItemId)
  const { data: coverUrl } = useAudiobookshelfCover(auth, hasCover ? item?.libraryItemId || null : null, {
    format: 'webp',
    width: 480,
    enabled: hasCover,
  })
  const linkMutation = useLinkLibraryItem(auth)
  const [pendingLink, setPendingLink] = useState<SearchResult | null>(null)
  const syncMutations = useSyncPositions(auth)

  const progress = useMemo(() => {
    const ebook = item?.localProgress?.percentage ?? null
    const audioRaw = item?.remoteProgress?.percentage ?? null
    let audio = audioRaw
    if (audio === null && item?.remoteProgress?.currentTime && item?.metadata?.duration) {
      const duration = Number(item.metadata.duration)
      if (duration > 0) {
        audio = Number(item.remoteProgress.currentTime) / duration
      }
    }
    return { ebook, audio }
  }, [item])

  const handleConfirmLink = () => {
    if (pendingLink && document) {
      linkMutation.mutate({ document, libraryItemId: pendingLink.libraryItem.id })
      setPendingLink(null)
    }
  }

  const handleCancelLink = () => {
    setPendingLink(null)
  }

  const handleSyncToAudio = () => {
    if (document) {
      syncMutations.syncToAudio.mutate(document, {
        onSuccess: () => refetch(),
      })
    }
  }

  const handleSyncFromAudio = () => {
    if (document) {
      syncMutations.syncFromAudio.mutate(document, {
        onSuccess: () => refetch(),
      })
    }
  }

  const handleAutoSync = () => {
    if (document) {
      syncMutations.autoSync.mutate(document, {
        onSuccess: () => refetch(),
      })
    }
  }

  if (isLoading) {
    return <div className="text-sm text-ctp-subtext0">Loading…</div>
  }
  if (error || !item) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
        Failed to load item: {(error as Error)?.message ?? 'Unknown error'}
      </div>
    )
  }

  const meta = item.metadata || {}

  return (
    <div className="space-y-8">
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <div className="overflow-hidden rounded-xl border border-white/5 bg-ctp-surface0/60 shadow-lg">
          {coverUrl ? (
            <img src={coverUrl} alt={meta.title || item.document} className="w-full" />
          ) : (
            <div className="flex aspect-[2/3] items-center justify-center text-sm text-ctp-overlay0">No cover</div>
          )}
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs uppercase tracking-[0.2em] text-ctp-overlay0">Document</p>
            <span className="rounded-full bg-ctp-mantle/60 px-3 py-1 text-xs font-semibold text-ctp-subtext0">{item.document}</span>
            {item.libraryItemId && (
              <span className="rounded-full bg-ctp-blue/10 px-3 py-1 text-xs font-semibold text-ctp-blue">ABS #{item.libraryItemId}</span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-ctp-text">{meta.title || 'Untitled item'}</h1>
          <p className="text-sm text-ctp-subtext0">{meta.author || 'Unknown author'}</p>
          <div className="flex flex-wrap gap-2">
            {progress.ebook !== null && <ProgressBadge label="Ebook" value={progress.ebook} tone="lavender" />}
            {progress.audio !== null && <ProgressBadge label="Audio" value={progress.audio} tone="blue" />}
          </div>

          {item.libraryItemId && (
            <div className="mt-4 rounded-xl border border-white/5 bg-ctp-mantle/40 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-ctp-overlay0">Sync Position</p>
              <p className="text-sm text-ctp-subtext0">Synchronize reading progress between ebook and audiobook.</p>

              <div className="mt-4 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleAutoSync}
                  disabled={syncMutations.autoSync.isPending || !progress.ebook && !progress.audio}
                  className="rounded-lg bg-ctp-lavender px-4 py-2 text-sm font-semibold text-ctp-base shadow-sm transition hover:shadow-lg hover:shadow-ctp-lavender/30 disabled:opacity-60"
                >
                  {syncMutations.autoSync.isPending ? 'Syncing...' : '↔ Auto Sync'}
                </button>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleSyncFromAudio}
                    disabled={syncMutations.syncFromAudio.isPending || !progress.audio}
                    className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-ctp-subtext0 transition hover:border-ctp-blue/40 hover:bg-ctp-surface0 disabled:opacity-60"
                  >
                    {syncMutations.syncFromAudio.isPending ? 'Syncing...' : '← Sync from Audio'}
                  </button>

                  <button
                    type="button"
                    onClick={handleSyncToAudio}
                    disabled={syncMutations.syncToAudio.isPending || !progress.ebook}
                    className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-ctp-subtext0 transition hover:border-ctp-lavender/40 hover:bg-ctp-surface0 disabled:opacity-60"
                  >
                    {syncMutations.syncToAudio.isPending ? 'Syncing...' : 'Sync to Audio →'}
                  </button>
                </div>

                {(syncMutations.autoSync.error || syncMutations.syncToAudio.error || syncMutations.syncFromAudio.error) && (
                  <p className="text-sm text-red-400">
                    {(syncMutations.autoSync.error as Error)?.message ||
                      (syncMutations.syncToAudio.error as Error)?.message ||
                      (syncMutations.syncFromAudio.error as Error)?.message}
                  </p>
                )}

                {(syncMutations.autoSync.isSuccess || syncMutations.syncToAudio.isSuccess || syncMutations.syncFromAudio.isSuccess) && (
                  <p className="text-sm text-ctp-green">✓ Sync completed successfully</p>
                )}
              </div>
            </div>
          )}
          <div className="rounded-xl border border-white/5 bg-ctp-mantle/40 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-ctp-overlay0">Link</p>
            <p className="text-sm text-ctp-subtext0">
              Connect this KoShelf document to an Audiobookshelf item. Search below to find the matching audiobook.
            </p>

            <div className="mt-4">
              <AudiobookshelfSearch
                auth={auth}
                onSelect={(result) => setPendingLink(result)}
              />
            </div>

            {item.libraryItemId && (
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to unlink this item?')) {
                      linkMutation.mutate({ document: document!, libraryItemId: null })
                    }
                  }}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-ctp-subtext0 transition hover:border-red-400/40 hover:text-red-300"
                >
                  Unlink current item
                </button>
              </div>
            )}

            {linkMutation.error && (
              <p className="mt-2 text-sm text-red-400">{(linkMutation.error as Error).message}</p>
            )}
          </div>
        </div>
      </div>

      {pendingLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-white/10 bg-ctp-base p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-ctp-text">Confirm Link</h3>
            <p className="mt-2 text-sm text-ctp-subtext0">
              Link <span className="font-medium text-ctp-lavender">{pendingLink.libraryItem.media.metadata.title}</span> to this document?
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleCancelLink}
                className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-ctp-subtext0 transition hover:border-white/20 hover:bg-ctp-surface0"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLink}
                disabled={linkMutation.isPending}
                className="flex-1 rounded-lg bg-ctp-lavender px-4 py-2 text-sm font-semibold text-ctp-base shadow-sm transition hover:shadow-lg hover:shadow-ctp-lavender/30 disabled:opacity-60"
              >
                {linkMutation.isPending ? 'Linking...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3 rounded-2xl border border-white/5 bg-ctp-surface0/40 p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-ctp-overlay0">Metadata</p>
        <p className="text-sm text-ctp-subtext0">{meta.description || 'No description available.'}</p>
        <div className="flex flex-wrap gap-3 text-xs text-ctp-overlay0">
          {meta.publishYear && <span className="rounded-full bg-ctp-mantle/60 px-3 py-1">{meta.publishYear}</span>}
          {meta.mediaType && <span className="rounded-full bg-ctp-mantle/60 px-3 py-1">{meta.mediaType}</span>}
          {meta.tags?.map((tag) => (
            <span key={tag} className="rounded-full bg-ctp-mantle/60 px-3 py-1">{tag}</span>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/5 bg-ctp-mantle/40 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ctp-text">Sync positions</h2>
          <button
            onClick={() => refetch()}
            className="text-xs font-semibold uppercase tracking-wide text-ctp-subtext0 underline"
          >
            Refresh
          </button>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <ProgressPanel title="Ebook" progress={item.localProgress} />
          <ProgressPanel title="Audiobook" progress={item.remoteProgress} />
        </div>
      </div>
    </div>
  )
}

interface ProgressPanelProps {
  title: string
  progress?: {
    percentage?: number | null
    progress?: string | null
    device?: string | null
    timestamp?: number | null
    currentTime?: number | null
  }
}

function ProgressPanel({ title, progress }: ProgressPanelProps) {
  if (!progress) {
    return (
      <div className="rounded-xl border border-white/5 bg-ctp-surface0/30 p-4 text-sm text-ctp-subtext0">
        <p className="text-sm font-semibold text-ctp-text">{title}</p>
        <p className="text-xs text-ctp-overlay0">No progress recorded.</p>
      </div>
    )
  }
  const pct = progress.percentage !== undefined && progress.percentage !== null ? Math.round(progress.percentage * 100) : null
  const ts = progress.timestamp ? new Date(progress.timestamp * 1000).toLocaleString() : null
  return (
    <div className="space-y-2 rounded-xl border border-white/5 bg-ctp-surface0/30 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ctp-text">{title}</p>
        {pct !== null && <span className="text-xs text-ctp-overlay0">{pct}%</span>}
      </div>
      <p className="text-xs text-ctp-subtext0 break-all">{progress.progress || '—'}</p>
      <div className="flex flex-wrap gap-2 text-[11px] text-ctp-overlay0">
        {progress.device && <span className="rounded-full bg-ctp-mantle/60 px-2 py-1">{progress.device}</span>}
        {ts && <span className="rounded-full bg-ctp-mantle/60 px-2 py-1">Updated {ts}</span>}
        {progress.currentTime && <span className="rounded-full bg-ctp-mantle/60 px-2 py-1">{Math.floor(progress.currentTime)}s</span>}
      </div>
    </div>
  )
}
