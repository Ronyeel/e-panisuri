import { NavLink } from 'react-router-dom';
import { useEffect } from 'react';
import { navLinks } from './NavBar';
import './SideBar.css';
import {
  MdHome,
  MdMenuBook,
  MdSearch,
  MdLibraryBooks,
  MdStraighten,
  MdInfo
} from 'react-icons/md';

export default function Sidebar({ isMinimized, setIsMinimized, isOpenMobile, setIsOpenMobile }) {

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const handleLinkClick = () => {
    setIsOpenMobile(false);
  };

  // Close mobile sidebar when route changes
  useEffect(() => {
    const closeMobile = () => setIsOpenMobile(false);
    window.addEventListener('popstate', closeMobile);
    return () => window.removeEventListener('popstate', closeMobile);
  }, [setIsOpenMobile]);

  return (
    <aside 
      className={`sidebar ${isMinimized ? 'minimized' : ''} ${isOpenMobile ? 'open' : ''}`}
      aria-label="Pangunahing nabigasyon"
    >
      <nav>
        {navLinks.map(link => (
          <NavLink
            key={link.label}
            to={link.to}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'sidebar-link--active' : ''}`
            }
            title={isMinimized ? link.label : ''}
            onClick={handleLinkClick}
          >
            <div className="icon">
              {link.icon || getDefaultIcon(link.label)}
            </div>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Desktop Toggle Button */}
      <button
        className="sidebar-toggle"
        onClick={toggleMinimize}
        aria-label={isMinimized ? "Expand sidebar" : "Minimize sidebar"}
      >
        {isMinimized ? '→' : '←'}
      </button>
    </aside>
  );
}

function getDefaultIcon(label) {
  const map = {
    'Home': <MdHome />,
    'Mga Libro': <MdMenuBook />,
    'Pagsusuri': <MdSearch />,
    'Teoryang Pampanitikan': <MdLibraryBooks />,
    'Bagong Pamantayan': <MdStraighten />,
    'Tungkol Sa Amin': <MdInfo />,
  };

  return map[label] || <span>●</span>;
}