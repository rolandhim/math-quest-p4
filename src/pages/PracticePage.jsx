import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getLesson } from '../data/lessons.js'
import { logAnswer } from '../lib/storage.js'
import { useNavLock } from '../lib/navlock.jsx'
import { openLessonSource } from '../lib/practiceBank.js'
import QuestionCard from '../components/QuestionCard.jsx'

/* ════════════════════════════════════════════════════════════
   ④ 練習庫（/lesson/:id/practice）—— 核心

   題目一律嚟自唯讀題庫（src/data/bank/，1,000 條/課題，Stage D）：
     · 主路徑：讀題庫 → shuffle 隊列 → 順序抽（避最近 30 id／15 組 operands）
     · 題庫唔夠／唔存在 → 後備生成器（過 generatorCodeHash 版本檢查先可以用）
     · 題庫走完 → 立即重洗牌再出（❌ 唔准彈「做晒」或死胡同）

   簡報 §1.5 (A) 用戶拍板：唔限數量、冇終點、佢自己揀停
     · 顯示「第 N 題」—— N 一路加上去，冇分母
     · 佢自己撳「🏠 今日夠喇 · 返課文櫃」就停 —— 系統唔幫佢決定

   簡報 §1.5 (C) 做緊唔准走，做完先出 Home 鍵
     · 未答完 → useNavLock(true)：頂部「← 課文櫃 / ← 課題」收埋
     · 答完之後 → 出「下一題」＋「🏠 今日夠喇 · 返課文櫃」

   鍵盤（spec §4）：打字題 Enter = 提交；已提交 → Enter = 下一題
   ════════════════════════════════════════════════════════════ */

export default function PracticePage() {
  const { id } = useParams()
  const lesson = getLesson(id)

  const [source, setSource] = useState(null) // { kind, total, next, persist }
  const [question, setQuestion] = useState(null)
  const [served, setServed] = useState(1) // 「第 N 題」—— 一路加上去，洗完牌都唔歸零
  const [result, setResult] = useState(null)
  const [ack, setAck] = useState(false)
  const [retryHints, setRetryHints] = useState(0) // 今次坐低做，有幾題可以再試
  const [outOfQuestions, setOutOfQuestions] = useState(false) // 後備生成器都冇貨

  // 換課題／首次載入：async 開題庫 → 抽第一題
  useEffect(() => {
    let alive = true
    setSource(null)
    setQuestion(null)
    setServed(1)
    setResult(null)
    setAck(false)
    setRetryHints(0)
    setOutOfQuestions(false)
    ;(async () => {
      const src = await openLessonSource(id)
      if (!alive) return
      setSource(src)
      if (src.kind === 'none') {
        setQuestion(null)
        return
      }
      const q = src.next()
      if (q == null) setOutOfQuestions(true)
      else setQuestion(q)
      if (src.persist) src.persist()
    })()
    return () => {
      alive = false
    }
  }, [id])

  // 「答完」＝答啱，或者已經行到第 3 層（系統出咗正確答案）
  const done = !!result && (result.correct === true || result.isFinalWrong === true)
  // 可以行落去／可以走：第 3 層仲要撳埋「我明喇」
  const canProceed = done && (result.correct === true || ack === true)

  // (C) 未答完 → 收埋頂部返回鍵（只喺真係有題目時先鎖）
  useNavLock(!!question && !canProceed)

  /** 下一題：行到題庫尾就重洗牌，永遠有下一題（冇「做完」） */
  function goNext() {
    if (!canProceed || !source) return
    const nextQ = source.next()
    if (nextQ == null) {
      setQuestion(null)
      setOutOfQuestions(true)
      return
    }
    setQuestion(nextQ)
    setServed((n) => n + 1)
    setResult(null)
    setAck(false)
    if (source.persist) source.persist()
  }

  // 打字題 Enter = 提交；已提交 → Enter = 下一題（用 ref 攞最新 goNext）
  const goNextRef = useRef(goNext)
  goNextRef.current = goNext
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Enter') goNextRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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

  // 載入中（題庫 lazy import 未返）
  if (!source) {
    return (
      <div className="page">
        <div className="practice-top">
          <span className="practice-lesson">{lesson.name}</span>
        </div>
        <p className="empty">準備緊題目，好快開始…</p>
        <p className="facts">{lesson.summary}</p>
      </div>
    )
  }

  // 空題庫（0 題，冇後備）：唔鎖導航，亦唔留一片空白死路 —— 出一條明確嘅出路
  if (source.kind === 'none') {
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

  // 後備生成器都連續 fail → 唔出題（唔准爆、唔准一片空白）
  if (outOfQuestions || !question) {
    return (
      <div className="page">
        <div className="practice-top">
          <span className="practice-lesson">{lesson.name}</span>
        </div>
        <p className="empty">暫時冇題，休息下。</p>
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
