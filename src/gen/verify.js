/* ════════════════════════════════════════════════════════════
   mq4 — verify.js
   每道生成題目即刻自我驗證，違反就 throw（唔准靜靜雞交錯題）。

   V1  由 operands + operation 重算答案 === answer
   V2  等式兩邊代入答案後相等（+ 鐵律：自由符號要約掉）
   V3  答案係整數、喺合理範圍；operands 全部係 ≥2 正整數（擋 0/1/小數/負數）
   V4  hint 唔准包含答案字符串（洩漏掃描）
   V5  MC 選項四值互不相等、correctIndex 指中答案；打字題 options 空、index -1
   V6  每個 errorTrap 由已知錯誤操作推出（白名單重算，唔准手寫）
   ════════════════════════════════════════════════════════════ */

import { computeAnswer } from '../data/lessons.js'
import { evalSide, coefficientOf } from './solve.js'

/** errorTrap 白名單：由 operands=[a,b,c] 推出已知錯誤 */
const TRAP_OPS = {
  a: (o) => o[0],
  b: (o) => o[1],
  c: (o) => o[2],
  'b+c': (o) => o[1] + o[2],
  'a*b': (o) => o[0] * o[1],
  'a*c': (o) => o[0] * o[2],
  'a*(b+c)': (o) => o[0] * (o[1] + o[2]),
}

function fail(q, msg) {
  throw new Error(`verify(${q && q.id})：${msg}`)
}

/**
 * 驗證一條題目，任何違反都 throw。通過就回傳 true。
 * @param {object} q Question
 * @returns {true}
 */
export function verifyQuestion(q) {
  if (!q || typeof q !== 'object') throw new Error('verify: 唔係題目 object')

  // ── V1：由 operands + operation 重算答案 ──────────────────
  const recomputed = computeAnswer(q.operation, q.operands)
  if (String(recomputed) !== String(q.answer)) {
    fail(q, `V1 答案唔符：重算=${recomputed} answer=${q.answer}（op=${q.operation} operands=[${q.operands}]）`)
  }

  // ── V2：等式兩邊代入答案後相等 ────────────────────────────
  if (q.equation) {
    const target = q.targetSymbol
    const freeSyms = Array.isArray(q.freeSymbols) ? q.freeSymbols : []
    if (!target) fail(q, 'V2 有 equation 但冇 targetSymbol')

    const env = { [target]: Number(q.answer) }
    for (const f of freeSyms) env[f] = 7 // 自由符號取任意正整數都應成立
    const lhsVal = evalSide(q.equation.lhs, env)
    const rhsVal = evalSide(q.equation.rhs, env)
    if (lhsVal !== rhsVal) {
      fail(q, `V2 代入答案後兩邊唔相等：lhs=${lhsVal} rhs=${rhsVal}`)
    }

    // 鐵律：每個自由符號喺兩邊嘅係數要一致（先會約掉，先唔會多解）
    for (const f of freeSyms) {
      const Lc = coefficientOf(q.equation.lhs, target, Number(q.answer), f)
      const Rc = coefficientOf(q.equation.rhs, target, Number(q.answer), f)
      if (Lc !== Rc) {
        fail(q, `V2 鐵律違反：自由符號「${f}」冇約掉（係數 ${Lc} ≠ ${Rc}）→ 會多解`)
      }
    }
  }

  // ── V3：答案整數 + 合理範圍；operands 全部 ≥2 正整數 ──────
  const ansNum = Number(q.answer)
  if (!Number.isInteger(ansNum)) fail(q, `V3 答案唔係整數：${q.answer}`)
  if (ansNum < 1 || ansNum > 1000) fail(q, `V3 答案超出合理範圍：${ansNum}`)
  for (const o of q.operands) {
    const n = Number(o)
    if (!Number.isInteger(n) || n < 2) {
      fail(q, `V3 operand 退化（0/1/小數/負數）：${o}`)
    }
  }

  // ── V4：hint 唔准包含答案 ────────────────────────────────
  const ansStr = String(q.answer)
  for (const h of [q.hintLevel1, q.hintLevel2]) {
    if (typeof h === 'string' && h.indexOf(ansStr) !== -1) {
      fail(q, `V4 hint 洩漏答案「${ansStr}」：${h}`)
    }
  }

  // ── V5：MC 選項 / 打字題 ─────────────────────────────────
  if (q.type === 'mc') {
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      fail(q, 'V5 MC 唔係 4 個選項')
    }
    if (new Set(q.options).size !== 4) fail(q, 'V5 MC 選項有重複值')
    if (String(q.options[q.correctIndex]) !== ansStr) {
      fail(q, `V5 correctIndex=${q.correctIndex} 指唔中答案（${q.options[q.correctIndex]} ≠ ${ansStr}）`)
    }
  } else {
    if (!Array.isArray(q.options) || q.options.length !== 0) {
      fail(q, `V5 打字題 options 應該係 []（實際 ${JSON.stringify(q.options)}）`)
    }
    if (q.correctIndex !== -1) fail(q, `V5 打字題 correctIndex 應該係 -1（實際 ${q.correctIndex}）`)
  }

  // ── V6：errorTrap 由白名單錯誤操作重算 ───────────────────
  for (const t of q.errorTraps || []) {
    const derive = TRAP_OPS[t.op]
    if (!derive) fail(q, `V6 errorTrap op 唔喺白名單：${t.op}`)
    if (String(derive(q.operands.map(Number))) !== String(t.value)) {
      fail(q, `V6 errorTrap「${t.op}」手寫值 ${t.value} ≠ 重算 ${derive(q.operands.map(Number))}`)
    }
  }

  return true
}
