import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../api/client'
import type { AuthState } from './useAuth'

interface CreateAccountInput {
  username: string
  password: string
  authOverride?: AuthState | null
}

export function useCreateAccount(defaultAuth: AuthState | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ username, password, authOverride }: CreateAccountInput) => {
      return apiFetch<{ username: string }>('/admin/accounts', {
        method: 'POST',
        body: { username, password },
        auth: authOverride ?? defaultAuth,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}
