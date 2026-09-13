import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getLesson } from '../data/lessons.js'
import { getAttempts, getMistakes, getReviewState, subscribe } from '../lib/storage.js'
import { countDone } from '../lib/progress.js'

/* ════════════════════════════════════════════════════════════
   ② 課題頁（/lesson/:id）三個入口
   · 練習庫 = 最大粒嘅主掣（最突出）
   · 溫習卡 = 上面細粒「先睇重點」
   · 再試一次 = 最底、低調（唔用紅色、唔用「錯」字做標題）
   ════════════════════════════════════════════════════════════ */

export default function LessonPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const lesson = getLesson(id)
  const [facts, setFacts] = useState({ done: 0, review: 0, retry: 0 })

  useEffect(() => {
    let alive = true
    async function load() {
      if (!lesson) return
      const attempts = await getAttempts(lesson.id)
      const review = await getReviewState(lesson.id)
      const known = Object.values(review).filter((v) => v && v.known).length
      const retry = await getMistakes(lesson.id)
      if (alive) {
        setFacts({
          done: countDone(attempts),
          review: known,
          retry: retry.length,
        })
      }
    }
    load()
    const unsubscribe = subscribe(load)
    return () => {
      alive = false
      unsubscribe()
    }
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

  return (
    <div className="page">
      <h1 className="page-title">{lesson.name}</h1>
      <p className="page-sub">
        {lesson.subtitle} · 課本 p{lesson.pages}
      </p>

      <Link className="btn btn-soft btn-small" to={`/lesson/${lesson.id}/review`}>
        📖 先睇重點（溫習卡）
      </Link>

      <button
        type="button"
        className="btn btn-hero"
        onClick={() => navigate(`/lesson/${lesson.id}/practice`)}
      >
        <span className="hero-emoji">✏️</span>
        <span className="hero-text">
          練習庫
          <small>一路做落去，想停就停</small>
        </span>
      </button>

      <p className="facts">
        {lesson.summary}（課本 p{lesson.pages}）
      </p>
      <p className="facts">做過 {facts.done} 題 · 睇過 {facts.review} 張重點卡</p>

      <div className="footer-links">
        <Link className="btn btn-quiet btn-small" to={`/lesson/${lesson.id}/retry`}>
          🔄 再試一次{facts.retry > 0 ? `（${facts.retry}）` : ''}
        </Link>
      </div>
    </div>
  )
}
