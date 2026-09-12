/* ════════════════════════════════════════════════════════════
   mq4 — templates/decompose.js
   課題 1 題型 4：拆數。例：29×7 = (30−1)×7（課本 p10）。
   問「□」填邊個整十數（答案 = base，由 n±k 重算）。

   機器可讀 equation（用 solve.js 驗唯一解）：
     n × f = (□ ± k) × f
     lhs: [{c: n*f}]
     rhs: [{c: f, syms:[□]}, {c: ±k*f}]   （＋k*f 或 −k*f）
   ════════════════════════════════════════════════════════════ */

import { randInt, pick } from '../rng.js'
import { verifyQuestion } from '../verify.js'
import { uniqueTargetValue } from '../solve.js'
import { mkTrap, commonMistakeFrom, safeNote } from './_common.js'

export const TEMPLATE_ID = 'decompose'
export const LESSON = '1'
export const TOPIC = 'distributive'
export const ANGLE = 'decompose'
export const CONCEPT_SOURCE = { pages: '10', concept: 'distributive' }
export const DIFFICULTY = 'advanced'

const BASES = [20, 30, 40, 50, 60, 70, 80, 90]
const SIGN = { minus: '−', plus: '+' }

export function generate(rng, _difficulty = null, _level = null, seed = 0) {
  const base = pick(rng, BASES) // 整十數（答案）
  const sign = rng() < 0.5 ? 'minus' : 'plus'
  const k = randInt(rng, 2, 9) // 調整量（operand，≥2）
  let f = randInt(rng, 2, 20) // 因數
  const n = sign === 'minus' ? base - k : base + k // 原數
  while (f === base || f === n || f === k) f = randInt(rng, 2, 20) // 保證 trap 互異

  const operands = [n, f, k]
  const answer = base
  const id = `l1-decompose-${String(seed).padStart(5, '0')}`
  const s = SIGN[sign]
  const traps = [
    mkTrap('a', operands, '填返原本嗰個數'),
    mkTrap('c', operands, '填咗調整量'),
    mkTrap('b', operands, '填咗因數'),
  ]

  const q = {
    id,
    lesson: LESSON,
    topic: TOPIC,
    conceptSource: CONCEPT_SOURCE,
    angle: ANGLE,
    difficulty: DIFFICULTY,
    type: 'type-answer',
    answerKind: 'number',
    question: `${n} × ${f} = (□ ${s} ${k}) × ${f}`,
    operands,
    operation: sign === 'minus' ? 'a+c' : 'a-c', // base = n+k（減）／ n−k（加）
    answer: String(answer),
    answerDisplay: String(answer),
    acceptedAnswers: [String(answer)],
    options: [],
    correctIndex: -1,
    estimate: {
      value: n * f,
      operands: [n, f],
      note: safeNote(String(answer),
        () => `左邊 ${n} × ${f} = ${n * f}，右邊都要等於嗰個數`,
        () => `你個整十數代入 (□ ${s} ${k}) × ${f}，要等於左邊 ${n} × ${f} 嘅值`,
        () => `左邊係 ${n} × ${f}，右邊嗰個整十數要令兩邊相等`,
      ),
    },
    errorTraps: traps,
    commonMistake: commonMistakeFrom(traps),
    hint: '搵一個同原本個數最接近嘅整十數。',
    hintLevel1: '搵一個同原本個數最接近嘅整十數。',
    hintLevel2: '填上去嗰個係整十數，唔係調整量。',
    explanationSteps: [
      `${n} 最接近嘅整十數係 ${base}。`,
      `${base} ${s} ${k} = ${n} ✓（拆返原本個數）。`,
      `所以 □ = ${base}。`,
      `驗算：(${base} ${s} ${k}) × ${f} = ${n} × ${f} = ${n * f}，同原本 ${n} × ${f} 相等 ✓。`,
    ],
    methods: [
      { id: `${id}-m1`, label: '方法一：搵整十數', steps: [`${n} 最接近嘅整十數係 ${base}`, `所以 □ = ${base}`] },
      { id: `${id}-m2`, label: '方法二：驗算', steps: [`代 ${base} 入去：${base} ${s} ${k} = ${n}`, `同原本 ${n} 相等 ✓`, `所以 □ = ${base}`] },
    ],
    source: 'generator',
    targetSymbol: '□',
    freeSymbols: [],
    equation: {
      lhs: [{ c: n * f, syms: [] }],
      rhs: sign === 'minus'
        ? [{ c: f, syms: ['□'] }, { c: -k * f, syms: [] }]
        : [{ c: f, syms: ['□'] }, { c: k * f, syms: [] }],
    },
  }

  verifyQuestion(q)
  const unique = uniqueTargetValue(q.equation.lhs, q.equation.rhs, q.targetSymbol)
  if (unique === null || String(unique) !== q.answer) {
    throw new Error(`decompose(${id})：唯一解檢查失敗（solve 得 ${unique}，答案 ${q.answer}）`)
  }
  return q
}

export default { id: TEMPLATE_ID, generate }
