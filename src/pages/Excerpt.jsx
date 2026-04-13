import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../API/supabase'
import FlipBook from '../pages/FlipBook'
import './Excerpt.css'

// ── Intersection hook for scroll-reveal ──────────────────────────────────────
function useIntersection(ref) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.12 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return visible
}

// ── Normalize row ─────────────────────────────────────────────────────────────
function normalizeExcerpt(row) {
  return {
    ...row,
    bookTitle: row.bookTitle ?? row.booktitle ?? row.book_title ?? '',
  }
}

// ── Partial title match — true if either string contains the other ────────────
function titlesMatch(a = '', b = '') {
  const clean = s => s.toLowerCase().trim()
  const ca = clean(a)
  const cb = clean(b)
  return ca === cb || ca.includes(cb) || cb.includes(ca)
}

// ── Single card ───────────────────────────────────────────────────────────────
function ExcerptCard({ item, index, isActive, onClick, onRead }) {
  const ref      = useRef(null)
  const visible  = useIntersection(ref)
  const hasPdf   = Boolean(item.pdf)
  const hasCover = Boolean(item.cover)

  useEffect(() => {
    if (isActive && ref.current) {
      setTimeout(() => {
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 150)
    }
  }, [isActive])

  return (
    <article
      ref={ref}
      className={[
        'exc-card',
        isActive ? 'exc-card--active'  : '',
        visible  ? 'exc-card--visible' : '',
      ].join(' ').trim()}
      style={{ '--i': index }}
      onClick={() => onClick(item.id)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick(item.id)}
      aria-expanded={isActive}
    >
      <div className="exc-card__glow" aria-hidden="true" />

      {/* Cover */}
      <div className="exc-card__cover-wrap">
        {hasCover && (
          <img
            src={item.cover}
            alt={`${item.bookTitle} cover`}
            className="exc-card__cover-img"
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
        )}
        <div className="exc-card__cover-fallback" aria-hidden="true">
          <span>{item.bookTitle?.charAt(0)}</span>
        </div>
      </div>

      {/* Top strip */}
      <div className="exc-card__strip">
        <span className="exc-card__tag">{item.tag}</span>
        <span className="exc-card__year">{item.year}</span>
      </div>

      {/* Title / author */}
      <div className="exc-card__meta">
        <h3 className="exc-card__title">{item.bookTitle}</h3>
        <p className="exc-card__author">ni {item.author}</p>
        {item.is_excerpt && (
          <span className="exc-excerpt-badge">Sipi lamang</span>
        )}
      </div>

      {/* Expandable excerpt */}
      <div className="exc-card__body" aria-hidden={!isActive}>
        <div className="exc-card__body-inner">
          <div className="exc-card__quote-mark">&ldquo;</div>
          <p className="exc-card__excerpt">{item.excerpt}</p>
          <div className="exc-card__rule" />

          <button
            className={`exc-card__read-cta${!hasPdf ? ' exc-card__read-cta--disabled' : ''}`}
            disabled={!hasPdf}
            onClick={e => {
              e.stopPropagation()
              if (hasPdf) onRead(item)
            }}
          >
            {hasPdf
              ? item.is_excerpt
                ? 'Basahin ang Sipi →'
                : 'Basahin ang Buong Aklat →'
              : 'Wala pang PDF'}
          </button>
        </div>
      </div>

      {/* Chevron */}
      <div className="exc-card__chevron" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          className={isActive ? 'chevron--open' : ''}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </article>
  )
}

// ── Page component ────────────────────────────────────────────────────────────
export default function ExcerptsPage() {
  const navigate  = useNavigate()
  const [excerpts,   setExcerpts]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [filter,     setFilter]     = useState('Lahat')
  const [activeId,   setActiveId]   = useState(null)
  const [readerBook, setReaderBook] = useState(null)
  const headerRef     = useRef(null)
  const headerVisible = useIntersection(headerRef)

  useEffect(() => {
    async function fetchExcerpts() {
      const { data, error } = await supabase
        .from('excerpts')
        .select('*')
        .order('year', { ascending: true })

      if (!error && data) {
        const normalized = data.map(normalizeExcerpt)
        setExcerpts(normalized)

        const params    = new URLSearchParams(window.location.search)
        const bookParam = params.get('book')
        const openRead  = params.get('read') === '1'

        if (bookParam) {
          const decoded = decodeURIComponent(bookParam)
          const match   = normalized.find(e => titlesMatch(e.bookTitle, decoded))

          if (match) {
            setActiveId(match.id)

            // If ?read=1 and the matched excerpt has a PDF, open FlipBook directly
            if (openRead && match.pdf) {
              setReaderBook(match)
            }
          }
        }
      }

      setLoading(false)
    }
    fetchExcerpts()
  }, [])

  const tags = ['Lahat', ...Array.from(new Set(excerpts.map(e => e.tag).filter(Boolean)))]

  const filtered = filter === 'Lahat'
    ? excerpts
    : excerpts.filter(e => e.tag === filter)

  const toggle = (id) => setActiveId(prev => prev === id ? null : id)

  // ── FlipBook full-screen ──────────────────────────────────────
  if (readerBook) {
    return (
      <FlipBook
        pdfUrl={readerBook.pdf}
        title={readerBook.bookTitle}
        onClose={() => setReaderBook(null)}
      />
    )
  }

  return (
    <main className="exc-page">

      <div className="exc-page__texture" aria-hidden="true" />

      <div className="exc-page__inner">

        <button className="exc-back" onClick={() => navigate(-1)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>Bumalik</span>
        </button>

        <header
          ref={headerRef}
          className={`exc-header ${headerVisible ? 'exc-header--visible' : ''}`}
        >
          <div className="exc-eyebrow">
            <span className="exc-eyebrow__line" />
            <span className="exc-eyebrow__text">Mga Piling Sipi</span>
            <span className="exc-eyebrow__line" />
          </div>

          <h1 className="exc-heading">
            <span className="exc-heading__white">Tikman ang</span>{' '}
            <span className="exc-heading__red">Kwento</span>
          </h1>

          <p className="exc-subheading">
            Mga piling talata mula sa mga natatanging akda ng panitikang Pilipino.
          </p>
        </header>

        <div className="exc-filters" role="group" aria-label="Salain ayon sa uri">
          {tags.map(tag => (
            <button
              key={tag}
              className={`exc-pill ${filter === tag ? 'exc-pill--active' : ''}`}
              onClick={() => { setFilter(tag); setActiveId(null) }}
            >
              {tag}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="exc-loading">
            <div className="exc-loading__spinner" />
            <p>Naglo-load ang mga sipi…</p>
          </div>
        ) : excerpts.length === 0 ? (
          <div className="exc-loading">
            <p style={{ color: 'rgba(240,236,228,0.3)' }}>Walang mga sipi sa ngayon.</p>
          </div>
        ) : (
          <div className="exc-grid">
            {filtered.map((item, i) => (
              <ExcerptCard
                key={item.id}
                item={item}
                index={i}
                isActive={activeId === item.id}
                onClick={toggle}
                onRead={setReaderBook}
              />
            ))}
          </div>
        )}

      </div>

      <div className="exc-rule" aria-hidden="true">
        <span /><span className="rule-diamond" /><span />
      </div>

    </main>
  )
}