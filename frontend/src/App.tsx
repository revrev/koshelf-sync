import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { useAuth } from './hooks/useAuth'

function App() {
  const { auth, saveAuth, clearAuth } = useAuth()

  return (
    <Layout>
      <Dashboard auth={auth} saveAuth={saveAuth} clearAuth={clearAuth} />
    </Layout>
  )
}

export default App
