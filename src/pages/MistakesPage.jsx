import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getLesson, getQuestionById } from '../data/lessons.js'
import { clearMistake, getMistakes, logAnswer, subscribe } from '../lib/storage.js'
import QuestionCard from '../components/QuestionCard.jsx'

/* ════════════════════════════════════════════════════════════
   ⑤ 「再試一次」（/lesson/:id/retry，route alias /mistakes）

   ⚠️ 設計改動（dev_panel 7 位一致）：唔叫「錯題記錄」，
      佢係「再試一次」，唔係罰站區。
      · icon 用循環箭嘴 🔄，❌ 唔用紅色交叉、標題唔出「錯」字
      · 重做答啱就即刻移走（清單越做越短）
   · 每題顯示：題目、佢寫嘅答案、正確答案、正確步驟
   · ❌ 唔顯示錯誤次數、唔顯示分類、唔顯示撞咗幾次
   ════════════════════════════════════════════════════════════ */

export default function MistakesPage() {
  const { id } = useParams()
  const lesson = getLesson(id)
  const [items, setItems] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [lastResult, setLastResult] = useState(null)

  useEffect(() => {
    let alive = true
    async function load() {
      if (!lesson) return
      const list = await getMistakes(lesson.id)
      if (alive) setItems(list)
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

  const activeQ = activeId ? getQuestionById(activeId) : null

  async function handleAnswered(res) {
    if (!activeQ) return
    await logAnswer({
      lessonId: lesson.id,
      question: activeQ,
      input: res.input,
      correct: res.correct,
      attemptNo: res.attemptNo,
      hintLevel: res.hintLevel,
    })
    setLastResult(res)
    // 重做答啱就即刻移走
    if (res.correct) {
      await clearMistake(activeQ.id)
      setActiveId(null)
      setLastResult(null)
      const list = await getMistakes(lesson.id)
      setItems(list)
    }
  }

  async function removeAll() {
    const ok = window.confirm('清空之後，呢啲題就唔會再出現喺清單（紀錄仲喺度，家長報告照睇得到）。確定？')
    if (!ok) return
    for (const it of items || []) {
      await clearMistake(it.questionId)
    }
    const list = await getMistakes(lesson.id)
    setItems(list)
  }

  /* ── 即場重做一題 ─────────────────────────── */
  if (activeQ) {
    return (
      <div className="page">
        <h1 className="page-title">🔄 再試一次</h1>
        <p className="page-sub">{lesson.name}</p>
        <QuestionCard
          key={activeQ.id}
          question={activeQ}
          onAnswered={handleAnswered}
          onAcknowledge={() => {}}
        />
        {lastResult && !lastResult.correct && (
          <p className="facts">冇問題，睇完步驟可以再嚟過，或者返清單揀第二題。</p>
        )}
        <div className="footer-links">
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => {
              setActiveId(null)
              setLastResult(null)
            }}
          >
            返清單
          </button>
          <Link className="btn btn-quiet btn-small" to={`/lesson/${lesson.id}/practice`}>
            ✏️ 去練習庫
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <h1 className="page-title">🔄 再試一次</h1>
      <p className="page-sub">{lesson.name} · 課本 p{lesson.pages}</p>

      {items === null && <p className="empty">睇緊…</p>}

      {items && items.length === 0 && (
        <div className="done-card">
          <p className="done-line">呢度暫時係空嘅，好清爽。</p>
          <p className="facts">做錯過嘅題會自動出現喺呢度。重做答啱就會即刻移走。</p>
        </div>
      )}

      {items && items.length > 0 && (
        <ul className="retry-list">
          {items.map((it) => {
            const q = getQuestionById(it.questionId)
            if (!q) return null
            return (
              <li key={it.questionId} className="retry-item">
                <p className="retry-q">{q.question}</p>
                <p className="retry-line">
                  你寫咗：<strong>{it.input || '（空白）'}</strong>
                </p>
                <p className="retry-line">
                  正確答案：<strong>{q.answer}</strong>
                </p>
                {it.needsHint && <p className="retry-tag">要用提示先啱</p>}
                <details className="retry-steps">
                  <summary>睇正確步驟</summary>
                  <ol className="steps">
                    {(q.explanationSteps || []).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </details>
                <button type="button" className="btn btn-primary btn-wide" onClick={() => setActiveId(it.questionId)}>
                  再做一次
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {items && items.length > 0 && (
        <div className="footer-links">
          <button type="button" className="btn btn-quiet btn-small" onClick={removeAll}>
            清空
          </button>
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
