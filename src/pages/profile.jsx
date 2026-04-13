import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  signOut,
} from 'firebase/auth'
import { auth } from '../API/firebase'
import './profile.css'

/* ─── Icons ──────────────────────────────────────────────── */
function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}
function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}
function EyeIcon({ open }) {
  return open ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
function SignOutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

/* ─── Avatar initials ─────────────────────────────────────── */
function Avatar({ name }) {
  const initials = name
    ? name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'
  return <div className="prof-avatar" aria-hidden="true">{initials}</div>
}

/* ─── Section wrapper ─────────────────────────────────────── */
function Section({ icon, title, children, delay = 0 }) {
  return (
    <div className="prof-section" style={{ animationDelay: `${delay}ms` }}>
      <div className="prof-section-header">
        <span className="prof-section-icon">{icon}</span>
        <h2 className="prof-section-title">{title}</h2>
      </div>
      {children}
    </div>
  )
}

/* ─── Field ───────────────────────────────────────────────── */
function Field({ label, error, children }) {
  return (
    <div className="prof-field">
      <label className="prof-label">{label}</label>
      {children}
      {error && <span className="prof-field-error" role="alert">{error}</span>}
    </div>
  )
}

/* ─── Password input ──────────────────────────────────────── */
function PassInput({ id, value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false)
  return (
    <div className="prof-input-wrap">
      <span className="prof-input-icon"><LockIcon /></span>
      <input
        id={id}
        type={show ? 'text' : 'password'}
        className="prof-input"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="prof-eye"
        onClick={() => setShow(v => !v)}
        aria-label={show ? 'Itago' : 'Ipakita'}
      >
        <EyeIcon open={show} />
      </button>
    </div>
  )
}

/* ─── Main Component ──────────────────────────────────────── */
export default function ProfilePage({ onNotify }) {
  const navigate = useNavigate()
  const user     = auth.currentUser
  const nameRef  = useRef(null)

  const [nameForm,  setNameForm]  = useState({ username: user?.displayName || '' })
  const [nameErr,   setNameErr]   = useState({})
  const [nameBusy,  setNameBusy]  = useState(false)
  const [nameShake, setNameShake] = useState(false)

  const [passForm,  setPassForm]  = useState({ current: '', next: '', confirm: '' })
  const [passErr,   setPassErr]   = useState({})
  const [passBusy,  setPassBusy]  = useState(false)
  const [passShake, setPassShake] = useState(false)

  useEffect(() => {
    if (!user) navigate('/login')
    nameRef.current?.focus()
  }, [user, navigate])

  const shake = (setter) => {
    setter(true)
    setTimeout(() => setter(false), 500)
  }

  /* ── Update username ── */
  const validateName = () => {
    const e = {}
    const v = nameForm.username.trim()
    if (!v)               e.username = 'Kailangan ang username.'
    else if (v.length < 2)  e.username = 'Minimum 2 karakter.'
    else if (v.length > 30) e.username = 'Maximum 30 karakter.'
    return e
  }

  const handleNameSubmit = async (e) => {
    e.preventDefault()
    const errs = validateName()
    if (Object.keys(errs).length) { setNameErr(errs); shake(setNameShake); return }
    setNameBusy(true)
    try {
      await updateProfile(user, { displayName: nameForm.username.trim() })
      onNotify?.({ message: 'Username na-update nang matagumpay!', type: 'success' })
    } catch {
      setNameErr({ username: 'Hindi ma-update. Subukan muli.' })
      shake(setNameShake)
      onNotify?.({ message: 'Hindi ma-update ang username.', type: 'error' })
    } finally {
      setNameBusy(false)
    }
  }

  /* ── Update password ── */
  const validatePass = () => {
    const e = {}
    if (!passForm.current)             e.current = 'Ilagay ang kasalukuyang password.'
    if (!passForm.next)                e.next    = 'Ilagay ang bagong password.'
    else if (passForm.next.length < 6) e.next    = 'Minimum 6 karakter.'
    if (passForm.next !== passForm.confirm) e.confirm = 'Hindi tugma ang mga password.'
    return e
  }

  const handlePassSubmit = async (e) => {
    e.preventDefault()
    const errs = validatePass()
    if (Object.keys(errs).length) { setPassErr(errs); shake(setPassShake); return }
    setPassBusy(true)
    try {
      const credential = EmailAuthProvider.credential(user.email, passForm.current)
      await reauthenticateWithCredential(user, credential)
      await updatePassword(user, passForm.next)
      setPassForm({ current: '', next: '', confirm: '' })
      onNotify?.({ message: 'Password na-update nang matagumpay!', type: 'success' })
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setPassErr({ current: 'Mali ang kasalukuyang password.' })
      } else {
        setPassErr({ confirm: 'May error. Subukan muli.' })
      }
      shake(setPassShake)
      onNotify?.({ message: 'Hindi ma-update ang password.', type: 'error' })
    } finally {
      setPassBusy(false)
    }
  }

  /* ── Sign out ── */
  const handleSignOut = async () => {
    await signOut(auth)
    navigate('/')
  }

  if (!user) return null

  return (
    <div className="prof-root">

      {/* Decorative background */}
      <div className="prof-bg" aria-hidden="true">
        <div className="prof-bg-stripe prof-bg-stripe--1" />
        <div className="prof-bg-stripe prof-bg-stripe--2" />
        <div className="prof-bg-orb" />
      </div>

      <div className="prof-container">

        {/* Header */}
        <div className="prof-header">
          <Avatar name={user.displayName || user.email} />
          <div className="prof-header-text">
            <p className="prof-header-label">Inyong Account</p>
            <h1 className="prof-header-name">
              {user.displayName || 'Mambabasa'}
            </h1>
            <p className="prof-header-email">{user.email}</p>
          </div>
          <button className="prof-signout-btn" onClick={handleSignOut} aria-label="Mag-sign out">
            <SignOutIcon />
            <span>Mag-Sign Out</span>
          </button>
        </div>

        <div className="prof-grid">

          {/* ── Username Section ── */}
          <Section icon={<UserIcon />} title="Baguhin ang Username" delay={0}>
            <form
              className={`prof-form${nameShake ? ' prof-form--shake' : ''}`}
              onSubmit={handleNameSubmit}
              noValidate
            >
              <Field label="Bagong Username" error={nameErr.username}>
                <div className="prof-input-wrap">
                  <span className="prof-input-icon"><UserIcon /></span>
                  <input
                    ref={nameRef}
                    id="prof-username"
                    type="text"
                    className="prof-input"
                    placeholder={user.displayName || 'Ilagay ang username'}
                    value={nameForm.username}
                    onChange={e => {
                      setNameForm({ username: e.target.value })
                      setNameErr({})
                    }}
                    autoComplete="username"
                    maxLength={30}
                  />
                </div>
              </Field>
              <div className="prof-char-count">
                {nameForm.username.length}/30
              </div>
              <button
                type="submit"
                className="prof-btn"
                disabled={nameBusy}
                aria-busy={nameBusy}
              >
                {nameBusy && <span className="prof-spinner" aria-hidden="true" />}
                {nameBusy ? 'Sine-save…' : 'I-save ang Username'}
              </button>
            </form>
          </Section>

          {/* ── Password Section ── */}
          <Section icon={<LockIcon />} title="Baguhin ang Password" delay={80}>
            <form
              className={`prof-form${passShake ? ' prof-form--shake' : ''}`}
              onSubmit={handlePassSubmit}
              noValidate
            >
              <Field label="Kasalukuyang Password" error={passErr.current}>
                <PassInput
                  id="prof-current"
                  value={passForm.current}
                  onChange={e => { setPassForm(p => ({ ...p, current: e.target.value })); setPassErr({}) }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </Field>
              <Field label="Bagong Password" error={passErr.next}>
                <PassInput
                  id="prof-next"
                  value={passForm.next}
                  onChange={e => { setPassForm(p => ({ ...p, next: e.target.value })); setPassErr({}) }}
                  placeholder="Min. 6 karakter"
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Kumpirmahin ang Bagong Password" error={passErr.confirm}>
                <PassInput
                  id="prof-confirm"
                  value={passForm.confirm}
                  onChange={e => { setPassForm(p => ({ ...p, confirm: e.target.value })); setPassErr({}) }}
                  placeholder="Ulitin ang bagong password"
                  autoComplete="new-password"
                />
              </Field>
              <button
                type="submit"
                className="prof-btn"
                disabled={passBusy}
                aria-busy={passBusy}
              >
                {passBusy && <span className="prof-spinner" aria-hidden="true" />}
                {passBusy ? 'Sine-save…' : 'I-save ang Password'}
              </button>
            </form>
          </Section>

        </div>
      </div>
    </div>
  )
}