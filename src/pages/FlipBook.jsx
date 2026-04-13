import { useEffect, useRef, useState, useCallback } from 'react'
import './FlipBook.css'

let pdfjsLib = null
async function getPdfJs() {
  if (pdfjsLib) return pdfjsLib
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.onload = () => {
      const lib = window['pdfjs-dist/build/pdf']
      lib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      pdfjsLib = lib
      resolve(lib)
    }
    script.onerror = reject
    document.head.appendChild(script)
  })
}

const SCALE       = 1.0
const JPEG_Q      = 0.70
const CONCURRENCY = 6     // ← more parallel renders since Supabase CDN is fast

// Cache rendered pages so revisiting same book is instant
const pageCache = new Map()

export default function FlipBook({ pdfUrl, onClose, title }) {
  const [pages, setPages]             = useState([])
  const [totalPages, setTotal]        = useState(0)
  const [spread, setSpread]           = useState(0)
  const [flipping, setFlipping]       = useState(false)
  const [flipDir, setFlipDir]         = useState(null)
  const [status, setStatus]           = useState('idle')
  const [loadedCount, setLoadedCount] = useState(0)
  const [mounted, setMounted]         = useState(false)
  const pdfRef    = useRef(null)
  const cancelRef = useRef(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 40)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft')  goPrev()
      if (e.key === 'Escape')     onClose?.()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [spread, flipping, totalPages])

  // ── Render a single page (with cache) ────────────────────────────────────
  async function renderPage(pdf, pageNum) {
    const cacheKey = `${pdfUrl}::${pageNum}`
    if (pageCache.has(cacheKey)) return pageCache.get(cacheKey)

    const page     = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale: SCALE })
    const canvas   = document.createElement('canvas')
    canvas.width   = viewport.width
    canvas.height  = viewport.height
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    const dataUrl  = canvas.toDataURL('image/jpeg', JPEG_Q)
    page.cleanup?.()

    pageCache.set(cacheKey, dataUrl)
    return dataUrl
  }

  // ── Render a batch in parallel ────────────────────────────────────────────
  async function renderBatch(pdf, pageNums) {
    const results = await Promise.all(pageNums.map(n => renderPage(pdf, n)))
    if (cancelRef.current) return
    setPages(prev => {
      const next = [...prev]
      pageNums.forEach((n, i) => { next[n - 1] = results[i] })
      return next
    })
    setLoadedCount(prev => prev + pageNums.length)
  }

  // ── Load PDF ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pdfUrl) { setStatus('error'); return }

    cancelRef.current = false
    setStatus('loading')
    setLoadedCount(0)
    setTotal(0)
    setSpread(0)
    pdfRef.current = null

    // Check if all pages already cached for this URL
    const cachedPages = pageCache
    
    ;(async () => {
      try {
        const lib = await getPdfJs()
        const pdf = await lib.getDocument({
          url: pdfUrl,
          disableRange: false,      // enables HTTP range requests = faster
          disableStream: false,     // enables streaming
          disableAutoFetch: false,  // pre-fetches PDF data
          cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
          cMapPacked: true,
        }).promise

        if (cancelRef.current) return
        pdfRef.current = pdf

        const count = pdf.numPages
        setTotal(count)

        // Check cache — if all pages cached, show instantly
        const allCached = Array.from({ length: count }, (_, i) =>
          pageCache.get(`${pdfUrl}::${i + 1}`)
        )
        if (allCached.every(Boolean)) {
          setPages(allCached)
          setLoadedCount(count)
          setStatus('ready')
          return
        }

        setPages(new Array(count).fill(null))

        // Render first 2 pages immediately → show book fast
        await renderBatch(pdf, [1, 2].filter(n => n <= count))
        if (cancelRef.current) return
        setStatus('ready')

        // Render rest in parallel batches of CONCURRENCY
        const remaining = Array.from({ length: Math.max(0, count - 2) }, (_, i) => i + 3)
        for (let i = 0; i < remaining.length; i += CONCURRENCY) {
          if (cancelRef.current) break
          await renderBatch(pdf, remaining.slice(i, i + CONCURRENCY))
        }

      } catch (err) {
        console.error('PDF load error:', err)
        if (!cancelRef.current) setStatus('error')
      }
    })()

    return () => { cancelRef.current = true }
  }, [pdfUrl])

  // ── Spread logic ──────────────────────────────────────────────────────────
  const getSpreadPages = (s) => {
    if (s === 0) return [null, 0]
    const left  = s * 2 - 1
    const right = s * 2
    return [left, right < totalPages ? right : null]
  }

  const maxSpread = Math.max(0, Math.ceil((totalPages - 1) / 2))

  const goNext = useCallback(() => {
    if (flipping || spread >= maxSpread) return
    setFlipDir('next')
    setFlipping(true)
    setTimeout(() => {
      setSpread(s => s + 1)
      setFlipping(false)
      setFlipDir(null)
    }, 300)
  }, [flipping, spread, maxSpread])

  const goPrev = useCallback(() => {
    if (flipping || spread <= 0) return
    setFlipDir('prev')
    setFlipping(true)
    setTimeout(() => {
      setSpread(s => s - 1)
      setFlipping(false)
      setFlipDir(null)
    }, 300)
  }, [flipping, spread])

  const jumpTo = useCallback((i) => {
    if (flipping || i === spread) return
    setFlipDir(i > spread ? 'next' : 'prev')
    setFlipping(true)
    setTimeout(() => {
      setSpread(i)
      setFlipping(false)
      setFlipDir(null)
    }, 300)
  }, [flipping, spread])

  const [leftIdx, rightIdx] = getSpreadPages(spread)
  const [nextLeftIdx]       = spread < maxSpread ? getSpreadPages(spread + 1) : [null]
  const pageNum = spread === 0 ? 1 : spread * 2

  const renderNoPdf = () => (
    <div className="fb-error-state">
      <div className="fb-error-icon">📄</div>
      <p>PDF hindi available para sa aklat na ito.</p>
      <button className="fb-btn-ghost" onClick={onClose}>← Bumalik sa Koleksyon</button>
    </div>
  )

  return (
    <div className={`fb-root ${mounted ? 'fb-root--in' : ''}`}>

      <header className="fb-header">
        <button className="fb-btn-ghost fb-back" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Koleksyon
        </button>
        <div className="fb-header-center">
          <span className="fb-title">{title}</span>
          {status !== 'error' && (
            <span className="fb-pager">
              {status === 'loading'
                ? `Nilo-load… ${loadedCount}${totalPages ? `/${totalPages}` : ''}`
                : `${pageNum} / ${totalPages}`
              }
            </span>
          )}
        </div>
        <div className="fb-header-right" />
      </header>

      {status === 'loading' && (
        <div className="fb-progress">
          <div
            className="fb-progress-fill"
            style={{ width: totalPages ? `${(loadedCount / totalPages) * 100}%` : '8%' }}
          />
        </div>
      )}

      {status === 'error' ? renderNoPdf() : (
        <main className="fb-stage">
          <div className={`fb-book ${flipping ? `fb-book--${flipDir}` : ''}`}>

            <div className="fb-page fb-page--left" onClick={goPrev}>
              <PageContent img={leftIdx !== null ? pages[leftIdx] : null} alt={`Pahina ${leftIdx + 1}`} />
              <div className="fb-shadow fb-shadow--right" />
              {spread > 0 && <NavHint side="left" />}
            </div>

            <div className="fb-spine" />

            <div className="fb-page fb-page--right" onClick={goNext}>
              <PageContent img={rightIdx !== null ? pages[rightIdx] : null} alt={`Pahina ${rightIdx + 1}`} />
              <div className="fb-shadow fb-shadow--left" />
              {spread < maxSpread && <NavHint side="right" />}
            </div>

            {flipping && (
              <div className={`fb-leaf fb-leaf--${flipDir}`}>
                <div className="fb-leaf-front">
                  <PageContent
                    img={flipDir === 'next'
                      ? (rightIdx !== null ? pages[rightIdx] : null)
                      : (nextLeftIdx !== null ? pages[nextLeftIdx] : null)
                    }
                  />
                </div>
                <div className="fb-leaf-back">
                  <PageContent
                    img={flipDir === 'next'
                      ? (nextLeftIdx !== null ? pages[nextLeftIdx] : null)
                      : (leftIdx !== null ? pages[leftIdx] : null)
                    }
                    mirrored
                  />
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      {status !== 'error' && (
        <footer className="fb-footer">
          <button className="fb-nav-btn" onClick={goPrev} disabled={spread === 0 || flipping}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Nakaraan
          </button>

          <div className="fb-dots">
            {Array.from({ length: maxSpread + 1 }, (_, i) => (
              <button
                key={i}
                className={`fb-dot ${i === spread ? 'fb-dot--on' : ''}`}
                onClick={() => jumpTo(i)}
                aria-label={`Pumunta sa spread ${i + 1}`}
              />
            ))}
          </div>

          <button className="fb-nav-btn" onClick={goNext} disabled={spread >= maxSpread || flipping}>
            Susunod
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </button>
        </footer>
      )}
    </div>
  )
}

function PageContent({ img, alt = '', mirrored = false }) {
  return (
    <div className="fb-page-content">
      {img
        ? <img src={img} alt={alt} className={`fb-img ${mirrored ? 'fb-img--mirror' : ''}`} />
        : <div className="fb-blank" />
      }
    </div>
  )
}

function NavHint({ side }) {
  return (
    <div className={`fb-hint fb-hint--${side}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="18" height="18">
        {side === 'left'
          ? <polyline points="15 18 9 12 15 6" />
          : <polyline points="9 6 15 12 9 18" />
        }
      </svg>
    </div>
  )
}