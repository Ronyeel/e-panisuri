// Sidebar.jsx
import { NavLink } from 'react-router-dom'
import { navLinks } from './NavBar'
import './SideBar.css'

export default function Sidebar() {
  return (
    <aside className="sidebar" aria-label="Pangunahing nabigasyon">
      <nav>
        {navLinks.map(link => (
          <NavLink
            key={link.label}
            to={link.to}
            className={({ isActive }) =>
              `sidebar-link${isActive ? ' sidebar-link--active' : ''}`
            }
          >
            
            <span className="sidebar-link-dot" />
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}