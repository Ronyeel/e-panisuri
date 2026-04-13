import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from '../API/firebase'
import './auth.css'

function firebaseError(code) {
  switch (code) {
    case 'auth/email-already-in-use': return 'Ginagamit na ang email na ito.'
    case 'auth/too-many-requests':    return 'Masyadong maraming pagsubok. Subukan muli mamaya.'
    case 'auth/network-request-failed': return 'Walang koneksyon sa internet.'
    default: return 'May error na naganap. Subukan muli.'
  }
}

export default function Registration({ onNotify }) {
  const navigate = useNavigate()
  const firstRef = useRef(null)

  const [form, setForm] = useState({
    username: '', email: '', password: '', confirmPassword: '', agreedToTerms: false,
  })
  const [errors, setErrors]           = useState({})
  const [showPass, setShowPass]       = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading]         = useState(false)
  const [shake, setShake]             = useState(false)

  useEffect(() => { firstRef.current?.focus() }, [])

  const validate = () => {
    const e = {}
    if (!form.username.trim())                        e.username        = 'Kailangan ang username.'
    if (!form.email.trim())                           e.email           = 'Kailangan ang email.'
    else if (!/\S+@\S+\.\S+/.test(form.email))       e.email           = 'Hindi wastong email.'
    if (!form.password)                               e.password        = 'Kailangan ang password.'
    else if (form.password.length < 8)                e.password        = 'Hindi bababa sa 8 karakter.'
    if (!form.confirmPassword)                        e.confirmPassword = 'Kumpirmahin ang password.'
    else if (form.password !== form.confirmPassword)  e.confirmPassword = 'Hindi magkatugma.'
    if (!form.agreedToTerms)                          e.terms           = 'Kailangan sumang-ayon sa mga tuntunin.'
    return e
  }

  const handleChange = (field) => (ev) => {
    const value = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value
    setForm(p => ({ ...p, [field]: value }))
    setErrors(p => ({ ...p, [field]: undefined, terms: undefined }))
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
      const { user } = await createUserWithEmailAndPassword(auth, form.email, form.password)
      await updateProfile(user, { displayName: form.username })
      await setDoc(doc(db, 'users', user.uid), {
        username: form.username.toLowerCase(),
        email: form.email,
        createdAt: new Date(),
      })
      onNotify?.({ message: `Maligayang pagdating, ${form.username}! Matagumpay kang nagrehistro.`, type: 'success' })
      navigate('/', { replace: true })
    } catch (err) {
      setErrors({ email: firebaseError(err.code) })
      triggerShake()
    } finally {
      setLoading(false)
    }
  }

  const strength = (() => {
    const p = form.password
    if (!p) return 0
    let s = 0
    if (p.length >= 8)          s++
    if (/[A-Z]/.test(p))        s++
    if (/[0-9]/.test(p))        s++
    if (/[^A-Za-z0-9]/.test(p)) s++
    return s
  })()
  const strengthLabel = ['', 'Mahina', 'Katamtaman', 'Malakas', 'Napakalakas'][strength]
  const strengthClass = ['', 'auth-strength--1', 'auth-strength--2', 'auth-strength--3', 'auth-strength--4'][strength]

  return (
    <div className="auth-root">
      <div className={`auth-card${shake ? ' auth-card--shake' : ''}`}>
        {/* No back button — user must authenticate first */}
        <div className="auth-brand">
          <div className="auth-brand-name">E-PANISURI</div>
          <div className="auth-logo-box">LOGO HERE</div>
        </div>
        <div className="auth-right">
          <h1 className="auth-heading">Gumawa ng Account</h1>
          <p className="auth-greeting">Maligayang pagdating! Simulan natin ang inyong paglalakbay sa E-Panisuri.</p>
          <p className="auth-section-label">Impormasyon</p>
          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="auth-field">
              <label className="auth-label" htmlFor="rg-username">Username</label>
              <div className="auth-input-wrap">
                <PersonIcon />
                <input id="rg-username" ref={firstRef} type="text" className="auth-input"
                  placeholder="juandelacruz" value={form.username} onChange={handleChange('username')}
                  autoComplete="username" aria-invalid={!!errors.username} />
              </div>
              {errors.username && <span className="auth-error-msg" role="alert">{errors.username}</span>}
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="rg-email">Email Address</label>
              <div className="auth-input-wrap">
                <MailIcon />
                <input id="rg-email" type="email" className="auth-input"
                  placeholder="ikaw@example.com" value={form.email} onChange={handleChange('email')}
                  autoComplete="email" aria-invalid={!!errors.email} />
              </div>
              {errors.email && <span className="auth-error-msg" role="alert">{errors.email}</span>}
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="rg-password">Password</label>
              <div className="auth-input-wrap">
                <LockIcon />
                <input id="rg-password" type={showPass ? 'text' : 'password'} className="auth-input"
                  placeholder="Min. 8 karakter" value={form.password} onChange={handleChange('password')}
                  autoComplete="new-password" aria-invalid={!!errors.password} />
                <EyeToggle show={showPass} onToggle={() => setShowPass(v => !v)} />
              </div>
              {form.password && (
                <div className={`auth-strength-wrap ${strengthClass}`}>
                  <div className="auth-strength-bar">
                    {[1,2,3,4].map(n => (
                      <div key={n} className={`auth-strength-seg${strength >= n ? ` ${strengthClass}` : ''}`} />
                    ))}
                  </div>
                  <span className="auth-strength-label">{strengthLabel}</span>
                </div>
              )}
              {errors.password && <span className="auth-error-msg" role="alert">{errors.password}</span>}
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="rg-confirm">Kumpirmahin ang Password</label>
              <div className="auth-input-wrap">
                <LockIcon />
                <input id="rg-confirm" type={showConfirm ? 'text' : 'password'} className="auth-input"
                  placeholder="Ulitin ang password" value={form.confirmPassword} onChange={handleChange('confirmPassword')}
                  autoComplete="new-password" aria-invalid={!!errors.confirmPassword} />
                <EyeToggle show={showConfirm} onToggle={() => setShowConfirm(v => !v)} />
              </div>
              {errors.confirmPassword && <span className="auth-error-msg" role="alert">{errors.confirmPassword}</span>}
            </div>
            <div>
              <label className="auth-terms">
                <input type="checkbox" checked={form.agreedToTerms} onChange={handleChange('agreedToTerms')} />
                <span className="auth-terms-text">
                  I agree to the{' '}
                  <a className="auth-terms-link" href="/privacy-policy">Privacy Policy</a>
                  {' '}and{' '}
                  <a className="auth-terms-link" href="/terms">User Terms and Condition</a>
                </span>
              </label>
              {errors.terms && <span className="auth-error-msg" role="alert" style={{ display: 'block', marginTop: '0.25rem' }}>{errors.terms}</span>}
            </div>
            <button type="submit" className="auth-submit" disabled={loading} aria-busy={loading}>
              {loading && <span className="auth-spinner" aria-hidden="true" />}
              {loading ? 'Nagre-rehistro…' : 'Mag-Register'}
            </button>
          </form>
          <p className="auth-switch">
            May account na?{' '}<Link className="auth-switch-link" to="/login">Login</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

function PersonIcon() {
  return <svg className="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
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