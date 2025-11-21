import type { AuthState } from '../hooks/useAuth'

export interface ApiError extends Error {
  status: number
  payload?: unknown
}

interface ApiRequestOptions {
  method?: string
  body?: unknown
  signal?: AbortSignal
  auth?: AuthState | null
  headers?: Record<string, string>
}

const defaultBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''

export async function apiFetch<T>(
  path: string,
  { method = 'GET', body, signal, auth, headers = {} }: ApiRequestOptions = {},
): Promise<T> {
  const url = `${defaultBaseUrl}${path}`
  const requestHeaders = new Headers(headers)
  requestHeaders.set('Accept', 'application/vnd.koshelf.v1+json')
  requestHeaders.set('Content-Type', 'application/json')
  if (auth?.username && auth?.key) {
    requestHeaders.set('X-Auth-User', auth.username)
    requestHeaders.set('X-Auth-Key', auth.key)
  }
  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
    signal,
    credentials: 'include',
  })

  if (!response.ok) {
    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      payload = await response.text()
    }
    const error: ApiError = Object.assign(new Error('Request failed'), {
      status: response.status,
      payload,
    })
    throw error
  }

  if (response.status === 204) {
    return null as T
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return response.json() as Promise<T>
  }
  return (response.text() as unknown) as T
}
