import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './API/firebase';

import NavBar            from './components/NavBar';
import Footer            from './components/Footer';
import Sidebar           from './components/SideBar';
import AdminToggleButton from './admin/AdminToggleButton';
import AdminRoute        from './admin/adminRoute';
import AdminLayout       from './admin/adminLayout';
import AdminDashboard    from './admin/adminDashboard';
import AdminBooks        from './admin/adminBooks';
import AdminExcerpts     from './admin/adminExcerpts';
import { UIProvider }    from './context/UIContext';

// ── New quiz admin pages (sets + grading) ─────────────────────
import AdminQuizSets    from './admin/adminQuizSets';
import AdminQuizGrading from './admin/adminQuizGrading';

// ── Player-facing pages ───────────────────────────────────────
import HomePage             from './pages/HomePage';
import MgaLibro             from './pages/mgaLibro';
import BookPage             from './pages/bookPage';
import ExcerptsPage         from './pages/Excerpt';
import Pagsusuri            from './pages/Pagsusuri';
import Pagsuslit            from './pages/pagsusulit';   // new multi-type player quiz
import Login                from './pages/login';
import Registration         from './pages/register';
import ProfilePage          from './pages/profile';
import MagsuriTayo          from './pages/magsuriTayo';
import TeoryangPampanitikan from './pages/teoryangPampanitikan';

// ─── Constants ────────────────────────────────────────────────
const CHROME_HIDDEN_ROUTES = new Set(['/login', '/register', '/magsuri']);

const PROTECTED_ROUTES = new Set([
  '/', '/mga-libro', '/excerpts', '/pagsusuri',
  '/pagsusulit', '/profile', '/magsuri',
]);

const Blank = () => <div style={{ minHeight: '100vh', background: '#0d0d0d' }} />;

// ─── Auth Guards ──────────────────────────────────────────────
function RequireAuth({ user, authReady, children }) {
  const { pathname } = useLocation();
  const [status, setStatus] = useState('pending');

  useEffect(() => {
    if (!authReady) return;

    if (!user) {
      const isProtected =
        PROTECTED_ROUTES.has(pathname) || pathname.startsWith('/libro/');
      setStatus(isProtected ? 'unauth' : 'ok');
      return;
    }

    let cancelled = false;
    setStatus('pending');

    getDoc(doc(db, 'users', user.uid))
      .then(() => { if (!cancelled) setStatus('ok'); })
      .catch(() => { if (!cancelled) setStatus('ok'); });

    return () => { cancelled = true; };
  }, [user, authReady, pathname]);

  if (status === 'pending') return <Blank />;
  if (status === 'unauth')  return <Navigate to="/login" replace />;
  return children;
}

function RedirectIfAuthed({ user, authReady, children }) {
  if (!authReady) return <Blank />;
  if (user)       return <Navigate to="/" replace />;
  return children;
}

function useHideChrome() {
  const { pathname } = useLocation();
  return (
    CHROME_HIDDEN_ROUTES.has(pathname) ||
    pathname.startsWith('/libro/')     ||
    pathname === '/excerpts'           ||
    pathname.startsWith('/admin')
  );
}

// ─── Layout ───────────────────────────────────────────────────
function Layout({ user, authReady }) {
  const hideChrome = useHideChrome();

  const [isMinimized, setIsMinimized] = useState(
    () => localStorage.getItem('sidebarMinimized') === 'true'
  );
  const [isOpenMobile, setIsOpenMobile] = useState(false);

  useEffect(() => {
    localStorage.setItem('sidebarMinimized', isMinimized);
  }, [isMinimized]);

  const isLoggedIn = !!user;
  const username   = user?.displayName || user?.email || '';

  return (
    <>
      {!hideChrome && <NavBar isLoggedIn={isLoggedIn} username={username} />}

      <div className={hideChrome ? '' : 'app-shell'}>
        {!hideChrome && (
          <Sidebar
            isMinimized={isMinimized}
            setIsMinimized={setIsMinimized}
            isOpenMobile={isOpenMobile}
            setIsOpenMobile={setIsOpenMobile}
          />
        )}

        <main
          className={
            !hideChrome
              ? `with-sidebar ${isMinimized ? 'minimized' : ''}`
              : ''
          }
        >
          <Routes>

            {/* ── Public ─────────────────────────────────────── */}
            <Route
              path="/login"
              element={
                <RedirectIfAuthed user={user} authReady={authReady}>
                  <Login />
                </RedirectIfAuthed>
              }
            />
            <Route
              path="/register"
              element={
                <RedirectIfAuthed user={user} authReady={authReady}>
                  <Registration />
                </RedirectIfAuthed>
              }
            />

            {/* ── Admin ──────────────────────────────────────── */}
            <Route
              path="/admin"
              element={
                <AdminRoute user={user}>
                  <AdminLayout />
                </AdminRoute>
              }
            >
              {/* Dashboard */}
              <Route index element={<AdminDashboard />} />

              {/* Content management */}
              <Route path="books"   element={<AdminBooks />} />
              <Route path="excerpts" element={<AdminExcerpts />} />

              {/* Quiz management — /admin/quiz   → sets & questions editor  */}
              {/*                   /admin/quiz/grading → essay grading panel */}
              <Route path="quiz"         element={<AdminQuizSets />} />
              <Route path="quiz/grading" element={<AdminQuizGrading />} />

              {/* Catch-all inside admin */}
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Route>

            {/* ── Protected (requires login) ──────────────────── */}
            {[
              {
                path: '/',
                element: <HomePage isLoggedIn={isLoggedIn} username={username} />,
              },
              { path: '/mga-libro',  element: <MgaLibro /> },
              { path: '/libro/:id',  element: <BookPage /> },
              { path: '/excerpts',   element: <ExcerptsPage /> },
              { path: '/pagsusuri',  element: <Pagsusuri /> },
              { path: '/pagsusulit', element: <Pagsuslit /> },   // ← new player quiz
              { path: '/magsuri',    element: <MagsuriTayo /> },
              { path: '/teorya',     element: <TeoryangPampanitikan /> },
              { path: '/profile',    element: <ProfilePage /> },
            ].map(({ path, element }) => (
              <Route
                key={path}
                path={path}
                element={
                  <RequireAuth user={user} authReady={authReady}>
                    {element}
                  </RequireAuth>
                }
              />
            ))}

            {/* ── Catch-all ───────────────────────────────────── */}
            <Route
              path="*"
              element={
                !authReady
                  ? <Blank />
                  : <Navigate to={user ? '/' : '/login'} replace />
              }
            />

          </Routes>
        </main>
      </div>

      {!hideChrome && <Footer className="with-sidebar" />}
      <AdminToggleButton />
    </>
  );
}

// ─── Root ─────────────────────────────────────────────────────
export default function App() {
  const [user,      setUser]      = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser ?? null);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  return (
    <UIProvider>
      <BrowserRouter>
        <Layout
          user={user}
          authReady={authReady}
        />
      </BrowserRouter>
    </UIProvider>
  );
}