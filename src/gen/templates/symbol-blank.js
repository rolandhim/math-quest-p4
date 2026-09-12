/* ════════════════════════════════════════════════════════════
   mq4 — templates/symbol-blank.js
   「符號填空（結構辨認）」6 級階梯（課題 1：乘法分配性質，p6–11）。

   鐵律（code-level 保證）：
     除目標符號外，其餘符號必須係「自由符號」——喺兩邊同角色、會約掉。
     （本 6 級入面，自由符號只喺 L4 出現 ■、L6 出現 心形。）

   9 條禁止形式全部由「只生成呢 6 個合法形狀」結構性擋住：
     1 移項 → 形狀都係直接對應，冇常數項要搬
     2 多解 → 自由符號會約掉（verify.js V2 + solve.js 雙重驗證）
     3 符號值唔唯一但冇明示只問另一個 → L4/L6 嘅自由符號題目只問目標符號
     4 0/1 退化 → 因數 2–20、括號內 10–90，operands 全部 ≥2（verify V3）
     5 小數/分數/負數 → 全整數 ≥2（verify V3）
     6 字母 x → 只用 □ ★ ♥ ● ■ + 心形/星星
     7 兩邊冇完整分配結構 → 6 級都係完整分配等價式
     8 符號代表「和」 → 符號只喺因數或括號加數位，唔會等於成條式嘅和
     9 同符號兼「因數」同「加數」 → 每個符號喺一條題只扮一個角色

   符號域 = 1..200 正整數，排除 0（solve.js 窮舉時連自由符號都排除 0）。
   因數範圍 2–20；括號內數字 10–90。
   ════════════════════════════════════════════════════════════ */

import { randInt } from '../rng.js'
import { uniqueTargetValue } from '../solve.js'
import { verifyQuestion } from '../verify.js'
import { commonMistakeFrom, safeNote } from './_common.js'

const S = { square: '□', star: '★', heart: '♥', dot: '●', block: '■' }
const T = { heart: '心形', star: '星星' }

export const TEMPLATE_ID = 'symbol-blank'
export const LESSON = '1'
export const CONCEPT_SOURCE = { pages: '6-11', concept: 'distributive' }
export const TOPIC = 'distributive'
export const ANGLE = 'symbol-blank'

/* 級 → 難度（6 級階梯摺做 3 個難度） */
export const LEVEL_DIFFICULTY = {
  1: 'basic',
  2: 'basic',
  3: 'advanced',
  4: 'advanced',
  5: 'challenge',
  6: 'challenge',
}

export const LEVELS = [1, 2, 3, 4, 5, 6]

/* ── 每級嘅符號 ───────────────────────────────────────── */
function symbols(level) {
  switch (level) {
    case 1:
      return { target: S.square, free: [] }
    case 2:
      return { target: S.star, free: [] }
    case 3:
      return { target: S.star, free: [] }
    case 4:
      return { target: S.star, free: [S.block] }
    case 5:
      return { target: S.star, free: [] }
    case 6:
      return { target: T.star, free: [T.heart] }
    default:
      throw new Error('symbol-blank: 未知級別 ' + level)
  }
}

/* ── 每級：由 (a, b, c) 砌出 題目字串 + 兩邊 monomials + 答案 ── */
function buildShape(level, a, b, c, sym) {
  const X = sym.target
  const free = sym.free[0] || null

  switch (level) {
    /* L1：分→合，空括號內　a×b + a×c = a×(b+□)　→ □=c */
    case 1:
      return {
        question: `${a} × ${b} + ${a} × ${c} = ${a} × (${b} + ${X})`,
        lhs: [{ c: a * b, syms: [] }, { c: a * c, syms: [] }],
        rhs: [{ c: a * b, syms: [] }, { c: a, syms: [X] }],
        answer: c,
        answerOp: 'c',
        label: '分開乘咗兩次，再合返括號',
      }

    /* L2：合→分，空展開項因數　a×(b+c) = a×b + a×★　→ ★=c */
    case 2:
      return {
        question: `${a} × (${b} + ${c}) = ${a} × ${b} + ${a} × ${X}`,
        lhs: [{ c: a * b, syms: [] }, { c: a * c, syms: [] }],
        rhs: [{ c: a * b, syms: [] }, { c: a, syms: [X] }],
        answer: c,
        answerOp: 'c',
        label: '由括號拆返開嚟乘',
      }

    /* L3：空共同因數（符號只出現一次）　a×b + a×c = ★×(b+c)　→ ★=a */
    case 3:
      return {
        question: `${a} × ${b} + ${a} × ${c} = ${X} × (${b} + ${c})`,
        lhs: [{ c: a * b, syms: [] }, { c: a * c, syms: [] }],
        rhs: [{ c: b, syms: [X] }, { c: c, syms: [X] }],
        answer: a,
        answerOp: 'a',
        label: '搵共同因數（兩組都有嘅數）',
      }

    /* L4：兩個符號，一個自由　■×(b+★) = ■×b + ■×c　→ ★=c（■ 自由） */
    case 4:
      return {
        question: `${free} × (${b} + ${X}) = ${free} × ${b} + ${free} × ${c}`,
        lhs: [{ c: b, syms: [free] }, { c: 1, syms: [free, X] }],
        rhs: [{ c: b, syms: [free] }, { c: c, syms: [free] }],
        answer: c,
        answerOp: 'c',
        label: '兩個符號，一個喺兩邊都出現（可約走）',
      }

    /* L5：兩邊因數唔對稱　a×(b+c) = ★×b + a×c　→ ★=a */
    case 5:
      return {
        question: `${a} × (${b} + ${c}) = ${X} × ${b} + ${a} × ${c}`,
        lhs: [{ c: a * b, syms: [] }, { c: a * c, syms: [] }],
        rhs: [{ c: b, syms: [X] }, { c: a * c, syms: [] }],
        answer: a,
        answerOp: 'a',
        label: '逐項對應（兩邊因數唔對稱）',
      }

    /* L6：文字符號 + 忽略自由符號　心形×(b+c) = 心形×b + 心形×星星　→ 星星=c */
    case 6:
      return {
        question: `${free} × (${b} + ${c}) = ${free} × ${b} + ${free} × ${X}`,
        lhs: [{ c: b, syms: [free] }, { c: c, syms: [free] }],
        rhs: [{ c: b, syms: [free] }, { c: 1, syms: [free, X] }],
        answer: c,
        answerOp: 'c',
        label: '文字符號 + 忽略自由符號',
      }

    default:
      throw new Error('symbol-blank: 未知級別 ' + level)
  }
}

/* ── 每級嘅提示（結構性、零數字 → 唔會洩漏答案） ────────── */
const HINTS = {
  1: { h1: '睇下左邊兩組乘法，邊個數重複出現？', h2: '空位對應左邊第二組嗰個數。' },
  2: { h1: '左邊括號入面有兩個數，右邊要拆開嚟乘。', h2: '空位對應括號入面第二個數。' },
  3: { h1: '左邊兩組都有同一個數，嗰個就係共同因數。', h2: '括號外面嗰個符號，代表邊個數？' },
  4: { h1: '有兩個符號：一個喺兩邊都出現，一個淨係出現一次。', h2: '兩邊都出現嗰個會約走，真正要答嘅係另一個。' },
  5: { h1: '右邊兩項嘅因數唔同，要逐項對應。', h2: '空位嗰項，對應左邊邊一項？' },
  6: { h1: '心形喺兩邊都出現，可以先忽略佢。', h2: '星星對應括號入面邊個數？' },
}

/* ── 每級嘅 errorTraps（由 operands 重算，白名單 op） ──── */
function errorTrapsFor(level, a, b, c, answer) {
  const mk = (op, label) => ({ op, value: deriveTrap(op, [a, b, c]), label })
  switch (level) {
    case 1:
    case 2:
      return [
        mk('b', '把括號入面第一個數當成答案'),
        mk('a', '把共同因數當成答案'),
        mk('b+c', '把括號入面兩數相加當成答案'),
      ]
    case 3:
      return [
        mk('b', '把第一個加數當成答案'),
        mk('c', '把第二個加數當成答案'),
        mk('b+c', '把括號內兩數相加當成答案'),
      ]
    case 4:
      return [
        mk('b', '把括號內第一個數當成答案'),
        mk('b+c', '把括號內兩數相加當成答案'),
      ]
    case 5:
      return [
        mk('b', '把第一個加數當成答案'),
        mk('c', '把第二個加數當成答案'),
        mk('a*c', '把右邊已知項嘅積當成答案'),
      ]
    case 6:
      return [
        mk('b', '把括號內第一個數當成答案'),
        mk('b+c', '把括號內兩數相加當成答案'),
      ]
    default:
      throw new Error('symbol-blank: 未知級別 ' + level)
  }
}

/* 同 verify.js 嘅白名單一致（呢度只係預先計出 value 擺入 errorTrap） */
function deriveTrap(op, o) {
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
      throw new Error('symbol-blank: errorTrap op 未支援 ' + op)
  }
}

/* ── 每級嘅解釋步驟（用真數字） ─────────────────────────── */
function explanationFor(level, shape, a, b, c) {
  const X = symbols(level).target
  const ans = shape.answer
  switch (level) {
    case 1:
      return [
        `左邊係 ${a}×${b} + ${a}×${c}，兩組都有共同因數 ${a}。`,
        `右邊 ${a}×(${b}+${X})，括號內第一個數 ${b} 對應左邊第一組。`,
        `所以空位對應左邊第二組嘅 ${c} → ${X} = ${ans}。`,
        `驗算：${a}×(${b}+${c}) = ${a}×${b + c} = ${a * (b + c)}，左邊 ${a * b}+${a * c} = ${a * b + a * c}，相等 ✓。`,
      ]
    case 2:
      return [
        `左邊 ${a}×(${b}+${c}) 要拆開嚟乘：${a}×${b} + ${a}×${c}。`,
        `右邊 ${a}×${b} + ${a}×${X}，第一項已對應 ${b}。`,
        `所以空位對應括號內第二個數 ${c} → ${X} = ${ans}。`,
        `驗算：${a}×${b} + ${a}×${c} = ${a * b} + ${a * c} = ${a * b + a * c}，同左邊 ${a * (b + c)} 相等 ✓。`,
      ]
    case 3:
      return [
        `左邊 ${a}×${b} + ${a}×${c}，兩組嘅共同因數係 ${a}。`,
        `右邊 ${X}×(${b}+${c})，括號外面就係共同因數。`,
        `所以 ${X} = ${ans}。`,
        `驗算：${a}×(${b}+${c}) = ${a}×${b + c} = ${a * (b + c)}，左邊 ${a * b}+${a * c} = ${a * b + a * c}，相等 ✓。`,
      ]
    case 4: {
      const free = symbols(level).free[0]
      return [
        `${free} 喺等式兩邊都出現、角色一樣，所以佢會約走，唔使求。`,
        `右邊 ${free}×${b} + ${free}×${c} 對應左邊 ${free}×(${b}+${X})。`,
        `所以 ${X} = ${c} = ${ans}。`,
        `驗算（任取 ${free}=7）：左邊 7×(${b}+${c}) = ${7 * (b + c)}，右邊 7×${b}+7×${c} = ${7 * (b + c)}，相等 ✓。`,
      ]
    }
    case 5:
      return [
        `左邊 ${a}×(${b}+${c})，右邊 ${X}×${b} + ${a}×${c}。`,
        `右邊第二項 ${a}×${c} 已對應左邊 ${a}×${c}，所以第一項要對應 ${a}×${b}。`,
        `因此 ${X} = ${ans}。`,
        `驗算：${a}×${b} + ${a}×${c} = ${a * b} + ${a * c} = ${a * (b + c)}，同左邊相等 ✓。`,
      ]
    case 6: {
      const free = symbols(level).free[0]
      return [
        `${free} 喺兩邊都出現，可以先忽略佢。`,
        `右邊 ${free}×${b} + ${free}×${X} 對應左邊 ${free}×(${b}+${c})。`,
        `所以 ${X} = ${c} = ${ans}。`,
        `驗算（任取 ${free}=5）：左邊 5×(${b}+${c}) = ${5 * (b + c)}，右邊 5×${b}+5×${c} = ${5 * (b + c)}，相等 ✓。`,
      ]
    }
    default:
      throw new Error('symbol-blank: 未知級別 ' + level)
  }
}

/* ── 每級嘅 2 個方法 ───────────────────────────────────── */
function methodsFor(id, level, shape, a, b, c) {
  const X = symbols(level).target
  const ans = shape.answer
  switch (level) {
    case 1:
      return [
        { id: `${id}-m1`, label: '方法一：對應法', steps: [`左邊第二組係 ${a}×${c}`, `對應括號內第二個位`, `所以 ${X} = ${ans}`] },
        { id: `${id}-m2`, label: '方法二：驗算法', steps: [`假設 ${X} = ${c}`, `右邊 = ${a}×(${b}+${c}) = ${a * (b + c)}`, `左邊 = ${a * b} + ${a * c} = ${a * b + a * c}`, `兩邊相等 ✓`] },
      ]
    case 2:
      return [
        { id: `${id}-m1`, label: '方法一：對應法', steps: [`括號內第二個數係 ${c}`, `對應右邊 ${a}×${X}`, `所以 ${X} = ${ans}`] },
        { id: `${id}-m2`, label: '方法二：驗算法', steps: [`假設 ${X} = ${c}`, `右邊 = ${a}×${b} + ${a}×${c} = ${a * (b + c)}`, `左邊 = ${a}×(${b}+${c}) = ${a * (b + c)}`, `兩邊相等 ✓`] },
      ]
    case 3:
      return [
        { id: `${id}-m1`, label: '方法一：找共同因數', steps: [`左邊兩組都有 ${a}`, `右邊括號外就係共同因數`, `所以 ${X} = ${ans}`] },
        { id: `${id}-m2`, label: '方法二：驗算法', steps: [`假設 ${X} = ${a}`, `右邊 = ${a}×(${b}+${c}) = ${a * (b + c)}`, `左邊 = ${a * b} + ${a * c} = ${a * b + a * c}`, `兩邊相等 ✓`] },
      ]
    case 4: {
      const free = symbols(level).free[0]
      return [
        { id: `${id}-m1`, label: '方法一：先約走自由符號', steps: [`${free} 兩邊都出現，約走佢`, `剩低 ${b}+${X} = ${b}+${c}`, `所以 ${X} = ${ans}`] },
        { id: `${id}-m2`, label: '方法二：對應法', steps: [`右邊 ${free}×${c} 對應左邊 ${free}×${X}`, `所以 ${X} = ${c}`, `即係 ${ans}`] },
      ]
    }
    case 5:
      return [
        { id: `${id}-m1`, label: '方法一：逐項對應', steps: [`右邊 ${a}×${c} 已對應左邊 ${a}×${c}`, `剩低 ${X}×${b} 要對應 ${a}×${b}`, `所以 ${X} = ${ans}`] },
        { id: `${id}-m2`, label: '方法二：驗算法', steps: [`假設 ${X} = ${a}`, `右邊 = ${a}×${b} + ${a}×${c} = ${a * (b + c)}`, `左邊 = ${a}×(${b}+${c}) = ${a * (b + c)}`, `兩邊相等 ✓`] },
      ]
    case 6: {
      const free = symbols(level).free[0]
      return [
        { id: `${id}-m1`, label: '方法一：忽略自由符號', steps: [`${free} 兩邊都出現，忽略佢`, `剩低 ${b}+${c} = ${b}+${X}`, `所以 ${X} = ${ans}`] },
        { id: `${id}-m2`, label: '方法二：對應法', steps: [`右邊 ${free}×${X} 對應左邊 ${free}×${c}`, `所以 ${X} = ${c}`, `即係 ${ans}`] },
      ]
    }
    default:
      throw new Error('symbol-blank: 未知級別 ' + level)
  }
}

/* ── 生成指定級別嘅題目 ───────────────────────────────── */
export function generateLevel(rng, level, seed) {
  if (!LEVELS.includes(level)) throw new Error('symbol-blank: 未知級別 ' + level)

  let a = randInt(rng, 2, 20) // 因數（L4/L6 係自由符號嘅名義值）
  let b = randInt(rng, 10, 90) // 括號內第一個數
  let c = randInt(rng, 10, 90) // 括號內第二個數（多數級嘅答案）
  while (c === b) c = randInt(rng, 10, 90) // b、c 唔可以相同（否則結構模糊）

  const sym = symbols(level)
  const shape = buildShape(level, a, b, c, sym)
  const difficulty = LEVEL_DIFFICULTY[level]
  const id = `sb-L${level}-${String(seed).padStart(5, '0')}`
  const traps = errorTrapsFor(level, a, b, c, shape.answer)
  const whole = a * (b + c) // 成條分配等價式嘅量級（兩邊相等）
  const ansStr = String(shape.answer)
  let estimateNote
  switch (level) {
    case 1:
    case 3:
      estimateNote = safeNote(ansStr,
        () => `左邊兩組乘法加埋係 ${whole}，右邊計出嚟都要係嗰個數`,
        () => `成條式嘅值係 ${whole}，你個答案要令兩邊相等`,
      )
      break
    case 2:
    case 5:
      estimateNote = safeNote(ansStr,
        () => `左邊拆開嚟乘再加埋係 ${whole}，右邊計出嚟都要係嗰個數`,
        () => `成條式嘅值係 ${whole}，你個答案要令兩邊相等`,
      )
      break
    case 4:
      estimateNote = safeNote(ansStr,
        () => `右邊係 ${b} 同另一個數，左邊括號入面係 ${b} 加你個答案`,
        () => `左右兩邊嘅值都係 ${whole}（代返符號入去），你個答案要令兩邊相等`,
      )
      break
    case 6:
      estimateNote = safeNote(ansStr,
        () => `左邊係 ${b} 同另一個數，右邊括號入面係 ${b} 加你個答案`,
        () => `左右兩邊嘅值都係 ${whole}（代返符號入去），你個答案要令兩邊相等`,
      )
      break
    default:
      throw new Error('symbol-blank: 未知級別 ' + level)
  }

  const q = {
    id,
    lesson: LESSON,
    topic: TOPIC,
    conceptSource: CONCEPT_SOURCE,
    angle: ANGLE,
    difficulty,
    level,
    type: 'type-answer',
    answerKind: 'number',
    question: shape.question,
    operands: [a, b, c],
    operation: shape.answerOp,
    answer: String(shape.answer),
    answerDisplay: String(shape.answer),
    acceptedAnswers: [String(shape.answer)],
    options: [],
    correctIndex: -1,
    estimate: {
      value: whole,
      operands: [a, b, c],
      note: estimateNote,
    },
    errorTraps: traps,
    commonMistake: commonMistakeFrom(traps),
    hint: HINTS[level].h1,
    hintLevel1: HINTS[level].h1,
    hintLevel2: HINTS[level].h2,
    explanationSteps: explanationFor(level, shape, a, b, c),
    methods: methodsFor(id, level, shape, a, b, c),
    source: 'generator',
    // 額外欄位（verify.js V2 + solve.js 用）
    targetSymbol: sym.target,
    freeSymbols: sym.free,
    equation: { lhs: shape.lhs, rhs: shape.rhs },
  }

  // 即刻自我驗證：V1–V6 + 唯一解（違反就 throw，唔準交錯題）
  verifyQuestion(q)
  const unique = uniqueTargetValue(q.equation.lhs, q.equation.rhs, q.targetSymbol)
  if (unique === null || String(unique) !== q.answer) {
    throw new Error(`symbol-blank(${id})：唯一解檢查失敗（solve 得 ${unique}，答案 ${q.answer}）`)
  }

  return q
}

/**
 * 模板入口（registry 用）。
 * @param {() => number} rng
 * @param {string|null} difficulty 'basic'|'advanced'|'challenge'
 * @param {number|null} level 強制指定級別（測試覆蓋用）
 * @param {number} seed 用嚟砌 id
 */
export function generate(rng, difficulty = null, level = null, seed = 0) {
  let lv = level
  if (lv === null) {
    const pool = difficulty
      ? LEVELS.filter((L) => LEVEL_DIFFICULTY[L] === difficulty)
      : LEVELS
    lv = pool[randInt(rng, 0, pool.length - 1)]
  }
  return generateLevel(rng, lv, seed)
}

export default { id: TEMPLATE_ID, generate, generateLevel }
