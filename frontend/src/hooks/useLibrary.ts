import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchLibraryShelves, fetchLibraryItem, linkLibraryItem } from '../api/library'
import type { AuthState } from './useAuth'

export function useLibraryShelves(auth: AuthState | null) {
  return useQuery({
    queryKey: ['library', 'shelves', auth?.username, auth?.key],
    queryFn: () => fetchLibraryShelves(auth),
    enabled: Boolean(auth?.username && auth?.key),
    staleTime: 60 * 1000,
  })
}

export function useLibraryItem(auth: AuthState | null, document: string | null) {
  return useQuery({
    queryKey: ['library', 'item', document, auth?.username, auth?.key],
    queryFn: () => fetchLibraryItem(auth, document!),
    enabled: Boolean(auth?.username && auth?.key && document),
    staleTime: 30 * 1000,
  })
}

export function useLinkLibraryItem(auth: AuthState | null) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ document, libraryItemId }: { document: string; libraryItemId: string | null }) =>
      linkLibraryItem(auth, document, libraryItemId),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: ['library'] })
      client.invalidateQueries({ queryKey: ['library', 'item', variables.document] })
    },
  })
}
