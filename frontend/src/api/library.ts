import { apiFetch } from './client'
import type { AuthState } from '../hooks/useAuth'

export interface LibraryCard {
  document: string
  libraryItemId?: string | null
  title?: string
  author?: string
  duration?: number
  coverPath?: string
  coverUrl?: string
  mediaType?: string
  ebookProgress?: number | null
  audioProgress?: number | null
  lastUpdated?: number | null
}

export interface LibraryShelvesResponse {
  shelves: {
    continueListening: LibraryCard[]
    continueReading: LibraryCard[]
    recentlyLinked: LibraryCard[]
    unlinked: LibraryCard[]
    all: LibraryCard[]
  }
  items: LibraryItem[]
}

export interface ProgressRecord {
  percentage?: number | null
  progress?: string | null
  device?: string | null
  device_id?: string | null
  timestamp?: number | null
  currentTime?: number | null
}

export interface LibraryItemMetadata {
  title?: string
  author?: string
  duration?: number
  coverPath?: string
  coverUrl?: string
  mediaType?: string
  description?: string
  publishYear?: string | number
  tags?: string[]
  raw?: unknown
}

export interface LibraryItem {
  username: string
  document: string
  libraryItemId?: string | null
  localProgress?: ProgressRecord
  remoteProgress?: ProgressRecord
  remoteError?: string
  metadataError?: string
  metadata?: LibraryItemMetadata
  coverUrl?: string
  lastUpdated?: number
}

export interface LibraryItemResponse {
  item: LibraryItem
}

export async function fetchLibraryShelves(auth: AuthState | null) {
  return apiFetch<LibraryShelvesResponse>('/admin/library', { auth })
}

export async function fetchLibraryItem(auth: AuthState | null, document: string) {
  return apiFetch<LibraryItemResponse>(`/admin/library/${encodeURIComponent(document)}`, { auth })
}

export async function linkLibraryItem(auth: AuthState | null, document: string, libraryItemId: string | null) {
  return apiFetch<{ document: string; library_item_id: string | null }>(
    `/admin/library/${encodeURIComponent(document)}/link`,
    {
      method: 'POST',
      body: { library_item_id: libraryItemId },
      auth,
    },
  )
}

export interface SyncResult {
  direction: 'to_audiobook' | 'from_audiobook'
  ebook_percentage: number
  audio_current_time: number
  audio_duration: number
  error?: string
  suggested_direction?: string
}

export async function syncToAudio(auth: AuthState | null, document: string) {
  return apiFetch<SyncResult>(`/admin/library/${encodeURIComponent(document)}/sync/to-audio`, {
    method: 'POST',
    auth,
  })
}

export async function syncFromAudio(auth: AuthState | null, document: string) {
  return apiFetch<SyncResult>(`/admin/library/${encodeURIComponent(document)}/sync/from-audio`, {
    method: 'POST',
    auth,
  })
}

export async function autoSync(auth: AuthState | null, document: string) {
  return apiFetch<SyncResult>(`/admin/library/${encodeURIComponent(document)}/sync/auto`, {
    method: 'POST',
    auth,
  })
}
