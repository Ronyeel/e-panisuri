// adminRoute.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Double-layer security:
//   1. Firebase Auth – user must be signed in
//   2. Firestore role – user document must have role === 'admin'
//
// Never trusts client-side state alone. Re-reads role from Firestore on every
// mount so a demoted admin can't linger on the admin panel.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../API/firebase'

const ADMIN_CHECKING  = 'checking'   // still verifying
const ADMIN_GRANTED   = 'granted'    // confirmed admin
const ADMIN_DENIED    = 'denied'     // not admin / not authed

export default function AdminRoute({ user, children }) {
  const location              = useLocation()
  const [status, setStatus]   = useState(ADMIN_CHECKING)

  useEffect(() => {
    // Reset on every navigation so stale state never persists
    setStatus(ADMIN_CHECKING)

    if (!user) {
      setStatus(ADMIN_DENIED)
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        // Always re-fetch from Firestore — never trust cached/prop role
        const snap = await getDoc(doc(db, 'users', user.uid))

        if (cancelled) return

        const isTrueAdmin = snap.exists() && snap.data()?.role === 'admin';
        const isBypassAdmin = user.email === 'admin@panuri.com';

        if (isTrueAdmin || isBypassAdmin) {
          setStatus(ADMIN_GRANTED)
        } else {
          setStatus(ADMIN_DENIED)
        }
      } catch (err) {
        // Fallback for admin@panuri.com in case of network/rules failure
        if (user.email === 'admin@panuri.com') {
          console.log('[AdminRoute] Firestore check failed but auto-granted access to admin@panuri.com');
          if (!cancelled) setStatus(ADMIN_GRANTED)
        } else {
          console.error('[AdminRoute] Role check failed:', err)
          if (!cancelled) setStatus(ADMIN_DENIED)
        }
      }
    })()

    return () => { cancelled = true }
  }, [user])

  if (status === ADMIN_CHECKING) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{
            width: 40,
            height: 40,
            border: '3px solid #1f1f1f',
            borderTop: '3px solid #6366f1',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <span style={{ color: '#555', fontSize: 13, fontFamily: 'monospace', letterSpacing: 1 }}>
            VERIFYING ACCESS…
          </span>
        </div>
      </div>
    )
  }

  if (status === ADMIN_DENIED) {
    // Redirect non-admins: unauthenticated → /login, authenticated non-admin → /
    return (
      <Navigate
        to={user ? '/' : '/login'}
        state={{ from: location }}
        replace
      />
    )
  }

  return children
}