import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import {
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../API/firebase'
import { useUI } from '../context/UIContext'
import './auth.css'

// ─── Cookie helpers ───────────────────────────────────────────────────────────

const COOKIE_KEY  = 'epanisuri_email'
const COOKIE_DAYS = 7

function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
}

function getCookie(name) {
  const row = document.cookie.split('; ').find(r => r.startsWith(`${name}=`))
  return row ? decodeURIComponent(row.split('=')[1]) : ''
}

function deleteCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`
}

// ─── Firebase error mapper ────────────────────────────────────────────────────

function mapFirebaseError(code) {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':     return 'Mali ang email o password.'
    case 'auth/too-many-requests':      return 'Masyadong maraming pagsubok. Subukan muli mamaya.'
    case 'auth/network-request-failed': return 'Walang koneksyon sa internet.'
    default:                            return 'May error na naganap. Subukan muli.'
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validate({ email, password }) {
  const errors = {}
  if (!email.trim())                      errors.email    = 'Kailangan ang email.'
  else if (!/\S+@\S+\.\S+/.test(email))  errors.email    = 'Hindi wastong email.'
  if (!password)                          errors.password = 'Kailangan ang password.'
  return errors
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Login() {
  const { notify } = useUI()
  const navigate       = useNavigate()
  const emailRef       = useRef(null)
  const [searchParams] = useSearchParams()

  const [form,       setForm]       = useState({ email: '', password: '' })
  const [errors,     setErrors]     = useState({})
  const [showPass,   setShowPass]   = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [shake,      setShake]      = useState(false)
  const [banner,     setBanner]     = useState(null)
  const [rememberMe, setRememberMe] = useState(false)

  // Restore remembered email and show deletion banner if applicable
  useEffect(() => {
    const saved = getCookie(COOKIE_KEY)
    if (saved) {
      setForm(p => ({ ...p, email: saved }))
      setRememberMe(true)
    } else {
      emailRef.current?.focus()
    }
    if (searchParams.get('reason') === 'deleted') {
      setBanner('Ang iyong account ay tinanggal ng admin. Hindi ka na makapag-login.')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = field => ev => {
    setForm(p => ({ ...p, [field]: ev.target.value }))
    setErrors(p => ({ ...p, [field]: undefined }))
  }

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  const handleSubmit = async e => {
    e.preventDefault()

    const errs = validate(form)
    if (Object.keys(errs).length) {
      setErrors(errs)
      triggerShake()
      return
    }

    setLoading(true)
    try {
      // Set Firebase session persistence before signing in
      await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence
      )

      const { user } = await signInWithEmailAndPassword(auth, form.email, form.password)

      // Guard: ensure the Firestore user doc still exists (admin-deleted accounts)
      const snap = await getDoc(doc(db, 'users', user.uid))
      if (!snap.exists()) {
        await signOut(auth)
        setErrors({ password: 'Ang account na ito ay tinanggal na ng admin.' })
        triggerShake()
        return
      }

      // Persist or clear the Remember Me cookie
      rememberMe
        ? setCookie(COOKIE_KEY, form.email, COOKIE_DAYS)
        : deleteCookie(COOKIE_KEY)

      notify('Maligayang pagdating! Matagumpay kang nag-login.', 'success')

      // All users (including admins) land on the homepage first.
      // Admins navigate to /admin via the floating AdminToggleButton.
      navigate('/', { replace: true })

    } catch (err) {
      setErrors({ password: mapFirebaseError(err.code) })
      triggerShake()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-root">
      <div className={`auth-card${shake ? ' auth-card--shake' : ''}`}>

        <div className="auth-brand">
          <div className="auth-hero-image"></div>
        </div>

        <div className="auth-right">
          <div className="auth-header-center">
            <h1 className="auth-heading">Mag - Login</h1>
            <p className="auth-greeting">
              Mabuhay! Inaanyayahan kaya na muling pumasok sa inyong account
            </p>
          </div>

          {banner && (
            <div className="auth-error-msg" role="alert" style={{ marginBottom: '1rem' }}>
              {banner}
            </div>
          )}

          <p className="auth-section-label">Impormasyon ng Account</p>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>

            {/* Email */}
            <div className="auth-field">
              <label className="auth-label" htmlFor="ln-email">Email Address</label>
              <div className="auth-input-wrap">
                <MailIcon />
                <input
                  id="ln-email"
                  ref={emailRef}
                  type="email"
                  className="auth-input"
                  placeholder="ikaw@example.com"
                  value={form.email}
                  onChange={handleChange('email')}
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                />
              </div>
              {errors.email && (
                <span className="auth-error-msg" role="alert">{errors.email}</span>
              )}
            </div>

            {/* Password */}
            <div className="auth-field">
              <label className="auth-label" htmlFor="ln-password">Password</label>
              <div className="auth-input-wrap">
                <LockIcon />
                <input
                  id="ln-password"
                  type={showPass ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="Ilagay ang password"
                  value={form.password}
                  onChange={handleChange('password')}
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                />
                <EyeToggle show={showPass} onToggle={() => setShowPass(v => !v)} />
              </div>
              {errors.password && (
                <span className="auth-error-msg" role="alert">{errors.password}</span>
              )}
            </div>

            {/* Remember Me + Forgot Password */}
            {/* Remember Me + Forgot Password */}
            <a className="auth-forgot" href="/forgot-password">Nalimutan ang password?</a>
            
            <div className="auth-remember-row" style={{ display: 'none' }}>
              <label className="auth-remember-label">
                <input
                  type="checkbox"
                  className="auth-remember-check"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                />
                <span className="auth-remember-custom" aria-hidden="true" />
                <span>Tandaan ako</span>
              </label>
            </div>

            <button
              type="submit"
              className="auth-submit"
              disabled={loading}
              aria-busy={loading}
            >
              {loading && <span className="auth-spinner" aria-hidden="true" />}
              {loading ? 'Naglo-login…' : 'Mag-Login'}
            </button>
          </form>

          <p className="auth-switch">
            Wala pang account?{' '}
            <Link className="auth-switch-link" to="/register">Mag-Register</Link>
          </p>
        </div>

      </div>
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function MailIcon() {
  return (
    <svg className="auth-input-icon" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M2 8l10 6 10-6" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg className="auth-input-icon" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function EyeToggle({ show, onToggle }) {
  return (
    <button
      type="button"
      className="auth-toggle-pass"
      onClick={onToggle}
      aria-label={show ? 'Itago ang password' : 'Ipakita ang password'}
    >
      {show ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  )
}