/* ════════════════════════════════════════════════════════════
   mq4 — templates/_common.js
   課題 1（乘法分配性質）其餘 10 款題型共用嘅小工具。

   ⚠️ 呢個檔唔係 template（冇 TEMPLATE_ID / generate），
   registry.js 唔會 import 佢，純粹畀其他 template 用。

   鐵律沿用 symbol-blank.js：
     - errorTrap op 必須喺 verify.js 白名單（a/b/c/b+c/a*b/a*c/a*(b+c)）
     - 答案全部由 operands 重算，唔准手寫
   ════════════════════════════════════════════════════════════ */

import { shuffle, makeRng } from '../rng.js'

/* ════════════════════════════════════════════════════════════
   課題 1 五款「同組數字」題型嘅 operand 流管理
   （forward-expand / reverse-combine / fastest / find-error /
    word-to-expression）。

   問題：呢五款本來共用同一段產生 operands 嘅 code，同一個 seed
   自然出同一組數字（實測 98.7% 撞題）。

   機制：
   - ~85% seed（唔同組）→ 每款 template 用自己嘅 salt 砌一把獨立 rng，
     五款唔再撞同一組數字。
   - ~15% seed（刻意同組）→ 五款共用同一把 rng（makeRng(seed)），
     出同一組 (數字, 答案)，做「同一條數換外衣」嘅變通訓練。
   - 規律可預測：seed % 100 < 15 就係同組 seed；同一 seed 永遠同結果。
   ════════════════════════════════════════════════════════════ */

/** 每 100 個 seed 有 15 個刻意同組（= 15% 變通訓練） */
export const LINKED_NUM = 15
export const LINKED_DEN = 100

/** 每款 template 一個唔同嘅 salt（任意 32-bit 常數，唔可以撞） */
const OPERAND_SALTS = {
  'forward-expand': 0x9e3779b9,
  'reverse-combine': 0x85ebca6b,
  fastest: 0xc2b2ae35,
  'find-error': 0x27d4eb2f,
  'word-to-expression': 0x165667b1,
  // 課題 2（乘法的運算）12 款 —— 每款唔同 salt，避免唔同題型出同一組數字
  'tens-multiply': 0x3c6ef372,
  'two-digit-expand': 0x1a2b3c4d,
  'two-digit-swap': 0x5d4e3f2a,
  'three-by-two': 0x7f8e9d0c,
  'mid-zero': 0x9b0a1c2d,
  'estimate-first': 0xa5b6c7d8,
  'triple-product': 0xe9f8a7b6,
  'fastest-order': 0xc5d4e3f2,
  'find-error-vertical': 0x8a9b0c1d,
  'reverse-l2': 0x6f7e8d9c,
  'word-problem-l2': 0x1c2d3e4f,
  'symbol-blank-l2': 0x5a6b7c8d,
}

/** 呢個 seed 係咪「刻意同組」seed（可預測規律） */
export function isLinkedSeed(seed) {
  return ((Number(seed) >>> 0) % LINKED_DEN) < LINKED_NUM
}

/**
 * 由 seed + template id 砌一把 operand 專用 rng。
 * - 同組 seed → 五款共用 makeRng(seed)（同一條流 → 同一組數字）
 * - 唔同組 seed → 每款 template 用自己嘅 salt（唔同流 → 唔同數字）
 * @param {number} seed
 * @param {string} templateId
 * @returns {() => number}
 */
export function operandRng(seed, templateId) {
  const s = Number(seed) >>> 0
  if (isLinkedSeed(s)) return makeRng(s)
  const salt = OPERAND_SALTS[templateId] ?? 0
  return makeRng((s ^ salt) >>> 0)
}

/** 同 verify.js TRAP_OPS 白名單完全一致（呢度只係預先計出 value） */
export function deriveTrap(op, o) {
  switch (op) {
    case 'a':
      return o[0]
    case 'b':
      return o[1]
    case 'c':
      return o[2]
    case 'b+c':
      return o[1] + o[2]
    case 'a*b':
      return o[0] * o[1]
    case 'a*c':
      return o[0] * o[2]
    case 'a*(b+c)':
      return o[0] * (o[1] + o[2])
    default:
      throw new Error('_common: errorTrap op 未支援 ' + op)
  }
}

/** 砌一個 errorTrap（value 由 operands 重算，唔准手寫） */
export function mkTrap(op, operands, label) {
  return { op, value: deriveTrap(op, operands.map(Number)), label }
}

/**
 * 揀因數，保證 answer ≤ 1000（verify.js V3 上限）。
 * 因數範圍跟 symbol-blank：2–20。
 * @param {()=>number} rng
 * @param {number} sumOrProduct  括號內和／差／已定乘積
 * @returns {number} 2..min(20, floor(1000/sumOrProduct))
 */
export function capFactor(rng, sumOrProduct) {
  const hi = Math.min(20, Math.floor(1000 / sumOrProduct))
  const lo = 2
  if (hi < lo) throw new Error('_common: capFactor hi(' + hi + ') < lo(' + lo + ')')
  return lo + Math.floor(rng() * (hi - lo + 1))
}

/**
 * 砌 MC 選項：answer + 3 個 trap 值，洗牌，回傳 options + correctIndex。
 * 四值必須互不相等（否則 throw，由模板 regenerate 兜）。
 * @returns {{options: string[], correctIndex: number}}
 */
export function buildMc(rng, answer, trapValues) {
  const vals = [answer, ...trapValues].map(String)
  if (new Set(vals).size !== 4) {
    throw new Error('_common: MC 四值唔互異 → ' + vals.join(' | '))
  }
  const options = shuffle(rng, vals)
  return { options, correctIndex: options.indexOf(String(answer)) }
}

/* ════════════════════════════════════════════════════════
   schema v1 共用欄位工具（estimate / commonMistake）
   全部由 operands 程式算出，唔准手寫答案／估算值。
   ════════════════════════════════════════════════════════ */

/** 量級詞：數值 → 小朋友睇得明嘅量級（幾十/幾百/幾千/幾萬） */
export function magnitudeWord(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '個位數'
  if (n >= 10000) return '幾萬'
  if (n >= 1000) return '幾千'
  if (n >= 100) return '幾百'
  if (n >= 10) return '幾十'
  return '個位數'
}

/** 由 errorTraps 推導 commonMistake（取第一個 trap 嘅人話描述） */
export function commonMistakeFrom(traps) {
  if (!Array.isArray(traps) || traps.length === 0) return ''
  const first = traps[0]
  return (first && typeof first.label === 'string' && first.label) ? first.label : ''
}

/**
 * a×X 嘅量級估算（X 係括號內嘅和）。
 * 將 X 向下 round 到整十；若 X 本身係整十就改用 X−10。
 * 保證 value = a×estX ≠ a×X（answer），且 value 恆細過 answer，
 * 所以 note 唔會撞到答案字串。
 */
export function productEstimate(a, X) {
  let estX = Math.floor(X / 10) * 10
  if (estX === X) estX = X - 10
  if (estX < 1) estX = 1
  const value = a * estX
  return {
    value,
    operands: [a, estX],
    note: `${a} × ${estX} 已經係 ${value}，答案最少 ${magnitudeWord(value)}`,
  }
}

/**
 * 結構題（答案係空格）嘅量級估算：用「成條式嘅值」做 value，
 * note 只用量級詞（唔含任何會撞到答案嘅數字）。
 * @param {number} whole 成條式嘅數值（由 operands 重算）
 * @param {number[]} operands
 * @param {string} phrasing 結構性描述（唔可以含數字）
 */
export function structuralEstimate(whole, operands, phrasing) {
  return {
    value: whole,
    operands: operands.slice(),
    note: `成條式嘅量級大約「${magnitudeWord(whole)}」，${phrasing}`,
  }
}

/**
 * 砌 estimate.note 兼防洩漏：逐個 builder 試，揀第一個
 * 唔包含答案字串嘅講法（換講法）。全部都洩漏就 throw。
 * @param {string|number} answerStr 答案字串（唔准出現喺 note）
 * @param {...() => string} builders 講法候選（由 operands 即時算出）
 * @returns {string}
 */
/** fallback note 被用咗幾多次（最後防線觸發次數，理想 = 0） */
const __safeNoteFallback = { n: 0 }

/** 畀 gate／驗證器讀取 fallback 觸發次數 */
export function getFallbackCount() {
  return __safeNoteFallback.n
}

/**
 * 課 2（乘法的運算）乘法題嘅量級估算：用「a × (b−1)」做一個
 * 肯定細過答案嘅具體數（a≥2 保證 value ≠ answer），note 含具體數字
 * 畀小朋友代入自己嘅答案去 check 量級，唔含答案本身。
 * @param {number} a 因數一
 * @param {number} b 因數二（答案 = a×b）
 * @param {string|number} answerStr 答案字串（防洩漏）
 * @returns {{value:number, operands:number[], note:string}}
 */
export function mulHint(a, b, answerStr) {
  const lo = Math.max(2, b - 1)
  const value = a * lo
  const note = safeNote(String(answerStr),
    () => `${a} × ${lo} = ${value}，答案應該多過 ${value} 少少`,
    () => `${a} 乘 ${lo} 已經係 ${value}，答案比佢多少少`,
  )
  return { value, operands: [a, lo], note }
}

export function safeNote(answerStr, ...builders) {
  const a = String(answerStr)
  const isNumeric = /^\d+$/.test(a)
  const n = Number(a)
  for (const build of builders) {
    const note = String(build())
    if (isNumeric) {
      // 數字 token 比對：抽出所有整數，只有數值 === answer 先算洩漏。
      // （answer=2 遇上「132」唔算洩漏；answer=2 遇上「2」先算。）
      const tokens = note.match(/\d+/g) ?? []
      const leaked = tokens.some((t) => Number(t) === n)
      if (!leaked) return note
    } else {
      // 非數字答案（choice id）：文字包含比對（保持原有行為）。
      if (note.indexOf(a) === -1) return note
    }
  }
  // 最後防線：safe fallback（唔含任何數字 → 一定唔洩漏），唔再 throw。
  __safeNoteFallback.n += 1
  return '先估一估個量級，再對一對。'
}
