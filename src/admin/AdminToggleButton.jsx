// AdminToggleButton.jsx
// Floating button visible only to admins — lets them switch between
// the user-facing site and the admin dashboard from any page.
//
// Usage: render once inside your top-level layout/App.jsx
//   import AdminToggleButton from './components/AdminToggleButton'
//   ...
//   <AdminToggleButton />
//
// It reads the current path and flips between / (user) ↔ /admin (dashboard).

import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../API/firebase'
import './AdminToggleButton.css'

export default function AdminToggleButton() {
  const location = useLocation()
  const navigate = useNavigate()
  const [isAdmin, setIsAdmin]     = useState(false)
  const [visible, setVisible]     = useState(false)   // fade-in after auth check
  const [pressed, setPressed]     = useState(false)   // click animation
  const [tooltip, setTooltip]     = useState(false)
  const tooltipTimer = useRef(null)

  // ── Check if current user is admin ────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        console.log("[AdminToggle] No user is currently logged in.");
        setIsAdmin(false);
        setVisible(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        let role = snap.exists() ? snap.data()?.role : 'user';

        // ── Auto-upgrade / self-heal for admin@panuri.com ─────────────────────
        if (user.email === 'admin@panuri.com') {
          role = 'admin';
          if (!snap.exists() || snap.data()?.role !== 'admin') {
            const { setDoc } = await import('firebase/firestore'); // ensure setDoc is imported
            await setDoc(doc(db, 'users', user.uid), {
              username: 'admin',
              email: user.email,
              role: 'admin',
              papel: 'admin',
              paaralan: 'PANURI System',
              kurso: 'PANURI System',
              createdAt: snap.exists() ? (snap.data()?.createdAt || new Date()) : new Date()
            }, { merge: true });
            console.log("[AdminToggle] Automatically updated admin@panuri.com to admin role in Firestore.");
          }
        }

        console.log(`[AdminToggle] Logged in user: ${user.email}, UID: ${user.uid}, Role in Firestore: "${role}"`);
        setIsAdmin(role === 'admin');
        setVisible(role === 'admin');
      } catch (err) {
        // Fallback for admin@panuri.com if Firestore fetch fails
        if (user.email === 'admin@panuri.com') {
          console.log("[AdminToggle] Firestore fetch failed but automatically allowed admin@panuri.com as Admin.");
          setIsAdmin(true);
          setVisible(true);
        } else {
          console.error("[AdminToggle] Error fetching user role from Firestore:", err);
          setIsAdmin(false);
          setVisible(false);
        }
      }
    });
    return () => unsub();
  }, [])

  if (!isAdmin) return null

  // ── Determine current "mode" ──────────────────────────────────────────────
  const inAdmin  = location.pathname.startsWith('/admin')
  const label    = inAdmin ? 'User View'  : 'Admin Panel'
  const dest     = inAdmin ? '/'          : '/admin'
  const iconUser = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
  const iconAdmin = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17.3l-6.2 4-2.4-7.4L2 9.4h7.6z"/>
    </svg>
  )

  const handleClick = () => {
    setPressed(true)
    setTimeout(() => { setPressed(false); navigate(dest) }, 220)
  }

  const handleMouseEnter = () => {
    clearTimeout(tooltipTimer.current)
    setTooltip(true)
  }
  const handleMouseLeave = () => {
    tooltipTimer.current = setTimeout(() => setTooltip(false), 120)
  }

  return (
    <div
      className={[
        'atb-wrap',
        visible  ? 'atb-wrap--visible'  : '',
        inAdmin  ? 'atb-wrap--in-admin' : 'atb-wrap--in-user',
      ].join(' ')}
    >
      {/* Tooltip */}
      <div className={`atb-tooltip ${tooltip ? 'atb-tooltip--show' : ''}`}>
        {label}
        <div className="atb-tooltip-arrow" />
      </div>

      {/* Button */}
      <button
        className={`atb-btn ${pressed ? 'atb-btn--pressed' : ''} ${inAdmin ? 'atb-btn--admin' : 'atb-btn--user'}`}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-label={`Switch to ${label}`}
      >
        {/* Animated icon swap */}
        <span className={`atb-icon atb-icon--out ${inAdmin ? 'atb-icon--active' : ''}`}>
          {iconUser}
        </span>
        <span className={`atb-icon atb-icon--in ${!inAdmin ? 'atb-icon--active' : ''}`}>
          {iconAdmin}
        </span>

        {/* Ripple layer */}
        <span className="atb-ripple" aria-hidden="true" />

        {/* Mode indicator dot */}
        <span className={`atb-dot ${inAdmin ? 'atb-dot--admin' : 'atb-dot--user'}`} />
      </button>
    </div>
  )
}