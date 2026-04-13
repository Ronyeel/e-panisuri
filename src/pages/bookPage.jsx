import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../API/supabase'
import localBooks from '../data/books.json'
import FlipBook from './FlipBook'

export default function BookPage() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const [book, setBook]       = useState(() => localBooks.find(b => String(b.id) === String(id)) ?? null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchBook() {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('id', id)
        .single()

      if (!error && data) setBook(data)
      setLoading(false)
    }
    fetchBook()
  }, [id])

  if (loading) return (
    <div style={{
      minHeight: '100vh', background: '#0f0e0b',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <p style={{ fontFamily: 'Crimson Text, serif', color: 'rgba(232,224,204,0.5)' }}>
        Naglo-load…
      </p>
    </div>
  )

  if (!book) return (
    <div style={{
      minHeight: '100vh', background: '#0f0e0b',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '1.5rem'
    }}>
      <p style={{ fontFamily: 'Crimson Text, serif', color: 'rgba(232,224,204,0.5)' }}>
        Aklat ay hindi nahanap.
      </p>
      <button onClick={() => navigate(-1)} style={{
        fontFamily: 'Barlow Condensed, sans-serif', fontSize: '0.7rem',
        letterSpacing: '0.2em', textTransform: 'uppercase',
        color: '#f5c518', background: 'none',
        border: '1px solid rgba(245,197,24,0.22)', padding: '10px 20px',
        cursor: 'pointer', borderRadius: '2px'
      }}>← Bumalik</button>
    </div>
  )

  return (
    <FlipBook
      pdfUrl={book.pdf}
      title={book.title}
      onClose={() => navigate(-1)}
    />
  )
}