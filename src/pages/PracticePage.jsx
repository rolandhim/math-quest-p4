import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getLesson, getQuestionsByLesson } from '../data/lessons.js'
import { logAnswer } from '../lib/storage.js'
import { useNavLock } from '../lib/navlock.jsx'
import QuestionCard from '../components/QuestionCard.jsx'

/* ════════════════════════════════════════════════════════════
   ④ 練習庫（/lesson/:id/practice）—— 核心

   簡報 §1.5 (A) 用戶拍板：唔限數量、冇終點、題庫走完重洗牌、佢自己揀停
     · 顯示「第 N 題」—— N 一路加上去，冇分母、冇「第 N / M 題」
     · 題庫走完 → 立即重洗牌再出（❌ 唔准彈「做晒」或死胡同）
     · 佢自己撳「🏠 今日夠喇 · 返課文櫃」就停 —— 系統唔幫佢決定幾時停
     · ❌ 冇「再做 5 題」、冇「做完 5 題就今日做好喇」

   簡報 §1.5 (C) 做緊唔准走，做完先出 Home 鍵
     · 未答完當前嗰題 → useNavLock(true)：頂部「← 課文櫃 / ← 課題」收埋
     · 答完之後 → 出「下一題」＋「🏠 今日夠喇 · 返課文櫃」
     · ❌ 唔用 history.pushState / popstate（階段 1 唔攔瀏覽器手勢）
     · ✅ 第二條防線：未答完走甩 → 唔會當「做過」（見 lib/progress.js）

   ❌ 冇計時器、冇排行榜、冇連勝、唔顯示錯誤分類
   ════════════════════════════════════════════════════════════ */

/** Fisher–Yates 洗牌。avoidFirstId：唔好一洗完就即刻出返啱啱嗰題 */
function shuffled(list, avoidFirstId) {
  const out = list.slice()
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = out[i]
    out[i] = out[j]
    out[j] = t
  }
  if (avoidFirstId && out.length > 1 && out[0].id === avoidFirstId) {
    const k = out.findIndex((q) => q.id !== avoidFirstId)
    if (k > 0) {
      const t = out[0]
      out[0] = out[k]
      out[k] = t
    }
  }
  return out
}

export default function PracticePage() {
  const { id } = useParams()
  const lesson = getLesson(id)
  const all = useMemo(() => (lesson ? getQuestionsByLesson(lesson.id) : []), [lesson])

  const [order, setOrder] = useState(() => all.slice())
  const [slot, setSlot] = useState(0) // 喺 order 入面嘅位置
  const [served, setServed] = useState(1) // 「第 N 題」—— 一路加上去，洗完牌都唔歸零
  const [result, setResult] = useState(null)
  const [ack, setAck] = useState(false)
  const [retryHints, setRetryHints] = useState(0) // 今次坐低做，有幾題可以再試

  // 換課題：由頭開始（第一輪照題庫原次序出，之後先洗牌）
  useEffect(() => {
    setOrder(all.slice())
    setSlot(0)
    setServed(1)
    setResult(null)
    setAck(false)
    setRetryHints(0)
  }, [id, all])

  const question = order[slot] || null
  // 「答完」＝答啱，或者已經行到第 3 層（系統出咗正確答案）
  const done = !!result && (result.correct === true || result.isFinalWrong === true)
  // 可以行落去／可以走：第 3 層仲要撳埋「我明喇」
  const canProceed = done && (result.correct === true || ack === true)

  // (C) 未答完 → 收埋頂部返回鍵
  // ⚠️ 只喺「真係有題目」嘅時候才鎖。如果課題 0 題（題庫空），question 永遠
  //    null，canProceed 永遠 false —— 照鎖就會死鎖：冇出路、冇返回鍵、
  //    連標題 Link 都指返自己。（2026-09-12 Checker 🟡）
  useNavLock(!!question && !canProceed)

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

  // 空題庫（0 題）：唔鎖導航，亦唔留一片空白死路 —— 出一條明確嘅出路
  if (!question) {
    return (
      <div className="page">
        <div className="practice-top">
          <span className="practice-lesson">{lesson.name}</span>
        </div>
        <p className="empty">呢個課題而家仲未有題目。</p>
        <div className="practice-leave">
          <Link className="btn btn-primary btn-wide" to="/">
            🏠 返課文櫃
          </Link>
          <Link className="btn btn-quiet btn-small" to={`/lesson/${lesson.id}`}>
            返課題頁
          </Link>
        </div>
      </div>
    )
  }

  async function handleAnswered(res) {
    if (!question) return
    await logAnswer({
      lessonId: lesson.id,
      question,
      input: res.input,
      correct: res.correct,
      attemptNo: res.attemptNo,
      hintLevel: res.hintLevel,
    })
    setResult(res)
    if (!res.correct && res.isFinalWrong) setRetryHints((n) => n + 1)
  }

  /** 下一題：行到題庫尾就重洗牌，永遠有下一題 */
  function goNext() {
    if (!canProceed) return
    const nextSlot = slot + 1
    if (nextSlot < order.length) {
      setSlot(nextSlot)
    } else {
      setOrder(shuffled(all, question ? question.id : null))
      setSlot(0)
    }
    setServed((n) => n + 1)
    setResult(null)
    setAck(false)
  }

  return (
    <div className="page">
      <div className="practice-top">
        <span className="practice-lesson">{lesson.name}</span>
        <span className="practice-count">第 {served} 題</span>
      </div>

      {question && (
        <QuestionCard
          key={question.id + '-' + served}
          question={question}
          onAnswered={handleAnswered}
          onAcknowledge={() => setAck(true)}
        />
      )}

      {retryHints > 0 && !done && (
        <p className="facts">今日有 {retryHints} 題可以再試，唔急，隨時都得。</p>
      )}

      <div className="practice-nav">
        <button type="button" className="btn btn-primary btn-wide" disabled={!canProceed} onClick={goNext}>
          下一題 →
        </button>
      </div>

      {/* (C) 答完先出 Home 鍵；(A) 停唔停由佢自己揀 */}
      {canProceed ? (
        <div className="practice-leave">
          <Link className="btn btn-soft btn-wide" to="/">
            🏠 今日夠喇 · 返課文櫃
          </Link>
          <Link className="btn btn-quiet btn-small" to={`/lesson/${lesson.id}`}>
            返課題頁
          </Link>
        </div>
      ) : (
        <p className="facts practice-note">答完呢題，就可以揀返課文櫃。</p>
      )}
    </div>
  )
}
