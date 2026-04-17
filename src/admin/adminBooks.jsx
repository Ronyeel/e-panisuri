// adminBooks.jsx
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../API/supabase'
import { MdAdd, MdSearch, MdLibraryBooks, MdPictureAsPdf, MdOutlineDescription } from 'react-icons/md'
import { useUI } from '../context/UIContext'

// ─────────────────────────────────────────────
// Supabase storage bucket names — adjust if yours differ
const COVER_BUCKET = 'covers'
const PDF_BUCKET   = 'pdfs'

// Supabase free-tier DB row limit for binary/text fields.
// PDFs larger than this go to books.json instead.
const SUPABASE_PDF_LIMIT_BYTES = 50 * 1024 * 1024 // 50 MB

const EMPTY_FORM = {
  title:      '',
  author:     '',
  genre:      '',
  cover:      '',       // final URL (after upload or manual entry)
  coverFile:  null,     // File object from <input type="file">
  quote:      '',
  year:       '',
  pdf:        '',       // final URL
  pdfFile:    null,     // File object
  is_excerpt: false,
}

// ─────────────────────────────────────────────
// helpers

/** Upload a file to a Supabase Storage bucket, return its public URL. */
async function uploadToStorage(bucket, file, pathPrefix = '') {
  const ext  = file.name.split('.').pop()
  const path = `${pathPrefix}${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Append a book entry to books.json via a Supabase Edge Function.
 * If you don't have that function, this will log a warning and return
 * the local path so the developer can handle it manually.
 *
 * Adjust the Edge Function name / endpoint to match your setup.
 */
async function appendToLocalJson(entry) {
  try {
    const { data, error } = await supabase.functions.invoke('append-book-json', {
      body: entry,
    })
    if (error) throw error
    return data?.path ?? entry.pdf
  } catch (e) {
    console.warn(
      '[AdminBooks] Could not call Edge Function "append-book-json". ' +
      'PDF exceeds 50 MB — add it to src/data/books.json manually.',
      e
    )
    // Return a local /books/<filename> path as a fallback placeholder
    return `/books/${entry.pdf.split('/').pop()}`
  }
}

export default function AdminBooks() {
  const { notify, confirm } = useUI()
  const [books,   setBooks]   = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [form,    setForm]    = useState(EMPTY_FORM)
  const [editing, setEditing] = useState(null)
  const [modal,   setModal]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [saveMsg, setSaveMsg] = useState('')   // progress message during upload
  const [error,   setError]   = useState('')
  const titleRef   = useRef(null)
  const coverInput = useRef(null)
  const pdfInput   = useRef(null)

  // ── fetch ──────────────────────────────────
  const fetchBooks = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('books').select('*').order('year', { ascending: true })
    if (error) console.error(error)
    else setBooks(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchBooks() }, [])

  // ── modal helpers ──────────────────────────
  const openAdd = () => {
    setForm(EMPTY_FORM); setEditing(null); setError(''); setSaveMsg(''); setModal(true)
    setTimeout(() => titleRef.current?.focus(), 50)
  }

  const openEdit = (book) => {
    setForm({
      title:      book.title      ?? '',
      author:     book.author     ?? '',
      genre:      book.genre      ?? '',
      cover:      book.cover      ?? '',
      coverFile:  null,
      quote:      book.quote      ?? '',
      year:       book.year       ?? '',
      pdf:        book.pdf        ?? '',
      pdfFile:    null,
      is_excerpt: book.is_excerpt ?? false,
    })
    setEditing(book.id); setError(''); setSaveMsg(''); setModal(true)
    setTimeout(() => titleRef.current?.focus(), 50)
  }

  const closeModal = () => {
    setModal(false); setEditing(null); setError(''); setSaveMsg('')
    // reset file inputs
    if (coverInput.current) coverInput.current.value = ''
    if (pdfInput.current)   pdfInput.current.value   = ''
  }

  // ── file pickers ───────────────────────────
  const handleCoverFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setForm(f => ({ ...f, coverFile: file, cover: '' }))
  }

  const handlePdfFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setForm(f => ({ ...f, pdfFile: file, pdf: '' }))
  }

  // ── validation ─────────────────────────────
  const validate = () => {
    if (!form.title.trim())  return 'Kailangan ang pamagat.'
    if (!form.author.trim()) return 'Kailangan ang pangalan ng may-akda.'
    if (form.year && !/^\d{4}$/.test(String(form.year).trim()))
      return 'Ang taon ay dapat 4 na digit (hal. 2024).'
    return ''
  }

  // ── save ───────────────────────────────────
  const handleSave = async () => {
    const err = validate()
    if (err) { setError(err); return }

    setSaving(true); setError(''); setSaveMsg('')

    try {
      let coverUrl = form.cover
      let pdfUrl   = form.pdf
      let pdfInJson = false

      // 1. Upload cover image if a file was chosen
      if (form.coverFile) {
        setSaveMsg('Ina-upload ang cover…')
        coverUrl = await uploadToStorage(COVER_BUCKET, form.coverFile, 'covers/')
      }

      // 2. Handle PDF
      if (form.pdfFile) {
        if (form.pdfFile.size > SUPABASE_PDF_LIMIT_BYTES) {
          // Too large for Supabase storage → route to books.json
          setSaveMsg('Malaki ang PDF, idina-dagdag sa books.json…')
          pdfInJson = true
          // We still upload the file to storage so it's accessible via URL;
          // only the *reference* goes into JSON instead of the DB row.
          pdfUrl = await uploadToStorage(PDF_BUCKET, form.pdfFile, 'pdfs/')
        } else {
          setSaveMsg('Ina-upload ang PDF…')
          pdfUrl = await uploadToStorage(PDF_BUCKET, form.pdfFile, 'pdfs/')
        }
      }

      setSaveMsg('Sine-save…')

      const trim = (v) => (v && String(v).trim()) || null
      const payload = {
        title:      form.title.trim(),
        author:     form.author.trim(),
        genre:      trim(form.genre),
        cover:      coverUrl  || null,
        quote:      trim(form.quote),
        year:       form.year ? parseInt(form.year, 10) : null,
        pdf:        pdfInJson ? null : (pdfUrl || null),   // omit from DB if going to JSON
        is_excerpt: form.is_excerpt,
      }

      if (editing) {
        const { error } = await supabase.from('books').update(payload).eq('id', editing)
        if (error) throw error

        // If PDF was rerouted to JSON and we're editing, append the JSON entry too
        if (pdfInJson) {
          await appendToLocalJson({ id: editing, pdf: pdfUrl, ...payload })
        }
      } else {
        const newId = crypto.randomUUID()
        const { error } = await supabase.from('books').insert([{ id: newId, ...payload }])
        if (error) throw error

        if (pdfInJson) {
          await appendToLocalJson({ id: newId, pdf: pdfUrl, ...payload })
        }
      }

      await fetchBooks()
      closeModal()

    } catch (e) {
      console.error(e)
      setError('Hindi ma-save. Subukan ulit.')
    } finally {
      setSaving(false)
      setSaveMsg('')
    }
  }

  // ── delete ─────────────────────────────────
  const handleDelete = async (id, title) => {
    const ok = await confirm({
      title:        `Tanggalin ang "${title}"?`,
      body:         'Permanente itong matatanggal. Hindi ito maibabalik.',
      confirmLabel: 'Tanggalin',
      danger:       true,
    })
    if (!ok) return
    const { error } = await supabase.from('books').delete().eq('id', id)
    if (error) {
      notify('Hindi matanggal. Subukan ulit.', 'error')
    } else {
      setBooks(prev => prev.filter(b => b.id !== id))
      notify(`"${title}" ay matagumpay na natanggal.`, 'success')
    }
  }

  // ── filter ─────────────────────────────────
  const filtered = books.filter(b =>
    b.title?.toLowerCase().includes(search.toLowerCase())  ||
    b.author?.toLowerCase().includes(search.toLowerCase()) ||
    b.genre?.toLowerCase().includes(search.toLowerCase())
  )

  // ── render ─────────────────────────────────
  return (
    <div className="ep-page">

      {/* Header */}
      <div className="ep-page-header">
        <div>
          <p className="ep-page-eyebrow">Koleksyon</p>
          <h1 className="ep-page-title">Books</h1>
        </div>
        <button className="ep-btn ep-btn--primary" onClick={openAdd}>
          <MdAdd size={16} />
          Magdagdag
        </button>
      </div>

      {/* Stats */}
      <div className="ep-stats-grid">
        {[
          { label: 'Kabuuan', val: books.length,                           icon: <MdLibraryBooks />, accent: '#6c63ff' },
          { label: 'May PDF', val: books.filter(b => b.pdf).length,        icon: <MdPictureAsPdf />, accent: '#22d3a5' },
          { label: 'Excerpt', val: books.filter(b => b.is_excerpt).length, icon: <MdOutlineDescription />, accent: '#f5b942' },
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
          <h2 className="ep-card-title">Lahat ng Libro</h2>
          <div className="ep-search-wrap">
            <MdSearch size={16} className="ep-search-icon" />
            <input className="ep-search" placeholder="Hanapin ang libro…"
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
                  <th>Pamagat</th>
                  <th>May-akda</th>
                  <th>Genre</th>
                  <th>Taon</th>
                  <th>PDF</th>
                  <th>Excerpt</th>
                  <th>Aksyon</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="ep-empty">Walang nahanap na libro.</td></tr>
                ) : filtered.map(b => (
                  <tr key={b.id} className="ep-table-row">
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {b.cover
                          ? <img src={b.cover} alt=""
                              style={{ width: 30, height: 42, objectFit: 'cover', borderRadius: 4,
                                border: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }} />
                          : <div style={{ width: 30, height: 42, background: 'var(--bg-3)', borderRadius: 4,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 14, border: '1px solid var(--border)', flexShrink: 0 }}>📖</div>
                        }
                        <div style={{ overflow: 'hidden' }}>
                          <span style={{ fontWeight: 500, color: 'var(--text-1)', display: 'block',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                            {b.title}
                          </span>
                          {b.quote && (
                            <span style={{ color: 'var(--text-3)', fontSize: 11.5, fontStyle: 'italic',
                              display: 'block', maxWidth: 200, overflow: 'hidden',
                              textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              "{b.quote}"
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{b.author || '—'}</td>
                    <td style={{ color: 'var(--text-2)' }}>{b.genre  || '—'}</td>
                    <td style={{ color: 'var(--text-2)' }}>{b.year   || '—'}</td>
                    <td>
                      {b.pdf
                        ? <a href={b.pdf} target="_blank" rel="noopener noreferrer">
                            <span className="ep-pill ep-pill--admin">May PDF</span>
                          </a>
                        : <span style={{ color: 'var(--text-3)' }}>—</span>
                      }
                    </td>
                    <td>
                      <span className={`ep-pill ep-pill--${b.is_excerpt ? 'admin' : 'user'}`}>
                        {b.is_excerpt ? 'Oo' : 'Hindi'}
                      </span>
                    </td>
                    <td>
                      <div className="ep-actions">
                        <button className="ep-btn ep-btn--ghost" onClick={() => openEdit(b)}>Edit</button>
                        <button className="ep-btn ep-btn--danger" onClick={() => handleDelete(b.id, b.title)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {modal && (
        <div className="ep-modal-backdrop" onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="ep-modal">
            <div className="ep-modal-header">
              <h2>{editing ? 'I-edit ang Libro' : 'Bagong Libro'}</h2>
              <button className="ep-modal-close" onClick={closeModal}>✕</button>
            </div>

            <div className="ep-modal-body">
              {error   && <p className="ep-form-error">{error}</p>}
              {saveMsg && (
                <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="ep-spinner" style={{ width: 12, height: 12 }} />
                  {saveMsg}
                </p>
              )}

              <div className="ep-form-grid">

                {/* Pamagat */}
                <div className="ep-form-group ep-form-group--full">
                  <label>Pamagat *</label>
                  <input ref={titleRef} value={form.title} className="ep-input"
                    placeholder="Pamagat ng libro"
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>

                {/* May-akda */}
                <div className="ep-form-group">
                  <label>May-akda *</label>
                  <input value={form.author} className="ep-input"
                    placeholder="Pangalan ng may-akda"
                    onChange={e => setForm(f => ({ ...f, author: e.target.value }))} />
                </div>

                {/* Genre */}
                <div className="ep-form-group">
                  <label>Genre</label>
                  <input value={form.genre} className="ep-input"
                    placeholder="hal. Nobela, Maikling Kwento"
                    onChange={e => setForm(f => ({ ...f, genre: e.target.value }))} />
                </div>

                {/* Taon */}
                <div className="ep-form-group">
                  <label>Taon ng Paglalathala</label>
                  <input value={form.year} className="ep-input"
                    placeholder="hal. 2024" maxLength={4}
                    onChange={e => setForm(f => ({ ...f, year: e.target.value }))} />
                </div>

                {/* Excerpt toggle */}
                <div className="ep-form-group">
                  <label>Excerpt lamang?</label>
                  <select value={form.is_excerpt ? 'true' : 'false'} className="ep-input"
                    onChange={e => setForm(f => ({ ...f, is_excerpt: e.target.value === 'true' }))}>
                    <option value="false">Hindi (buong libro)</option>
                    <option value="true">Oo (excerpt)</option>
                  </select>
                </div>

                {/* ── Cover upload ── */}
                <div className="ep-form-group ep-form-group--full">
                  <label>Cover Image</label>

                  {/* Preview */}
                  {(form.coverFile || form.cover) && (
                    <div style={{ marginBottom: 8 }}>
                      <img
                        src={form.coverFile ? URL.createObjectURL(form.coverFile) : form.cover}
                        alt="cover preview"
                        style={{ height: 80, borderRadius: 6, objectFit: 'cover',
                          border: '1px solid var(--border)' }}
                      />
                    </div>
                  )}

                  {/* File picker button */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="ep-btn ep-btn--ghost"
                      style={{ fontSize: 12, padding: '5px 12px' }}
                      onClick={() => coverInput.current?.click()}
                    >
                      📁 Pumili ng larawan
                    </button>
                    {form.coverFile && (
                      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                        {form.coverFile.name}
                      </span>
                    )}
                    <input
                      ref={coverInput}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleCoverFile}
                    />
                  </div>

                  {/* Manual URL fallback */}
                  <input
                    value={form.coverFile ? '' : form.cover}
                    className="ep-input"
                    style={{ marginTop: 8 }}
                    placeholder="…o i-paste ang image URL"
                    disabled={!!form.coverFile}
                    onChange={e => setForm(f => ({ ...f, cover: e.target.value, coverFile: null }))}
                  />
                  {form.coverFile && (
                    <button
                      type="button"
                      style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4,
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      onClick={() => {
                        setForm(f => ({ ...f, coverFile: null }))
                        if (coverInput.current) coverInput.current.value = ''
                      }}
                    >
                      ✕ Alisin ang file
                    </button>
                  )}
                </div>

                {/* ── PDF upload ── */}
                <div className="ep-form-group ep-form-group--full">
                  <label>
                    PDF
                    <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 6, fontWeight: 400 }}>
                      (higit sa 50 MB → awtomatikong mapupunta sa books.json)
                    </span>
                  </label>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="ep-btn ep-btn--ghost"
                      style={{ fontSize: 12, padding: '5px 12px' }}
                      onClick={() => pdfInput.current?.click()}
                    >
                      📄 Pumili ng PDF
                    </button>
                    {form.pdfFile && (
                      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                        {form.pdfFile.name}
                        {' '}
                        <span style={{
                          color: form.pdfFile.size > SUPABASE_PDF_LIMIT_BYTES ? '#f5b942' : 'var(--text-3)',
                          fontSize: 11,
                        }}>
                          ({(form.pdfFile.size / 1024 / 1024).toFixed(1)} MB
                          {form.pdfFile.size > SUPABASE_PDF_LIMIT_BYTES && ' — mapupunta sa JSON'})
                        </span>
                      </span>
                    )}
                    <input
                      ref={pdfInput}
                      type="file"
                      accept="application/pdf"
                      style={{ display: 'none' }}
                      onChange={handlePdfFile}
                    />
                  </div>

                  {/* Manual URL fallback */}
                  <input
                    value={form.pdfFile ? '' : form.pdf}
                    className="ep-input"
                    style={{ marginTop: 8 }}
                    placeholder="…o i-paste ang PDF URL"
                    disabled={!!form.pdfFile}
                    onChange={e => setForm(f => ({ ...f, pdf: e.target.value, pdfFile: null }))}
                  />
                  {form.pdfFile && (
                    <button
                      type="button"
                      style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4,
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      onClick={() => {
                        setForm(f => ({ ...f, pdfFile: null }))
                        if (pdfInput.current) pdfInput.current.value = ''
                      }}
                    >
                      ✕ Alisin ang file
                    </button>
                  )}
                </div>

                {/* Quote */}
                <div className="ep-form-group ep-form-group--full">
                  <label>Piling Sipi (Quote)</label>
                  <textarea value={form.quote} className="ep-input ep-textarea"
                    placeholder="Isang makabuluhang linya mula sa libro…" rows={3}
                    onChange={e => setForm(f => ({ ...f, quote: e.target.value }))} />
                </div>

              </div>
            </div>

            <div className="ep-modal-footer">
              <button className="ep-btn ep-btn--ghost" onClick={closeModal} disabled={saving}>
                Kanselahin
              </button>
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