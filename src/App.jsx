import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './API/firebase'

import NavBar        from './components/NavBar'
import Footer        from './components/Footer'
import Sidebar       from './components/SideBar'
import Notification  from './components/notification'
import AdminRoute    from './admin/adminRoute'
import AdminLayout   from './admin/adminLayout'
import AdminDashboard from './admin/adminDashboard'
import AdminBooks    from './admin/adminBooks'
import AdminQuiz     from './admin/adminQuiz'
import AdminExcerpts from './admin/adminExcerpts'

import HomePage      from './pages/HomePage'
import MgaLibro      from './pages/mgaLibro'
import BookPage      from './pages/bookPage'
import ExcerptsPage  from './pages/Excerpt'
import Pagsusuri     from './pages/Pagsusuri'
import Pagsusulit    from './pages/pagsusulit'
import Login         from './pages/login'
import Registration  from './pages/register'
import ProfilePage   from './pages/profile'
import MagsuriTayo   from './pages/magsuriTayo'

/* ─────────────────────────────────────────────────────────── */

const CHROME_HIDDEN_ROUTES = new Set([
  '/login',
  '/register',
  '/magsuri',
])

const PROTECTED_ROUTES = new Set([
  '/',
  '/mga-libro',
  '/pagsusuri',
  '/pagsusulit',
  '/profile',
  '/magsuri',
])

/* ─────────────────────────────────────────────────────────── */

// Upgraded RequireAuth — also checks if Firestore doc still exists
function RequireAuth({ user, children }) {
  const { pathname } = useLocation()
  const [status, setStatus] = useState('checking') // 'checking' | 'ok' | 'deleted' | 'unauth'

  useEffect(() => {
    if (!user) {
      setStatus(PROTECTED_ROUTES.has(pathname) ? 'unauth' : 'ok')
      return
    }

    let cancelled = false
    getDoc(doc(db, 'users', user.uid)).then((snap) => {
      if (cancelled) return
      if (!snap.exists()) {
        signOut(auth)
        setStatus('deleted')
      } else {
        setStatus('ok')
      }
    }).catch(() => {
      if (!cancelled) setStatus('ok') // fail open on network error
    })

    return () => { cancelled = true }
  }, [user, pathname])

  if (status === 'checking') {
    return <div style={{ minHeight: '100vh', background: '#0d0d0d' }} />
  }

  if (status === 'deleted') {
    return <Navigate to="/login?reason=deleted" replace />
  }

  if (status === 'unauth') {
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
    pathname === '/excerpts'       ||
    pathname.startsWith('/admin')  ||
    CHROME_HIDDEN_ROUTES.has(pathname)
  )
}

/* ─────────────────────────────────────────────────────────── */

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

      {!hideChrome && <Sidebar />}

      <main className={hideChrome ? '' : 'with-sidebar'}>
        <Routes>

          {/* ── Auth routes ────────────────────────────────── */}
          <Route path="/login" element={
            <RedirectIfAuthed user={user}>
              <Login onNotify={setNotif} />
            </RedirectIfAuthed>
          } />
          <Route path="/register" element={
            <RedirectIfAuthed user={user}>
              <Registration onNotify={setNotif} />
            </RedirectIfAuthed>
          } />

          {/* ── Admin routes ───────────────────────────────── */}
          <Route
            path="/admin"
            element={
              <AdminRoute user={user}>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index           element={<AdminDashboard />} />
            <Route path="books"    element={<AdminBooks />} />
            <Route path="quiz"     element={<AdminQuiz />} />
            <Route path="excerpts" element={<AdminExcerpts />} />
            <Route path="*"        element={<Navigate to="/admin" replace />} />
          </Route>

          {/* ── Protected user routes ──────────────────────── */}
          <Route path="/" element={
            <RequireAuth user={user}><HomePage /></RequireAuth>
          } />
          <Route path="/mga-libro" element={
            <RequireAuth user={user}><MgaLibro /></RequireAuth>
          } />
          <Route path="/libro/:id" element={
            <RequireAuth user={user}><BookPage /></RequireAuth>
          } />
          <Route path="/excerpts" element={
            <RequireAuth user={user}><ExcerptsPage /></RequireAuth>
          } />
          <Route path="/pagsusuri" element={
            <RequireAuth user={user}><Pagsusuri /></RequireAuth>
          } />
          <Route path="/pagsusulit" element={
            <RequireAuth user={user}><Pagsusulit /></RequireAuth>
          } />
          <Route path="/profile" element={
            <RequireAuth user={user}><ProfilePage onNotify={setNotif} /></RequireAuth>
          } />
          <Route path="/magsuri" element={
            <RequireAuth user={user}><MagsuriTayo /></RequireAuth>
          } />

          {/* ── Catch-all ──────────────────────────────────── */}
          <Route path="*" element={
            <Navigate to={user ? '/' : '/login'} replace />
          } />

        </Routes>
      </main>

      {!hideChrome && <Footer className="with-sidebar" />}
    </>
  )
}

/* ─────────────────────────────────────────────────────────── */

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

  if (!authReady) return <div style={{ minHeight: '100vh', background: '#0d0d0d' }} />

  return (
    <BrowserRouter>
      <Layout notif={notif} setNotif={setNotif} user={user} />
    </BrowserRouter>
  )
}

export default App