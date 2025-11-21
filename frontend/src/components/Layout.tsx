import type { PropsWithChildren } from 'react'

export function Layout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f1a] via-[#1a1824] to-[#0f0b18] text-ctp-text">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-10 pt-12 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.4em] text-ctp-subtext0">KoShelf Admin</p>
          <h1 className="text-3xl font-semibold text-ctp-lavender sm:text-4xl">Audiobookshelf Bridge</h1>
          <p className="max-w-3xl text-base text-ctp-subtext0">
            React-powered workspace for managing KoShelf accounts and verifying the Audiobookshelf bridge. Enter a KoShelf
            credential to pull real data from the existing backend.
          </p>
        </header>
        {children}
      </div>
    </div>
  )
}
