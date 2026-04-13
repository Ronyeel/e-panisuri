// NavBar.jsx
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import './NavBar.css'

const navLinks = [
  { label: 'Home',                   to: '/' },
  { label: 'Mga Libro',              to: '/mga-libro' },
  { label: 'Pagsusuri',              to: '/pagsusuri' },
  { label: 'Teoryang Pamapanitikan', to: '/teorya' },
  { label: 'Bagong Pamantayan',      to: '/bagong-pamantayan' },
  { label: 'Tungkol Sa Amin',        to: '/tungkol-sa' },
]

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}

function MagsuriButton({ onClick }) {
  return (
    <div className="magsuri-wrapper">
      <button
        className="magsuri-btn"
        onClick={onClick}
        aria-label="Magsuri Tayo"
      >
        <img src="/examine.svg" alt="Magsuri Tayo" className="magsuri-icon" />
      </button>
      <div className="magsuri-tooltip">
        <span className="magsuri-tooltip-title">Magsuri Tayo</span>
      </div>
    </div>
  )
}

export default function NavBar({ isLoggedIn = false, username = '' }) {
  const [menuOpen,  setMenuOpen]  = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const navigate = useNavigate()

  const close = () => setMenuOpen(false)

  const handleProfileClick = () => {
    if (isLoggedIn) {
      navigate('/profile')
      close()
    } else {
      setNotifOpen(true)
    }
  }

  // Truncate long usernames for display
  const displayName = username
    ? (username.length > 14 ? username.slice(0, 13) + '…' : username)
    : 'Sign In'

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">

          {/* Logo */}
          <a href="/" className="navbar-logo"
            onClick={e => { e.preventDefault(); navigate('/'); close() }}>
            <span className="logo-line1">WEBSITE</span>
            <span className="logo-line2">LOGO</span>
          </a>

          {/* Desktop Links */}
          <ul className="navbar-links">
            {navLinks.map(link => (
              <li key={link.label}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) =>
                    `navbar-link${isActive ? ' navbar-link--active' : ''}`
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>

          {/* Actions */}
          <div className="navbar-actions">
            <div className="navbar-divider" />

            <MagsuriButton onClick={() => navigate('/magsuri')} />

            <button
              className={`navbar-profile${isLoggedIn ? ' navbar-profile--loggedin' : ''}`}
              aria-label={isLoggedIn ? `Pumunta sa Profile ni ${username}` : 'Mag-Sign In'}
              onClick={handleProfileClick}
            >
              <span className="navbar-profile-icon"><UserIcon /></span>
              <span className="navbar-profile-label">{displayName}</span>
            </button>

            <button
              className={`navbar-burger ${menuOpen ? 'open' : ''}`}
              onClick={() => setMenuOpen(v => !v)}
              aria-label="Toggle menu"
            >
              <span /><span /><span />
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div className={`navbar-mobile ${menuOpen ? 'navbar-mobile--open' : ''}`}>
          {navLinks.map(link => (
            <NavLink
              key={link.label}
              to={link.to}
              className={({ isActive }) =>
                `navbar-mobile-link${isActive ? ' navbar-link--active' : ''}`
              }
              onClick={close}
            >
              {link.label}
            </NavLink>
          ))}

          {/* Magsuri Tayo — mobile */}
          <NavLink
            to="/magsuri"
            className={({ isActive }) =>
              `navbar-mobile-link${isActive ? ' navbar-link--active' : ''}`
            }
            onClick={close}
          >
            Magsuri Tayo
          </NavLink>

          {isLoggedIn ? (
            <NavLink
              to="/profile"
              className="navbar-mobile-link navbar-mobile-profile"
              onClick={close}
            >
              <UserIcon /> {username || 'Profile'}
            </NavLink>
          ) : (
            <button
              className="navbar-mobile-link navbar-mobile-profile navbar-mobile-signin"
              onClick={() => { close(); setNotifOpen(true) }}
            >
              <UserIcon /> Mag-Sign In
            </button>
          )}
        </div>
      </nav>

  
    </>
  )
}