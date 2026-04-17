// profile.jsx
// User profile: edit username/password, view quiz history with persistent titles.
// Quiz attempt titles are snapshotted at submission time so they survive admin deletion.

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  updateProfile, updatePassword,
  reauthenticateWithCredential, EmailAuthProvider, signOut,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../API/firebase'
import { supabase } from '../API/supabase'
import { useUI } from '../context/UIContext'
import './profile.css'

// ─── Config ───────────────────────────────────────────────────────────────────

const PAPEL_CONFIG = {
  guro:       { label: 'Guro',       className: 'prof-badge--guro' },
  manunulat:  { label: 'Manunulat',  className: 'prof-badge--manunulat' },
  estudyante: { label: 'Estudyante', className: 'prof-badge--estudyante' },
  tagasuri:   { label: 'Tagasuri',   className: 'prof-badge--tagasuri' },
}

const STATUS_COLORS = {
  completed:      { bg: '#10B98122', text: '#34d399', border: '#10B98144' },
  pending_review: { bg: '#F59E0B22', text: '#fbbf24', border: '#F59E0B44' },
  in_progress:    { bg: '#3B82F622', text: '#60a5fa', border: '#3B82F644' },
}
const STATUS_LABELS = {
  completed:      'Tapos na',
  pending_review: 'Para sa Pagsusuri',
  in_progress:    'In Progress',
}
const Q_TYPE_LABELS = {
  multiple_choice: 'Multiple Choice',
  true_false:      'Tama o Mali',
  essay:           'Sanaysay',
}

// ─── Validation ───────────────────────────────────────────────────────────────

const validateName = ({ username }) => {
  const v = username.trim()
  if (!v)            return { username: 'Kailangan ang username.' }
  if (v.length < 2)  return { username: 'Minimum 2 karakter.' }
  if (v.length > 30) return { username: 'Maximum 30 karakter.' }
  return {}
}

const validatePass = ({ current, next, confirm }) => {
  const errors = {}
  if (!current)             errors.current = 'Ilagay ang kasalukuyang password.'
  if (!next)                errors.next    = 'Ilagay ang bagong password.'
  else if (next.length < 8) errors.next    = 'Minimum 8 karakter.'
  if (next !== confirm)     errors.confirm = 'Hindi tugma ang mga password.'
  return errors
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
)
const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)
const EyeIcon = ({ open }) => open ? (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
) : (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
)
const SignOutIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)
const QuizIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
    <rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/>
  </svg>
)
const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

// ─── Atoms ────────────────────────────────────────────────────────────────────

const PapelBadge = ({ papel }) => {
  if (!papel) return null
  const config = PAPEL_CONFIG[papel] ?? { label: papel, className: 'prof-badge--default' }
  return <span className={`prof-badge ${config.className}`}>{config.label}</span>
}

const Avatar = ({ name }) => {
  const initials = name
    ? name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'
  return <div className="prof-avatar" aria-hidden="true">{initials}</div>
}

const Field = ({ label, error, children }) => (
  <div className="prof-field">
    <label className="prof-label">{label}</label>
    {children}
    {error && <span className="prof-field-error" role="alert">{error}</span>}
  </div>
)

const PassInput = ({ id, value, onChange, placeholder, autoComplete }) => {
  const [show, setShow] = useState(false)
  return (
    <div className="prof-input-wrap">
      <span className="prof-input-icon"><LockIcon /></span>
      <input
        id={id} type={show ? 'text' : 'password'}
        className="prof-input" value={value} onChange={onChange}
        placeholder={placeholder} autoComplete={autoComplete}
      />
      <button type="button" className="prof-eye" onClick={() => setShow(v => !v)} aria-label={show ? 'Itago' : 'Ipakita'}>
        <EyeIcon open={show} />
      </button>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Returns the quiz title, falling back to the snapshot saved at submission time.
// This ensures titles persist even after an admin deletes the quiz set.
const getAttemptTitle = (attempt) =>
  attempt.quiz_sets?.title ?? attempt.snapshot_title ?? 'Quiz (Tinanggal na)'

const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('fil-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

const calcPct = (score, total) =>
  total > 0 ? Math.round((score / total) * 100) : 0

const scoreColor = (pct) =>
  pct >= 75 ? '#22d3a5' : pct >= 50 ? '#f5b942' : '#ff5f6d'

// ─── Quiz Review Modal ────────────────────────────────────────────────────────

function QuizReviewModal({ attempt, onClose }) {
  const [responses, setResponses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!attempt) return
    setLoading(true)
    supabase
      .from('quiz_responses')
      .select(`
        id, answer_text, is_correct, needs_grading, admin_feedback, graded_at,
        quiz_questions ( question, type, correct_tf, correct_index, choices, explanation )
      `)
      .eq('attempt_id', attempt.id)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!error) setResponses(data ?? [])
        setLoading(false)
      })
  }, [attempt?.id])

  if (!attempt) return null

  const pct = calcPct(attempt.score, attempt.total_questions)
  const title = getAttemptTitle(attempt)

  return (
    <div className="prof-review-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="prof-review-modal">
        {/* Header */}
        <div className="prof-review-header">
          <div>
            <p className="prof-review-set-name">{title}</p>
            <p className="prof-review-meta">
              Marka:{' '}
              <strong style={{ color: scoreColor(pct) }}>
                {attempt.score}/{attempt.total_questions} ({pct}%)
              </strong>
              {attempt.finished_at && <> · {formatDate(attempt.finished_at)}</>}
            </p>
          </div>
          <button className="prof-review-close" onClick={onClose} aria-label="Isara">
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div className="prof-review-body">
          {loading ? (
            <div className="prof-review-loading">Naglo-load…</div>
          ) : responses.length === 0 ? (
            <p className="prof-review-empty">Walang mga sagot na nahanap.</p>
          ) : (
            <div className="prof-review-list">
              {responses.map((r, idx) => <ResponseItem key={r.id} r={r} idx={idx} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ResponseItem({ r, idx }) {
  const q = r.quiz_questions
  const isEssay = q?.type === 'essay'

  let displayAnswer = r.answer_text
  let correctDisplay = null

  if (q?.type === 'multiple_choice') {
    const i = parseInt(r.answer_text, 10)
    displayAnswer  = isNaN(i) ? r.answer_text : (q.choices?.[i] ?? r.answer_text)
    correctDisplay = q.choices?.[q.correct_index] ?? '—'
  }
  if (q?.type === 'true_false') {
    displayAnswer  = r.answer_text === 'true' ? 'Tama (True)' : 'Mali (False)'
    correctDisplay = q.correct_tf ? 'Tama (True)' : 'Mali (False)'
  }

  const resultColor = r.is_correct === true ? '#22d3a5' : r.is_correct === false ? '#ff5f6d' : '#f5b942'
  const typeStyle = {
    essay:           { bg: '#a78bfa22', color: '#a78bfa', border: '#a78bfa33' },
    true_false:      { bg: '#22d3a522', color: '#22d3a5', border: '#22d3a533' },
    multiple_choice: { bg: '#4fa3e822', color: '#4fa3e8', border: '#4fa3e833' },
  }[q?.type] ?? { bg: '#ffffff11', color: '#aaa', border: '#ffffff22' }

  return (
    <div className={`prof-review-item${r.needs_grading ? ' prof-review-item--pending' : ''}`}>
      <div className="prof-review-item-header">
        <span className="prof-review-qnum">Q{idx + 1}</span>
        <span className="prof-review-qtype" style={{ background: typeStyle.bg, color: typeStyle.color, border: `1px solid ${typeStyle.border}` }}>
          {Q_TYPE_LABELS[q?.type] ?? 'Tanong'}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: resultColor }}>
          {r.needs_grading ? '⏳ Hinihintay ang Pagsusuri' : r.is_correct ? '✓ Tama' : '✕ Mali'}
        </span>
      </div>

      <p className="prof-review-question">{q?.question}</p>

      <div className="prof-review-answers">
        <div>
          <div className="prof-review-answer-label">Iyong Sagot</div>
          <div className={`prof-review-answer-box${r.is_correct === true ? ' correct' : r.is_correct === false ? ' wrong' : ''}`}>
            {displayAnswer || <em style={{ opacity: 0.5 }}>Walang sagot</em>}
          </div>
        </div>
        {!isEssay && correctDisplay && (
          <div>
            <div className="prof-review-answer-label">Tamang Sagot</div>
            <div className="prof-review-answer-box ref">{correctDisplay}</div>
          </div>
        )}
      </div>

      {q?.explanation && !isEssay && (
        <div className="prof-review-explanation">
          <span className="prof-review-section-label">Paliwanag</span>
          <p>{q.explanation}</p>
        </div>
      )}
      {isEssay && r.admin_feedback && (
        <div className="prof-review-feedback">
          <span className="prof-review-section-label">Feedback ng Guro</span>
          <p>{r.admin_feedback}</p>
        </div>
      )}
    </div>
  )
}

// ─── Quiz Section ─────────────────────────────────────────────────────────────

function QuizSection({ userId, onStatsReady }) {
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading] = useState(true)
  const [reviewAttempt, setReviewAttempt] = useState(null)

  const liftStats = useCallback((data) => {
    const taken = data.length
    const scores = data.map(a => calcPct(a.score, a.total_questions))
    const avg = taken > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / taken) : null
    const highest = taken > 0 ? Math.max(...scores) : null
    const activeDays = new Set(data.map(a => new Date(a.finished_at).toDateString())).size
    onStatsReady?.({
      totalTaken:   taken,
      avgScore:     avg     != null ? avg     + '%' : '—',
      highestScore: highest != null ? highest + '%' : '—',
      activeDays:   activeDays > 0  ? activeDays   : '—',
    })
  }, [onStatsReady])

  const fetchAttempts = useCallback(async () => {
    if (!userId) { setLoading(false); return }
    // snapshot_title is stored at submission time so quiz history survives admin deletion
    const { data, error } = await supabase
      .from('quiz_attempts')
      .select('id, score, total_questions, status, finished_at, snapshot_title, quiz_sets ( title )')
      .eq('user_uid', userId)
      .not('finished_at', 'is', null)
      .order('finished_at', { ascending: false })

    if (!error && data) { setAttempts(data); liftStats(data) }
    setLoading(false)
  }, [userId, liftStats])

  // Initial load
  useEffect(() => { fetchAttempts() }, [fetchAttempts])

  // Realtime: re-fetch on any attempt change or essay grading
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`profile_attempts_${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_attempts', filter: `user_uid=eq.${userId}` }, fetchAttempts)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'quiz_responses' }, fetchAttempts)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [userId, fetchAttempts])

  // Derived stats
  const totalTaken = attempts.length
  const scores = attempts.map(a => calcPct(a.score, a.total_questions))
  const avgScore = totalTaken > 0 ? (scores.reduce((s, v) => s + v, 0) / totalTaken).toFixed(0) + '%' : '—'
  const passCount = scores.filter(s => s >= 60).length
  const passRate  = totalTaken > 0 ? ((passCount / totalTaken) * 100).toFixed(0) + '%' : '—'
  const highestScore = totalTaken > 0 ? Math.max(...scores) + '%' : '—'

  const statCards = [
    { label: 'Mga Sinagutan',    val: loading ? '…' : (totalTaken || '—'), gold: true  },
    { label: 'Karaniwang Marka', val: loading ? '…' : avgScore,            green: true },
    { label: 'Pinakamataas',     val: loading ? '…' : highestScore },
    { label: 'Passing Rate',     val: loading ? '…' : passRate },
  ]

  return (
    <>
      <div className="prof-section prof-section--quiz" style={{ animationDelay: '160ms' }}>
        <div className="prof-section-header">
          <div className="prof-section-header-left">
            <span className="prof-section-icon prof-section-icon--blue"><QuizIcon /></span>
            <h2 className="prof-section-title">Talaan ng mga Pagsusulit</h2>
          </div>
          <span className="prof-section-badge">
            {loading ? 'Naglo-load…' : totalTaken === 0 ? 'Walang datos' : `${totalTaken} na pagsusulit`}
          </span>
        </div>

        {/* Stats grid */}
        <div className="prof-quiz-grid">
          {statCards.map(s => (
            <div className="prof-quiz-stat" key={s.label}>
              <div className="prof-quiz-stat-label">{s.label}</div>
              <div className={`prof-quiz-stat-val${s.gold ? ' prof-quiz-stat-val--gold' : s.green ? ' prof-quiz-stat-val--green' : ''}`}>
                {s.val}
              </div>
            </div>
          ))}
        </div>

        {/* Attempts list */}
        {loading ? (
          <div className="prof-quiz-loading">Naglo-load…</div>
        ) : attempts.length > 0 ? (
          <>
            <div className="prof-quiz-table-header">
              <span className="prof-quiz-table-col">Pamagat ng Pagsusulit</span>
              <span className="prof-quiz-table-col">Marka</span>
              <span className="prof-quiz-table-col">Resulta</span>
              <span className="prof-quiz-table-col">Petsa</span>
            </div>
            {attempts.map(a => <AttemptRow key={a.id} attempt={a} onReview={setReviewAttempt} />)}
          </>
        ) : (
          <div className="prof-quiz-empty">
            <div className="prof-quiz-empty-icon"><QuizIcon /></div>
            <p className="prof-quiz-empty-text">Walang pagsusulit pa</p>
            <p className="prof-quiz-empty-sub">Ang inyong mga resulta ay lilitaw dito.</p>
          </div>
        )}
      </div>

      {reviewAttempt && (
        <QuizReviewModal attempt={reviewAttempt} onClose={() => setReviewAttempt(null)} />
      )}
    </>
  )
}

function AttemptRow({ attempt, onReview }) {
  const pct    = calcPct(attempt.score, attempt.total_questions)
  const passed = pct >= 60
  const sc     = STATUS_COLORS[attempt.status] ?? STATUS_COLORS.completed
  const title  = getAttemptTitle(attempt)

  return (
    <div
      className="prof-quiz-row prof-quiz-row--clickable"
      onClick={() => onReview(attempt)}
      title="I-click para makita ang mga sagot"
    >
      <span className="prof-quiz-row-title">
        {title}
        <span className="prof-quiz-row-review-hint">Tingnan ang Sagot →</span>
      </span>
      <span className="prof-quiz-row-score">
        {attempt.score}/{attempt.total_questions}
        <span style={{ fontSize: 11, color: 'var(--mist, #888)', marginLeft: 4 }}>({pct}%)</span>
      </span>
      <span>
        {attempt.status === 'pending_review' ? (
          <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
            {STATUS_LABELS[attempt.status]}
          </span>
        ) : (
          <span className={`prof-quiz-row-pill prof-quiz-row-pill--${passed ? 'pass' : 'fail'}`}>
            {passed ? 'Pumasa' : 'Bumagsak'}
          </span>
        )}
      </span>
      <span className="prof-quiz-row-date">{formatDate(attempt.finished_at)}</span>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { notify, confirm } = useUI()
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
  const [heroStats, setHeroStats] = useState({ totalTaken: '—', avgScore: '—', highestScore: '—', activeDays: '—' })

  const handleStatsReady = useCallback((stats) => setHeroStats(stats), [])

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    nameRef.current?.focus()
    getDoc(doc(db, 'users', user.uid))
      .then(snap => { if (snap.exists()) setPapel(snap.data()?.papel ?? null) })
      .catch(() => {})
  }, [user, navigate])

  const triggerShake = (setter) => { setter(true); setTimeout(() => setter(false), 500) }

  const handleNameSubmit = async (e) => {
    e.preventDefault()
    const errs = validateName(nameForm)
    if (Object.keys(errs).length) { setNameErr(errs); triggerShake(setNameShake); return }
    setNameBusy(true)
    try {
      await updateProfile(user, { displayName: nameForm.username.trim() })
      notify('Matagumpay na napalitan ang iyong Username!', 'success')
    } catch {
      setNameErr({ username: 'Hindi ma-update. Subukang muli.' })
      triggerShake(setNameShake)
      notify('Hindi ma-update ang username.', 'error')
    } finally { setNameBusy(false) }
  }

  const handlePassSubmit = async (e) => {
    e.preventDefault()
    const errs = validatePass(passForm)
    if (Object.keys(errs).length) { setPassErr(errs); triggerShake(setPassShake); return }
    setPassBusy(true)
    try {
      const credential = EmailAuthProvider.credential(user.email, passForm.current)
      await reauthenticateWithCredential(user, credential)
      await updatePassword(user, passForm.next)
      setPassForm({ current: '', next: '', confirm: '' })
      notify('Password na-update nang matagumpay!', 'success')
    } catch (err) {
      const isBadPass = err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
      setPassErr(isBadPass ? { current: 'Mali ang kasalukuyang password.' } : { confirm: 'May error. Subukan muli.' })
      triggerShake(setPassShake)
      notify('Hindi ma-update ang password.', 'error')
    } finally { setPassBusy(false) }
  }

  const handleSignOut = async () => { await signOut(auth); navigate('/') }

  if (!user) return null

  const heroStatCards = [
    { label: 'Mga Pagsusulit',  value: heroStats.totalTaken,  note: 'na sinagutan' },
    { label: 'Kabuuang Marka',  value: heroStats.avgScore,    note: 'na average', gold: true },
    { label: 'Pinakamataas',    value: heroStats.highestScore, note: 'na score' },
    { label: 'Mga Araw Aktibo', value: heroStats.activeDays,  note: 'na araw' },
  ]

  return (
    <div className="prof-root">
      <div className="prof-bg" aria-hidden="true">
        <div className="prof-bg-grid"/>
        <div className="prof-bg-vignette"/>
        <div className="prof-bg-glow"/>
      </div>

      <div className="prof-container">
        {/* Breadcrumb */}
        <div className="prof-topbar">
          <span className="prof-topbar-path">
            Dashboard <span style={{ opacity: 0.4 }}>›</span> <span>Account</span>
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
              <span className="prof-hero-stat">Papel <strong>{papel ? PAPEL_CONFIG[papel]?.label ?? papel : '—'}</strong></span>
              <span className="prof-hero-divider"/>
              <span className="prof-hero-stat">Status <strong>Aktibo</strong></span>
            </div>
          </div>
          <button className="prof-signout-btn" onClick={handleSignOut} aria-label="Mag-sign out">
            <SignOutIcon /><span>Sign Out</span>
          </button>
        </div>

        {/* Hero stats */}
        <div className="prof-stats-row">
          {heroStatCards.map((s, i) => (
            <div className="prof-stat-card" key={i}>
              <div className="prof-stat-label">{s.label}</div>
              <div className={`prof-stat-value${s.gold ? ' prof-stat-value--gold' : ''}`}>{s.value}</div>
              <div className="prof-stat-sub">{s.note}</div>
            </div>
          ))}
        </div>

        {/* Main grid */}
        <div className="prof-main-grid">
          {/* Username */}
          <div className="prof-section" style={{ animationDelay: '0ms' }}>
            <div className="prof-section-header">
              <div className="prof-section-header-left">
                <span className="prof-section-icon"><UserIcon /></span>
                <h2 className="prof-section-title">Baguhin ang Username</h2>
              </div>
            </div>
            <form className={`prof-form${nameShake ? ' prof-form--shake' : ''}`} onSubmit={handleNameSubmit} noValidate>
              <Field label="Bagong Username" error={nameErr.username}>
                <div className="prof-input-wrap">
                  <span className="prof-input-icon"><UserIcon /></span>
                  <input
                    ref={nameRef} id="prof-username" type="text" className="prof-input"
                    placeholder={user.displayName || 'Ilagay ang username'}
                    value={nameForm.username}
                    onChange={e => { setNameForm({ username: e.target.value }); setNameErr({}) }}
                    autoComplete="username" maxLength={30}
                  />
                </div>
              </Field>
              <div className="prof-char-count">{nameForm.username.length} / 30</div>
              <button type="submit" className="prof-btn" disabled={nameBusy} aria-busy={nameBusy}>
                {nameBusy && <span className="prof-spinner" aria-hidden="true"/>}
                {nameBusy ? 'Sine-save…' : 'I-save ang Username'}
              </button>
            </form>
          </div>

          {/* Password */}
          <div className="prof-section prof-section--password" style={{ animationDelay: '80ms' }}>
            <div className="prof-section-header">
              <div className="prof-section-header-left">
                <span className="prof-section-icon prof-section-icon--red"><LockIcon /></span>
                <h2 className="prof-section-title">Baguhin ang Password</h2>
              </div>
            </div>
            <form className={`prof-form${passShake ? ' prof-form--shake' : ''}`} onSubmit={handlePassSubmit} noValidate>
              <Field label="Kasalukuyang Password" error={passErr.current}>
                <PassInput id="prof-current" value={passForm.current}
                  onChange={e => { setPassForm(p => ({ ...p, current: e.target.value })); setPassErr({}) }}
                  placeholder="••••••••" autoComplete="current-password"/>
              </Field>
              <Field label="Bagong Password" error={passErr.next}>
                <PassInput id="prof-next" value={passForm.next}
                  onChange={e => { setPassForm(p => ({ ...p, next: e.target.value })); setPassErr({}) }}
                  placeholder="Min. 8 karakter" autoComplete="new-password"/>
              </Field>
              <Field label="Kumpirmahin ang Bagong Password" error={passErr.confirm}>
                <PassInput id="prof-confirm" value={passForm.confirm}
                  onChange={e => { setPassForm(p => ({ ...p, confirm: e.target.value })); setPassErr({}) }}
                  placeholder="Ulitin ang bagong password" autoComplete="new-password"/>
              </Field>
              <button type="submit" className="prof-btn prof-btn--red" disabled={passBusy} aria-busy={passBusy}>
                {passBusy && <span className="prof-spinner" aria-hidden="true"/>}
                {passBusy ? 'Sine-save…' : 'I-save ang Password'}
              </button>
            </form>
          </div>

          {/* Quiz history */}
          <QuizSection userId={user.uid} onStatsReady={handleStatsReady} />
        </div>
      </div>

      {/* Inline modal styles */}
      <style>{`
        .prof-review-backdrop {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(0,0,0,0.7);
          display: flex; align-items: center; justify-content: center;
          padding: 1rem; backdrop-filter: blur(4px);
        }
        .prof-review-modal {
          background: var(--bg-card, #141428);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 18px;
          width: 100%; max-width: 640px; max-height: 85vh;
          display: flex; flex-direction: column;
          overflow: hidden;
          box-shadow: 0 24px 64px rgba(0,0,0,0.5);
        }
        .prof-review-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          flex-shrink: 0;
        }
        .prof-review-set-name { margin: 0 0 4px; font-size: 16px; font-weight: 700; color: var(--text-primary, #e0e0e0); }
        .prof-review-meta     { margin: 0; font-size: 13px; color: var(--text-muted, #888); }
        .prof-review-close {
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px; padding: 6px; cursor: pointer;
          color: var(--text-muted, #888); display: flex; align-items: center;
          transition: background 0.15s, color 0.15s; flex-shrink: 0;
        }
        .prof-review-close:hover { background: rgba(255,255,255,0.12); color: var(--text-primary, #e0e0e0); }
        .prof-review-body { overflow-y: auto; padding: 16px 24px 24px; flex: 1; }
        .prof-review-loading, .prof-review-empty {
          display: flex; justify-content: center; padding: 3rem;
          color: var(--text-muted, #888); font-size: 13px; text-align: center;
        }
        .prof-review-list  { display: flex; flex-direction: column; gap: 14px; }
        .prof-review-item  {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px; padding: 14px 16px;
          transition: border-color 0.15s;
        }
        .prof-review-item--pending { border-color: rgba(245,185,66,0.25); }
        .prof-review-item-header   { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
        .prof-review-qnum {
          font-size: 11px; font-weight: 700; color: var(--text-muted, #888);
          background: rgba(255,255,255,0.06); border-radius: 6px; padding: 2px 7px; flex-shrink: 0;
        }
        .prof-review-qtype         { font-size: 11px; font-weight: 600; padding: 2px 9px; border-radius: 99px; flex-shrink: 0; }
        .prof-review-question      { margin: 0 0 10px; font-size: 14px; line-height: 1.6; color: var(--text-primary, #e0e0e0); }
        .prof-review-answers       { display: flex; flex-direction: column; gap: 8px; }
        .prof-review-answer-label  {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.06em; opacity: 0.5; margin-bottom: 4px; color: var(--text-primary, #e0e0e0);
        }
        .prof-review-answer-box {
          padding: 8px 12px; border-radius: 8px; font-size: 13px; line-height: 1.5;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: var(--text-primary, #e0e0e0);
        }
        .prof-review-answer-box.correct { background: rgba(34,211,165,0.1);  border-color: rgba(34,211,165,0.3);  color: #22d3a5; }
        .prof-review-answer-box.wrong   { background: rgba(255,95,109,0.1);   border-color: rgba(255,95,109,0.3);  color: #ff5f6d; }
        .prof-review-answer-box.ref     { background: rgba(34,211,165,0.06);  border-color: rgba(34,211,165,0.2);  color: #22d3a5; }
        .prof-review-section-label {
          font-weight: 600; font-size: 11px; opacity: 0.6;
          text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 4px;
        }
        .prof-review-explanation {
          margin-top: 10px; padding: 10px 12px;
          background: rgba(255,255,255,0.03); border-radius: 8px;
          border-left: 3px solid rgba(255,255,255,0.15);
          font-size: 13px; color: var(--text-muted, #888);
        }
        .prof-review-explanation p { margin: 0; line-height: 1.6; }
        .prof-review-feedback {
          margin-top: 10px; padding: 10px 12px;
          background: rgba(167,139,250,0.08); border-radius: 8px;
          border-left: 3px solid rgba(167,139,250,0.4);
          font-size: 13px; color: #c4b5fd;
        }
        .prof-review-feedback p { margin: 0; line-height: 1.6; }
        .prof-quiz-loading {
          display: flex; justify-content: center; padding: 2rem 0;
          color: var(--mist, #888); font-size: 13px;
        }
        .prof-quiz-row--clickable { cursor: pointer; transition: background 0.15s, border-color 0.15s; }
        .prof-quiz-row--clickable:hover { background: rgba(255,255,255,0.04); }
        .prof-quiz-row-review-hint { display: none; font-size: 11px; color: #4fa3e8; margin-left: 8px; font-weight: 500; }
        .prof-quiz-row--clickable:hover .prof-quiz-row-review-hint { display: inline; }
      `}</style>
    </div>
  )
}