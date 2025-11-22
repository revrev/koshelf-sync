import { useState, useEffect } from 'react'
import type { AuthState } from '../hooks/useAuth'
import type { SearchResult } from '../api/audiobookshelf'
import { useLibraries, useLibrarySearch } from '../hooks/useAudiobookshelf'
import { useAudiobookshelfCover } from '../hooks/useAudiobookshelfCover'

interface AudiobookshelfSearchProps {
    auth: AuthState | null
    onSelect?: (result: SearchResult) => void
}

export function AudiobookshelfSearch({ auth, onSelect }: AudiobookshelfSearchProps) {
    const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedQuery, setDebouncedQuery] = useState('')

    const { data: librariesData, isLoading: isLoadingLibraries, error: librariesError } = useLibraries(auth)
    const { data: searchData, isLoading: isSearching, error: searchError } = useLibrarySearch(
        auth,
        selectedLibraryId,
        debouncedQuery,
    )

    // Auto-select first library if none selected
    useEffect(() => {
        if (librariesData?.libraries && librariesData.libraries.length > 0 && !selectedLibraryId) {
            setSelectedLibraryId(librariesData.libraries[0].id)
        }
    }, [librariesData, selectedLibraryId])

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value)
        // Simple debounce
        const timeoutId = setTimeout(() => {
            setDebouncedQuery(e.target.value)
        }, 500)
        return () => clearTimeout(timeoutId)
    }

    if (isLoadingLibraries) {
        return <div className="text-sm text-ctp-subtext0">Loading libraries...</div>
    }

    if (librariesError) {
        return (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
                Failed to load libraries: {(librariesError as Error).message}
            </div>
        )
    }

    const libraries = librariesData?.libraries ?? []

    if (libraries.length === 0) {
        return (
            <div className="text-sm text-ctp-subtext0">
                No libraries found. Check your Audiobookshelf configuration.
            </div>
        )
    }

    return (
        <section className="rounded-2xl border border-white/5 bg-ctp-surface0/50 p-6">
            <h2 className="mb-4 text-xl font-semibold text-ctp-lavender">Find Audiobookshelf items</h2>

            <div className="mb-6 flex flex-col gap-4 sm:flex-row">
                <select
                    value={selectedLibraryId ?? ''}
                    onChange={(e) => setSelectedLibraryId(e.target.value)}
                    className="rounded-lg border border-white/10 bg-ctp-mantle px-4 py-2 text-sm text-ctp-text focus:border-ctp-lavender focus:outline-none"
                >
                    {libraries.map((lib) => (
                        <option key={lib.id} value={lib.id}>
                            {lib.name}
                        </option>
                    ))}
                </select>

                <div className="relative flex-1">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={handleSearchChange}
                        placeholder="Search for books..."
                        className="w-full rounded-lg border border-white/10 bg-ctp-mantle px-4 py-2 text-sm text-ctp-text placeholder-ctp-overlay0 focus:border-ctp-lavender focus:outline-none"
                    />
                    {isSearching && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-ctp-lavender border-t-transparent" />
                        </div>
                    )}
                </div>
            </div>

            {searchError && (
                <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
                    Search failed: {(searchError as Error).message}
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {searchData?.results.map((result) => (
                    <AudiobookshelfResultCard
                        key={result.libraryItem.id}
                        auth={auth}
                        result={result}
                        onSelect={onSelect}
                    />
                ))}
                {searchData?.results.length === 0 && debouncedQuery && !isSearching && (
                    <div className="col-span-full py-8 text-center text-sm text-ctp-subtext0">
                        No results found for "{debouncedQuery}"
                    </div>
                )}
            </div>
        </section>
    )
}

interface ResultCardProps {
    auth: AuthState | null
    result: SearchResult
    onSelect?: (result: SearchResult) => void
}

function AudiobookshelfResultCard({ auth, result, onSelect }: ResultCardProps) {
    const libraryItem = result.libraryItem
    const hasRemoteCover = Boolean(libraryItem.media?.coverPath)
    const { data: coverUrl, isLoading: coverLoading, error: coverError } = useAudiobookshelfCover(
        auth,
        hasRemoteCover ? libraryItem.id : null,
        { format: 'webp', width: 400 },
    )

    const handleSelect = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault()
        e.stopPropagation()
        if (onSelect) {
            onSelect(result)
        } else {
            console.log('Selected book:', libraryItem.media.metadata.title)
            console.log('Library Item ID:', libraryItem.id)
            alert(`Selected: ${libraryItem.media.metadata.title}\n\nLibrary Item ID: ${libraryItem.id}\n\n(Linking functionality coming soon!)`)
        }
    }

    const renderCover = () => {
        if (coverUrl) {
            return <img src={coverUrl} alt={libraryItem.media.metadata.title} className="h-24 w-16 rounded object-cover" />
        }
        if (!hasRemoteCover) {
            return <div className="flex h-24 w-16 items-center justify-center rounded bg-ctp-surface0 text-[10px] text-ctp-overlay0">No Cover</div>
        }
        if (coverLoading) {
            return (
                <div className="flex h-24 w-16 items-center justify-center rounded bg-ctp-surface0 text-[10px] text-ctp-overlay0">
                    Loading…
                </div>
            )
        }
        if (coverError) {
            return (
                <div className="flex h-24 w-16 items-center justify-center rounded bg-ctp-surface0 text-[10px] text-red-400">
                    Cover unavailable
                </div>
            )
        }
        return <div className="flex h-24 w-16 items-center justify-center rounded bg-ctp-surface0 text-[10px] text-ctp-overlay0">Cover unavailable</div>
    }

    return (
        <button
            type="button"
            onClick={handleSelect}
            className="flex gap-4 rounded-xl border border-white/5 bg-ctp-mantle/50 p-4 text-left transition hover:border-ctp-lavender/30 hover:bg-ctp-mantle active:scale-[0.98]"
        >
            {renderCover()}
            <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-medium text-ctp-text" title={libraryItem.media.metadata.title}>
                    {libraryItem.media.metadata.title}
                </h3>
                <p className="truncate text-xs text-ctp-subtext0" title={libraryItem.media.metadata.author}>
                    {libraryItem.media.metadata.author}
                </p>
                <div className="mt-2 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-ctp-blue/10 px-2 py-0.5 text-[10px] font-medium text-ctp-blue">
                        {libraryItem.mediaType}
                    </span>
                    <span className="text-[10px] text-ctp-overlay0">Click to link</span>
                </div>
            </div>
        </button>
    )
}
