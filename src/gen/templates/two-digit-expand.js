/* ════════════════════════════════════════════════════════════
   mq4 — templates/two-digit-expand.js
   課題 2 題型 2：兩位數乘法（展開）。例 4×12 = 4×10 + 4×2（課本 p15–17）。
   答案由 operands 重算（operation 'a*(b+c)'，b=十位部分、c=個位）。
   ════════════════════════════════════════════════════════════ */

import { randInt } from '../rng.js'
import { verifyQuestion } from '../verify.js'
import { mkTrap, operandRng, mulHint, commonMistakeFrom } from './_common.js'

export const TEMPLATE_ID = 'two-digit-expand'
export const LESSON = '2'
export const TOPIC = 'multiplication'
export const ANGLE = 'two-digit-expand'
export const CONCEPT_SOURCE = { pages: '15-17', concept: 'distributive' }
export const DIFFICULTY = 'basic'

export function generate(rng, _difficulty = null, _level = null, seed = 0) {
  const orng = operandRng(seed, TEMPLATE_ID)
  const a = randInt(orng, 2, 9) // 一位數因數（例：4）
  const tens = randInt(orng, 1, 9) // 兩位數嘅十位
  const ones = randInt(orng, 2, 9) // 兩位數嘅個位（≥2 兼非 0 → 先有「展開」意義）
  const n = tens * 10 + ones

  const operands = [a, tens * 10, ones]
  const answer = a * n
  const id = `l2-expand-${String(seed).padStart(5, '0')}`
  const traps = [
    mkTrap('a*b', operands, '只計咗十位嗰部分'),
    mkTrap('a*c', operands, '只計咗個位嗰部分'),
    mkTrap('b+c', operands, '加咗位值但冇乘'),
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
    question: `${a} × ${n} = ${a} × ${tens * 10} + ${a} × ${ones} = ?`,
    operands,
    operation: 'a*(b+c)',
    answer: String(answer),
    answerDisplay: String(answer),
    acceptedAnswers: [String(answer)],
    options: [],
    correctIndex: -1,
    estimate: mulHint(a, n, answer),
    errorTraps: traps,
    commonMistake: commonMistakeFrom(traps),
    hint: '兩位數拆做「十位 + 個位」，各自乘再加。',
    hintLevel1: '兩位數拆做「十位 + 個位」，各自乘再加。',
    hintLevel2: '十位嗰部分乘完，要記得係「幾十」，唔好淨係乘個位數。',
    explanationSteps: [
      `${n} 拆做 ${tens * 10} + ${ones}。`,
      `${a} × ${tens * 10} = ${a * tens * 10}，${a} × ${ones} = ${a * ones}。`,
      `加埋：${a * tens * 10} + ${a * ones} = ${answer}。`,
      `覆核：${a} × ${n} = ${answer} ✓。`,
    ],
    methods: [
      { id: `${id}-m1`, label: '方法一：拆位展開', steps: [`${n} = ${tens * 10} + ${ones}`, `${a}×${tens * 10} = ${a * tens * 10}`, `${a}×${ones} = ${a * ones}`, `${a * tens * 10} + ${a * ones} = ${answer}`] },
      { id: `${id}-m2`, label: '方法二：直接乘', steps: [`${a} × ${n} = ${answer}`] },
    ],
    source: 'generator',
  }

  verifyQuestion(q)
  return q
}

export default { id: TEMPLATE_ID, generate }
