import { useQuery } from '@tanstack/react-query'
import { fetchLibraries, searchLibrary } from '../api/audiobookshelf'
import type { AuthState } from './useAuth'

export function useLibraries(auth: AuthState | null) {
    return useQuery({
        queryKey: ['audiobookshelf', 'libraries', auth?.username, auth?.key],
        queryFn: () => fetchLibraries(auth),
        enabled: Boolean(auth?.username && auth?.key),
        staleTime: 5 * 60 * 1000, // 5 minutes
    })
}

export function useLibrarySearch(
    auth: AuthState | null,
    libraryId: string | null,
    query: string,
) {
    return useQuery({
        queryKey: ['audiobookshelf', 'search', libraryId, query, auth?.username, auth?.key],
        queryFn: () => searchLibrary(auth!, libraryId!, query),
        enabled: Boolean(auth?.username && auth?.key && libraryId && query.length > 2),
        staleTime: 60 * 1000, // 1 minute
    })
}
