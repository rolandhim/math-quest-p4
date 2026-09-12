/* ════════════════════════════════════════════════════════════
   mq4 — templates/reverse-subtract.js
   課題 1 題型 3：逆向合併（減法）。例：4×25 − 4×6 → 4×(25−6)（課本 p7）。
   ⚠️ 減法題：保證 b > c，結果非負（小四未學負數）。
   ════════════════════════════════════════════════════════════ */

import { randInt } from '../rng.js'
import { verifyQuestion } from '../verify.js'
import { mkTrap, capFactor, commonMistakeFrom, safeNote } from './_common.js'

export const TEMPLATE_ID = 'reverse-subtract'
export const LESSON = '1'
export const TOPIC = 'distributive'
export const ANGLE = 'subtract'
export const CONCEPT_SOURCE = { pages: '7', concept: 'distributive' }
export const DIFFICULTY = 'advanced'

export function generate(rng, _difficulty = null, _level = null, seed = 0) {
  const b = randInt(rng, 11, 90) // 被減數（≥11 先有空間畀 c）
  const c = randInt(rng, 10, b - 1) // 減數，必細過 b → b−c ≥ 1 非負
  const a = capFactor(rng, b - c)

  const operands = [a, b, c]
  const answer = a * (b - c)
  const id = `l1-subtract-${String(seed).padStart(5, '0')}`
  const traps = [
    mkTrap('a*(b+c)', operands, '把減當成加嚟合'),
    mkTrap('a*b', operands, '只計咗第一組，漏咗減第二組'),
    mkTrap('a*c', operands, '只計咗減嗰組，漏咗第一組'),
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
    question: `${a} × ${b} − ${a} × ${c} = ?`,
    operands,
    operation: 'a*(b-c)',
    answer: String(answer),
    answerDisplay: String(answer),
    acceptedAnswers: [String(answer)],
    options: [],
    correctIndex: -1,
    estimate: {
      value: a * b,
      operands: [a, b],
      note: safeNote(String(answer),
        () => `${a} × ${b} 已經係 ${a * b}，減完都係幾多？`,
        () => `先分開乘：${a} × ${b} = ${a * b}，${a} × ${c} = ${a * c}，再相減`,
        () => `${a} × ${b} − ${a} × ${c} 嘅結果（${a} × ${b} = ${a * b} 作參考）`,
        () => `答案一定細過 ${a * b}（第一組乘出嚟），再對一對`,
      ),
    },
    errorTraps: traps,
    commonMistake: commonMistakeFrom(traps),
    hint: '兩個乘法式嘅相同嗰個數係邊個？',
    hintLevel1: '兩個乘法式嘅相同嗰個數係邊個？',
    hintLevel2: '減法同加法一樣，都可以提出共同因數。',
    explanationSteps: [
      `兩組都有共同因數 ${a}。`,
      `合埋：${a} × (${b} − ${c})。`,
      `${b} − ${c} = ${b - c}，${a} × ${b - c} = ${answer}。`,
      `覆核（分開計）：${a * b} − ${a * c} = ${a * b - a * c} = ${answer} ✓。`,
    ],
    methods: [
      { id: `${id}-m1`, label: '方法一：分開乘再減', steps: [`${a} × ${b} = ${a * b}`, `${a} × ${c} = ${a * c}`, `${a * b} − ${a * c} = ${answer}`] },
      { id: `${id}-m2`, label: '方法二：合埋先減再乘', steps: [`${b} − ${c} = ${b - c}`, `${a} × ${b - c} = ${answer}`] },
    ],
    source: 'generator',
  }

  verifyQuestion(q)
  return q
}

export default { id: TEMPLATE_ID, generate }
