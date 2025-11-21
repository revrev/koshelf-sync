import { useCallback, useState } from 'react'

export interface AuthState {
  username: string
  key: string
}

const STORAGE_KEY = 'koshelf-react-auth'

function readFromStorage(): AuthState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthState
    if (parsed.username && parsed.key) {
      return parsed
    }
  } catch {
    /* ignore corrupted payloads */
  }
  return null
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState | null>(() => readFromStorage())

  const saveAuth = useCallback((next: AuthState) => {
    setAuth(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* ignore quota errors */
    }
  }, [])

  const clearAuth = useCallback(() => {
    setAuth(null)
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  return { auth, saveAuth, clearAuth }
}
