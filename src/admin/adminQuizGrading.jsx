// adminQuizGrading.jsx
// Admin page: manually grade essay responses, view all user attempts & responses.
// No breaking changes needed here — works correctly once Pagsuslit.jsx writes
// user_uid into quiz_attempts. Added: student name shown in grading panel header,
// display_name sync on recalcScore, and a per-attempt user_uid display in the
// responses tab for easier identification.
//
// Badge changes:
//  - document.title updates with (N) prefix when essays are pending
//  - navigator.setAppBadge() for PWA/home-screen installs
//  - Tab badge now always visible regardless of active tab

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../API/supabase'
import { MdGrading, MdPeople, MdSearch, MdClose, MdExpandMore, MdAssignment, MdCheckCircle, MdPendingActions, MdAutorenew, MdDoneAll, MdAssessment } from 'react-icons/md'
import './adminQuiz.css'

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_META = {
  completed:      { label: 'Tapos na',         color: '#22d3a5', bg: 'rgba(34,211,165,0.12)',  border: 'rgba(34,211,165,0.25)' },
  pending_review: { label: 'Para sa Pagsusuri', color: '#f5b942', bg: 'rgba(245,185,66,0.12)',  border: 'rgba(245,185,66,0.25)' },
  in_progress:    { label: 'In Progress',       color: '#4fa3e8', bg: 'rgba(79,163,232,0.12)',  border: 'rgba(79,163,232,0.25)' },
}

const Q_TYPE_META = {
  multiple_choice: { label: 'Multiple Choice', color: '#4fa3e8', bg: 'rgba(79,163,232,0.12)',  border: 'rgba(79,163,232,0.25)' },
  true_false:      { label: 'Tama o Mali',      color: '#22d3a5', bg: 'rgba(34,211,165,0.12)', border: 'rgba(34,211,165,0.25)' },
  essay:           { label: 'Sanaysay',          color: '#a78bfa', bg: 'rgba(167,139,250,0.12)',border: 'rgba(167,139,250,0.25)' },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const m = STATUS_META[status] ?? STATUS_META.completed
  return (
    <span className="qz-type-badge" style={{ '--tc': m.color, '--tb': m.bg, '--tbd': m.border }}>
      {m.label}
    </span>
  )
}

function TypeBadge({ type }) {
  const m = Q_TYPE_META[type] ?? Q_TYPE_META.multiple_choice
  return (
    <span className="qz-type-badge" style={{ '--tc': m.color, '--tb': m.bg, '--tbd': m.border }}>
      {m.label}
    </span>
  )
}

function ScorePill({ score, total }) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0
  const color = pct >= 75 ? '#22d3a5' : pct >= 50 ? '#f5b942' : '#ff5f6d'
  return (
    <span className="qz-score-pill" style={{ '--sc': color }}>
      {score}/{total} <em>{pct}%</em>
    </span>
  )
}

// ─── ResponseCard ─────────────────────────────────────────────────────────────

function ResponseCard({ response: r, index, saving, onGrade }) {
  const [feedback, setFeedback] = useState(r.admin_feedback ?? '')
  const q = r.quiz_questions
  const isEssay = q?.type === 'essay'

  let displayAnswer = r.answer_text
  let correctDisplay = '—'

  if (q?.type === 'multiple_choice') {
    const idx = parseInt(r.answer_text, 10)
    displayAnswer = isNaN(idx) ? r.answer_text : (q.choices?.[idx] ?? r.answer_text)
    correctDisplay = q.choices?.[q.correct_index] ?? '—'
  }
  if (q?.type === 'true_false') {
    displayAnswer = r.answer_text === 'true' ? 'Tama (True)' : r.answer_text === 'false' ? 'Mali (False)' : r.answer_text
    correctDisplay = q.correct_tf ? 'Tama (True)' : 'Mali (False)'
  }

  const resultColor = r.is_correct === true ? '#22d3a5' : r.is_correct === false ? '#ff5f6d' : null

  return (
    <div className={`qz-response-card${r.needs_grading ? ' qz-response-card--needs-grading' : ''}`}>
      <div className="qz-response-header">
        <div className="qz-response-num">Q{index + 1}</div>
        <TypeBadge type={q?.type} />
        {r.is_correct !== null && !r.needs_grading && (
          <span style={{ color: resultColor, fontSize: 13, fontWeight: 700, marginLeft: 'auto' }}>
            {r.is_correct ? '✓ Tama' : '✕ Mali'}
          </span>
        )}
        {r.needs_grading && (
          <span className="qz-needs-grading-tag">Kailangan ng Pagtatasa</span>
        )}
      </div>

      <p className="qz-response-question">{q?.question}</p>

      <div className="qz-response-answer-row">
        <div className="qz-response-answer-block">
          <div className="qz-mini-label">Sagot ng Mag-aaral</div>
          <div className={`qz-answer-box${r.is_correct === true ? ' qz-answer-box--correct' : r.is_correct === false ? ' qz-answer-box--wrong' : ''}`}>
            {isEssay
              ? (r.answer_text || <em style={{ color: '#555' }}>Walang sagot</em>)
              : displayAnswer || <em style={{ color: '#555' }}>Walang sagot</em>}
          </div>
        </div>

        {!isEssay && (
          <div className="qz-response-answer-block">
            <div className="qz-mini-label">Tamang Sagot</div>
            <div className="qz-answer-box qz-answer-box--correct-ref">{correctDisplay}</div>
          </div>
        )}
      </div>

      {q?.explanation && !isEssay && (
        <div className="qz-explanation-box">
          <span className="qz-mini-label">Paliwanag</span>
          <p>{q.explanation}</p>
        </div>
      )}

      {isEssay && (
        <div className="qz-grade-section">
          <div className="qz-form-group">
            <div className="qz-mini-label">
              Feedback <span style={{ textTransform: 'none', fontWeight: 400 }}>(opsyonal)</span>
            </div>
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              className="qz-input qz-textarea"
              rows={2}
              placeholder="Isulat ang iyong komento para sa mag-aaral…"
            />
          </div>
          <div className="qz-grade-actions">
            <button
              className={`qz-grade-btn qz-grade-btn--correct${r.is_correct === true ? ' qz-grade-btn--selected' : ''}`}
              disabled={saving}
              onClick={() => onGrade(r.id, true, feedback)}
            >
              {saving ? <div className="qz-spinner qz-spinner--sm" /> : '✓'} Tama
            </button>
            <button
              className={`qz-grade-btn qz-grade-btn--wrong${r.is_correct === false ? ' qz-grade-btn--selected' : ''}`}
              disabled={saving}
              onClick={() => onGrade(r.id, false, feedback)}
            >
              {saving ? <div className="qz-spinner qz-spinner--sm" /> : '✕'} Mali
            </button>
          </div>
          {r.graded_at && (
            <p className="qz-graded-at">
              Na-grade noong {new Date(r.graded_at).toLocaleString('fil-PH')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminQuizGrading() {
  const [mainTab,       setMainTab]       = useState('grading') // 'grading' | 'responses'
  const [gradingTab,    setGradingTab]    = useState('pending') // 'pending' | 'all'
  const [attempts,      setAttempts]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [activeAttempt, setActiveAttempt] = useState(null)
  const [responses,     setResponses]     = useState([])
  const [loadingR,      setLoadingR]      = useState(false)
  const [saving,        setSaving]        = useState({})
  const [searchQ,       setSearchQ]       = useState('')
  const [filterStatus,  setFilterStatus]  = useState('all')

  // All responses tab
  const [allAttempts,      setAllAttempts]      = useState([])
  const [loadingAll,       setLoadingAll]        = useState(false)
  const [expandedAttempt,  setExpandedAttempt]  = useState(null)
  const [attemptResponses, setAttemptResponses] = useState({})
  const [loadingAttemptR,  setLoadingAttemptR]  = useState({})
  const [searchStudent,    setSearchStudent]    = useState('')
  const [filterSet,        setFilterSet]        = useState('all')
  const [allSets,          setAllSets]          = useState([])

  // ── Fetch attempts (grading tab) ──────────────────────────────────────────

  const fetchAttempts = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('quiz_attempts')
      .select(`
        id, display_name, user_uid, score, total_questions,
        status, started_at, finished_at,
        quiz_sets ( title, category )
      `)
      .order('finished_at', { ascending: false })
    if (gradingTab === 'pending') query = query.eq('status', 'pending_review')
    const { data, error } = await query
    if (!error) setAttempts(data ?? [])
    setLoading(false)
  }, [gradingTab])

  useEffect(() => { fetchAttempts() }, [fetchAttempts])

  // ── Fetch all attempts (responses tab) ────────────────────────────────────

  const fetchAllAttempts = useCallback(async () => {
    setLoadingAll(true)
    const { data, error } = await supabase
      .from('quiz_attempts')
      .select(`
        id, display_name, user_uid, score, total_questions,
        status, started_at, finished_at,
        quiz_sets ( id, title, category )
      `)
      .order('finished_at', { ascending: false })
    if (!error) setAllAttempts(data ?? [])
    setLoadingAll(false)
  }, [])

  const fetchAllSets = useCallback(async () => {
    const { data } = await supabase.from('quiz_sets').select('id, title').order('title')
    if (data) setAllSets(data)
  }, [])

  useEffect(() => {
    if (mainTab === 'responses') { fetchAllAttempts(); fetchAllSets() }
  }, [mainTab, fetchAllAttempts, fetchAllSets])

  // ── App icon / browser-tab badge ─────────────────────────────────────────
  // pendingCount is derived below, but we need it early for the effect dep.
  // We re-derive it here directly from `attempts` so the effect runs on the
  // right value without a stale-closure problem.

  const pendingCount = attempts.filter(a => a.status === 'pending_review').length

  useEffect(() => {
    const BASE_TITLE = 'Mga Sagot at Grading'

    // 1. Browser tab title  →  "(3) Mga Sagot at Grading"
    document.title = pendingCount > 0 ? `(${pendingCount}) ${BASE_TITLE}` : BASE_TITLE

    // 2. PWA / home-screen OS badge  (Badging API — Chrome 81+, Edge, Safari 17.4+)
    if ('setAppBadge' in navigator) {
      if (pendingCount > 0) {
        navigator.setAppBadge(pendingCount).catch(() => {})
      } else {
        navigator.clearAppBadge().catch(() => {})
      }
    }

    // Cleanup: restore plain title & clear badge when component unmounts
    return () => {
      document.title = BASE_TITLE
      if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch(() => {})
    }
  }, [pendingCount])

  // ── Fetch responses for grading panel ────────────────────────────────────

  const openAttempt = async (attempt) => {
    setActiveAttempt(attempt); setLoadingR(true)
    const { data, error } = await supabase
      .from('quiz_responses')
      .select(`
        id, answer_text, is_correct, needs_grading, admin_feedback, graded_at,
        quiz_questions ( question, type, correct_tf, correct_index, choices, explanation )
      `)
      .eq('attempt_id', attempt.id)
      .order('created_at', { ascending: true })
    if (!error) setResponses(data ?? [])
    setLoadingR(false)
  }

  // ── Fetch responses for a student attempt (responses tab) ─────────────────

  const toggleAttemptDetail = async (attemptId) => {
    if (expandedAttempt === attemptId) { setExpandedAttempt(null); return }
    setExpandedAttempt(attemptId)
    if (attemptResponses[attemptId]) return
    setLoadingAttemptR(prev => ({ ...prev, [attemptId]: true }))
    const { data, error } = await supabase
      .from('quiz_responses')
      .select(`
        id, answer_text, is_correct, needs_grading, admin_feedback, graded_at,
        quiz_questions ( question, type, correct_tf, correct_index, choices, explanation )
      `)
      .eq('attempt_id', attemptId)
      .order('created_at', { ascending: true })
    if (!error) setAttemptResponses(prev => ({ ...prev, [attemptId]: data ?? [] }))
    setLoadingAttemptR(prev => ({ ...prev, [attemptId]: false }))
  }

  // ── Grade essay ───────────────────────────────────────────────────────────

  const gradeResponse = async (responseId, isCorrect, feedback) => {
    setSaving(prev => ({ ...prev, [responseId]: true }))
    const { error } = await supabase.from('quiz_responses').update({
      is_correct:    isCorrect,
      needs_grading: false,
      admin_feedback: feedback || null,
      graded_at:     new Date().toISOString(),
    }).eq('id', responseId)

    if (!error) {
      setResponses(prev => prev.map(r => r.id === responseId
        ? { ...r, is_correct: isCorrect, needs_grading: false, admin_feedback: feedback, graded_at: new Date().toISOString() }
        : r))
      await recalcScore(activeAttempt.id)
    }
    setSaving(prev => ({ ...prev, [responseId]: false }))
  }

  const recalcScore = async (attemptId) => {
    const { data } = await supabase
      .from('quiz_responses')
      .select('is_correct, needs_grading')
      .eq('attempt_id', attemptId)
    if (!data) return

    const allGraded  = data.every(r => !r.needs_grading)
    const finalScore = data.filter(r => r.is_correct === true).length
    const status     = allGraded ? 'completed' : 'pending_review'

    await supabase
      .from('quiz_attempts')
      .update({ score: finalScore, status })
      .eq('id', attemptId)

    setAttempts(prev => prev.map(a => a.id === attemptId ? { ...a, score: finalScore, status } : a))
    if (activeAttempt?.id === attemptId) setActiveAttempt(prev => ({ ...prev, score: finalScore, status }))
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const filteredAttempts = attempts.filter(a => {
    const matchSearch = (a.display_name ?? '').toLowerCase().includes(searchQ.toLowerCase()) ||
      (a.quiz_sets?.title ?? '').toLowerCase().includes(searchQ.toLowerCase())
    const matchStatus = filterStatus === 'all' || a.status === filterStatus
    return matchSearch && matchStatus
  })

  const filteredAllAttempts = allAttempts.filter(a => {
    const matchSearch = (a.display_name ?? '').toLowerCase().includes(searchStudent.toLowerCase())
    const matchSet    = filterSet === 'all' || a.quiz_sets?.id === filterSet
    return matchSearch && matchSet
  })

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="qz-page">
      {/* ── Page Header ── */}
      <div className="qz-page-header">
        <div>
          <p className="qz-eyebrow">Palaisipan · Pamamahala</p>
          <h1 className="qz-page-title">Mga Sagot at Grading</h1>
        </div>
      </div>

      {/* ── Main Tabs ── */}
      <div className="qz-main-tabs">
        <button
          className={`qz-main-tab${mainTab === 'grading' ? ' qz-main-tab--active' : ''}`}
          onClick={() => { setMainTab('grading'); setActiveAttempt(null) }}
        >
          <MdGrading size={18} />
          Grading ng Sanaysay
          {/* Badge always visible — no mainTab guard */}
          {pendingCount > 0 && (
            <span className="qz-tab-badge">{pendingCount}</span>
          )}
        </button>
        <button
          className={`qz-main-tab${mainTab === 'responses' ? ' qz-main-tab--active' : ''}`}
          onClick={() => { setMainTab('responses'); setExpandedAttempt(null) }}
        >
          <MdPeople size={18} />
          Lahat ng Sagot ng Mga Estudyante
        </button>
      </div>

      {/* ══════════════════════
          GRADING TAB
      ══════════════════════ */}
      {mainTab === 'grading' && (
        <>
          {/* Sub-tabs */}
          <div className="qz-sub-tabs">
            {[
              { key: 'pending', label: `Para sa Pagsusuri${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
              { key: 'all',    label: 'Lahat ng Pagsubok' },
            ].map(t => (
              <button
                key={t.key}
                className={`qz-sub-tab${gradingTab === t.key ? ' qz-sub-tab--active' : ''}`}
                onClick={() => { setGradingTab(t.key); setActiveAttempt(null) }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="qz-filters qz-filters--compact">
            <div className="qz-search-wrap">
              <MdSearch size={16} />
              <input
                className="qz-search"
                placeholder="Hanapin ang mag-aaral o quiz…"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
              />
            </div>
            <div className="qz-cat-filters">
              {['all', 'pending_review', 'completed', 'in_progress'].map(s => (
                <button
                  key={s}
                  className={`qz-cat-filter${filterStatus === s ? ' qz-cat-filter--active' : ''}`}
                  onClick={() => setFilterStatus(s)}
                >
                  {s === 'all' ? 'Lahat' : STATUS_META[s]?.label ?? s}
                </button>
              ))}
            </div>
          </div>

          <div className={`qz-panels${activeAttempt ? ' qz-panels--split' : ''}`}>
            {/* Attempts list */}
            <div className="qz-panel">
              {loading ? (
                <div className="qz-loading"><div className="qz-spinner" /><span>Naglo-load…</span></div>
              ) : filteredAttempts.length === 0 ? (
                <div className="qz-empty-state">
                  <div className="qz-empty-icon"><MdDoneAll /></div>
                  <p>{gradingTab === 'pending' ? 'Wala pang naghihintay na sanaysay.' : 'Wala pang attempt.'}</p>
                </div>
              ) : (
                <div className="qz-attempt-list">
                  {filteredAttempts.map(a => {
                    const date = a.finished_at
                      ? new Date(a.finished_at).toLocaleDateString('fil-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—'
                    return (
                      <div
                        key={a.id}
                        className={`qz-attempt-card${activeAttempt?.id === a.id ? ' qz-attempt-card--active' : ''}`}
                        onClick={() => openAttempt(a)}
                      >
                        <div className="qz-attempt-card-top">
                          <div className="qz-student-avatar">
                            {(a.display_name || 'A')[0].toUpperCase()}
                          </div>
                          <div className="qz-attempt-info">
                            <p className="qz-attempt-name">{a.display_name || 'Anonymous'}</p>
                            <p className="qz-attempt-set">{a.quiz_sets?.title ?? '—'}</p>
                            {a.user_uid && (
                              <p style={{ fontSize: 10, opacity: 0.4, marginTop: 1, fontFamily: 'monospace' }}>
                                {a.user_uid.slice(0, 12)}…
                              </p>
                            )}
                          </div>
                          <div className="qz-attempt-right">
                            <ScorePill score={a.score ?? 0} total={a.total_questions ?? 0} />
                            <StatusBadge status={a.status} />
                          </div>
                        </div>
                        <p className="qz-attempt-date">{date}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Grading panel */}
            {activeAttempt && (
              <div className="qz-panel qz-panel--grading">
                <div className="qz-qs-header">
                  <div className="qz-qs-header-left">
                    <button className="qz-icon-btn" onClick={() => setActiveAttempt(null)}>
                      <MdClose size={18} />
                    </button>
                    <div>
                      <p className="qz-qs-set-name">{activeAttempt.display_name || 'Anonymous'}</p>
                      <div className="qz-qs-set-meta">
                        <span>{activeAttempt.quiz_sets?.title}</span>
                        <span>·</span>
                        <ScorePill score={activeAttempt.score ?? 0} total={activeAttempt.total_questions ?? 0} />
                        <StatusBadge status={activeAttempt.status} />
                      </div>
                    </div>
                  </div>
                </div>

                {loadingR ? (
                  <div className="qz-loading"><div className="qz-spinner" /><span>Naglo-load…</span></div>
                ) : responses.length === 0 ? (
                  <div className="qz-empty-state qz-empty-state--sm">
                    <p>Walang mga sagot na nahanap.</p>
                  </div>
                ) : (
                  <div className="qz-response-list">
                    {responses.map((r, idx) => (
                      <ResponseCard
                        key={r.id}
                        response={r}
                        index={idx}
                        saving={!!saving[r.id]}
                        onGrade={gradeResponse}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════════════
          RESPONSES TAB
      ══════════════════════ */}
      {mainTab === 'responses' && (
        <>
          {/* Stats */}
          <div className="qz-stats-row" style={{ marginBottom: 20 }}>
            {[
              { label: 'Kabuuang Attempt',  val: allAttempts.length,                                                icon: <MdAssignment />, accent: '#4fa3e8' },
              { label: 'Natapos na',        val: allAttempts.filter(a => a.status === 'completed').length,          icon: <MdCheckCircle />, accent: '#22d3a5' },
              { label: 'Para sa Pagsusuri', val: allAttempts.filter(a => a.status === 'pending_review').length,     icon: <MdPendingActions />, accent: '#f5b942' },
              { label: 'In Progress',       val: allAttempts.filter(a => a.status === 'in_progress').length,        icon: <MdAutorenew />, accent: '#a78bfa' },
            ].map(s => (
              <div className="qz-stat-card" key={s.label} style={{ '--sa': s.accent }}>
                <span className="qz-stat-icon">{s.icon}</span>
                <div>
                  <p className="qz-stat-label">{s.label}</p>
                  <p className="qz-stat-val">{s.val}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="qz-filters">
            <div className="qz-search-wrap">
              <MdSearch size={16} />
              <input
                className="qz-search"
                placeholder="Hanapin ang mag-aaral…"
                value={searchStudent}
                onChange={e => setSearchStudent(e.target.value)}
              />
            </div>
            <div className="qz-cat-filters">
              <button
                className={`qz-cat-filter${filterSet === 'all' ? ' qz-cat-filter--active' : ''}`}
                onClick={() => setFilterSet('all')}
              >
                Lahat ng Set
              </button>
              {allSets.map(s => (
                <button
                  key={s.id}
                  className={`qz-cat-filter${filterSet === s.id ? ' qz-cat-filter--active' : ''}`}
                  onClick={() => setFilterSet(s.id)}
                >
                  {s.title}
                </button>
              ))}
            </div>
          </div>

          {loadingAll ? (
            <div className="qz-loading"><div className="qz-spinner" /><span>Naglo-load…</span></div>
          ) : filteredAllAttempts.length === 0 ? (
            <div className="qz-empty-state" style={{ padding: '4rem 2rem' }}>
              <div className="qz-empty-icon"><MdAssessment /></div>
              <p>Wala pang mga sagot na nahanap.</p>
            </div>
          ) : (
            <div className="qz-all-attempts-list">
              {filteredAllAttempts.map(a => {
                const isExpanded = expandedAttempt === a.id
                const rList      = attemptResponses[a.id]
                const isLoadingR = loadingAttemptR[a.id]
                const date = a.finished_at
                  ? new Date(a.finished_at).toLocaleString('fil-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : a.started_at
                    ? `Sinimulan: ${new Date(a.started_at).toLocaleString('fil-PH', { month: 'short', day: 'numeric' })}`
                    : '—'

                return (
                  <div key={a.id} className={`qz-all-attempt-row${isExpanded ? ' qz-all-attempt-row--expanded' : ''}`}>
                    <div className="qz-all-attempt-summary" onClick={() => toggleAttemptDetail(a.id)}>
                      <div className="qz-student-avatar">
                        {(a.display_name || 'A')[0].toUpperCase()}
                      </div>
                      <div className="qz-all-attempt-info">
                        <p className="qz-attempt-name">{a.display_name || 'Anonymous'}</p>
                        <p className="qz-attempt-set">
                          {a.quiz_sets?.title ?? '—'}
                          {a.quiz_sets?.category && (
                            <span className="qz-badge qz-badge--sm">{a.quiz_sets.category}</span>
                          )}
                        </p>
                        {a.user_uid ? (
                          <p style={{ fontSize: 10, opacity: 0.35, marginTop: 1, fontFamily: 'monospace' }}>
                            uid: {a.user_uid.slice(0, 12)}…
                          </p>
                        ) : (
                          <p style={{ fontSize: 10, opacity: 0.35, marginTop: 1 }}>
                            Guest attempt
                          </p>
                        )}
                      </div>
                      <div className="qz-all-attempt-right">
                        <ScorePill score={a.score ?? 0} total={a.total_questions ?? 0} />
                        <StatusBadge status={a.status} />
                        <span className="qz-attempt-date-inline">{date}</span>
                      </div>
                      <div className="qz-expand-icon" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}>
                        <MdExpandMore size={18} />
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="qz-all-attempt-detail">
                        {isLoadingR ? (
                          <div className="qz-loading" style={{ padding: '2rem' }}>
                            <div className="qz-spinner" /><span>Naglo-load…</span>
                          </div>
                        ) : !rList || rList.length === 0 ? (
                          <p className="qz-empty-inline">Walang mga sagot.</p>
                        ) : (
                          <div className="qz-response-detail-grid">
                            {rList.map((r, idx) => {
                              const q = r.quiz_questions
                              let displayAnswer  = r.answer_text
                              let correctDisplay = null

                              if (q?.type === 'multiple_choice') {
                                const i = parseInt(r.answer_text, 10)
                                displayAnswer  = isNaN(i) ? r.answer_text : (q.choices?.[i] ?? r.answer_text)
                                correctDisplay = q.choices?.[q.correct_index] ?? '—'
                              }
                              if (q?.type === 'true_false') {
                                displayAnswer  = r.answer_text === 'true' ? 'Tama (True)' : r.answer_text === 'false' ? 'Mali (False)' : r.answer_text
                                correctDisplay = q.correct_tf ? 'Tama (True)' : 'Mali (False)'
                              }

                              return (
                                <div key={r.id} className="qz-detail-item">
                                  <div className="qz-detail-item-header">
                                    <span className="qz-detail-qnum">Q{idx + 1}</span>
                                    <TypeBadge type={q?.type} />
                                    {r.is_correct === true  && <span className="qz-result-correct">✓ Tama</span>}
                                    {r.is_correct === false && <span className="qz-result-wrong">✕ Mali</span>}
                                    {r.needs_grading        && <span className="qz-needs-grading-tag">Kailangan ng Grading</span>}
                                  </div>
                                  <p className="qz-detail-question">{q?.question}</p>
                                  <div className="qz-detail-answers">
                                    <div>
                                      <div className="qz-mini-label">Sagot</div>
                                      <div className={`qz-answer-box qz-answer-box--sm${r.is_correct === true ? ' qz-answer-box--correct' : r.is_correct === false ? ' qz-answer-box--wrong' : ''}`}>
                                        {displayAnswer || <em>Walang sagot</em>}
                                      </div>
                                    </div>
                                    {correctDisplay && q?.type !== 'essay' && (
                                      <div>
                                        <div className="qz-mini-label">Tamang Sagot</div>
                                        <div className="qz-answer-box qz-answer-box--sm qz-answer-box--correct-ref">
                                          {correctDisplay}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  {r.admin_feedback && (
                                    <div className="qz-feedback-preview">
                                      <span className="qz-mini-label">Feedback:</span> {r.admin_feedback}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}