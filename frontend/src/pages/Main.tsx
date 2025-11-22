import { AudiobookshelfSearch } from '../components/AudiobookshelfSearch'
import type { AuthState } from '../hooks/useAuth'

interface MainProps {
    auth: AuthState
}

export function Main({ auth }: MainProps) {
    return (
        <div className="space-y-8">
            <div className="rounded-xl border border-white/5 bg-ctp-mantle/50 p-6 backdrop-blur-md">
                <h2 className="mb-4 text-xl font-semibold text-ctp-lavender">Sync Audiobooks</h2>
                <p className="mb-6 text-ctp-subtext0">
                    Search for an audiobook in your Audiobookshelf library to link it with your current reading progress.
                </p>
                <AudiobookshelfSearch auth={auth} />
            </div>

            <div className="rounded-xl border border-white/5 bg-ctp-surface0/40 p-6">
                <h3 className="mb-2 text-lg font-semibold text-ctp-text">View your library</h3>
                <p className="text-sm text-ctp-subtext0">Head to the Library tab to see linked items, progress, and detail pages.</p>
            </div>
        </div>
    )
}
