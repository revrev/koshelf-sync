import { Link } from 'react-router-dom'
import type { LibraryCard as LibraryCardType } from '../api/library'
import type { AuthState } from '../hooks/useAuth'
import { useAudiobookshelfCover } from '../hooks/useAudiobookshelfCover'
import { ProgressBadge } from './ProgressBadge'

interface LibraryCardProps {
  auth: AuthState | null
  item: LibraryCardType
}

export function LibraryCard({ auth, item }: LibraryCardProps) {
  const hasCover = Boolean(item.libraryItemId)
  const { data: coverUrl } = useAudiobookshelfCover(auth, hasCover ? item.libraryItemId || null : null, {
    format: 'webp',
    width: 320,
    enabled: hasCover,
  })

  return (
    <Link
      to={`/library/${encodeURIComponent(item.document)}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-white/5 bg-ctp-mantle/40 shadow-sm transition hover:-translate-y-1 hover:border-ctp-lavender/40 hover:shadow-lg hover:shadow-ctp-lavender/10"
    >
      <div className="aspect-[2/3] w-full bg-ctp-surface0/60">
        {coverUrl ? (
          <img src={coverUrl} alt={item.title || item.document} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-ctp-overlay0">No cover</div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="line-clamp-2 text-sm font-semibold text-ctp-text">{item.title || 'Untitled item'}</div>
        <div className="line-clamp-1 text-xs text-ctp-subtext0">{item.author || 'Unknown author'}</div>
        {item.lastUpdated ? (
          <div className="text-[10px] text-ctp-overlay0">
            Updated {new Date(item.lastUpdated * 1000).toLocaleDateString()}
          </div>
        ) : null}
        <div className="mt-auto flex flex-wrap gap-2">
          {item.ebookProgress !== undefined && item.ebookProgress !== null && (
            <ProgressBadge label="Ebook" value={item.ebookProgress} tone="lavender" />
          )}
          {item.audioProgress !== undefined && item.audioProgress !== null && (
            <ProgressBadge label="Audio" value={item.audioProgress} tone="blue" />
          )}
        </div>
      </div>
    </Link>
  )
}
