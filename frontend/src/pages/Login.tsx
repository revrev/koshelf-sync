import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthGate } from '../components/AuthGate'
import type { AuthState } from '../hooks/useAuth'

interface LoginProps {
    auth: AuthState | null
    saveAuth: (auth: AuthState) => void
    clearAuth: () => void
}

export function Login({ auth, saveAuth, clearAuth }: LoginProps) {
    const navigate = useNavigate()

    useEffect(() => {
        if (auth) {
            navigate('/')
        }
    }, [auth, navigate])

    if (auth) {
        return null
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-ctp-base p-4 text-ctp-text">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <span className="text-4xl">📚</span>
                    <h2 className="mt-6 text-3xl font-bold tracking-tight text-ctp-lavender">
                        Sign in to KoShelf
                    </h2>
                    <p className="mt-2 text-sm text-ctp-subtext0">
                        Sync your reading progress across devices
                    </p>
                </div>

                {/* Force show login form by passing auth={null} */}
                <AuthGate auth={null} onSave={saveAuth} onClear={clearAuth} />
            </div>
        </div>
    )
}
