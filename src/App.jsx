import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './API/firebase'
import NavBar from './components/NavBar'
import Footer from './components/Footer'
import HomePage from './pages/HomePage'
import MgaLibro from './pages/mgaLibro'
import BookPage from './pages/bookPage'
import ExcerptsPage from './pages/Excerpt'
import Pagsusuri from './pages/Pagsusuri'
import Login from './pages/login'
import Registration from './pages/register'
import ProfilePage from './pages/profile'
import Notification from './components/notification'
import MagsuriTayo from './pages/magsuriTayo'

// Routes that should never show NavBar/Footer
const CHROME_HIDDEN_ROUTES = new Set(['/login', '/register', '/magsuri'])

// Routes that require authentication
const PROTECTED_ROUTES = new Set(['/', '/mga-libro', '/pagsusuri', '/profile', '/magsuri'])

function RequireAuth({ user, children }) {
  const { pathname } = useLocation()
  if (!user && PROTECTED_ROUTES.has(pathname)) {
    return <Navigate to="/login" replace />
  }
  return children
}

function RedirectIfAuthed({ user, children }) {
  if (user) return <Navigate to="/" replace />
  return children
}

function useHideChrome() {
  const { pathname } = useLocation()
  return (
    pathname.startsWith('/libro/') ||
    pathname === '/excerpts' ||
    CHROME_HIDDEN_ROUTES.has(pathname)
  )
}

function Layout({ notif, setNotif, user }) {
  const hideChrome = useHideChrome()

  return (
    <>
      <Notification
        message={notif?.message}
        type={notif?.type}
        onClose={() => setNotif(null)}
      />

      {!hideChrome && (
        <NavBar
          isLoggedIn={!!user}
          username={user?.displayName || user?.email || ''}
        />
      )}

      <Routes>
        {/* ── Public / auth routes ─────────────────────────── */}
        <Route
          path="/login"
          element={
            <RedirectIfAuthed user={user}>
              <Login onNotify={setNotif} />
            </RedirectIfAuthed>
          }
        />
        <Route
          path="/register"
          element={
            <RedirectIfAuthed user={user}>
              <Registration onNotify={setNotif} />
            </RedirectIfAuthed>
          }
        />

        {/* ── Protected routes ─────────────────────────────── */}
        <Route
          path="/"
          element={
            <RequireAuth user={user}>
              <HomePage />
            </RequireAuth>
          }
        />
        <Route
          path="/mga-libro"
          element={
            <RequireAuth user={user}>
              <MgaLibro />
            </RequireAuth>
          }
        />
        <Route
          path="/libro/:id"
          element={
            <RequireAuth user={user}>
              <BookPage />
            </RequireAuth>
          }
        />
        <Route
          path="/excerpts"
          element={
            <RequireAuth user={user}>
              <ExcerptsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/pagsusuri"
          element={
            <RequireAuth user={user}>
              <Pagsusuri />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth user={user}>
              <ProfilePage onNotify={setNotif} />
            </RequireAuth>
          }
        />
        <Route
          path="/magsuri"
          element={
            <RequireAuth user={user}>
              <MagsuriTayo />
            </RequireAuth>
          }
        />

        {/* ── Catch-all ────────────────────────────────────── */}
        <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
      </Routes>

      {!hideChrome && <Footer />}
    </>
  )
}

function App() {
  const [notif,     setNotif]     = useState(null)
  const [user,      setUser]      = useState(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setAuthReady(true)
    })
    return () => unsubscribe()
  }, [])

  // Hold render until Firebase resolves — prevents flash of wrong route
  if (!authReady) return <div style={{ minHeight: '100vh', background: '#0d0d0d' }} />

  return (
    <BrowserRouter>
      <Layout notif={notif} setNotif={setNotif} user={user} />
    </BrowserRouter>
  )
}

export default App