/* ════════════════════════════════════════════════════════════
   mq4 — templates/word-to-expression.js
   課題 1 題型 8：文字轉算式。情境（兩樣嘢單價相同）→ 列式計算（課本 p6–7）。
   答案 = 總價 = a×(b+c)，由 operands 重算。
   ════════════════════════════════════════════════════════════ */

import { randInt } from '../rng.js'
import { verifyQuestion } from '../verify.js'
import { mkTrap, capFactor, operandRng, productEstimate, commonMistakeFrom } from './_common.js'

export const TEMPLATE_ID = 'word-to-expression'
export const LESSON = '1'
export const TOPIC = 'distributive'
export const ANGLE = 'word-to-expression'
export const CONCEPT_SOURCE = { pages: '6-7', concept: 'distributive' }
export const DIFFICULTY = 'basic'

export function generate(rng, _difficulty = null, _level = null, seed = 0) {
  const orng = operandRng(seed, TEMPLATE_ID)
  let b = randInt(orng, 10, 90)
  let c = randInt(orng, 10, 90)
  while (c === b) c = randInt(orng, 10, 90)
  const a = capFactor(orng, b + c)

  const operands = [a, b, c]
  const answer = a * (b + c)
  const id = `l1-word-${String(seed).padStart(5, '0')}`
  const traps = [
    mkTrap('a*b', operands, '淨係計咗鉛筆'),
    mkTrap('a*c', operands, '淨係計咗間尺'),
    mkTrap('b+c', operands, '加咗數量但冇乘單價'),
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
    question: `鉛筆每支 ${a} 元，買咗 ${b} 支；間尺每把 ${a} 元，買咗 ${c} 把。一共要畀幾多錢？`,
    operands,
    operation: 'a*(b+c)',
    answer: String(answer),
    answerDisplay: String(answer),
    acceptedAnswers: [String(answer)],
    options: [],
    correctIndex: -1,
    estimate: productEstimate(a, b + c),
    errorTraps: traps,
    commonMistake: commonMistakeFrom(traps),
    hint: '兩樣嘢嘅單價一樣，可以合埋總數量。',
    hintLevel1: '兩樣嘢嘅單價一樣，可以合埋總數量。',
    hintLevel2: '先計總數量，再乘單價。',
    explanationSteps: [
      `兩樣嘢單價都係 ${a} 元。`,
      `總數量：${b} + ${c} = ${b + c} 件。`,
      `總價：${a} × ${b + c} = ${answer} 元。`,
      `覆核（分開計）：${a}×${b} + ${a}×${c} = ${a * b} + ${a * c} = ${answer} ✓。`,
    ],
    methods: [
      { id: `${id}-m1`, label: '方法一：分開計再加', steps: [`鉛筆：${a} × ${b} = ${a * b}`, `間尺：${a} × ${c} = ${a * c}`, `${a * b} + ${a * c} = ${answer}`] },
      { id: `${id}-m2`, label: '方法二：合埋總數量再乘', steps: [`${b} + ${c} = ${b + c}`, `${a} × ${b + c} = ${answer}`] },
    ],
    source: 'generator',
  }

  verifyQuestion(q)
  return q
}

export default { id: TEMPLATE_ID, generate }
