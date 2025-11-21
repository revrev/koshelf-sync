import { useQuery } from '@tanstack/react-query'
import { apiFetch, type ApiError } from '../api/client'
import type { AccountsResponse } from '../api/types'
import type { AuthState } from './useAuth'

export function useAccounts(auth: AuthState | null) {
  return useQuery({
    queryKey: ['accounts', auth?.username, auth?.key],
    queryFn: () => apiFetch<AccountsResponse>('/admin/accounts', { auth }),
    staleTime: 60_000,
    retry(failureCount, error) {
      const apiErr = error as ApiError | undefined
      if (apiErr?.status === 401) {
        return false
      }
      return failureCount < 2
    },
  })
}
