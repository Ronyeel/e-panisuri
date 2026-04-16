// AdminLayout.jsx
import { useState } from 'react'
import { useNavigate, useLocation, Link, Outlet } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../API/firebase'
import './admin.css'

const NAV_ITEMS = [
  {
    path: '/admin',
    label: 'Dashboard',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    path: '/admin/books',
    label: 'Books',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
    ),
  },
  {
    path: '/admin/quiz',
    label: 'Quiz',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
  {
    path: '/admin/excerpts',
    label: 'Excerpts',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
]

export default function AdminLayout() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = async () => {
    await signOut(auth)
    navigate('/login', { replace: true })
  }

  return (
    <div className={`ep-shell ${collapsed ? 'ep-shell--collapsed' : ''}`}>

      {/* ── Sidebar ── */}
      <aside className="ep-sidebar">

        <div className="ep-sidebar-header">
          <div className="ep-logo">
            <span className="ep-logo-mark">P</span>
            <span className="ep-logo-text">Panisuri</span>
          </div>
          <button
            className="ep-collapse-btn"
            onClick={() => setCollapsed(c => !c)}
            aria-label="Toggle sidebar"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {collapsed
                ? <polyline points="9 18 15 12 9 6"/>
                : <polyline points="15 18 9 12 15 6"/>}
            </svg>
          </button>
        </div>

        <nav className="ep-nav">
          {NAV_ITEMS.map(item => {
            const active =
              location.pathname === item.path ||
              (item.path !== '/admin' && location.pathname.startsWith(item.path))
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`ep-nav-item ${active ? 'ep-nav-item--active' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <span className="ep-nav-icon">{item.icon}</span>
                <span className="ep-nav-label">{item.label}</span>
                {active && <span className="ep-nav-indicator" />}
              </Link>
            )
          })}
        </nav>

        <div className="ep-sidebar-footer">
          <button className="ep-logout-btn" onClick={handleLogout} title={collapsed ? 'Mag-logout' : undefined}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span>Mag-logout</span>
          </button>
        </div>

      </aside>

      {/* ── Main ── */}
      <main className="ep-main">
        <Outlet />
      </main>

    </div>
  )
}