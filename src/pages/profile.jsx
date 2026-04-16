import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  signOut,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../API/firebase'
import './profile.css'

// ─── Config ───────────────────────────────────────────────────────────────────

const PAPEL_CONFIG = {
  guro:       { label: 'Guro',       className: 'prof-badge--guro' },
  manunulat:  { label: 'Manunulat',  className: 'prof-badge--manunulat' },
  estudyante: { label: 'Estudyante', className: 'prof-badge--estudyante' },
  tagasuri:   { label: 'Tagasuri',   className: 'prof-badge--tagasuri' },
}

// ─── Placeholder quiz data (replace with real data later) ─────────────────────

const QUIZ_PLACEHOLDER_ROWS = [
  { id: 1, title: 'Aralin 1 — Panimula sa Panitikan', score: '—', status: null, date: '—' },
  { id: 2, title: 'Aralin 2 — Mga Uri ng Tula',       score: '—', status: null, date: '—' },
  { id: 3, title: 'Aralin 3 — Maikling Kwento',       score: '—', status: null, date: '—' },
]

// ─── Validation ───────────────────────────────────────────────────────────────

function validateName({ username }) {
  const errors = {}
  const v = username.trim()
  if (!v)             errors.username = 'Kailangan ang username.'
  else if (v.length < 2)  errors.username = 'Minimum 2 karakter.'
  else if (v.length > 30) errors.username = 'Maximum 30 karakter.'
  return errors
}

function validatePass({ current, next, confirm }) {
  const errors = {}
  if (!current)             errors.current = 'Ilagay ang kasalukuyang password.'
  if (!next)                errors.next    = 'Ilagay ang bagong password.'
  else if (next.length < 8) errors.next    = 'Minimum 8 karakter.'
  if (next !== confirm)     errors.confirm = 'Hindi tugma ang mga password.'
  return errors
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PapelBadge({ papel }) {
  if (!papel) return null
  const config = PAPEL_CONFIG[papel] ?? { label: papel, className: 'prof-badge--default' }
  return <span className={`prof-badge ${config.className}`}>{config.label}</span>
}

function Avatar({ name }) {
  const initials = name
    ? name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'
  return <div className="prof-avatar" aria-hidden="true">{initials}</div>
}

function Field({ label, error, children }) {
  return (
    <div className="prof-field">
      <label className="prof-label">{label}</label>
      {children}
      {error && <span className="prof-field-error" role="alert">{error}</span>}
    </div>
  )
}

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

// ─── Quiz Summary Section ─────────────────────────────────────────────────────

function QuizSection({ quizData }) {
  // TODO: Replace with real data from Firestore
  // quizData should be an array of: { id, title, score, status: 'pass'|'fail', date }
  // Summary stats should be derived from quizData

  const totalTaken  = 0   // TODO: quizData.length
  const avgScore    = '—' // TODO: compute from quizData
  const passRate    = '—' // TODO: compute from quizData

  const rows = QUIZ_PLACEHOLDER_ROWS // TODO: replace with quizData

  return (
    <div
      className="prof-section prof-section--quiz"
      style={{ animationDelay: '160ms' }}
    >
      <div className="prof-section-header">
        <div className="prof-section-header-left">
          <span className="prof-section-icon prof-section-icon--blue">
            <QuizIcon />
          </span>
          <h2 className="prof-section-title">Talaan ng mga Pagsusulit</h2>
        </div>
        <span className="prof-section-badge">
          {totalTaken === 0 ? 'Walang datos' : `${totalTaken} na pagsusulit`}
        </span>
      </div>

      {/* ── Summary stats ── */}
      <div className="prof-quiz-grid">
        <div className="prof-quiz-stat">
          <div className="prof-quiz-stat-label">Mga Sinagutan</div>
          <div className="prof-quiz-stat-val prof-quiz-stat-val--gold">
            {totalTaken || '—'}
          </div>
        </div>
        <div className="prof-quiz-stat">
          <div className="prof-quiz-stat-label">Karaniwang Marka</div>
          <div className="prof-quiz-stat-val prof-quiz-stat-val--green">
            {avgScore}
          </div>
        </div>
        <div className="prof-quiz-stat">
          <div className="prof-quiz-stat-label">Passing Rate</div>
          <div className="prof-quiz-stat-val">
            {passRate}
          </div>
        </div>
      </div>

      {/* ── Table header ── */}
      {rows.length > 0 ? (
        <>
          <div className="prof-quiz-table-header">
            <span className="prof-quiz-table-col">Pamagat ng Pagsusulit</span>
            <span className="prof-quiz-table-col">Marka</span>
            <span className="prof-quiz-table-col">Resulta</span>
            <span className="prof-quiz-table-col">Petsa</span>
          </div>

          {/* ── Placeholder rows (replace with real map over quizData) ── */}
          {rows.map(row => (
            <div key={row.id} className="prof-quiz-row prof-quiz-row--placeholder">
              <span className="prof-quiz-row-title">{row.title}</span>
              <span className="prof-quiz-row-score">{row.score}</span>
              <span>
                {row.status
                  ? <span className={`prof-quiz-row-pill prof-quiz-row-pill--${row.status}`}>
                      {row.status === 'pass' ? 'Pumasa' : 'Bumagsak'}
                    </span>
                  : <span className="prof-quiz-row-pill" style={{ opacity: 0.3, borderColor: 'rgba(255,255,255,0.1)', color: 'var(--mist)' }}>—</span>
                }
              </span>
              <span className="prof-quiz-row-date">{row.date}</span>
            </div>
          ))}
        </>
      ) : (
        <div className="prof-quiz-empty">
          <div className="prof-quiz-empty-icon"><QuizIcon /></div>
          <p className="prof-quiz-empty-text">Walang pagsusulit pa</p>
          <p className="prof-quiz-empty-sub">Ang inyong mga resulta ay lilitaw dito.</p>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProfilePage({ onNotify }) {
  const navigate = useNavigate()
  const user     = auth.currentUser
  const nameRef  = useRef(null)

  const [papel,     setPapel]     = useState(null)
  const [nameForm,  setNameForm]  = useState({ username: user?.displayName || '' })
  const [nameErr,   setNameErr]   = useState({})
  const [nameBusy,  setNameBusy]  = useState(false)
  const [nameShake, setNameShake] = useState(false)
  const [passForm,  setPassForm]  = useState({ current: '', next: '', confirm: '' })
  const [passErr,   setPassErr]   = useState({})
  const [passBusy,  setPassBusy]  = useState(false)
  const [passShake, setPassShake] = useState(false)

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    nameRef.current?.focus()
    getDoc(doc(db, 'users', user.uid))
      .then(snap => { if (snap.exists()) setPapel(snap.data()?.papel ?? null) })
      .catch(() => {})
  }, [user, navigate])

  const triggerShake = setter => {
    setter(true)
    setTimeout(() => setter(false), 500)
  }

  // ── Update username ─────────────────────────────────────────
  const handleNameSubmit = async e => {
    e.preventDefault()
    const errs = validateName(nameForm)
    if (Object.keys(errs).length) { setNameErr(errs); triggerShake(setNameShake); return }
    setNameBusy(true)
    try {
      await updateProfile(user, { displayName: nameForm.username.trim() })
      onNotify?.({ message: 'Matagumpay na napalitan ang iyong Username!', type: 'success' })
    } catch {
      setNameErr({ username: 'Hindi ma-update. Subukang muli.' })
      triggerShake(setNameShake)
      onNotify?.({ message: 'Hindi ma-update ang username.', type: 'error' })
    } finally {
      setNameBusy(false)
    }
  }

  // ── Update password ─────────────────────────────────────────
  const handlePassSubmit = async e => {
    e.preventDefault()
    const errs = validatePass(passForm)
    if (Object.keys(errs).length) { setPassErr(errs); triggerShake(setPassShake); return }
    setPassBusy(true)
    try {
      const credential = EmailAuthProvider.credential(user.email, passForm.current)
      await reauthenticateWithCredential(user, credential)
      await updatePassword(user, passForm.next)
      setPassForm({ current: '', next: '', confirm: '' })
      onNotify?.({ message: 'Password na-update nang matagumpay!', type: 'success' })
    } catch (err) {
      const isBadPass = err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
      setPassErr(isBadPass
        ? { current: 'Mali ang kasalukuyang password.' }
        : { confirm: 'May error. Subukan muli.' }
      )
      triggerShake(setPassShake)
      onNotify?.({ message: 'Hindi ma-update ang password.', type: 'error' })
    } finally {
      setPassBusy(false)
    }
  }

  // ── Sign out ────────────────────────────────────────────────
  const handleSignOut = async () => {
    await signOut(auth)
    navigate('/')
  }

  if (!user) return null

  return (
    <div className="prof-root">

      {/* Background */}
      <div className="prof-bg" aria-hidden="true">
        <div className="prof-bg-grid" />
        <div className="prof-bg-vignette" />
        <div className="prof-bg-glow" />
      </div>

      <div className="prof-container">

        {/* Top bar */}
        <div className="prof-topbar">
          <span className="prof-topbar-path">
            Dashboard <span style={{ opacity: 0.4 }}>›</span>
            <span>Account</span>
          </span>
        </div>

        {/* Hero */}
        <div className="prof-hero">
          <Avatar name={user.displayName || user.email} />

          <div className="prof-hero-info">
            <p className="prof-hero-label">Inyong Profile</p>
            <div className="prof-hero-name-row">
              <h1 className="prof-hero-name">{user.displayName || 'Mambabasa'}</h1>
              <PapelBadge papel={papel} />
            </div>
            <p className="prof-hero-email">{user.email}</p>
            <div className="prof-hero-meta">
              <span className="prof-hero-stat">
                Papel <strong>{papel ? PAPEL_CONFIG[papel]?.label ?? papel : '—'}</strong>
              </span>
              <span className="prof-hero-divider" />
              <span className="prof-hero-stat">
                Status <strong>Aktibo</strong>
              </span>
            </div>
          </div>

          <button className="prof-signout-btn" onClick={handleSignOut} aria-label="Mag-sign out">
            <SignOutIcon />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Stats row */}
        <div className="prof-stats-row">
          {[
            { label: 'Mga Pagsusulit',  value: '—', note: 'na sinagutan' },
            { label: 'Kabuuang Marka',  value: '—', note: 'na average',   gold: true },
            { label: 'Pinakamataas',    value: '—', note: 'na score' },
            { label: 'Mga Araw Aktibo', value: '—', note: 'na araw' },
          ].map((s, i) => (
            <div className="prof-stat-card" key={i}>
              <div className="prof-stat-label">{s.label}</div>
              <div className={`prof-stat-value${s.gold ? ' prof-stat-value--gold' : ''}`}>{s.value}</div>
              <div className="prof-stat-sub">{s.note}</div>
            </div>
          ))}
        </div>

        {/* Main grid */}
        <div className="prof-main-grid">

          {/* ── Username ── */}
          <div
            className="prof-section"
            style={{ animationDelay: '0ms' }}
          >
            <div className="prof-section-header">
              <div className="prof-section-header-left">
                <span className="prof-section-icon"><UserIcon /></span>
                <h2 className="prof-section-title">Baguhin ang Username</h2>
              </div>
            </div>
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
                    onChange={e => { setNameForm({ username: e.target.value }); setNameErr({}) }}
                    autoComplete="username"
                    maxLength={30}
                  />
                </div>
              </Field>
              <div className="prof-char-count">{nameForm.username.length} / 30</div>
              <button type="submit" className="prof-btn" disabled={nameBusy} aria-busy={nameBusy}>
                {nameBusy && <span className="prof-spinner" aria-hidden="true" />}
                {nameBusy ? 'Sine-save…' : 'I-save ang Username'}
              </button>
            </form>
          </div>

          {/* ── Password ── */}
          <div
            className="prof-section prof-section--password"
            style={{ animationDelay: '80ms' }}
          >
            <div className="prof-section-header">
              <div className="prof-section-header-left">
                <span className="prof-section-icon prof-section-icon--red"><LockIcon /></span>
                <h2 className="prof-section-title">Baguhin ang Password</h2>
              </div>
            </div>
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
                  placeholder="Min. 8 karakter"
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
              <button type="submit" className="prof-btn prof-btn--red" disabled={passBusy} aria-busy={passBusy}>
                {passBusy && <span className="prof-spinner" aria-hidden="true" />}
                {passBusy ? 'Sine-save…' : 'I-save ang Password'}
              </button>
            </form>
          </div>

          {/* ── Quiz Summary ── */}
          <QuizSection quizData={[]} />

        </div>
      </div>

      {/* Toast portal — wire this up to your toast system */}
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

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
function QuizIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  )
}