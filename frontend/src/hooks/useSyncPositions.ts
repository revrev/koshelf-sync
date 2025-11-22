import { useMutation } from '@tanstack/react-query'
import type { AuthState } from './useAuth'
import { syncToAudio, syncFromAudio, autoSync } from '../api/library'

export function useSyncPositions(auth: AuthState | null) {
    const syncToAudioMutation = useMutation({
        mutationFn: (document: string) => syncToAudio(auth, document),
    })

    const syncFromAudioMutation = useMutation({
        mutationFn: (document: string) => syncFromAudio(auth, document),
    })

    const autoSyncMutation = useMutation({
        mutationFn: (document: string) => autoSync(auth, document),
    })

    return {
        syncToAudio: syncToAudioMutation,
        syncFromAudio: syncFromAudioMutation,
        autoSync: autoSyncMutation,
    }
}
