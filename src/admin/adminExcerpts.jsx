// adminExcerpts.jsx
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../API/supabase'

const EMPTY_FORM = {
  bookTitle: '',
  author:    '',
  cover:     '',
  tag:       '',
  year:      '',
  excerpt:   '',
  pdf:       '',
}

export default function AdminExcerpts() {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [form,    setForm]    = useState(EMPTY_FORM)
  const [editing, setEditing] = useState(null)
  const [modal,   setModal]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const titleRef = useRef(null)

  /* fetch */
  const fetchItems = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('excerpts')
      .select('*')
      .order('id', { ascending: true })
    if (error) console.error(error)
    else setItems(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchItems() }, [])

  /* modal helpers */
  const openAdd = () => {
    setForm(EMPTY_FORM); setEditing(null); setError(''); setModal(true)
    setTimeout(() => titleRef.current?.focus(), 50)
  }

  const openEdit = (item) => {
    setForm({
      bookTitle: item.bookTitle ?? '',
      author:    item.author    ?? '',
      cover:     item.cover     ?? '',
      tag:       item.tag       ?? '',
      year:      item.year      ?? '',
      excerpt:   item.excerpt   ?? '',
      pdf:       item.pdf       ?? '',
    })
    setEditing(item.id); setError(''); setModal(true)
    setTimeout(() => titleRef.current?.focus(), 50)
  }

  const closeModal = () => { setModal(false); setEditing(null); setError('') }

  const validate = () => {
    if (!form.bookTitle.trim()) return 'Kailangan ang pamagat ng libro.'
    if (form.year && !/^\d{4}$/.test(String(form.year).trim()))
      return 'Ang taon ay dapat 4 na digit (hal. 2024).'
    return ''
  }

  /* save */
  const handleSave = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setSaving(true); setError('')
    const trim = (v) => (v && String(v).trim()) || null
    const payload = {
      bookTitle: form.bookTitle.trim(),
      author:    trim(form.author),
      cover:     trim(form.cover),
      tag:       trim(form.tag),
      year:      form.year ? parseInt(form.year, 10) : null,
      excerpt:   trim(form.excerpt),
      pdf:       trim(form.pdf),
    }
    try {
      if (editing) {
        const { error } = await supabase.from('excerpts').update(payload).eq('id', editing)
        if (error) throw error
      } else {
        const { error } = await supabase.from('excerpts').insert([payload])
        if (error) throw error
      }
      await fetchItems(); closeModal()
    } catch (e) {
      console.error(e); setError('Hindi ma-save. Subukan ulit.')
    } finally {
      setSaving(false)
    }
  }

  /* delete */
  const handleDelete = async (id, title) => {
    if (!window.confirm(`Tanggalin ang "${title}"?`)) return
    const { error } = await supabase.from('excerpts').delete().eq('id', id)
    if (error) { alert('Hindi matanggal. Subukan ulit.') }
    else { setItems(prev => prev.filter(i => i.id !== id)) }
  }

  const filtered = items.filter(i =>
    i.bookTitle?.toLowerCase().includes(search.toLowerCase()) ||
    i.author?.toLowerCase().includes(search.toLowerCase())    ||
    i.tag?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="ep-page">

      {/* Header */}
      <div className="ep-page-header">
        <div>
          <p className="ep-page-eyebrow">Mga Sipi</p>
          <h1 className="ep-page-title">Excerpts</h1>
        </div>
        <button className="ep-btn ep-btn--primary" onClick={openAdd}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Magdagdag
        </button>
      </div>

      {/* Stats */}
      <div className="ep-stats-grid">
        {[
          { label: 'Kabuuan',   val: items.length,                         icon: '', accent: '#6c63ff' },
          { label: 'May PDF',   val: items.filter(i => i.pdf).length,      icon: '', accent: '#22d3a5' },
          { label: 'May Cover', val: items.filter(i => i.cover).length,    icon: '', accent: '#f5b942' },
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
          <h2 className="ep-card-title">Lahat ng Sipi</h2>
          <div className="ep-search-wrap">
            <svg className="ep-search-icon" width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="ep-search"
              placeholder="Hanapin ang sipi…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="ep-loading"><div className="ep-spinner" /><span>Naglo-load…</span></div>
        ) : (
          <div className="ep-table-wrap">
            <table className="ep-table">
              <thead>
                <tr>
                  <th>Libro</th>
                  <th>May-akda</th>
                  <th>Tag</th>
                  <th>Taon</th>
                  <th>PDF</th>
                  <th>Aksyon</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="ep-empty">Walang nahanap na sipi.</td></tr>
                ) : filtered.map(item => (
                  <tr key={item.id} className="ep-table-row">
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {item.cover
                          ? <img src={item.cover} alt=""
                              style={{ width: 30, height: 42, objectFit: 'cover', borderRadius: 4,
                                border: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }} />
                          : <div style={{ width: 30, height: 42, background: 'var(--bg-3)', borderRadius: 4,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 14, border: '1px solid var(--border)', flexShrink: 0 }}>📖</div>
                        }
                        <div style={{ overflow: 'hidden' }}>
                          <span style={{ fontWeight: 500, color: 'var(--text-1)', display: 'block', whiteSpace: 'nowrap',
                            overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                            {item.bookTitle}
                          </span>
                          {item.excerpt && (
                            <span style={{ color: 'var(--text-3)', fontSize: 11.5, fontStyle: 'italic',
                              display: 'block', maxWidth: 200, overflow: 'hidden',
                              textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              "{item.excerpt}"
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{item.author || '—'}</td>
                    <td>
                      {item.tag
                        ? <span className="ep-pill" style={{
                            background: 'rgba(108,99,255,0.1)', color: '#a89cff',
                            border: '1px solid rgba(108,99,255,0.2)' }}>
                            {item.tag}
                          </span>
                        : <span style={{ color: 'var(--text-3)' }}>—</span>
                      }
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>{item.year || '—'}</td>
                    <td>
                      {item.pdf
                        ? <a href={item.pdf} target="_blank" rel="noopener noreferrer">
                            <span className="ep-pill ep-pill--admin">May PDF</span>
                          </a>
                        : <span style={{ color: 'var(--text-3)' }}>—</span>
                      }
                    </td>
                    <td>
                      <div className="ep-actions">
                        <button className="ep-btn ep-btn--ghost" onClick={() => openEdit(item)}>Edit</button>
                        <button className="ep-btn ep-btn--danger" onClick={() => handleDelete(item.id, item.bookTitle)}>Delete</button>
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
              <h2>{editing ? 'I-edit ang Sipi' : 'Bagong Sipi'}</h2>
              <button className="ep-modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="ep-modal-body">
              {error && <p className="ep-form-error">{error}</p>}
              <div className="ep-form-grid">

                <div className="ep-form-group ep-form-group--full">
                  <label>Pamagat ng Libro *</label>
                  <input ref={titleRef} value={form.bookTitle} className="ep-input"
                    placeholder="hal. Maynila sa mga Kuko ng Liwanag"
                    onChange={e => setForm(f => ({ ...f, bookTitle: e.target.value }))} />
                </div>

                <div className="ep-form-group">
                  <label>May-akda</label>
                  <input value={form.author} className="ep-input"
                    placeholder="Pangalan ng may-akda"
                    onChange={e => setForm(f => ({ ...f, author: e.target.value }))} />
                </div>

                <div className="ep-form-group">
                  <label>Tag</label>
                  <input value={form.tag} className="ep-input"
                    placeholder="hal. pag-ibig, kalayaan"
                    onChange={e => setForm(f => ({ ...f, tag: e.target.value }))} />
                </div>

                <div className="ep-form-group">
                  <label>Taon</label>
                  <input value={form.year} className="ep-input"
                    placeholder="hal. 2024" maxLength={4}
                    onChange={e => setForm(f => ({ ...f, year: e.target.value }))} />
                </div>

                <div className="ep-form-group">
                  <label>Cover URL</label>
                  <input value={form.cover} className="ep-input"
                    placeholder="https://…"
                    onChange={e => setForm(f => ({ ...f, cover: e.target.value }))} />
                </div>

                <div className="ep-form-group ep-form-group--full">
                  <label>PDF URL</label>
                  <input value={form.pdf} className="ep-input"
                    placeholder="https://…"
                    onChange={e => setForm(f => ({ ...f, pdf: e.target.value }))} />
                </div>

                <div className="ep-form-group ep-form-group--full">
                  <label>Sipi (Excerpt)</label>
                  <textarea value={form.excerpt} className="ep-input ep-textarea"
                    placeholder="I-paste ang sipi dito…" rows={5}
                    onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))} />
                </div>

              </div>
            </div>
            <div className="ep-modal-footer">
              <button className="ep-btn ep-btn--ghost" onClick={closeModal} disabled={saving}>Kanselahin</button>
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