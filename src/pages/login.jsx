import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../API/firebase'
import './auth.css'

function firebaseError(code) {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Mali ang email o password.'
    case 'auth/too-many-requests':  return 'Masyadong maraming pagsubok. Subukan muli mamaya.'
    case 'auth/network-request-failed': return 'Walang koneksyon sa internet.'
    default: return 'May error na naganap. Subukan muli.'
  }
}

export default function Login({ onNotify }) {
  const navigate = useNavigate()
  const emailRef = useRef(null)
  const [searchParams] = useSearchParams()

  const [form, setForm]         = useState({ email: '', password: '' })
  const [errors, setErrors]     = useState({})
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [shake, setShake]       = useState(false)
  const [banner, setBanner]     = useState(null)

  useEffect(() => {
    emailRef.current?.focus()
    // Show banner if redirected from deleted account
    if (searchParams.get('reason') === 'deleted') {
      setBanner('Ang iyong account ay tinanggal ng admin. Hindi ka na makapag-login.')
    }
  }, [])

  const validate = () => {
    const e = {}
    if (!form.email.trim())                     e.email    = 'Kailangan ang email.'
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email    = 'Hindi wastong email.'
    if (!form.password)                         e.password = 'Kailangan ang password.'
    return e
  }

  const handleChange = (field) => (ev) => {
    setForm(p => ({ ...p, [field]: ev.target.value }))
    setErrors(p => ({ ...p, [field]: undefined }))
  }

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); triggerShake(); return }

    setLoading(true)
    try {
      const { user } = await signInWithEmailAndPassword(auth, form.email, form.password)

      const userDoc = await getDoc(doc(db, 'users', user.uid))

      if (!userDoc.exists()) {
        await signOut(auth)
        setErrors({ password: 'Ang account na ito ay tinanggal na ng admin.' })
        triggerShake()
        return
      }

      const role = userDoc.data()?.role ?? 'user'

      onNotify?.({
        message: `Maligayang pagbabalik, ${user.displayName || 'Mambabasa'}! Matagumpay kang naka-login.`,
        type: 'success'
      })

      if (role === 'admin') {
        navigate('/admin', { replace: true })
      } else {
        navigate('/', { replace: true })
      }
    } catch (err) {
      setErrors({ password: firebaseError(err.code) })
      triggerShake()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-root">
      <div className={`auth-card${shake ? ' auth-card--shake' : ''}`}>
        <div className="auth-brand">
          <div className="auth-brand-name">E-PANISURI</div>
          <div className="auth-logo-box">LOGO HERE</div>
        </div>
        <div className="auth-right">
          <h1 className="auth-heading">Mag-Login</h1>
          <p className="auth-greeting">Mabuhay! Inaanyayahan kayo na muling pumasok sa inyong account.</p>

          {/* Deleted account banner */}
          {banner && (
            <div className="auth-error-msg" role="alert" style={{ marginBottom: '1rem' }}>
              {banner}
            </div>
          )}

          <p className="auth-section-label">Impormasyon ng Account</p>
          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="auth-field">
              <label className="auth-label" htmlFor="ln-email">Email Address</label>
              <div className="auth-input-wrap">
                <MailIcon />
                <input
                  id="ln-email" ref={emailRef} type="email"
                  className="auth-input" placeholder="ikaw@example.com"
                  value={form.email} onChange={handleChange('email')}
                  autoComplete="email" aria-invalid={!!errors.email}
                />
              </div>
              {errors.email && <span className="auth-error-msg" role="alert">{errors.email}</span>}
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="ln-password">Password</label>
              <div className="auth-input-wrap">
                <LockIcon />
                <input
                  id="ln-password" type={showPass ? 'text' : 'password'}
                  className="auth-input" placeholder="Ilagay ang password"
                  value={form.password} onChange={handleChange('password')}
                  autoComplete="current-password" aria-invalid={!!errors.password}
                />
                <EyeToggle show={showPass} onToggle={() => setShowPass(v => !v)} />
              </div>
              {errors.password && <span className="auth-error-msg" role="alert">{errors.password}</span>}
              <a className="auth-forgot" href="/forgot-password">Nakalimutan ang password?</a>
            </div>
            <button type="submit" className="auth-submit" disabled={loading} aria-busy={loading}>
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

function MailIcon() {
  return <svg className="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 8l10 6 10-6"/></svg>
}
function LockIcon() {
  return <svg className="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
}
function EyeToggle({ show, onToggle }) {
  return (
    <button type="button" className="auth-toggle-pass" onClick={onToggle} aria-label={show ? 'Itago' : 'Ipakita'}>
      {show
        ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      }
    </button>
  )
}