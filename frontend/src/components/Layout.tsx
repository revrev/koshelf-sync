import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom'
import type { AuthState } from '../hooks/useAuth'

interface LayoutProps {
  auth: AuthState | null
  clearAuth: () => void
  isAdmin: boolean
}

export function Layout({ auth, clearAuth, isAdmin }: LayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  if (!auth) {
    return null // Should be handled by protected route wrapper, but just in case
  }

  return (
    <div className="min-h-screen bg-ctp-base text-ctp-text selection:bg-ctp-surface2 selection:text-ctp-text">
      <nav className="border-b border-white/5 bg-ctp-mantle/50 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 text-lg font-bold text-ctp-lavender transition hover:text-ctp-mauve">
              <span className="text-2xl">📚</span>
              KoShelf Sync
            </Link>
            <div className="hidden md:flex md:gap-4">
              <Link
                to="/"
                className={`text-sm font-medium transition hover:text-ctp-text ${location.pathname === '/' ? 'text-ctp-text' : 'text-ctp-subtext0'
                  }`}
              >
                Sync
              </Link>
              <Link
                to="/library"
                className={`text-sm font-medium transition hover:text-ctp-text ${location.pathname.startsWith('/library') ? 'text-ctp-text' : 'text-ctp-subtext0'
                  }`}
              >
                Library
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  className={`text-sm font-medium transition hover:text-ctp-text ${location.pathname === '/admin' ? 'text-ctp-text' : 'text-ctp-subtext0'
                    }`}
                >
                  Admin
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-ctp-subtext0 sm:block">
              Signed in as <span className="font-semibold text-ctp-text">{auth.username}</span>
            </span>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-ctp-subtext0 transition hover:bg-white/10 hover:text-ctp-text"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}
