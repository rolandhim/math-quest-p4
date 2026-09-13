import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getLesson, getQuestionsByLesson } from '../data/lessons.js'
import { isCorrect } from '../lib/grading.js'
import { getReviewState, logAnswer, saveReviewState } from '../lib/storage.js'
import QuestionCard from '../components/QuestionCard.jsx'

/* ════════════════════════════════════════════════════════════
   ③ 溫習卡（/lesson/:id/review）
     步驟 1 課文重點卡（一句人話 + 課本頁碼 + 例子）
     步驟 2 遮位自測
     步驟 3 即出 3 題驗證（用 QuestionCard 同一套元件）

   每張卡下面兩個掣：「我明喇」／「想再睇」→ saveReviewState
   ❌ 冇「識／唔識」判定字眼、冇「已掌握」
   ════════════════════════════════════════════════════════════ */

const QUIZ_SIZE = 3

export default function ReviewPage() {
  const { id } = useParams()
  const lesson = getLesson(id)
  const [step, setStep] = useState('cards') // cards | fill | quiz
  const [cardIndex, setCardIndex] = useState(0)
  const [state, setState] = useState({})
  const [fillInput, setFillInput] = useState('')
  const [fillShowAnswer, setFillShowAnswer] = useState(false)
  const [fillOk, setFillOk] = useState(null)
  const [quizIndex, setQuizIndex] = useState(0)
  const [quizResults, setQuizResults] = useState({})
  const [acknowledged, setAcknowledged] = useState({})

  useEffect(() => {
    let alive = true
    async function load() {
      if (!lesson) return
      const s = await getReviewState(lesson.id)
      if (alive) setState(s)
    }
    load()
    return () => {
      alive = false
    }
  }, [lesson])

  const quiz = useMemo(() => {
    if (!lesson) return []
    const all = getQuestionsByLesson(lesson.id)
    return all.slice(0, Math.min(QUIZ_SIZE, all.length))
  }, [lesson])

  if (!lesson) {
    return (
      <div className="page">
        <p className="empty">搵唔到呢個課文。</p>
        <Link className="btn btn-primary" to="/">
          返課文櫃
        </Link>
      </div>
    )
  }

  const cards = lesson.cards || []
  const card = cards[cardIndex]
  const fillCards = cards.filter((c) => c.fill)
  const fillCard = fillCards[Math.min(cardIndex, fillCards.length - 1)]

  async function mark(cardId, known) {
    const next = {
      ...state,
      [cardId]: { known, lastReviewAt: new Date().toISOString() },
    }
    setState(next)
    await saveReviewState(lesson.id, next)
    if (known && cardIndex < cards.length - 1) setCardIndex(cardIndex + 1)
  }

  function answerFill() {
    if (!fillCard) return
    const ok = isCorrect(fillInput, [fillCard.fill.answer, ...(fillCard.fill.accepted || [])])
    setFillOk(ok)
    setFillShowAnswer(true)
  }

  async function handleQuizAnswered(res) {
    const q = quiz[quizIndex]
    if (!q) return
    await logAnswer({
      lessonId: lesson.id,
      question: q,
      input: res.input,
      correct: res.correct,
      attemptNo: res.attemptNo,
      hintLevel: res.hintLevel,
      needsHint: !!res.needsHint,
    })
    setQuizResults((prev) => ({ ...prev, [q.id]: res }))
  }

  const current = quiz[quizIndex]
  const currentResult = current ? quizResults[current.id] : null
  const canGoNext = currentResult && (!currentResult.isFinalWrong || acknowledged[current.id])

  return (
    <div className="page">
      <h1 className="page-title">{lesson.name} · 溫習卡</h1>
      <p className="page-sub">課本 p{lesson.pages}</p>

      <div className="steps-tabs">
        {[
          ['cards', '1 課文重點'],
          ['fill', '2 遮位自測'],
          ['quiz', '3 做 3 題'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={'tab' + (step === key ? ' tab-on' : '')}
            onClick={() => setStep(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── 步驟 1：課文重點卡 ─────────────────────── */}
      {step === 'cards' && card && (
        <div>
          <div className="review-card">
            <div className="review-card-top">
              <h2 className="review-title">{card.title}</h2>
              <span className="review-pages">p{card.pages}</span>
            </div>
            <p className="review-text">{card.text}</p>
            <p className="review-example">例子：{card.example}</p>
          </div>

          <div className="review-nav">
            <button
              type="button"
              className="btn btn-ghost btn-small"
              disabled={cardIndex === 0}
              onClick={() => setCardIndex(cardIndex - 1)}
            >
              ← 上一張
            </button>
            <span className="review-count">
              {cardIndex + 1} / {cards.length}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              disabled={cardIndex >= cards.length - 1}
              onClick={() => setCardIndex(cardIndex + 1)}
            >
              下一張 →
            </button>
          </div>

          <div className="review-actions">
            <button type="button" className="btn btn-primary btn-wide" onClick={() => mark(card.id, true)}>
              我明喇
            </button>
            <button type="button" className="btn btn-soft btn-wide" onClick={() => mark(card.id, false)}>
              想再睇
            </button>
          </div>

          <p className="facts">
            {state[card.id]
              ? state[card.id].known
                ? '你上次睇完話明喇。'
                : '你上次話想再睇，冇問題，慢慢嚟。'
              : '第一次睇呢張。'}
          </p>

          <button type="button" className="btn btn-hero" onClick={() => setStep('fill')}>
            <span className="hero-emoji">👉</span>
            <span className="hero-text">
              下一步：遮位自測
              <small>睇吓記唔記得</small>
            </span>
          </button>
        </div>
      )}

      {/* ── 步驟 2：遮位自測 ───────────────────────── */}
      {step === 'fill' && fillCard && (
        <div>
          <div className="review-card">
            <h2 className="review-title">填一填</h2>
            <p className="fill-prompt">{fillCard.fill.prompt}</p>
            <input
              className="big-input"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={fillInput}
              onChange={(e) => setFillInput(e.target.value)}
              placeholder="喺度打答案"
              aria-label="遮位答案"
            />
            <div className="review-actions">
              <button type="button" className="btn btn-primary btn-wide" onClick={answerFill}>
                對一對
              </button>
              <button
                type="button"
                className="btn btn-soft btn-wide"
                onClick={() => setFillShowAnswer(true)}
              >
                睇答案
              </button>
            </div>
            {fillShowAnswer && (
              <div className="tier tier-ok">
                <p className="tier-msg">
                  {fillOk === true ? '答啱咗！' : fillOk === false ? '差少少，一齊睇睇：' : '答案係：'}
                  答案係 <strong>{fillCard.fill.answer}</strong>
                </p>
                <p className="facts">例子：{fillCard.example}</p>
              </div>
            )}
          </div>

          <div className="review-nav">
            <button
              type="button"
              className="btn btn-ghost btn-small"
              disabled={cardIndex === 0}
              onClick={() => {
                setCardIndex(cardIndex - 1)
                setFillShowAnswer(false)
                setFillInput('')
              }}
            >
              ← 上一張
            </button>
            <span className="review-count">
              {Math.min(cardIndex, fillCards.length - 1) + 1} / {fillCards.length}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              disabled={cardIndex >= fillCards.length - 1}
              onClick={() => {
                setCardIndex(cardIndex + 1)
                setFillShowAnswer(false)
                setFillInput('')
              }}
            >
              下一張 →
            </button>
          </div>

          <button type="button" className="btn btn-hero" onClick={() => setStep('quiz')}>
            <span className="hero-emoji">👉</span>
            <span className="hero-text">
              下一步：做 3 題
              <small>睇吓用唔用得着</small>
            </span>
          </button>
        </div>
      )}

      {/* ── 步驟 3：即出 3 題驗證 ─────────────────── */}
      {step === 'quiz' && current && (
        <div>
          <p className="facts">
            第 {quizIndex + 1} / {quiz.length} 題
          </p>
          <QuestionCard
            key={current.id}
            question={current}
            onAnswered={handleQuizAnswered}
            onAcknowledge={(qid) => setAcknowledged((prev) => ({ ...prev, [qid]: true }))}
          />
          <div className="practice-nav">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={quizIndex === 0}
              onClick={() => setQuizIndex(quizIndex - 1)}
            >
              ← 上一題
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canGoNext || quizIndex >= quiz.length - 1}
              onClick={() => setQuizIndex(quizIndex + 1)}
            >
              下一題 →
            </button>
          </div>
          <Link className="btn btn-soft btn-wide" to={`/lesson/${lesson.id}`}>
            返課題頁
          </Link>
        </div>
      )}

      <div className="footer-links">
        <Link className="btn btn-ghost btn-small" to={`/lesson/${lesson.id}`}>
          返課題頁
        </Link>
      </div>
    </div>
  )
}
