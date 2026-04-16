import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './API/firebase'

import NavBar            from './components/NavBar'
import Footer            from './components/Footer'
import Sidebar           from './components/SideBar'
import Notification      from './components/notification'
import AdminToggleButton from './admin/AdminToggleButton'
import AdminRoute        from './admin/adminRoute'
import AdminLayout       from './admin/adminLayout'
import AdminDashboard    from './admin/adminDashboard'
import AdminBooks        from './admin/adminBooks'
import AdminQuiz         from './admin/adminQuiz'
import AdminExcerpts     from './admin/adminExcerpts'

import HomePage     from './pages/HomePage'
import MgaLibro     from './pages/mgaLibro'
import BookPage     from './pages/bookPage'
import ExcerptsPage from './pages/Excerpt'
import Pagsusuri    from './pages/Pagsusuri'
import Pagsusulit   from './pages/pagsusulit'
import Login        from './pages/login'
import Registration from './pages/register'
import ProfilePage  from './pages/profile'
import MagsuriTayo  from './pages/magsuriTayo'

// ─── Constants ────────────────────────────────────────────────────────────────

const CHROME_HIDDEN_ROUTES = new Set(['/login', '/register', '/magsuri'])

const PROTECTED_ROUTES = new Set([
  '/', '/mga-libro', '/excerpts', '/pagsusuri',
  '/pagsusulit', '/profile', '/magsuri',
])

// Single blank screen used by all guards — avoids re-creating elements
const Blank = () => <div style={{ minHeight: '100vh', background: '#0d0d0d' }} />

// ─── Auth Guards ──────────────────────────────────────────────────────────────

/**
 * RequireAuth
 * Blocks protected pages until:
 *   1. Firebase has resolved the session (authReady)
 *   2. The Firestore user doc is confirmed to exist (catches admin-deleted accounts)
 *
 * Status flow:
 *   'pending'  → waiting; renders blank (no flash)
 *   'ok'       → valid session; renders children
 *   'unauth'   → no session on a protected route; redirects to /login
 *   'deleted'  → Firestore doc missing; signs out and redirects to /login?reason=deleted
 */
function RequireAuth({ user, authReady, children }) {
  const { pathname } = useLocation()

  // Always start pending — never render children optimistically
  const [status, setStatus] = useState('pending')

  useEffect(() => {
    if (!authReady) return

    // No Firebase session
    if (!user) {
      const isProtected = PROTECTED_ROUTES.has(pathname) || pathname.startsWith('/libro/')
      setStatus(isProtected ? 'unauth' : 'ok')
      return
    }

    // Confirm the Firestore doc still exists (admin may have deleted the account)
    let cancelled = false
    setStatus('pending') // re-enter pending on user/path change

    getDoc(doc(db, 'users', user.uid))
      .then(snap => {
        if (cancelled) return
        if (snap.exists()) {
          setStatus('ok')
        } else {
          signOut(auth)
          setStatus('deleted')
        }
      })
      .catch(() => {
        // Network error — optimistically allow rather than lock the user out
        if (!cancelled) setStatus('ok')
      })

    return () => { cancelled = true }
  }, [user, authReady, pathname])

  if (status === 'pending')  return <Blank />
  if (status === 'deleted')  return <Navigate to="/login?reason=deleted" replace />
  if (status === 'unauth')   return <Navigate to="/login" replace />
  return children
}

/**
 * RedirectIfAuthed
 * Used on /login and /register.
 * Waits for authReady before deciding — prevents the login form from flashing
 * when a remembered session is being restored by Firebase on mount.
 */
function RedirectIfAuthed({ user, authReady, children }) {
  if (!authReady) return <Blank />
  if (user)       return <Navigate to="/" replace />
  return children
}

// ─── Chrome Visibility ────────────────────────────────────────────────────────

function useHideChrome() {
  const { pathname } = useLocation()
  return (
    CHROME_HIDDEN_ROUTES.has(pathname) ||
    pathname.startsWith('/libro/')     ||
    pathname === '/excerpts'           ||
    pathname.startsWith('/admin')
  )
}

// ─── App Shell ────────────────────────────────────────────────────────────────

function Layout({ notif, setNotif, user, authReady }) {
  const hideChrome = useHideChrome()

  // Derived display values — avoids prop drilling into every page
  const isLoggedIn = !!user
  const username   = user?.displayName || user?.email || ''

  return (
    <>
      <Notification
        message={notif?.message}
        type={notif?.type}
        onClose={() => setNotif(null)}
      />

      {!hideChrome && <NavBar isLoggedIn={isLoggedIn} username={username} />}
      {!hideChrome && <Sidebar />}

      <main className={hideChrome ? '' : 'with-sidebar'}>
        <Routes>

          {/* ── Public auth pages ──────────────────────────────── */}
          <Route path="/login" element={
            <RedirectIfAuthed user={user} authReady={authReady}>
              <Login onNotify={setNotif} />
            </RedirectIfAuthed>
          } />
          <Route path="/register" element={
            <RedirectIfAuthed user={user} authReady={authReady}>
              <Registration onNotify={setNotif} />
            </RedirectIfAuthed>
          } />

          {/* ── Admin (role-gated inside AdminRoute) ───────────── */}
          <Route
            path="/admin"
            element={<AdminRoute user={user}><AdminLayout /></AdminRoute>}
          >
            <Route index           element={<AdminDashboard />} />
            <Route path="books"    element={<AdminBooks />} />
            <Route path="quiz"     element={<AdminQuiz />} />
            <Route path="excerpts" element={<AdminExcerpts />} />
            <Route path="*"        element={<Navigate to="/admin" replace />} />
          </Route>

          {/* ── Protected user pages ───────────────────────────── */}
          {[
            { path: '/',            element: <HomePage isLoggedIn={isLoggedIn} username={username} /> },
            { path: '/mga-libro',   element: <MgaLibro /> },
            { path: '/libro/:id',   element: <BookPage /> },
            { path: '/excerpts',    element: <ExcerptsPage /> },
            { path: '/pagsusuri',   element: <Pagsusuri /> },
            { path: '/pagsusulit',  element: <Pagsusulit /> },
            { path: '/magsuri',     element: <MagsuriTayo /> },
            { path: '/profile',     element: <ProfilePage onNotify={setNotif} /> },
          ].map(({ path, element }) => (
            <Route key={path} path={path} element={
              <RequireAuth user={user} authReady={authReady}>
                {element}
              </RequireAuth>
            } />
          ))}

          {/* ── Catch-all ──────────────────────────────────────── */}
          <Route path="*" element={
            !authReady
              ? <Blank />
              : <Navigate to={user ? '/' : '/login'} replace />
          } />

        </Routes>
      </main>

      {!hideChrome && <Footer className="with-sidebar" />}

      {/* Floating admin panel toggle — self-guards by role inside the component */}
      <AdminToggleButton />
    </>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [notif,     setNotif]     = useState(null)
  const [user,      setUser]      = useState(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    /**
     * onAuthStateChanged fires once on mount:
     *   null → no saved session; user must log in manually
     *   User → session restored from browserLocalPersistence (Remember Me)
     *
     * authReady stays false until this fires, so all guards render <Blank />
     * and nothing is shown prematurely — eliminates the homepage flash.
     */
    const unsub = onAuthStateChanged(auth, firebaseUser => {
      setUser(firebaseUser ?? null)
      setAuthReady(true)
    })
    return () => unsub()
  }, [])

  return (
    <BrowserRouter>
      <Layout
        notif={notif}
        setNotif={setNotif}
        user={user}
        authReady={authReady}
      />
    </BrowserRouter>
  )
}