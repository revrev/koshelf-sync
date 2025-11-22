import { useQuery } from '@tanstack/react-query'
import { fetchCover } from '../api/audiobookshelf'
import type { AuthState } from './useAuth'

interface CoverHookOptions {
  format?: string
  width?: number
  height?: number
  enabled?: boolean
}

export function useAudiobookshelfCover(
  auth: AuthState | null,
  libraryItemId: string | null,
  options: CoverHookOptions = {},
) {
  return useQuery({
    queryKey: [
      'audiobookshelf',
      'cover',
      libraryItemId,
      options.width,
      options.height,
      options.format,
      auth?.username,
      auth?.key,
    ],
    queryFn: () => fetchCover(auth!, libraryItemId!, options),
    enabled: Boolean(auth?.username && auth?.key && libraryItemId && (options.enabled ?? true)),
    staleTime: 6 * 60 * 60 * 1000,
  })
}
