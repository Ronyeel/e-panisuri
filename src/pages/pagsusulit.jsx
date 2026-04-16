// Pagsuslit.jsx
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../API/supabase'
import './pagsusulit.css'

const LETTERS = ['A', 'B', 'C', 'D']

function getVerdict(score, total) {
  const pct = score / total
  if (pct === 1)   return 'Perpekto! Tunay kang dalubhasà.'
  if (pct >= 0.8)  return 'Napakahusay! Malapit ka na sa katumbusan.'
  if (pct >= 0.6)  return 'Magaling! May kaalaman ka, ngunit lagi pang puwang para lumago.'
  if (pct >= 0.4)  return 'Hindi masama. Pag-aralan muli at subuking muli!'
  return 'Huwag panghinaan ng loob — ang kabiguan ay simula ng karunungan.'
}

// Groups flat rows from Supabase into the { id, label, questions[] } shape
function groupByCategory(rows) {
  const map = new Map()
  for (const row of rows) {
    const cat = row.category?.trim() || 'Iba pa'
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat).push({
      id:          row.id,
      text:        row.question,
      choices:     (row.choices ?? []).map((text, i) => ({ id: String(i), text })),
      correctId:   String(row.correctindex ?? 0),
      explanation: row.explanation ?? '',
    })
  }
  return Array.from(map.entries()).map(([label, questions]) => ({
    id:    label.toLowerCase().replace(/\s+/g, '-'),
    label,
    questions,
  }))
}

export default function Pagsuslit() {
  const [quizData,     setQuizData]     = useState([])
  const [loadingQuiz,  setLoadingQuiz]  = useState(true)
  const [activeQuizId, setActiveQuizId] = useState(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedId,   setSelectedId]   = useState(null)
  const [answered,     setAnswered]     = useState(false)
  const [score,        setScore]        = useState(0)
  const [finished,     setFinished]     = useState(false)

  // Fetch once on mount
  useEffect(() => {
    const load = async () => {
      setLoadingQuiz(true)
      const { data, error } = await supabase
        .from('quiz')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) {
        console.error(error)
      } else {
        const grouped = groupByCategory(data ?? [])
        setQuizData(grouped)
        setActiveQuizId(grouped[0]?.id ?? null)
      }
      setLoadingQuiz(false)
    }
    load()
  }, [])

  const activeQuiz = quizData.find(q => q.id === activeQuizId)
  const questions  = activeQuiz?.questions ?? []
  const question   = questions[currentIndex]
  const total      = questions.length

  const handleSelectQuiz = useCallback((id) => {
    setActiveQuizId(id)
    setCurrentIndex(0)
    setSelectedId(null)
    setAnswered(false)
    setScore(0)
    setFinished(false)
  }, [])

  const handleChoose = useCallback((choiceId) => {
    if (answered) return
    setSelectedId(choiceId)
    setAnswered(true)
    if (choiceId === question.correctId) setScore(s => s + 1)
  }, [answered, question])

  const handleNext = useCallback(() => {
    if (currentIndex + 1 >= total) {
      setFinished(true)
    } else {
      setCurrentIndex(i => i + 1)
      setSelectedId(null)
      setAnswered(false)
    }
  }, [currentIndex, total])

  const handleRetry = useCallback(() => {
    setCurrentIndex(0)
    setSelectedId(null)
    setAnswered(false)
    setScore(0)
    setFinished(false)
  }, [])

  const progressPct = total > 0
    ? ((currentIndex + (answered ? 1 : 0)) / total) * 100
    : 0

  if (loadingQuiz) {
    return (
      <section className="pagsuslit" aria-label="Pagsuslit — Pagsusulit">
        <div className="pagsuslit-inner">
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
            Naglo-load ng mga tanong…
          </div>
        </div>
      </section>
    )
  }

  if (quizData.length === 0) {
    return (
      <section className="pagsuslit" aria-label="Pagsuslit — Pagsusulit">
        <div className="pagsuslit-inner">
          <p style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)', fontFamily: "'Crimson Text', serif" }}>
            Wala pang mga tanong. Bumalik na lang mamaya!
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="pagsuslit" aria-label="Pagsuslit — Pagsusulit">
      <div className="pagsuslit-inner">

        {/* Header */}
        <header className="pagsuslit-header">
          <div className="pagsuslit-eyebrow">Subukan ang Iyong Kaalaman</div>
          <h2 className="pagsuslit-title">Pagsuslit</h2>
          <p className="pagsuslit-subtitle">Piliin ang kategorya at simulan ang pagsusulit</p>
        </header>

        {/* Category tabs */}
        <nav className="pagsuslit-selector" aria-label="Kategorya ng pagsusulit">
          {quizData.map(quiz => (
            <button
              key={quiz.id}
              className={`pagsuslit-selector-btn${activeQuizId === quiz.id ? ' active' : ''}`}
              onClick={() => handleSelectQuiz(quiz.id)}
            >
              {quiz.label}
            </button>
          ))}
        </nav>

        {/* Quiz card */}
        <div className="pagsuslit-card" role="main">

          {finished ? (
            <div className="pagsuslit-results">
              <div className="pagsuslit-results-label">Iyong Puntos</div>
              <div className="pagsuslit-results-score">
                {score}<span className="pagsuslit-results-denom">/{total}</span>
              </div>
              <p className="pagsuslit-results-verdict">{getVerdict(score, total)}</p>
              <div className="pagsuslit-results-actions">
                <button className="pagsuslit-retry-btn" onClick={handleRetry}>↩ Ulit</button>
                {quizData.length > 1 && (
                  <button className="pagsuslit-other-btn" onClick={() => {
                    const others = quizData.filter(q => q.id !== activeQuizId)
                    handleSelectQuiz(others[0].id)
                  }}>
                    Ibang Kategorya
                  </button>
                )}
              </div>
            </div>

          ) : question ? (
            <>
              {/* Progress */}
              <div className="pagsuslit-progress">
                <div className="pagsuslit-progress-track" role="progressbar"
                  aria-valuenow={currentIndex + 1} aria-valuemin={1} aria-valuemax={total}>
                  <div className="pagsuslit-progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
                <div className="pagsuslit-progress-label">
                  <span>{currentIndex + 1}</span> / {total}
                </div>
              </div>

              {/* Question */}
              <div className="pagsuslit-question-wrap">
                <div className="pagsuslit-question-num">Tanong {currentIndex + 1}</div>
                <p className="pagsuslit-question-text">{question.text}</p>
              </div>

              {/* Choices */}
              <div className="pagsuslit-choices" role="list">
                {question.choices.map((choice, idx) => {
                  let stateClass = ''
                  if (answered) {
                    if (choice.id === question.correctId)   stateClass = ' revealed'
                    else if (choice.id === selectedId)      stateClass = ' wrong'
                  }
                  return (
                    <button key={choice.id} role="listitem"
                      className={`pagsuslit-choice${stateClass}`}
                      onClick={() => handleChoose(choice.id)}
                      disabled={answered}
                      aria-pressed={selectedId === choice.id}
                    >
                      <span className="pagsuslit-choice-letter">{LETTERS[idx]}</span>
                      <span className="pagsuslit-choice-text">{choice.text}</span>
                    </button>
                  )
                })}
              </div>

              {/* Explanation */}
              {answered && question.explanation && (
                <div className="pagsuslit-explanation" role="alert">
                  <span className="pagsuslit-explanation-icon">
                    {selectedId === question.correctId ? '✓' : '✕'}
                  </span>
                  <p className="pagsuslit-explanation-text">{question.explanation}</p>
                </div>
              )}

              {/* Footer */}
              <div className="pagsuslit-card-footer">
                <div className="pagsuslit-score-inline">Puntos: <span>{score}</span></div>
                <button className="pagsuslit-next-btn" onClick={handleNext} disabled={!answered}>
                  {currentIndex + 1 >= total ? 'Tingnan ang Resulta →' : 'Susunod →'}
                </button>
              </div>
            </>

          ) : (
            <p style={{ color: 'var(--text-muted)', fontFamily: "'Crimson Text', serif",
              textAlign: 'center', padding: '2rem 0' }}>
              Walang mga tanong para sa kategoryang ito.
            </p>
          )}

        </div>
      </div>
    </section>
  )
}