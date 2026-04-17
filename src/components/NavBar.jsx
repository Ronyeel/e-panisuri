import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import SearchBar from './searchBar'
import './NavBar.css'

// ✅ React Icons (Material)
import {
  MdPerson,
  MdQuiz,
 MdSummarize
} from 'react-icons/md'

export const navLinks = [
  { label: 'Home',                  to: '/' },
  { label: 'Mga Aklat',             to: '/mga-libro' },
  { label: 'Pagsusuri',             to: '/pagsusuri' },
  { label: 'Teoryang Pampanitikan', to: '/teorya' },
  { label: 'Bagong Pamantayan',     to: '/bagong-pamantayan' },
  { label: 'Tungkol Sa Amin',       to: '/tungkol-sa' },
]

// ✅ Replaced SVG with React Icon
function UserIcon() {
  return <MdPerson size={18} />
}

/* ✅ Pagsusulit Button (React Icon) */
function PagsusulitButton({ onClick }) {
  return (
    <div className="pagsusulit-wrapper">
      <button
        className="pagsusulit-btn"
        onClick={onClick}
        aria-label="Pagsusulit"
      >
        <MdQuiz size={20} />
      </button>
      <div className="pagsusulit-tooltip">
        <span className="pagsusulit-tooltip-title">Pagsusulit</span>
      </div>
    </div>
  )
}

/* ✅ Magsuri Button (React Icon) */
function MagsuriButton({ onClick }) {
  return (
    <div className="magsuri-wrapper">
      <button
        className="magsuri-btn"
        onClick={onClick}
        aria-label="Magsuri Tayo"
      >
        <MdSummarize size={20} />
      </button>
      <div className="magsuri-tooltip">
        <span className="magsuri-tooltip-title">Magsuri Tayo</span>
      </div>
    </div>
  )
}

export default function NavBar({ isLoggedIn = false, username = '' }) {
  const [menuOpen,   setMenuOpen]   = useState(false)
  const [notifOpen,  setNotifOpen]  = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
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

  const displayName = username
    ? (username.length > 14 ? username.slice(0, 13) + '…' : username)
    : 'Sign In'

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">

          {/* Logo */}
          <a
            href="/"
            className="navbar-logo"
            onClick={e => {
              e.preventDefault()
              navigate('/')
              close()
            }}
          >
            <span className="logo-line1">WEBSITE</span>
            <span className="logo-line2">LOGO</span>
          </a>

          {/* Search */}
          <SearchBar
            mobileOpen={searchOpen}
            onMobileToggle={() => setSearchOpen(v => !v)}
          />

          {/* Actions */}
          <div className="navbar-actions">
            <div className="navbar-divider" />

            {/* Pagsusulit */}
            <PagsusulitButton onClick={() => navigate('/pagsusulit')} />

            {/* Magsuri */}
            <MagsuriButton onClick={() => navigate('/magsuri')} />

            {/* Profile */}
            <button
              className={`navbar-profile${isLoggedIn ? ' navbar-profile--loggedin' : ''}`}
              aria-label={isLoggedIn ? `Pumunta sa Profile ni ${username}` : 'Mag-Sign In'}
              onClick={handleProfileClick}
            >
              <span className="navbar-profile-icon">
                <UserIcon />
              </span>
              <span className="navbar-profile-label">
                {displayName}
              </span>
            </button>

            {/* Hamburger */}
            <button
              className={`navbar-burger ${menuOpen ? 'open' : ''}`}
              onClick={() => setMenuOpen(v => !v)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
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

          {/* Extra routes */}
          <NavLink
            to="/pagsusulit"
            className={({ isActive }) =>
              `navbar-mobile-link${isActive ? ' navbar-link--active' : ''}`
            }
            onClick={close}
          >
            <MdQuiz size={18} style={{ marginRight: 6 }} />
            Pagsusulit
          </NavLink>

          <NavLink
            to="/magsuri"
            className={({ isActive }) =>
              `navbar-mobile-link${isActive ? ' navbar-link--active' : ''}`
            }
            onClick={close}
          >
            <MdSummarize size={18} style={{ marginRight: 6 }} />
            Magsuri Tayo
          </NavLink>

          {isLoggedIn ? (
            <NavLink
              to="/profile"
              className="navbar-mobile-link navbar-mobile-profile"
              onClick={close}
            >
              <MdPerson size={18} style={{ marginRight: 6 }} />
              {username || 'Profile'}
            </NavLink>
          ) : (
            <button
              className="navbar-mobile-link navbar-mobile-profile navbar-mobile-signin"
              onClick={() => {
                close()
                setNotifOpen(true)
              }}
            >
              <MdPerson size={18} style={{ marginRight: 6 }} />
              Mag-Sign In
            </button>
          )}
        </div>
      </nav>
    </>
  )
}