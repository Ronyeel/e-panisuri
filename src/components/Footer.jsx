import './Footer.css'

const NAV_LINKS = [
  { label: 'Home',       href: '#home' },
  { label: 'Mga Aklat',  href: '#books' },
  { label: 'Pagsusuri',  href: '#pagsusuri' },
  { label: 'Tungkol',    href: '#tungkol' },
  { label: 'Makipag-ugnayan', href: '#contact' },
]

const SOCIALS = [
  {
    label: 'Facebook',
    href: '#',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
      </svg>
    ),
  },
  {
    label: 'Instagram',
    href: '#',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: 'X / Twitter',
    href: '#',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: 'YouTube',
    href: '#',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.96-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
        <polygon fill="#111" points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" />
      </svg>
    ),
  },
]

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="footer-inner">

        {/* Top row */}
        <div className="footer-top">

          {/* Brand */}
          <div className="footer-brand">
            <span className="footer-logo-mark"></span>
            <div>
              <p className="footer-site-name">E-Panisuri</p>
              <p className="footer-tagline">Camarines Norte State College</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="footer-nav" aria-label="Footer navigation">
            <p className="footer-col-label">Nabigasyon</p>
            <ul className="footer-nav-list">
              {NAV_LINKS.map(({ label, href }) => (
                <li key={href}>
                  <a href={href} className="footer-nav-link">{label}</a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Socials */}
          <div className="footer-socials-col">
            <p className="footer-col-label">Sundan Kami</p>
            <div className="footer-socials">
              {SOCIALS.map(({ label, href, icon }) => (
                <a
                  key={label}
                  href={href}
                  className="footer-social-btn"
                  aria-label={label}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>

        </div>

        {/* Divider */}
        <div className="footer-rule" aria-hidden="true">
          <span /><span className="footer-diamond"></span><span />
        </div>

        {/* Bottom row */}
        <div className="footer-bottom">
          <p className="footer-copy">
            &copy; {year} E-Panisuri Lahat ng karapatan ay nakalaan.
          </p>
          <p className="footer-credit">
            Ginawa para sa mga manunulat at mambabasa ng Camarines Norte.
          </p>
        </div>

      </div>
    </footer>
  )
}