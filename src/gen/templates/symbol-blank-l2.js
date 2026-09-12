/* ════════════════════════════════════════════════════════════
   mq4 — templates/symbol-blank-l2.js
   課題 2 題型 12：符號填空（結構辨認）★（課本 p15 展開）。
   例 4×12 = 4×10 + 4×□ → □=2。
   唯一符號（冇自由符號），solve.js 窮舉唯一解；唔准移項。
   ════════════════════════════════════════════════════════════ */

import { randInt } from '../rng.js'
import { verifyQuestion } from '../verify.js'
import { uniqueTargetValue } from '../solve.js'
import { mkTrap, operandRng, commonMistakeFrom, safeNote } from './_common.js'

export const TEMPLATE_ID = 'symbol-blank-l2'
export const LESSON = '2'
export const TOPIC = 'multiplication'
export const ANGLE = 'symbol-blank-l2'
export const CONCEPT_SOURCE = { pages: '15', concept: 'distributive' }
export const DIFFICULTY = 'basic'

export const LEVELS = [1, 2]
const S = { square: '□', star: '★' }

/* L1：空個位　a × n = a × 十位部分 + a × □　→ □=個位
   L2：空十位　a × n = a × ★ + a × 個位　　→ ★=十位部分 */
function buildShape(level, a, t10, o, n) {
  if (level === 1) {
    return {
      question: `${a} × ${n} = ${a} × ${t10} + ${a} × ${S.square}`,
      lhs: [{ c: a * n, syms: [] }],
      rhs: [{ c: a * t10, syms: [] }, { c: a, syms: [S.square] }],
      answer: o,
      answerOp: 'c',
      target: S.square,
    }
  }
  return {
    question: `${a} × ${n} = ${a} × ${S.star} + ${a} × ${o}`,
    lhs: [{ c: a * n, syms: [] }],
    rhs: [{ c: a, syms: [S.star] }, { c: a * o, syms: [] }],
    answer: t10,
    answerOp: 'b',
    target: S.star,
  }
}

const HINTS = {
  1: { h1: '左邊係一個數乘兩位數，右邊拆開咗嚟乘。', h2: '空位對應兩位數嘅個位。' },
  2: { h1: '左邊係一個數乘兩位數，右邊拆開咗嚟乘。', h2: '空位對應兩位數嘅十位部分（幾十）。' },
}

export function generate(rng, _difficulty = null, level = null, seed = 0) {
  const orng = operandRng(seed, TEMPLATE_ID)
  const lv = level === null ? LEVELS[randInt(orng, 0, LEVELS.length - 1)] : level
  const a = randInt(orng, 2, 9) // 因數（例：4）
  const tens = randInt(orng, 1, 9) // 十位
  const ones = randInt(orng, 2, 9) // 個位（≥2 兼非 0）
  const t10 = tens * 10
  const n = t10 + ones

  const shape = buildShape(lv, a, t10, ones, n)
  const operands = [a, t10, ones]
  const id = `l2-sb-L${lv}-${String(seed).padStart(5, '0')}`
  const traps = [
    mkTrap('a*b', operands, '把十位部分當成答案'),
    mkTrap('a*c', operands, '把個位部分當成答案'),
    mkTrap('a', operands, '把共同因數當成答案'),
  ]
  const whole = a * n

  const q = {
    id,
    lesson: LESSON,
    topic: TOPIC,
    conceptSource: CONCEPT_SOURCE,
    angle: ANGLE,
    difficulty: DIFFICULTY,
    level: lv,
    type: 'type-answer',
    answerKind: 'number',
    question: shape.question,
    operands,
    operation: shape.answerOp,
    answer: String(shape.answer),
    answerDisplay: String(shape.answer),
    acceptedAnswers: [String(shape.answer)],
    options: [],
    correctIndex: -1,
    estimate: {
      value: whole,
      operands: [a, t10, ones],
      note: safeNote(String(shape.answer),
        () => `左邊 ${a} × ${n} = ${whole}，右邊計出嚟都要係 ${whole}`,
        () => `成條式嘅值係 ${whole}，你個答案要令兩邊相等`,
      ),
    },
    errorTraps: traps,
    commonMistake: commonMistakeFrom(traps),
    hint: HINTS[lv].h1,
    hintLevel1: HINTS[lv].h1,
    hintLevel2: HINTS[lv].h2,
    explanationSteps: lv === 1
      ? [
          `左邊 ${a} × ${n}，右邊拆做 ${a} × ${t10} + ${a} × □。`,
          `${a} × ${t10} 已對應 ${t10}，所以空位對應 ${ones}。`,
          `□ = ${ones}。`,
          `驗算：${a} × ${t10} + ${a} × ${ones} = ${a * t10} + ${a * ones} = ${whole}，同左邊 ${a} × ${n} = ${whole} 相等 ✓。`,
        ]
      : [
          `左邊 ${a} × ${n}，右邊拆做 ${a} × ★ + ${a} × ${ones}。`,
          `${a} × ${ones} 已對應 ${ones}，所以空位對應十位部分 ${t10}。`,
          `★ = ${t10}。`,
          `驗算：${a} × ${t10} + ${a} × ${ones} = ${a * t10} + ${a * ones} = ${whole}，同左邊 ${a} × ${n} = ${whole} 相等 ✓。`,
        ],
    methods: lv === 1
      ? [
          { id: `${id}-m1`, label: '方法一：對應法', steps: [`右邊 ${a} × ${t10} 對應十位 ${t10}`, `空位對應個位 ${ones}`, `所以 □ = ${ones}`] },
          { id: `${id}-m2`, label: '方法二：驗算法', steps: [`假設 □ = ${ones}`, `右邊 = ${a}×${t10} + ${a}×${ones} = ${whole}`, `左邊 = ${a}×${n} = ${whole}`, `兩邊相等 ✓`] },
        ]
      : [
          { id: `${id}-m1`, label: '方法一：對應法', steps: [`右邊 ${a} × ${ones} 對應個位 ${ones}`, `空位對應十位部分 ${t10}`, `所以 ★ = ${t10}`] },
          { id: `${id}-m2`, label: '方法二：驗算法', steps: [`假設 ★ = ${t10}`, `右邊 = ${a}×${t10} + ${a}×${ones} = ${whole}`, `左邊 = ${a}×${n} = ${whole}`, `兩邊相等 ✓`] },
        ],
    source: 'generator',
    targetSymbol: shape.target,
    freeSymbols: [],
    equation: { lhs: shape.lhs, rhs: shape.rhs },
  }

  verifyQuestion(q)
  const unique = uniqueTargetValue(q.equation.lhs, q.equation.rhs, q.targetSymbol)
  if (unique === null || String(unique) !== q.answer) {
    throw new Error(`symbol-blank-l2(${id})：唯一解檢查失敗（solve 得 ${unique}，答案 ${q.answer}）`)
  }
  return q
}

export default { id: TEMPLATE_ID, generate }
