// adminQuizSets.jsx
// Admin page: manage quiz sets and their questions.
// When a quiz attempt is submitted (elsewhere in the app), write snapshot_title
// to quiz_attempts so the title persists even if this set is later deleted.

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../API/supabase'
import { MdClose, MdAdd, MdEdit, MdDelete, MdSearch, MdFolder, MdInfo, MdHelpOutline, MdExpandMore, MdInventory, MdWarning, MdInbox } from 'react-icons/md'
import { useUI } from '../context/UIContext'
import './adminQuiz.css'

// ─── Constants ───────────────────────────────────────────────────────────────

const DIFFICULTY_META = {
  easy:   { label: 'Madali',     color: '#22d3a5', bg: 'rgba(34,211,165,0.12)',  border: 'rgba(34,211,165,0.25)' },
  medium: { label: 'Katamtaman', color: '#f5b942', bg: 'rgba(245,185,66,0.12)',  border: 'rgba(245,185,66,0.25)' },
  hard:   { label: 'Mahirap',    color: '#ff5f6d', bg: 'rgba(255,95,109,0.12)',  border: 'rgba(255,95,109,0.25)' },
}

const Q_TYPE_META = {
  multiple_choice: { label: 'Multiple Choice', color: '#4fa3e8', bg: 'rgba(79,163,232,0.12)',   border: 'rgba(79,163,232,0.25)'  },
  true_false:      { label: 'Tama o Mali',      color: '#22d3a5', bg: 'rgba(34,211,165,0.12)',  border: 'rgba(34,211,165,0.25)'  },
  essay:           { label: 'Sanaysay',          color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.25)' },
}

const SUGGESTED_CATEGORIES = [
  'Kasaysayan', 'Agham', 'Matematika', 'Filipino', 'Ingles',
  'MAPEH', 'Araling Panlipunan', 'Teknolohiya', 'Panitikan', 'Edukasyon sa Pagpapakatao',
]

const EMPTY_SET = { title: '', description: '', category: '', difficulty: 'medium' }

const EMPTY_QUESTION = {
  type: 'multiple_choice',
  question: '',
  choices: ['', '', '', ''],
  correct_index: 0,
  correct_tf: true,
  explanation: '',
  order_index: 0,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const validateQuestion = (q) => {
  if (!q.question.trim()) return 'Kailangan ang tanong.'
  if (q.type === 'multiple_choice') {
    if (q.choices.filter(c => c.trim()).length < 2) return 'Kailangan ng hindi bababa sa 2 pagpipilian.'
    if (!q.choices[q.correct_index]?.trim())        return 'Ang tamang sagot ay walang laman.'
  }
  return ''
}

// ─── Atoms ───────────────────────────────────────────────────────────────────

const CloseIcon = ({ size = 18 }) => <MdClose size={size} />
const PlusIcon = () => <MdAdd size={16} />
const EditIcon = () => <MdEdit size={16} />
const DeleteIcon = () => <MdDelete size={16} />
const SearchIcon = () => <MdSearch size={16} />
const FolderIcon = () => <MdFolder size={16} />
const InfoIcon = () => <MdInfo size={16} />
const HelpIcon = () => <MdHelpOutline size={14} />

const Badge = ({ children, color, bg, border }) => (
  <span style={{
    padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 600,
    color, background: bg, border: `1px solid ${border}`,
  }}>{children}</span>
)

const DifficultyBadge = ({ difficulty }) => {
  const d = DIFFICULTY_META[difficulty] ?? DIFFICULTY_META.medium
  return <Badge color={d.color} bg={d.bg} border={d.border}>{d.label}</Badge>
}
const TypeBadge = ({ type }) => {
  const m = Q_TYPE_META[type] ?? Q_TYPE_META.multiple_choice
  return <Badge color={m.color} bg={m.bg} border={m.border}>{m.label}</Badge>
}
const CategoryBadge = ({ category }) =>
  category
    ? <span className="qz-badge">{category}</span>
    : <span className="qz-badge qz-badge--muted">—</span>

// ─── QuestionForm ─────────────────────────────────────────────────────────────

function QuestionForm({ form, onChange, error }) {
  const updateChoice = (i, val) => {
    const choices = [...form.choices]
    choices[i] = val
    onChange({ ...form, choices })
  }

  return (
    <div className="qz-form-grid">
      {error && <div className="qz-form-error" style={{ gridColumn: '1/-1' }}>{error}</div>}

      {/* Type tabs */}
      <div className="qz-form-group">
        <label>Uri ng Tanong *</label>
        <div className="qz-type-tabs">
          {Object.entries(Q_TYPE_META).map(([val, meta]) => (
            <button
              key={val} type="button"
              className={`qz-type-tab${form.type === val ? ' qz-type-tab--active' : ''}`}
              style={form.type === val ? { '--tab-color': meta.color, '--tab-bg': meta.bg, '--tab-border': meta.border } : {}}
              onClick={() => onChange({ ...form, type: val })}
            >
              {meta.label}
            </button>
          ))}
        </div>
      </div>

      {/* Order */}
      <div className="qz-form-group">
        <label>Order</label>
        <input
          type="number" min="0" value={form.order_index} className="qz-input"
          onChange={e => onChange({ ...form, order_index: Number(e.target.value) })}
        />
      </div>

      {/* Question text */}
      <div className="qz-form-group qz-form-group--full">
        <label>Tanong *</label>
        <textarea
          value={form.question} rows={3} className="qz-input qz-textarea"
          placeholder="Isulat ang tanong dito…"
          onChange={e => onChange({ ...form, question: e.target.value })}
        />
      </div>

      {/* Multiple choice */}
      {form.type === 'multiple_choice' && (
        <div className="qz-form-group qz-form-group--full">
          <label>Mga Pagpipilian * <span className="qz-label-hint">(piliin ang tamang sagot)</span></label>
          <div className="qz-choices">
            {form.choices.map((c, i) => (
              <div key={i} className="qz-choice-row">
                <input
                  type="radio" name={`correct-${form._uid ?? 'new'}`}
                  checked={form.correct_index === i}
                  onChange={() => onChange({ ...form, correct_index: i })}
                  className="qz-radio"
                />
                <span className={`qz-choice-letter${form.correct_index === i ? ' qz-choice-letter--active' : ''}`}>
                  {String.fromCharCode(65 + i)}
                </span>
                <input
                  value={c} onChange={e => updateChoice(i, e.target.value)}
                  className={`qz-input qz-choice-input${form.correct_index === i ? ' qz-choice-input--correct' : ''}`}
                  placeholder={`Pagpipilian ${i + 1}${i < 2 ? ' *' : ''}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* True / False */}
      {form.type === 'true_false' && (
        <div className="qz-form-group qz-form-group--full">
          <label>Tamang Sagot *</label>
          <div className="qz-tf-options">
            {[
              { val: true,  label: '✓  Tama (True)',  cls: 'true'  },
              { val: false, label: '✕  Mali (False)', cls: 'false' },
            ].map(opt => (
              <label key={String(opt.val)}
                className={`qz-tf-option qz-tf-option--${opt.cls}${form.correct_tf === opt.val ? ' qz-tf-option--active' : ''}`}
              >
                <input
                  type="radio" name={`tf-${form._uid ?? 'new'}`}
                  checked={form.correct_tf === opt.val}
                  onChange={() => onChange({ ...form, correct_tf: opt.val })}
                  style={{ display: 'none' }}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Essay notice */}
      {form.type === 'essay' && (
        <div className="qz-form-group qz-form-group--full">
          <div className="qz-essay-notice">
            <InfoIcon />
            Ang mga sagot sa sanaysay ay susuriin mo nang manu-mano sa pahina ng Grading.
          </div>
        </div>
      )}

      {/* Explanation */}
      <div className="qz-form-group qz-form-group--full">
        <label>Paliwanag <span className="qz-label-hint">(opsyonal)</span></label>
        <textarea
          value={form.explanation} rows={2} className="qz-input qz-textarea"
          placeholder="Ipaliwanag kung bakit ito ang tamang sagot…"
          onChange={e => onChange({ ...form, explanation: e.target.value })}
        />
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminQuizSets() {
  const { notify, confirm } = useUI()
  // Sets state
  const [sets,        setSets]        = useState([])
  const [loadingSets, setLoadingSets] = useState(true)
  const [setSearch,   setSetSearch]   = useState('')
  const [filterCat,   setFilterCat]   = useState('all')

  // Set modal state
  const [setModal,    setSetModal]    = useState(false)
  const [setForm,     setSetForm]     = useState(EMPTY_SET)
  const [editingSet,  setEditingSet]  = useState(null)
  const [savingSet,   setSavingSet]   = useState(false)
  const [setError,    setSetError]    = useState('')
  const [catInput,    setCatInput]    = useState('')
  const [showCatSug,  setShowCatSug]  = useState(false)

  // Questions state
  const [activeSet,   setActiveSet]   = useState(null)
  const [questions,   setQuestions]   = useState([])
  const [loadingQ,    setLoadingQ]    = useState(false)

  // Question modal state
  const [qModal,      setQModal]      = useState(false)
  const [qForm,       setQForm]       = useState(EMPTY_QUESTION)
  const [editingQ,    setEditingQ]    = useState(null)
  const [savingQ,     setSavingQ]     = useState(false)
  const [qError,      setQError]      = useState('')

  const titleRef = useRef(null)

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchSets = useCallback(async () => {
    setLoadingSets(true)
    const { data, error } = await supabase
      .from('quiz_sets')
      .select('*, quiz_questions(count)')
      .order('created_at', { ascending: false })
    if (!error) setSets(data ?? [])
    setLoadingSets(false)
  }, [])

  useEffect(() => { fetchSets() }, [fetchSets])

  const fetchQuestions = useCallback(async (setId) => {
    setLoadingQ(true)
    const { data, error } = await supabase
      .from('quiz_questions')
      .select('*')
      .eq('set_id', setId)
      .order('order_index', { ascending: true })
    if (!error) setQuestions(data ?? [])
    setLoadingQ(false)
  }, [])

  const openSet = (s) => { setActiveSet(s); fetchQuestions(s.id) }

  // ── Set CRUD ──────────────────────────────────────────────────────────────

  const openAddSet = () => {
    setSetForm(EMPTY_SET); setCatInput(''); setEditingSet(null); setSetError('')
    setSetModal(true)
    setTimeout(() => titleRef.current?.focus(), 50)
  }

  const openEditSet = (s, e) => {
    e?.stopPropagation()
    setSetForm({ title: s.title, description: s.description ?? '', category: s.category ?? '', difficulty: s.difficulty ?? 'medium' })
    setCatInput(s.category ?? '')
    setEditingSet(s.id); setSetError('')
    setSetModal(true)
    setTimeout(() => titleRef.current?.focus(), 50)
  }

  const closeSetModal = () => { setSetModal(false); setEditingSet(null); setSetError(''); setShowCatSug(false) }

  const handleSaveSet = async () => {
    if (!setForm.title.trim()) { setSetError('Kailangan ang titulo ng set.'); return }
    setSavingSet(true); setSetError('')
    const payload = {
      title:       setForm.title.trim(),
      description: setForm.description.trim() || null,
      category:    setForm.category.trim()    || null,
      difficulty:  setForm.difficulty,
      updated_at:  new Date().toISOString(),
    }
    try {
      if (editingSet) {
        const { error } = await supabase.from('quiz_sets').update(payload).eq('id', editingSet)
        if (error) throw error
        if (activeSet?.id === editingSet) setActiveSet(prev => ({ ...prev, ...payload }))
      } else {
        const { error } = await supabase.from('quiz_sets').insert([payload])
        if (error) throw error
      }
      await fetchSets(); closeSetModal()
    } catch { setSetError('Hindi ma-save. Subukan ulit.') }
    finally  { setSavingSet(false) }
  }

  const handleDeleteSet = async (id, title, e) => {
    e?.stopPropagation()
    const ok = await confirm({
      title:        `Tanggalin ang "${title}"?`,
      body:         'Matatanggal din ang lahat ng tanong sa loob nito. Hindi ito maibabalik.',
      confirmLabel: 'Tanggalin',
      danger:       true,
    })
    if (!ok) return
    const { error } = await supabase.from('quiz_sets').delete().eq('id', id)
    if (error) {
      notify('Hindi matanggal. Subukan ulit.', 'error')
    } else {
      setSets(prev => prev.filter(s => s.id !== id))
      if (activeSet?.id === id) setActiveSet(null)
      notify(`"${title}" ay matagumpay na natanggal.`, 'success')
    }
  }

  // ── Question CRUD ─────────────────────────────────────────────────────────

  const openAddQ = () => {
    setQForm({ ...EMPTY_QUESTION, order_index: questions.length, _uid: Date.now() })
    setEditingQ(null); setQError(''); setQModal(true)
  }

  const openEditQ = (q) => {
    setQForm({
      _uid:          q.id,
      type:          q.type,
      question:      q.question,
      choices:       q.choices       ?? ['', '', '', ''],
      correct_index: q.correct_index ?? 0,
      correct_tf:    q.correct_tf    ?? true,
      explanation:   q.explanation   ?? '',
      order_index:   q.order_index   ?? 0,
    })
    setEditingQ(q.id); setQError(''); setQModal(true)
  }

  const closeQModal = () => { setQModal(false); setEditingQ(null); setQError('') }

  const handleSaveQ = async () => {
    const err = validateQuestion(qForm)
    if (err) { setQError(err); return }
    setSavingQ(true); setQError('')
    const payload = {
      set_id:        activeSet.id,
      type:          qForm.type,
      question:      qForm.question.trim(),
      choices:       qForm.type === 'multiple_choice' ? qForm.choices.map(c => c.trim()) : null,
      correct_index: qForm.type === 'multiple_choice' ? qForm.correct_index             : null,
      correct_tf:    qForm.type === 'true_false'      ? qForm.correct_tf                : null,
      explanation:   qForm.explanation.trim() || null,
      order_index:   qForm.order_index,
    }
    try {
      if (editingQ) {
        const { error } = await supabase.from('quiz_questions').update(payload).eq('id', editingQ)
        if (error) throw error
      } else {
        const { error } = await supabase.from('quiz_questions').insert([payload])
        if (error) throw error
      }
      await fetchQuestions(activeSet.id); await fetchSets(); closeQModal()
    } catch { setQError('Hindi ma-save. Subukan ulit.') }
    finally  { setSavingQ(false) }
  }

  const handleDeleteQ = async (id, text) => {
    const ok = await confirm({
      title:        'Tanggalin ang tanong na ito?',
      body:         `"${text.length > 80 ? text.slice(0, 80) + '…' : text}"`,
      confirmLabel: 'Tanggalin',
      danger:       true,
    })
    if (!ok) return
    const { error } = await supabase.from('quiz_questions').delete().eq('id', id)
    if (error) {
      notify('Hindi matanggal. Subukan ulit.', 'error')
    } else {
      setQuestions(prev => prev.filter(q => q.id !== id))
      await fetchSets()
      notify('Tanong ay matagumpay na natanggal.', 'success')
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const allCategories = ['all', ...Array.from(new Set(sets.map(s => s.category).filter(Boolean)))]

  const filteredSets = sets.filter(s =>
    (s.title?.toLowerCase().includes(setSearch.toLowerCase()) ||
     s.category?.toLowerCase().includes(setSearch.toLowerCase())) &&
    (filterCat === 'all' || s.category === filterCat)
  )

  const grouped = filteredSets.reduce((acc, s) => {
    const cat = s.category || 'Walang Kategorya'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(s)
    return acc
  }, {})

  const totalQuestions = sets.reduce((acc, s) => acc + (s.quiz_questions?.[0]?.count ?? 0), 0)
  const catSuggestions = SUGGESTED_CATEGORIES.filter(c =>
    c.toLowerCase().includes(catInput.toLowerCase()) && c !== setForm.category
  )

  const statCards = [
    { label: 'Kabuuang Set',      val: sets.length,                                                        icon: <MdInventory />, accent: '#4fa3e8' },
    { label: 'Kabuuang Tanong',   val: totalQuestions,                                                     icon: <MdHelpOutline />, accent: '#a78bfa' },
    { label: 'Mga Kategorya',     val: allCategories.length - 1,                                           icon: <MdFolder />, accent: '#22d3a5' },
    { label: 'Para sa Pagsusuri', val: sets.filter(s => (s.quiz_questions?.[0]?.count ?? 0) === 0).length, icon: <MdWarning />, accent: '#f5b942' },
  ]

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="qz-page">
      {/* Header */}
      <div className="qz-page-header">
        <div>
          <p className="qz-eyebrow">Palaisipan · Pamamahala</p>
          <h1 className="qz-page-title">Mga Set ng Quiz</h1>
        </div>
        <button className="qz-btn qz-btn--primary" onClick={openAddSet}>
          <PlusIcon /> Bagong Set
        </button>
      </div>

      {/* Stats */}
      <div className="qz-stats-row">
        {statCards.map(s => (
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
          <SearchIcon />
          <input
            className="qz-search"
            placeholder="Hanapin ang set o kategorya…"
            value={setSearch}
            onChange={e => setSetSearch(e.target.value)}
          />
        </div>
        <div className="qz-cat-filters">
          {allCategories.map(cat => (
            <button
              key={cat}
              className={`qz-cat-filter${filterCat === cat ? ' qz-cat-filter--active' : ''}`}
              onClick={() => setFilterCat(cat)}
            >
              {cat === 'all' ? 'Lahat' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Two-panel layout */}
      <div className={`qz-panels${activeSet ? ' qz-panels--split' : ''}`}>

        {/* Sets panel */}
        <div className="qz-panel">
          {loadingSets ? (
            <div className="qz-loading"><div className="qz-spinner" /><span>Naglo-load…</span></div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="qz-empty-state">
              <div className="qz-empty-icon"><MdInbox /></div>
              <p>Walang mga quiz set na nahanap.</p>
              <button className="qz-btn qz-btn--primary" onClick={openAddSet}>Gumawa ng Set</button>
            </div>
          ) : (
            Object.entries(grouped).map(([cat, catSets]) => (
              <div key={cat} className="qz-category-group">
                <div className="qz-category-header">
                  <span className="qz-category-name"><FolderIcon /> {cat}</span>
                  <span className="qz-category-count">{catSets.length} set{catSets.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="qz-set-list">
                  {catSets.map(s => {
                    const qCount   = s.quiz_questions?.[0]?.count ?? 0
                    const isActive = activeSet?.id === s.id
                    return (
                      <div
                        key={s.id}
                        className={`qz-set-card${isActive ? ' qz-set-card--active' : ''}`}
                        onClick={() => openSet(s)}
                      >
                        <div className="qz-set-card-main">
                          <div className="qz-set-card-top">
                            <span className="qz-set-title">{s.title}</span>
                            <div className="qz-set-card-actions" onClick={e => e.stopPropagation()}>
                              <button className="qz-icon-btn qz-icon-btn--edit"   onClick={e => openEditSet(s, e)}              title="I-edit">    <EditIcon />   </button>
                              <button className="qz-icon-btn qz-icon-btn--delete" onClick={e => handleDeleteSet(s.id, s.title, e)} title="Tanggalin"><DeleteIcon /> </button>
                            </div>
                          </div>
                          {s.description && <p className="qz-set-desc">{s.description}</p>}
                          <div className="qz-set-card-footer">
                            <DifficultyBadge difficulty={s.difficulty} />
                            <span className="qz-set-q-count">
                              <HelpIcon />
                              {qCount} tanong
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Questions panel */}
        {activeSet && (
          <div className="qz-panel qz-panel--questions">
            <div className="qz-qs-header">
              <div className="qz-qs-header-left">
                <button className="qz-icon-btn" onClick={() => setActiveSet(null)} title="Isara">
                  <CloseIcon />
                </button>
                <div>
                  <p className="qz-qs-set-name">{activeSet.title}</p>
                  <p className="qz-qs-set-meta">
                    <CategoryBadge category={activeSet.category} />
                    <span>·</span>
                    <span>{questions.length} tanong</span>
                  </p>
                </div>
              </div>
              <button className="qz-btn qz-btn--primary qz-btn--sm" onClick={openAddQ}>
                <PlusIcon /> Tanong
              </button>
            </div>

            {loadingQ ? (
              <div className="qz-loading"><div className="qz-spinner" /><span>Naglo-load…</span></div>
            ) : questions.length === 0 ? (
              <div className="qz-empty-state qz-empty-state--sm">
                <div className="qz-empty-icon"><MdEdit /></div>
                <p>Wala pang mga tanong dito.</p>
                <button className="qz-btn qz-btn--primary qz-btn--sm" onClick={openAddQ}>Magdagdag ng Tanong</button>
              </div>
            ) : (
              <div className="qz-question-list">
                {questions.map((q, idx) => (
                  <div key={q.id} className="qz-question-card">
                    <div className="qz-question-num">{idx + 1}</div>
                    <div className="qz-question-body">
                      <p className="qz-question-text">{q.question}</p>
                      <div className="qz-question-footer">
                        <TypeBadge type={q.type} />
                        {q.type === 'multiple_choice' && (
                          <span className="qz-question-hint">Sagot: {q.choices?.[q.correct_index] ?? '—'}</span>
                        )}
                        {q.type === 'true_false' && (
                          <span className="qz-question-hint">Sagot: {q.correct_tf ? 'Tama' : 'Mali'}</span>
                        )}
                      </div>
                    </div>
                    <div className="qz-question-actions">
                      <button className="qz-icon-btn qz-icon-btn--edit"   onClick={() => openEditQ(q)}           title="I-edit">    <EditIcon />   </button>
                      <button className="qz-icon-btn qz-icon-btn--delete" onClick={() => handleDeleteQ(q.id, q.question)} title="Tanggalin"><DeleteIcon /> </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Set modal */}
      {setModal && (
        <div className="qz-backdrop" onClick={e => e.target === e.currentTarget && closeSetModal()}>
          <div className="qz-modal">
            <div className="qz-modal-header">
              <h2>{editingSet ? 'I-edit ang Set' : 'Bagong Set ng Quiz'}</h2>
              <button className="qz-icon-btn" onClick={closeSetModal}><CloseIcon /></button>
            </div>
            <div className="qz-modal-body">
              {setError && <div className="qz-form-error">{setError}</div>}
              <div className="qz-form-grid">
                {/* Title */}
                <div className="qz-form-group qz-form-group--full">
                  <label>Titulo *</label>
                  <input
                    ref={titleRef} value={setForm.title} className="qz-input"
                    placeholder="hal. Pagsusulit sa Kasaysayan ng Pilipinas"
                    onChange={e => setSetForm(f => ({ ...f, title: e.target.value }))}
                  />
                </div>

                {/* Category with autocomplete */}
                <div className="qz-form-group qz-form-group--full" style={{ position: 'relative' }}>
                  <label>Kategorya</label>
                  <input
                    value={catInput} className="qz-input"
                    placeholder="hal. Kasaysayan, Agham…"
                    onChange={e => { setCatInput(e.target.value); setSetForm(f => ({ ...f, category: e.target.value })); setShowCatSug(true) }}
                    onFocus={() => setShowCatSug(true)}
                    onBlur={() => setTimeout(() => setShowCatSug(false), 150)}
                  />
                  {showCatSug && catSuggestions.length > 0 && (
                    <div className="qz-cat-dropdown">
                      {catSuggestions.map(c => (
                        <button key={c} className="qz-cat-option"
                          onMouseDown={() => { setCatInput(c); setSetForm(f => ({ ...f, category: c })); setShowCatSug(false) }}
                        >{c}</button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Difficulty */}
                <div className="qz-form-group">
                  <label>Antas ng Hirap</label>
                  <div className="qz-difficulty-picker">
                    {Object.entries(DIFFICULTY_META).map(([val, meta]) => (
                      <button
                        key={val} type="button"
                        className={`qz-diff-option${setForm.difficulty === val ? ' qz-diff-option--active' : ''}`}
                        style={{ '--dc': meta.color, '--db': meta.bg, '--dbd': meta.border }}
                        onClick={() => setSetForm(f => ({ ...f, difficulty: val }))}
                      >
                        {meta.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div className="qz-form-group qz-form-group--full">
                  <label>Paglalarawan <span className="qz-label-hint">(opsyonal)</span></label>
                  <textarea
                    value={setForm.description} rows={2} className="qz-input qz-textarea"
                    placeholder="Maikling paglalarawan ng set na ito…"
                    onChange={e => setSetForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="qz-modal-footer">
              <button className="qz-btn qz-btn--ghost" onClick={closeSetModal} disabled={savingSet}>Kanselahin</button>
              <button className="qz-btn qz-btn--primary" onClick={handleSaveSet} disabled={savingSet}>
                {savingSet ? <><div className="qz-spinner qz-spinner--sm" /> Sine-save…</> : editingSet ? 'I-update' : 'Idagdag'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question modal */}
      {qModal && (
        <div className="qz-backdrop" onClick={e => e.target === e.currentTarget && closeQModal()}>
          <div className="qz-modal qz-modal--wide">
            <div className="qz-modal-header">
              <h2>{editingQ ? 'I-edit ang Tanong' : `Bagong Tanong — ${activeSet?.title}`}</h2>
              <button className="qz-icon-btn" onClick={closeQModal}><CloseIcon /></button>
            </div>
            <div className="qz-modal-body">
              <QuestionForm form={qForm} onChange={setQForm} error={qError} />
            </div>
            <div className="qz-modal-footer">
              <button className="qz-btn qz-btn--ghost" onClick={closeQModal} disabled={savingQ}>Kanselahin</button>
              <button className="qz-btn qz-btn--primary" onClick={handleSaveQ} disabled={savingQ}>
                {savingQ ? <><div className="qz-spinner qz-spinner--sm" /> Sine-save…</> : editingQ ? 'I-update' : 'Idagdag'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}