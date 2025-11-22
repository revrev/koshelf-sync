import { apiFetch } from './client'
import type { AuthState } from '../hooks/useAuth'

export interface Library {
  id: string
  name: string
  folders: string[]
  displayOrder: number
  icon: string
  mediaType: string
  provider: string
  settings: unknown
  created: number
  lastUpdate: number
}

export interface SearchResult {
  libraryItem: {
    id: string
    ino: string
    libraryId: string
    folderId: string
    path: string
    relPath: string
    isFile: boolean
    mtimeMs: number
    ctimeMs: number
    birthtimeMs: number
    addedAt: number
    updatedAt: number
    isMissing: boolean
    isInvalid: boolean
    mediaType: string
    media: {
      metadata: {
        title: string
        author: string
        narrator?: string
        series?: unknown
        publishYear?: string
        publisher?: string
        description?: string
        isbn?: string
        asin?: string
        genres?: string[]
        tags?: string[]
        language?: string
        cover?: string
      }
      coverPath?: string
      duration: number
      size: number
      format: string
    }
  }
  matchType: string
}

export interface LibrariesResponse {
  libraries: Library[]
}

export interface SearchResponse {
  results: SearchResult[]
}

export interface CoverResponse {
  cover: string
  content_type: string
}

export async function fetchLibraries(auth: AuthState | null) {
  return apiFetch<LibrariesResponse>('/admin/audiobookshelf/libraries', { auth })
}

export async function searchLibrary(auth: AuthState, libraryId: string, query: string) {
  const params = new URLSearchParams({ query, library_id: libraryId })
  const url = `/admin/audiobookshelf/search?${params.toString()}`
  console.log('[searchLibrary] URL:', url)
  console.log('[searchLibrary] Auth:', { username: auth?.username, hasKey: !!auth?.key })

  try {
    const result = await apiFetch<SearchResponse>(url, { auth })
    console.log('[searchLibrary] Success:', result)
    return result
  } catch (error) {
    console.error('[searchLibrary] Error:', error)
    throw error
  }
}

interface CoverOptions {
  format?: string
  width?: number
  height?: number
}

export async function fetchCover(auth: AuthState, libraryItemId: string, options: CoverOptions = {}) {
  if (!auth?.username || !auth?.key) {
    throw new Error('Missing authentication for cover request')
  }
  const params = new URLSearchParams({ library_item_id: libraryItemId })
  if (options.format) params.set('format', options.format)
  if (options.width) params.set('width', String(options.width))
  if (options.height) params.set('height', String(options.height))
  const response = await apiFetch<CoverResponse>(`/admin/audiobookshelf/cover?${params.toString()}`, { auth })
  if (!response?.cover) {
    throw new Error('Cover payload missing')
  }
  const contentType = response.content_type || 'image/webp'
  return `data:${contentType};base64,${response.cover}`
}
