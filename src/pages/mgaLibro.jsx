import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import localBooks from '../data/books.json'
import { supabase } from '../API/supabase'
import './mgaLibro.css'

const BOOK_W   = 174
const BOOK_GAP = 18
const ANIM_MS  = 480

// ─── DEBUG flag — set to false before deploying ───────────────────────────────
const DEV_REALTIME_LOG = import.meta.env.DEV

function log(...args) {
  if (DEV_REALTIME_LOG) console.log('[MgaLibro RT]', ...args)
}

function extractColor(src) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 8; canvas.height = 8
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, 8, 8)
        const d = ctx.getImageData(0, 0, 8, 8).data
        let r = 0, g = 0, b = 0
        const n = d.length / 4
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2] }
        resolve({ r: r / n | 0, g: g / n | 0, b: b / n | 0 })
      } catch {
        resolve({ r: 232, g: 160, b: 32 })
      }
    }
    img.onerror = () => resolve({ r: 232, g: 160, b: 32 })
    img.src = src
    // Fire immediately if already cached by browser
    if (img.complete && img.naturalWidth > 0) img.onload()
  })
}

function buildMerged(remoteBooks) {
  const remoteIds = new Set(remoteBooks.map(b => b.id))
  const localOnly = localBooks.filter(b => !remoteIds.has(b.id))
  return [...remoteBooks, ...localOnly]
}

export default function MgaLibro() {
  const navigate    = useNavigate()
  const caseRef     = useRef(null)
  const sectionRef  = useRef(null)
  const canvasRef   = useRef(null)

  // Ref holds the live remote list — event handlers read this directly,
  // so they never capture a stale closure and the channel never restarts.
  const remoteBooksRef  = useRef([])
  const mountedRef      = useRef(true)
  const channelRef      = useRef(null)
  const retryTimerRef   = useRef(null)

  const [books,        setBooks]        = useState(() => localBooks)
  const [perShelf,     setPerShelf]     = useState(null)
  const [animating,    setAnimating]    = useState(false)
  const [transferring, setTransferring] = useState([])
  const [rtStatus,     setRtStatus]     = useState('connecting')
  const prevPer = useRef(null)

  const [ambColor,   setAmbColor]   = useState({ r: 232, g: 160, b: 32 })
  const [isHovering, setIsHovering] = useState(false)
  const colorCache  = useRef({})
  const ambTimer    = useRef(null)
  const ambColorRef = useRef(ambColor)
  useEffect(() => { ambColorRef.current = ambColor }, [ambColor])

  // ── Commit helper — always use this to update remote list + React state ──
  const commit = useCallback((nextRemote) => {
    if (!mountedRef.current) return
    remoteBooksRef.current = nextRemote
    setBooks(buildMerged(nextRemote))
    log('commit — total remote rows:', nextRemote.length)
  }, [])

  // ── Fetch all rows from Supabase ──────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    log('fetchAll()')
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .order('year', { ascending: true })
    if (error) {
      console.error('[MgaLibro] fetch error:', error)
      return
    }
    if (data) commit(data)
  }, [commit])

  // ── Subscribe to realtime changes ─────────────────────────────────────────
  const subscribe = useCallback(() => {
    // Clean up any existing channel before re-subscribing
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    log('subscribe()')

    const channel = supabase
      .channel('mga-libro-realtime', {
        config: {
          // Broadcast presence so Supabase knows there's an active listener
          presence: { key: 'mga-libro' },
        },
      })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'books' },
        ({ new: row }) => {
          log('INSERT', row.id, row.title)
          const cur = remoteBooksRef.current
          if (cur.some(b => b.id === row.id)) return
          commit(
            [...cur, row].sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999))
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'books' },
        ({ new: row }) => {
          log('UPDATE', row.id, row.title)
          const cur    = remoteBooksRef.current
          const exists = cur.some(b => b.id === row.id)
          commit(
            exists
              ? cur.map(b => b.id === row.id ? { ...b, ...row } : b)
              : [...cur, row].sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999))
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'books' },
        ({ old: row }) => {
          log('DELETE', row.id)
          // NOTE: DELETE only sends the old row if REPLICA IDENTITY FULL is set.
          // If row.id is undefined here, run this in your Supabase SQL editor:
          //   ALTER TABLE books REPLICA IDENTITY FULL;
          if (!row.id) {
            console.warn(
              '[MgaLibro] DELETE event missing row.id — run in Supabase SQL:\n' +
              '  ALTER TABLE books REPLICA IDENTITY FULL;'
            )
            // Refetch as fallback since we can't identify which row was deleted
            fetchAll()
            return
          }
          commit(remoteBooksRef.current.filter(b => b.id !== row.id))
        }
      )
      .subscribe((status, err) => {
        log('channel status:', status, err ?? '')
        if (mountedRef.current) setRtStatus(status)

        if (status === 'SUBSCRIBED') {
          // Safe to fetch now — no INSERT can slip between sub + fetch
          fetchAll()
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('[mga-libro-realtime]', status, '— scheduling re-subscribe in 3 s')
          // Re-fetch immediately to catch any missed events
          fetchAll()
          // Then reconnect
          clearTimeout(retryTimerRef.current)
          retryTimerRef.current = setTimeout(() => {
            if (mountedRef.current) subscribe()
          }, 3000)
        }
      })

    channelRef.current = channel
  }, [commit, fetchAll])

  // ── Realtime bootstrap — runs once ───────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true
    subscribe()

    return () => {
      mountedRef.current = false
      clearTimeout(retryTimerRef.current)
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, []) // ← intentionally empty — subscribe/fetchAll are stable refs

  // ── Ambient colour → CSS vars ─────────────────────────────────────────────
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    el.style.setProperty('--amb-r', ambColor.r)
    el.style.setProperty('--amb-g', ambColor.g)
    el.style.setProperty('--amb-b', ambColor.b)
  }, [ambColor])

  // ── Dust particles ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas  = canvasRef.current
    const section = sectionRef.current
    if (!canvas || !section) return
    const ctx = canvas.getContext('2d')
    let raf

    const resize = () => {
      canvas.width  = section.offsetWidth
      canvas.height = section.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const particles = Array.from({ length: 42 }, () => ({
      x:          Math.random() * canvas.width,
      y:          Math.random() * canvas.height,
      r:          Math.random() * 1.5 + 0.3,
      alpha:      Math.random() * 0.16 + 0.04,
      dx:         (Math.random() - 0.5) * 0.18,
      dy:         -Math.random() * 0.22 - 0.06,
      drift:      Math.random() * Math.PI * 2,
      driftSpeed: Math.random() * 0.007 + 0.003,
    }))

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const { r, g, b } = ambColorRef.current
      particles.forEach(p => {
        p.drift += p.driftSpeed
        p.x += p.dx + Math.sin(p.drift) * 0.12
        p.y += p.dy
        if (p.y < -5)               p.y = canvas.height + 5
        if (p.x < -5)               p.x = canvas.width  + 5
        if (p.x > canvas.width + 5) p.x = -5
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${r}, ${Math.min(255, g + 60)}, ${b}, ${p.alpha})`
        ctx.fill()
      })
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  // ── Book hover ────────────────────────────────────────────────────────────
  const handleBookEnter = useCallback(async (cover) => {
    if (!cover) return
    clearTimeout(ambTimer.current)
    setIsHovering(true)
    if (colorCache.current[cover]) {
      setAmbColor(colorCache.current[cover])
      return
    }
    const color = await extractColor(cover)
    colorCache.current[cover] = color
    setAmbColor(color)
  }, [])

  const handleBookLeave = useCallback(() => {
    ambTimer.current = setTimeout(() => {
      setIsHovering(false)
      setAmbColor({ r: 232, g: 160, b: 32 })
    }, 600)
  }, [])

  // ── Responsive shelf ──────────────────────────────────────────────────────
  const measure = useCallback(() => {
    if (!caseRef.current) return
    const w   = caseRef.current.offsetWidth
    const fit = Math.max(1, Math.floor((w + BOOK_GAP) / (BOOK_W + BOOK_GAP)))
    if (fit === prevPer.current) return

    const oldFit = prevPer.current

    if (oldFit !== null && !animating) {
      const moving = []
      if (fit < oldFit) {
        for (let i = fit; i < Math.min(oldFit, books.length); i++) moving.push(i)
      } else {
        for (let i = fit - (fit - oldFit); i < Math.min(fit, books.length); i++) moving.push(i)
      }
      if (moving.length) {
        const dir = fit < oldFit ? 'down' : 'up'
        setTransferring(moving.map(i => ({ idx: i, dir })))
        setAnimating(true)
        setTimeout(() => {
          setTransferring([])
          setAnimating(false)
          setPerShelf(fit)
          prevPer.current = fit
        }, ANIM_MS)
        return
      }
    }

    setPerShelf(fit)
    prevPer.current = fit
  }, [animating, books.length])

  useEffect(() => {
    measure()
    const ro = new ResizeObserver(measure)
    if (caseRef.current) ro.observe(caseRef.current)
    return () => ro.disconnect()
  }, [measure])

  // ── Build shelves ─────────────────────────────────────────────────────────
  const shelves = []
  if (perShelf !== null) {
    for (let i = 0; i < books.length; i += perShelf) {
      shelves.push(books.slice(i, i + perShelf))
    }
  }

  const isTransferring = (globalIdx) =>
    transferring.find(t => t.idx === globalIdx) || null

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <section className="ml-section" id="mga-libro" ref={sectionRef}>

      <canvas className="ml-dust-canvas" ref={canvasRef} />

      <div
        className="ml-ambiance"
        style={{
          background: `radial-gradient(
            ellipse 80% 50% at 50% 20%,
            rgba(${ambColor.r}, ${ambColor.g}, ${ambColor.b}, ${isHovering ? 0.42 : 0.28}) 0%,
            rgba(${ambColor.r}, ${ambColor.g}, ${ambColor.b}, ${isHovering ? 0.20 : 0.12}) 38%,
            rgba(${ambColor.r}, ${ambColor.g}, ${ambColor.b}, ${isHovering ? 0.07 : 0.04}) 62%,
            transparent 80%
          )`,
          transition: 'background 0.65s ease',
        }}
      />

      <div className="ml-header">
        <p className="ml-eyebrow">Koleksyon ng </p>
        <h2 className="ml-title">Mga Aklat</h2>
      </div>

      <div className="ml-bookcase" ref={caseRef}>
        {perShelf === null ? null : shelves.map((shelf, si) => (
          <div className="ml-shelf" key={si}>
            <div className="ml-shelf-books">
              {shelf.map((b, bi) => {
                const globalIdx = si * perShelf + bi
                const xfer      = isTransferring(globalIdx)
                return (
                  <div
                    className={['ml-book', xfer ? `ml-book--transfer-${xfer.dir}` : ''].join(' ')}
                    key={b.id}
                    style={{ '--book-nth': bi, animationDelay: xfer ? `${bi * 40}ms` : '0ms' }}
                    onClick={() => navigate(`/libro/${b.id}`)}
                    onMouseEnter={() => handleBookEnter(b.cover)}
                    onMouseLeave={handleBookLeave}
                  >
                    <div className="ml-book-inner">
                      <img src={b.cover} alt={b.title} className="ml-cover-img" />
                      <div className="ml-book-overlay">
                        <span className="ml-book-title-hover">{b.title}</span>
                        <span className="ml-book-year-hover">{b.genre} · {b.year}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="ml-shelf-plank">
              <div className="ml-shelf-edge" />
            </div>
          </div>
        ))}
      </div>

    </section>
  )
}