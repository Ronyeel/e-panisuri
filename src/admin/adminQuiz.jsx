// adminQuiz.jsx
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../API/supabase'

const EMPTY_FORM = {
  question:     '',
  choices:      ['', '', '', ''],
  correctindex: 0,
  explanation:  '',
  difficulty:   'medium',
  category:     '',
}

const DIFFICULTY_COLORS = {
  easy:   '#10B981',
  medium: '#F59E0B',
  hard:   '#EF4444',
}

export default function AdminQuiz() {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [form,    setForm]    = useState(EMPTY_FORM)
  const [editing, setEditing] = useState(null)
  const [modal,   setModal]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const qRef = useRef(null)

  const fetchItems = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('quiz')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) console.error(error)
    else setItems(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchItems() }, [])

  const openAdd = () => {
    setForm(EMPTY_FORM)
    setEditing(null)
    setError('')
    setModal(true)
    setTimeout(() => qRef.current?.focus(), 50)
  }

  const openEdit = (item) => {
    setForm({
      question:     item.question     ?? '',
      choices:      item.choices      ?? ['', '', '', ''],
      correctindex: item.correctindex ?? 0,
      explanation:  item.explanation  ?? '',
      difficulty:   item.difficulty   ?? 'medium',
      category:     item.category     ?? '',
    })
    setEditing(item.id)
    setError('')
    setModal(true)
    setTimeout(() => qRef.current?.focus(), 50)
  }

  const closeModal = () => { setModal(false); setEditing(null); setError('') }

  const validate = () => {
    if (!form.question.trim()) return 'Kailangan ang tanong.'
    const filled = form.choices.filter(c => c.trim())
    if (filled.length < 2)    return 'Kailangan ng hindi bababa sa 2 pagpipilian.'
    if (!form.choices[form.correctindex]?.trim()) return 'Ang tamang sagot ay walang laman.'
    return ''
  }

  const setChoice = (i, val) => {
    setForm(f => {
      const choices = [...f.choices]
      choices[i] = val
      return { ...f, choices }
    })
  }

  const handleSave = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setSaving(true)
    setError('')

    const payload = {
      question:     form.question.trim(),
      choices:      form.choices.map(c => c.trim()),
      correctindex: Number(form.correctindex),
      explanation:  form.explanation.trim() || null,
      difficulty:   form.difficulty,
      category:     form.category.trim() || null,
      updated_at:   new Date().toISOString(),
    }

    try {
      if (editing) {
        const { error } = await supabase.from('quiz').update(payload).eq('id', editing)
        if (error) throw error
      } else {
        const { error } = await supabase.from('quiz').insert([payload])
        if (error) throw error
      }
      await fetchItems()
      closeModal()
    } catch (e) {
      console.error(e)
      setError('Hindi ma-save. Subukan ulit.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id, question) => {
    if (!window.confirm(`Tanggalin ang tanong na ito?\n\n"${question}"`)) return
    const { error } = await supabase.from('quiz').delete().eq('id', id)
    if (error) { alert('Hindi matanggal. Subukan ulit.') }
    else { setItems(prev => prev.filter(i => i.id !== id)) }
  }

  const filtered = items.filter(q =>
    q.question?.toLowerCase().includes(search.toLowerCase()) ||
    q.category?.toLowerCase().includes(search.toLowerCase())
  )

  const byDifficulty = (d) => items.filter(i => i.difficulty === d).length

  return (
    <div className="ep-page">
      <div className="ep-page-header">
        <div>
          <p className="ep-page-eyebrow">Palaisipan</p>
          <h1 className="ep-page-title">Quiz</h1>
        </div>
        <button className="ep-btn ep-btn--primary" onClick={openAdd}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Magdagdag
        </button>
      </div>

      {/* Stats */}
      <div className="ep-stats-grid">
        {[
          { label: 'Kabuuan',    val: items.length,           icon: '', accent: '#3B82F6' },
          { label: 'Madali',     val: byDifficulty('easy'),   icon: '', accent: '#10B981' },
          { label: 'Katamtaman', val: byDifficulty('medium'), icon: '', accent: '#F59E0B' },
          { label: 'Mahirap',    val: byDifficulty('hard'),   icon: '', accent: '#EF4444' },
        ].map(s => (
          <div className="ep-stat-card" key={s.label} style={{ '--accent': s.accent }}>
            <div className="ep-stat-icon">{s.icon}</div>
            <div>
              <p className="ep-stat-label">{s.label}</p>
              <p className="ep-stat-val">{s.val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="ep-card">
        <div className="ep-card-header">
          <h2 className="ep-card-title">Lahat ng Tanong</h2>
          <div className="ep-search-wrap">
            <svg className="ep-search-icon" width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input className="ep-search" placeholder="Hanapin ang tanong..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="ep-loading"><div className="ep-spinner" /><span>Naglo-load…</span></div>
        ) : (
          <div className="ep-table-wrap">
            <table className="ep-table">
              <thead>
                <tr>
                  <th style={{ width: '45%' }}>Tanong</th>
                  <th>Kategorya</th>
                  <th>Hirap</th>
                  <th>Pagpipilian</th>
                  <th>Aksyon</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="ep-empty">Walang nahanap na tanong.</td></tr>
                ) : filtered.map(q => (
                  <tr key={q.id} className="ep-table-row">
                    <td style={{ color: '#e0e0e0', maxWidth: 300 }}>
                      <span style={{ display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {q.question}
                      </span>
                    </td>
                    <td style={{ color: '#aaa' }}>{q.category || '—'}</td>
                    <td>
                      <span style={{
                        padding: '2px 10px', borderRadius: 99, fontSize: 11,
                        fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
                        background: (DIFFICULTY_COLORS[q.difficulty] ?? '#555') + '22',
                        color: DIFFICULTY_COLORS[q.difficulty] ?? '#aaa',
                        border: `1px solid ${DIFFICULTY_COLORS[q.difficulty] ?? '#555'}44`,
                      }}>
                        {q.difficulty}
                      </span>
                    </td>
                    <td style={{ color: '#aaa' }}>{q.choices?.filter(Boolean).length ?? 0}</td>
                    <td>
                      <div className="ep-actions">
                        <button className="ep-btn ep-btn--ghost"  onClick={() => openEdit(q)}>Edit</button>
                        <button className="ep-btn ep-btn--danger" onClick={() => handleDelete(q.id, q.question)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="ep-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="ep-modal">
            <div className="ep-modal-header">
              <h2>{editing ? 'I-edit ang Tanong' : 'Bagong Tanong'}</h2>
              <button className="ep-modal-close" onClick={closeModal}>✕</button>
            </div>

            <div className="ep-modal-body">
              {error && <p className="ep-form-error">{error}</p>}
              <div className="ep-form-grid">

                <div className="ep-form-group ep-form-group--full">
                  <label>Tanong *</label>
                  <textarea ref={qRef} value={form.question} rows={3}
                    className="ep-input ep-textarea" placeholder="Isulat ang tanong dito..."
                    onChange={e => setForm(f => ({ ...f, question: e.target.value }))} />
                </div>

                <div className="ep-form-group">
                  <label>Kategorya</label>
                  <input value={form.category} className="ep-input"
                    placeholder="hal. Panitikan, Kasaysayan"
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
                </div>

                <div className="ep-form-group">
                  <label>Antas ng Hirap</label>
                  <select value={form.difficulty} className="ep-input"
                    onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}>
                    <option value="easy">Madali</option>
                    <option value="medium">Katamtaman</option>
                    <option value="hard">Mahirap</option>
                  </select>
                </div>

                <div className="ep-form-group ep-form-group--full">
                  <label>
                    Mga Pagpipilian *{' '}
                    <span style={{ color: '#555', fontWeight: 400 }}>(lagyan ng tsek ang tamang sagot)</span>
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                    {form.choices.map((c, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="radio"
                          name="correct"
                          checked={form.correctindex === i}
                          onChange={() => setForm(f => ({ ...f, correctindex: i }))}
                          style={{ accentColor: '#6366f1', width: 16, height: 16, flexShrink: 0 }}
                        />
                        <input
                          value={c}
                          onChange={e => setChoice(i, e.target.value)}
                          className="ep-input"
                          style={{ flex: 1 }}
                          placeholder={`Pagpipilian ${i + 1}${i < 2 ? ' *' : ''}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="ep-form-group ep-form-group--full">
                  <label>
                    Paliwanag{' '}
                    <span style={{ color: '#555', fontWeight: 400 }}>(opsyonal)</span>
                  </label>
                  <textarea value={form.explanation} rows={3}
                    className="ep-input ep-textarea"
                    placeholder="Ipaliwanag kung bakit ito ang tamang sagot..."
                    onChange={e => setForm(f => ({ ...f, explanation: e.target.value }))} />
                </div>

              </div>
            </div>

            <div className="ep-modal-footer">
              <button className="ep-btn ep-btn--ghost"   onClick={closeModal} disabled={saving}>Kanselahin</button>
              <button className="ep-btn ep-btn--primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Sine-save…' : editing ? 'I-update' : 'Idagdag'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}