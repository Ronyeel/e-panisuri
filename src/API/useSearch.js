import { useState, useEffect, useRef } from 'react'
import { supabase } from '../API/supabase'
import booksData from '../data/books.json'

// ─────────────────────────────────────────────
const DEBOUNCE_MS = 300
const MAX_RESULTS = 10

// ─────────────────────────────────────────────
// STATIC SEARCH — books.json
function searchStatic(query) {
  const lower = query.toLowerCase()
  const results = []

  for (const item of booksData) {
    const matches =
      item.title?.toLowerCase().includes(lower)  ||
      item.author?.toLowerCase().includes(lower) ||
      item.genre?.toLowerCase().includes(lower)  ||
      String(item.year ?? '').includes(lower)

    if (matches) {
      results.push({
        id:       `static-book-${item.id}`,
        title:    item.title,
        subtitle: item.author ?? '',
        category: 'Mga Libro',
        path:     `/mga-libro/${item.id}`,
      })
    }
  }

  return results
}

// ─────────────────────────────────────────────
// SUPABASE SEARCH — books, excerpts, quiz
async function searchSupabase(query) {
  const pattern = `%${query}%`

  try {
    const [booksRes, excerptsRes, quizRes] = await Promise.all([

      // ── BOOKS ────────────────────────────────
      supabase
        .from('books')
        .select('id, title, author, genre, year')
        .or(`title.ilike."${pattern}",author.ilike."${pattern}",genre.ilike."${pattern}"`)
        .limit(MAX_RESULTS),

      // ── EXCERPTS ─────────────────────────────
      supabase
        .from('excerpts')
        .select('id, bookTitle, author, tag, year, excerpt')
        .or(`bookTitle.ilike."${pattern}",author.ilike."${pattern}",tag.ilike."${pattern}",excerpt.ilike."${pattern}"`)
        .limit(MAX_RESULTS),

      // ── QUIZ ─────────────────────────────────
      supabase
        .from('quiz')
        .select('id, question, category, difficulty')
        .or(`question.ilike."${pattern}",category.ilike."${pattern}",difficulty.ilike."${pattern}"`)
        .limit(MAX_RESULTS),
    ])

    if (booksRes.error)    console.error('Books error:',    booksRes.error)
    if (excerptsRes.error) console.error('Excerpts error:', excerptsRes.error)
    if (quizRes.error)     console.error('Quiz error:',     quizRes.error)

    // ── MAP BOOKS ────────────────────────────
    const books = (booksRes.data ?? []).map(item => ({
      id:       `book-${item.id}`,
      title:    item.title,
      subtitle: item.author ?? '',
      category: 'Mga Libro',
      path:     `/mga-libro/${item.id}`,
    }))

    // ── MAP EXCERPTS ─────────────────────────
    const excerpts = (excerptsRes.data ?? []).map(item => ({
      id:       `excerpt-${item.id}`,
      title:    item.bookTitle,
      subtitle: item.author
        ? `ni ${item.author}${item.tag ? ` · ${item.tag}` : ''}`
        : item.tag ?? '',
      category: 'Excerpt',
      path:     `/excerpts/${item.id}`,
    }))

    // ── MAP QUIZ ─────────────────────────────
    const quiz = (quizRes.data ?? []).map(item => ({
      id:       `quiz-${item.id}`,
      title:    item.question,
      subtitle: item.difficulty
        ? `${item.difficulty}${item.category ? ` · ${item.category}` : ''}`
        : item.category ?? '',
      category: 'Quiz',
      path:     `/quiz/${item.id}`,
    }))

    return [...books, ...excerpts, ...quiz]

  } catch (err) {
    console.error('Search failed:', err)
    return []
  }
}

// ─────────────────────────────────────────────
// MAIN HOOK
export function useSearch(query) {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const timerRef = useRef(null)
  const abortRef = useRef(false)

  useEffect(() => {
    const trimmed = query.trim()

    if (!trimmed) {
      setResults([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    abortRef.current = false

    clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      try {
        const [staticResults, supabaseResults] = await Promise.all([
          searchStatic(trimmed),
          searchSupabase(trimmed),
        ])

        if (abortRef.current) return

        // Deduplicate by id, static results take priority
        const seen   = new Set()
        const merged = []

        for (const item of [...staticResults, ...supabaseResults]) {
          if (!seen.has(item.id)) {
            seen.add(item.id)
            merged.push(item)
          }
          if (merged.length >= MAX_RESULTS) break
        }

        setResults(merged)

      } catch (err) {
        if (!abortRef.current) {
          console.error(err)
          setError('Hindi ma-load ang mga resulta.')
        }
      } finally {
        if (!abortRef.current) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      abortRef.current = true
      clearTimeout(timerRef.current)
    }
  }, [query])

  return { results, loading, error }
}