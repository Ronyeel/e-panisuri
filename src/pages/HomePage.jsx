import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../API/firebase'
import './HomePage.css'
import localBooks from '../data/books.json'
import { supabase } from '../API/supabase'
import { useBookPalette } from '../hooks/useBookPalette'


const INTERVAL = 6000

function randomNext(current, length) {
  if (length <= 1) return 0
  let next
  do { next = Math.floor(Math.random() * length) } while (next === current)
  return next
}

function getTitleLen(title) {
  const len = title.length
  if (len < 12) return 'short'
  if (len < 24) return 'medium'
  if (len < 40) return 'long'
  return 'xlong'
}

function pairWords(title) {
  const words = title.split(' ')
  const pairs = []
  for (let i = 0; i < words.length; i += 2) {
    pairs.push(words.slice(i, i + 2).join(' '))
  }
  return pairs
}

export default function HomePage() {
  const bgRef     = useRef(null)
  const bannerRef = useRef(null)
  const navigate  = useNavigate()

  const [books, setBooks]           = useState(localBooks)
  const [index, setIndex]           = useState(() => Math.floor(Math.random() * localBooks.length))
  const [phase, setPhase]           = useState('idle')
  const [showSignIn, setShowSignIn] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [username, setUsername]     = useState('Bisita')

  const book = books[index] ?? books[0]
  const { r, g, b } = useBookPalette(book.cover)

  // ── Firebase auth ─────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsLoggedIn(true)
        setUsername(user.displayName || user.email || 'Mambabasa')
      } else {
        setIsLoggedIn(false)
        setUsername('Bisita')
      }
    })
    return () => unsub()
  }, [])

  // ── Fetch from Supabase and merge with local ──────────────────
  useEffect(() => {
    async function fetchBooks() {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .order('year', { ascending: true })

      if (!error && data.length > 0) {
        const supabaseIds = data.map(b => b.id)
        const localOnly = localBooks.filter(b => !supabaseIds.includes(b.id))
        setBooks([...data, ...localOnly])
      }
    }
    fetchBooks()
  }, [])

  // ── Random auto-feature ───────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      setPhase('exit')
      setTimeout(() => {
        setIndex(i => randomNext(i, books.length))
        setPhase('enter')
        setTimeout(() => setPhase('idle'), 50)
      }, 400)
    }, INTERVAL)
    return () => clearInterval(timer)
  }, [books.length])

  // ── Parallax ──────────────────────────────────────────────────
  useEffect(() => {
    const bg     = bgRef.current
    const banner = bannerRef.current
    if (!bg || !banner) return

    let current = 0, target = 0, rafId = null
    const lerp = (a, b, t) => a + (b - a) * t

    const getTarget = () => {
      const rect    = banner.getBoundingClientRect()
      const viewH   = window.innerHeight
      const bannerH = rect.height
      const progress = (viewH - rect.top) / (viewH + bannerH)
      return (progress - 0.5) * bannerH * 0.45
    }

    const tick = () => {
      current = lerp(current, target, 0.06)
      bg.style.transform = `translateY(${current.toFixed(2)}px)`
      if (Math.abs(current - target) > 0.05) {
        bg.style.transform = `translateY(${target.toFixed(2)}px)`
        rafId = null
      } else {
        rafId = requestAnimationFrame(tick)
      }
    }

    const onScroll = () => {
      target = getTarget()
      if (!rafId) rafId = requestAnimationFrame(tick)
    }

    target = current = getTarget()
    bg.style.transform = `translateY(${current.toFixed(2)}px)`

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [])

  // ── Derived state ─────────────────────────────────────────────
  const panelClass = phase === 'exit'  ? 'panel--exit'
                   : phase === 'enter' ? 'panel--enter'
                   : ''

  const bookClass = [
    'book-stage',
    phase === 'exit'    ? 'book--exit'
    : phase === 'enter' ? 'book--enter'
    : ''
  ].join(' ').trim()

  const titleLen   = getTitleLen(book.title)
  const titlePairs = pairWords(book.title)
  const hasPdf     = Boolean(book.pdf)

  const goToBook = () => {
    if (!hasPdf) return
    if (!isLoggedIn) {
      setShowSignIn(true)
      return
    }
    navigate(`/libro/${book.id}`)
  }

  const goToExcerpt = () =>
    navigate(`/excerpts?book=${encodeURIComponent(book.title)}&read=1`)

  return (
    <main className="homepage">

    

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="hero" id="home">

        <div
          className="hero-color-wash"
          style={{
            background: `radial-gradient(ellipse 100% 80% at 50% 120%, rgba(${r},${g},${b},0.5) 0%, rgba(${r},${g},${b},0.2) 45%, transparent 70%)`
          }}
        />

        <div className="hero-bg-texture" aria-hidden="true" />

        <div className="hero-inner">

          <div className="hero-welcome-tag">
            <span className="welcome-label">Welcome</span>
            <span className="welcome-name">{username}</span>
            <span className="welcome-bang">!</span>
          </div>

          <div className="hero-showcase">

            {/* LEFT — title + author */}
            <div className={`hero-left ${panelClass}`}>
              <p className="hero-featured-label">Tampok na Aklat</p>

              <h1
                className="hero-book-title"
                data-len={titleLen}
                onClick={goToBook}
                style={{ cursor: hasPdf ? 'pointer' : 'default' }}
              >
                {titlePairs.map((line, i) => (
                  <span
                    key={line + i}
                    className={`title-word ${i % 2 === 0 ? 'title-word--red' : 'title-word--white'}`}
                    style={{ animationDelay: `${i * 0.08}s` }}
                  >
                    {line}
                  </span>
                ))}
              </h1>

              <div className="hero-author-row">
                <span className="hero-author-by">ni</span>
                <span className="hero-author-name">{book.author}</span>
              </div>
            </div>

            {/* CENTER — book cover */}
            <div className="hero-center">
              <div className="book-stage-wrap">
                <div
                  className={bookClass}
                  onClick={goToBook}
                  style={{ cursor: hasPdf ? 'pointer' : 'default' }}
                >
                  <div className="book-shadow" />
                  <div className="book-cover">
                    <img src={book.cover} alt={`${book.title} cover`} />
                    <div className="book-sheen" aria-hidden="true" />
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT — quote + CTA */}
            <div className={`hero-right ${panelClass}`}>
              <span className="quote-opener">&ldquo;</span>
              <blockquote className="hero-quote">{book.quote}</blockquote>

              <div className="hero-cta-group">
                <button
                  className="hero-cta"
                  onClick={goToBook}
                  disabled={!hasPdf}
                  style={{
                    opacity: hasPdf ? 1 : 0.4,
                    cursor: hasPdf ? 'pointer' : 'not-allowed'
                  }}
                >
                  <span>{hasPdf ? 'Basahin' : 'Wala pang PDF'}</span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>

                <button
                  className="hero-cta-excerpt"
                  onClick={goToExcerpt}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 6h16M4 12h10M4 18h12" />
                  </svg>
                  <span>Basahin ang Excerpt</span>
                </button>
              </div>
            </div>

          </div>

          <div className="hero-rule" aria-hidden="true">
            <span /><span className="rule-diamond"></span><span />
          </div>

        </div>
      </section>

      {/* ── School Photo Banner ───────────────────────────────── */}
      <section
        className="school-banner"
        ref={bannerRef}
        role="img"
        aria-label="Camarines Norte State College"
      >
        <div
          className="school-banner__bg"
          ref={bgRef}
          style={{ backgroundImage: 'url(/cnsc.jpg)' }}
        />
        <div className="school-overlay" />
        <div className="school-banner__content">
          <h2 className="school-headline">
            Lumikha. Maglakbay.<br />
            <em>Patungo sa Obra Mong Script.</em>
          </h2>
        </div>
      </section>

      {/* ── CTA Strip ─────────────────────────────────────────── */}
      <section className="cta-strip">
        <div className="cta-deco-circle cta-deco--1" aria-hidden="true" />
        <div className="cta-deco-circle cta-deco--2" aria-hidden="true" />
        <div className="cta-inner">
          <p className="cta-eyebrow">Para sa mga Manunulat at Mambabasa</p>
          <button
            className="cta-btn"
            onClick={() => navigate('/excerpts')}
          >
            Basahin ang mga Excerpts
          </button>
        </div>
      </section>

    </main>
  )
}