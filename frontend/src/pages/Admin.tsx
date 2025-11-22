import { useState } from 'react'
import { AccountTable } from '../components/AccountTable'
import { BootstrapCard } from '../components/BootstrapCard'
import { CreateAccountCard } from '../components/CreateAccountCard'
import { useAccounts } from '../hooks/useAccounts'
import { useCreateAccount } from '../hooks/useCreateAccount'
import type { AuthState } from '../hooks/useAuth'
import type { ApiError } from '../api/client'

interface AdminProps {
    auth: AuthState
}

export function Admin({ auth }: AdminProps) {
    const { data, isFetching, error, refetch } = useAccounts(auth)
    const createAccount = useCreateAccount(auth)
    const [lastCreateTarget, setLastCreateTarget] = useState<'bootstrap' | 'admin' | null>(null)
    const [bootstrapSuccess, setBootstrapSuccess] = useState(false)
    const [adminSuccess, setAdminSuccess] = useState(false)

    const accounts = data?.accounts ?? []
    const bootstrapMode = Boolean(data?.bootstrap_allowed && accounts.length === 0)
    const actorIsAdmin = Boolean(data?.actor_is_admin)
    const adminName = data?.admin
    const apiError = error as ApiError | undefined
    const unauthorized = apiError?.status === 401

    const mutationError = createAccount.error as ApiError | undefined
    const creationErrorMessage =
        mutationError && mutationError.payload && typeof mutationError.payload === 'object'
            ? ((mutationError.payload as { error?: string }).error ?? mutationError.message)
            : mutationError?.message
    const bootstrapError = lastCreateTarget === 'bootstrap' ? creationErrorMessage : null
    const adminError = lastCreateTarget === 'admin' ? creationErrorMessage : null

    const handleBootstrapCreate = async ({ username, password }: { username: string; password: string }) => {
        setLastCreateTarget('bootstrap')
        setBootstrapSuccess(false)
        setAdminSuccess(false)
        await createAccount.mutateAsync({ username, password, authOverride: null })
        setBootstrapSuccess(true)
        refetch()
    }

    const handleAdminCreate = async ({ username, password }: { username: string; password: string }) => {
        setLastCreateTarget('admin')
        setAdminSuccess(false)
        setBootstrapSuccess(false)
        await createAccount.mutateAsync({ username, password })
        setAdminSuccess(true)
        refetch()
    }

    if (unauthorized) {
        return (
            <div className="rounded-lg border border-ctp-red/20 bg-ctp-red/10 p-4 text-center text-ctp-red">
                You are not authorized to view this page.
            </div>
        )
    }

    return (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
            <div className="space-y-4">
                {bootstrapMode ? (
                    <BootstrapCard
                        onCreate={handleBootstrapCreate}
                        isPending={createAccount.isPending && lastCreateTarget === 'bootstrap'}
                        errorMessage={bootstrapError}
                        successMessage={bootstrapSuccess ? 'Admin account created! Sign in with these credentials.' : null}
                    />
                ) : (
                    <CreateAccountCard
                        onCreate={handleAdminCreate}
                        isPending={createAccount.isPending && lastCreateTarget === 'admin'}
                        disabled={!actorIsAdmin}
                        reason={
                            actorIsAdmin
                                ? undefined
                                : adminName
                                    ? `Only ${adminName} can create new KoShelf accounts.`
                                    : 'Account creation is limited to the admin user.'
                        }
                        errorMessage={adminError}
                        successMessage={adminSuccess ? 'Account created successfully.' : null}
                    />
                )}
            </div>

            <div className="space-y-4">
                <section className="rounded-2xl border border-white/5 bg-ctp-surface0/50 p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-semibold text-ctp-lavender">Accounts overview</h2>
                            <p className="text-sm text-ctp-subtext0">Live data served by the Lua/Gin backend.</p>
                        </div>
                        <button
                            onClick={() => refetch()}
                            className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ctp-subtext0 transition hover:border-ctp-lavender/60"
                        >
                            Refresh
                        </button>
                    </div>

                    <AccountTable
                        accounts={accounts}
                        isLoading={isFetching}
                        isError={Boolean(error) && !unauthorized}
                        errorMessage={
                            error && !unauthorized ? (error instanceof Error ? error.message : 'Failed to load accounts') : undefined
                        }
                        onRetry={() => refetch()}
                    />
                </section>
            </div>
        </div>
    )
}
