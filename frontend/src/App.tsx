import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Main } from './pages/Main'
import { Admin } from './pages/Admin'
import { Library } from './pages/Library'
import { LibraryDetail } from './pages/LibraryDetail'
import { useAuth } from './hooks/useAuth'
import { useAccounts } from './hooks/useAccounts'
import { type ApiError } from './api/client'

function App() {
  const { auth, saveAuth, clearAuth } = useAuth()
  const { data, error } = useAccounts(auth)
  const isAdmin = Boolean(data?.actor_is_admin)

  useEffect(() => {
    if ((error as ApiError)?.status === 401) {
      clearAuth()
    }
  }, [error, clearAuth])

  return (
    <Routes>
      <Route
        path="/login"
        element={<Login auth={auth} saveAuth={saveAuth} clearAuth={clearAuth} />}
      />

      <Route element={<Layout auth={auth} clearAuth={clearAuth} isAdmin={isAdmin} />}>
        <Route
          path="/"
          element={auth ? <Main auth={auth} /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/library"
          element={auth ? <Library auth={auth} /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/library/:document"
          element={auth ? <LibraryDetail auth={auth} /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/admin"
          element={auth ? <Admin auth={auth} /> : <Navigate to="/login" replace />}
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
