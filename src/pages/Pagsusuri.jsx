import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../API/supabase'
import './Pagsusuri.css'

// ── Intersection hook for scroll-reveal ──────────────────────────────────────
function useIntersection(ref) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.10 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return visible
}

// ── Star renderer ─────────────────────────────────────────────────────────────
function Stars({ rating = 0 }) {
  return (
    <div className="pag-card__stars" aria-label={`${rating} sa 5 bituin`}>
      {Array.from({ length: 5 }, (_, i) => {
        const filled = rating >= i + 1
        const half   = !filled && rating >= i + 0.5
        return (
          <span
            key={i}
            className={[
              'pag-star',
              filled ? 'pag-star--filled' : '',
              half   ? 'pag-star--half'   : '',
            ].join(' ').trim()}
          />
        )
      })}
      <span className="pag-card__rating-num">{rating.toFixed(1)}</span>
    </div>
  )
}

// ── Verdict badge ─────────────────────────────────────────────────────────────
function Verdict({ rating }) {
  if (!rating) return null
  const recommended = rating >= 3.5
  return (
    <span className={`pag-verdict pag-verdict--${recommended ? 'recommended' : 'mixed'}`}>
      <span className="pag-verdict__dot" />
      {recommended ? 'Inirerekomenda' : 'Halo-halo'}
    </span>
  )
}

// ── Initials from name ────────────────────────────────────────────────────────
function initials(name = '') {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
}

// ── Format date ───────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('fil-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

// ── Single review card ────────────────────────────────────────────────────────
function ReviewCard({ item, index, featured = false }) {
  const ref     = useRef(null)
  const visible = useIntersection(ref)
  const [expanded, setExpanded] = useState(false)

  const hasCover    = Boolean(item.cover)
  const longReview  = (item.review ?? '').length > 280
  const bookTitle   = item.book_title ?? item.bookTitle ?? item.booktitle ?? ''
  const reviewerName = item.reviewer_name ?? item.reviewerName ?? 'Hindi Kilala'

  return (
    <article
      ref={ref}
      className={[
        'pag-card',
        featured ? 'pag-card--featured' : '',
        visible  ? 'pag-card--visible'  : '',
      ].join(' ').trim()}
      style={{ '--i': index }}
    >
      <div className="pag-card__glow" aria-hidden="true" />

      {/* Top: cover + book info */}
      <div className="pag-card__top">
        <div className="pag-card__cover-wrap">
          {hasCover && (
            <img
              src={item.cover}
              alt={`${bookTitle} cover`}
              className="pag-card__cover-img"
              onError={e => { e.currentTarget.style.display = 'none' }}
            />
          )}
          <div className="pag-card__cover-fallback" aria-hidden="true">
            <span>{bookTitle.charAt(0)}</span>
          </div>
        </div>

        <div className="pag-card__bookinfo">
          {item.genre && (
            <span className="pag-card__genre">{item.genre}</span>
          )}
          <h3 className="pag-card__booktitle" title={bookTitle}>
            {bookTitle}
          </h3>
          <p className="pag-card__author">
            ni {item.author ?? 'Hindi Kilala'}
          </p>
          <Stars rating={item.rating ?? 0} />
        </div>
      </div>

      <div className="pag-card__divider" />

      {/* Review body */}
      <div className="pag-card__body">
        <span className="pag-card__quote-mark" aria-hidden="true">&ldquo;</span>
        <p className={`pag-card__review-text${expanded ? ' pag-card__review-text--expanded' : ''}`}>
          {item.review}
        </p>
        {longReview && (
          <button
            className="pag-card__toggle"
            onClick={() => setExpanded(p => !p)}
          >
            {expanded ? '↑ Bawasan' : '↓ Basahin pa'}
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="pag-card__footer">
        <div className="pag-card__reviewer">
          <div className="pag-card__avatar">
            <span>{initials(reviewerName)}</span>
          </div>
          <span className="pag-card__reviewer-name">{reviewerName}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {item.created_at && (
            <span className="pag-card__date">{formatDate(item.created_at)}</span>
          )}
          <Verdict rating={item.rating} />
        </div>
      </div>
    </article>
  )
}

// ── Page component ────────────────────────────────────────────────────────────
export default function Pagsusuri() {
  const navigate  = useNavigate()
  const [reviews,  setReviews]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('Lahat')
  const [sort,     setSort]     = useState('pinakabago')
  const headerRef     = useRef(null)
  const headerVisible = useIntersection(headerRef)

  useEffect(() => {
    async function fetchReviews() {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false })

      if (!error && data) setReviews(data)
      setLoading(false)
    }
    fetchReviews()
  }, [])

  // Derive genre tags
  const tags = [
    'Lahat',
    ...Array.from(new Set(reviews.map(r => r.genre).filter(Boolean))),
  ]

  // Filter
  const filtered = filter === 'Lahat'
    ? reviews
    : reviews.filter(r => r.genre === filter)

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'pinakamataas') return (b.rating ?? 0) - (a.rating ?? 0)
    if (sort === 'pinakamababa') return (a.rating ?? 0) - (b.rating ?? 0)
    // pinakabago (default)
    return new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0)
  })

  return (
    <main className="pag-page">
      <div className="pag-page__texture" aria-hidden="true" />

      <div className="pag-page__inner">

        {/* Back */}
        <button className="pag-back" onClick={() => navigate(-1)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>Bumalik</span>
        </button>

        {/* Header */}
        <header
          ref={headerRef}
          className={`pag-header ${headerVisible ? 'pag-header--visible' : ''}`}
        >
          <div className="pag-eyebrow">
            <span className="pag-eyebrow__line" />
            <span className="pag-eyebrow__text">Mga Pagsusuri</span>
            <span className="pag-eyebrow__line" />
          </div>

          <h1 className="pag-heading">
            <span className="pag-heading__white">Mga Tinig ng</span>{' '}
            <span className="pag-heading__gold">Mambabasa</span>
          </h1>

          <p className="pag-subheading">
            Mga tapat na pagsusuri mula sa mga nagmamahal sa panitikang Pilipino.
          </p>
        </header>

        {/* Genre filter pills */}
        <div className="pag-filters" role="group" aria-label="Salain ayon sa genre">
          {tags.map(tag => (
            <button
              key={tag}
              className={`pag-pill ${filter === tag ? 'pag-pill--active' : ''}`}
              onClick={() => setFilter(tag)}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Sort bar */}
        {!loading && sorted.length > 0 && (
          <div className="pag-sortbar">
            <p className="pag-sortbar__count">
              <strong>{sorted.length}</strong> pagsusuri ang natagpuan
            </p>
            <select
              className="pag-sort-select"
              value={sort}
              onChange={e => setSort(e.target.value)}
              aria-label="Pagbukud-bukurin ang mga pagsusuri"
            >
              <option value="pinakabago">PINAKABAGO</option>
              <option value="pinakamataas">PINAKAMATAAS</option>
              <option value="pinakamababa">PINAKAMABABA</option>
            </select>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="pag-loading">
            <div className="pag-loading__spinner" />
            <p>Naglo-load ang mga pagsusuri…</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="pag-loading">
            <p>Walang mga pagsusuri sa ngayon.</p>
          </div>
        ) : (
          <div className="pag-grid">
            {sorted.map((item, i) => (
              <ReviewCard
                key={item.id}
                item={item}
                index={i}
                featured={i === 0 && filter === 'Lahat' && sort === 'pinakabago'}
              />
            ))}
          </div>
        )}

      </div>

      {/* Bottom rule */}
      <div className="pag-rule" aria-hidden="true">
        <span /><span className="pag-rule__diamond" /><span />
      </div>
    </main>
  )
}