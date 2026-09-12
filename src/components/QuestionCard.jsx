import { useEffect, useRef, useState } from 'react'
import { isCorrect } from '../lib/grading.js'
import MethodPicker from './MethodPicker.jsx'

/* ════════════════════════════════════════════════════════════
   QuestionCard —— 一版一題（練習庫同溫習卡第 3 步共用同一套元件）

   答錯三層遞進（硬性上限 3 次，唔准無限重試）：
     第 1 次 ❌ 唔准講量級／唔准暗示答案 → 原封不動顯示佢寫嘅答案
              ＋ 輸入框鎖 3 秒
     第 2 次 ✅ 出量級提示（由 question.estimate 拎）＋直式格仔
     第 3 次 ✅ 出正確答案 + 逐步拆解，撳「我明喇」先可以行落去

   ⚠️ 第 1 次錯嘅提示語係固定手寫字串（唔准動態生成），
      免得唔覺意漏咗量級或者答案落去。
   ⚠️ 小朋友介面完全唔顯示錯誤分類（subcodes 只入 storage）。
   ⚠️ 冇計時器、冇排行榜、冇連勝。
   ════════════════════════════════════════════════════════════ */

const LOCK_MS = 3 // 秒

/** ★ 固定手寫字串：只會插入佢自己寫嘅答案，第二句永遠一樣 */
function wrongFirstMessage(input) {
  return `你寫咗「${input}」。對一對題目嘅數字，同你寫嘅係唔係一樣？`
}

export default function QuestionCard({ question, onAnswered, onAcknowledge }) {
  const [input, setInput] = useState('')
  const [attempts, setAttempts] = useState([]) // [{ input, correct }]
  const [phase, setPhase] = useState('answer') // answer | wrong1 | wrong2 | correct | revealed
  const [hintPressed, setHintPressed] = useState(false) // 佢自己撳「要一個提示」
  const [tier2Seen, setTier2Seen] = useState(false) // 系統出過量級提示
  const [acknowledged, setAcknowledged] = useState(false) // 撳過「我明喇」
  const [lockLeft, setLockLeft] = useState(0)
  const inputRef = useRef(null)

  const locked = lockLeft > 0
  const qid = question ? question.id : null

  // 換題就重置
  useEffect(() => {
    setInput('')
    setAttempts([])
    setPhase('answer')
    setHintPressed(false)
    setTier2Seen(false)
    setAcknowledged(false)
    setLockLeft(0)
  }, [qid])

  // 第 1 次錯：輸入框鎖 3 秒
  useEffect(() => {
    if (lockLeft <= 0) return undefined
    const id = setTimeout(() => setLockLeft((n) => Math.max(0, n - 1)), 1000)
    return () => clearTimeout(id)
  }, [lockLeft])

  useEffect(() => {
    if (phase === 'answer' && !locked && inputRef.current) inputRef.current.focus()
  }, [phase, locked])

  if (!question) return null

  const accepted = question.acceptedAnswers && question.acceptedAnswers.length
    ? question.acceptedAnswers
    : [question.answer]
  const steps = Array.isArray(question.explanationSteps) ? question.explanationSteps : []
  const lastInput = attempts.length ? attempts[attempts.length - 1].input : ''

  // 用咗幾多層提示：0 冇 / 1 睇過內建提示 / 2 睇過量級提示 / 3 睇過答案
  const helpLevel = phase === 'revealed' ? 3 : tier2Seen ? 2 : hintPressed ? 1 : 0

  function submit(rawValue) {
    const value = rawValue === undefined ? input : rawValue
    if (locked) return
    const ok = isCorrect(value, accepted)
    const next = attempts.concat([{ input: String(value), correct: ok }])
    const attemptNo = next.length
    setAttempts(next)

    if (ok) {
      setPhase('correct')
      if (onAnswered) {
        onAnswered({
          input: String(value),
          correct: true,
          attemptNo,
          hintLevel: hintPressed ? 1 : 0,
          needsHint: tier2Seen || attemptNo >= 3,
          isFinalWrong: false,
        })
      }
      return
    }

    if (attemptNo === 1) {
      // 第 1 層：唔講量級、唔暗示答案，鎖 3 秒
      setPhase('wrong1')
      setLockLeft(LOCK_MS)
      if (onAnswered) {
        onAnswered({
          input: String(value),
          correct: false,
          attemptNo,
          hintLevel: hintPressed ? 1 : 0,
          needsHint: false,
          isFinalWrong: false,
        })
      }
      return
    }

    if (attemptNo === 2) {
      // 第 2 層：可以出量級提示／直式格仔
      setPhase('wrong2')
      setTier2Seen(true)
      if (onAnswered) {
        onAnswered({
          input: String(value),
          correct: false,
          attemptNo,
          hintLevel: 2,
          needsHint: false,
          isFinalWrong: false,
        })
      }
      return
    }

    // 第 3 層：直接出答案 + 逐步拆解
    setPhase('revealed')
    if (onAnswered) {
      onAnswered({
        input: String(value),
        correct: false,
        attemptNo,
        hintLevel: 3,
        needsHint: true,
        isFinalWrong: true,
      })
    }
  }

  const resolved = phase === 'correct' || phase === 'revealed'
  const showHintText = hintPressed && !resolved

  return (
    <div className="qcard">
      <div className="qcard-head">
        <span className="qcard-badge">
          {question.difficulty === 'challenge'
            ? '挑戰'
            : question.difficulty === 'advanced'
              ? '進階'
              : '基本'}
        </span>
        {question.source && question.source.pages ? (
          <span className="qcard-book">課本 p{question.source.pages}</span>
        ) : null}
      </div>

      <p className="qcard-question">{question.question}</p>

      {/* 輸入框：第 1 次錯嘅時候留住佢寫嘅答案，鎖住（spec：輸入框鎖 3 秒） */}
      {(phase === 'answer' || phase === 'wrong1') && question.type === 'type-answer' && (
        <div className="answer-area">
          <input
            ref={inputRef}
            className="big-input"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={input}
            disabled={locked || phase === 'wrong1'}
            placeholder={locked ? `等 ${lockLeft} 秒…` : '喺度打答案'}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && String(input).trim() !== '') submit()
            }}
            aria-label="答案"
          />
          {phase === 'answer' && (
            <button
              type="button"
              className="btn btn-primary btn-wide"
              disabled={locked || String(input).trim() === ''}
              onClick={() => submit()}
            >
              提交
            </button>
          )}
        </div>
      )}

      {phase === 'answer' && question.type === 'mc' && (
        <div className="options">
          {(question.options || []).map((opt, i) => (
            <button key={i} type="button" className="option" onClick={() => submit(String(opt))}>
              {opt}
            </button>
          ))}
        </div>
      )}

      {phase === 'answer' && !hintPressed && (
        <button type="button" className="btn btn-ghost btn-hint" onClick={() => setHintPressed(true)}>
          要一個提示
        </button>
      )}
      {showHintText && question.hint && <p className="hint-box">提示：{question.hint}</p>}

      {/* 第 1 次錯 */}
      {phase === 'wrong1' && (
        <div className="tier tier-1">
          <p className="tier-msg">{wrongFirstMessage(lastInput)}</p>
          {locked ? (
            <p className="tier-lock">你可以 {lockLeft} 秒後再試。</p>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-wide"
              onClick={() => {
                setInput('')
                setPhase('answer')
              }}
            >
              再試一次
            </button>
          )}
        </div>
      )}

      {/* 第 2 次錯 */}
      {phase === 'wrong2' && (
        <div className="tier tier-2">
          <p className="tier-msg">
            {question.estimate
              ? `${question.estimate.note}，你覺得「${lastInput}」合理嗎？`
              : '先估一估個量級，再對一對。'}
          </p>
          <ColumnGrid question={question} />
          <button
            type="button"
            className="btn btn-primary btn-wide"
            onClick={() => {
              setInput('')
              setPhase('answer')
            }}
          >
            再試一次
          </button>
        </div>
      )}

      {/* 第 3 次錯：出答案 + 逐步拆解 + 撳「我明喇」先准行 */}
      {phase === 'revealed' && (
        <div className="tier tier-3">
          <p className="tier-msg">一齊睇睇點計：</p>
          <p className="answer-line">
            正確答案係 <strong>{question.answer}</strong>
          </p>
        </div>
      )}

      {phase === 'correct' && (
        <div className="tier tier-ok">
          <p className="tier-msg">答啱咗！</p>
        </div>
      )}

      {/* 答完（無論對錯）一定要出正確步驟 */}
      {resolved && steps.length > 0 && (
        <div className="steps-box">
          <h3 className="steps-title">逐步睇一次</h3>
          <ol className="steps">
            {steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      )}

      {/* 每題都要展示兩種方法 + 「兩條路，邊條快？」 */}
      {resolved && <MethodPicker key={question.id} methods={question.methods} />}

      {resolved && question.commonMistake && (
        <p className="common-mistake">好多人都會咁：{question.commonMistake}</p>
      )}

      {phase === 'revealed' && (
        <button
          type="button"
          className="btn btn-primary btn-wide"
          disabled={acknowledged}
          onClick={() => {
            setAcknowledged(true)
            if (onAcknowledge) onAcknowledge(question.id)
          }}
        >
          {acknowledged ? '我明喇 ✓' : '我明喇'}
        </button>
      )}
      {phase === 'correct' && <p className="tier-note">睇完步驟可以撳下面「下一題」。</p>}
    </div>
  )
}

/** 直式格仔（第 2 次錯嘅時候出，幫佢睇位） */
function ColumnGrid({ question }) {
  const ops = question && Array.isArray(question.operands) ? question.operands : []
  if (question.operation !== 'a*b' || ops.length !== 2) return null
  return (
    <div className="column-grid" aria-label="直式格仔">
      <div className="cg-row">{ops[0]}</div>
      <div className="cg-row">
        <span className="cg-times">×</span>
        {ops[1]}
      </div>
      <div className="cg-line" />
      <div className="cg-boxes">
        <span className="cg-box" />
        <span className="cg-box" />
        <span className="cg-box" />
        <span className="cg-box" />
      </div>
    </div>
  )
}
