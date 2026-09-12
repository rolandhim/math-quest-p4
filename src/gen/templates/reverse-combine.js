/* ════════════════════════════════════════════════════════════
   mq4 — templates/reverse-combine.js
   課題 1 題型 2：逆向合併。例：23×17 + 23×13 → 23×(17+13)（課本 p9）。
   ════════════════════════════════════════════════════════════ */

import { randInt } from '../rng.js'
import { verifyQuestion } from '../verify.js'
import { mkTrap, capFactor, operandRng, productEstimate, commonMistakeFrom } from './_common.js'

export const TEMPLATE_ID = 'reverse-combine'
export const LESSON = '1'
export const TOPIC = 'distributive'
export const ANGLE = 'reverse'
export const CONCEPT_SOURCE = { pages: '9', concept: 'distributive' }
export const DIFFICULTY = 'basic'

export function generate(rng, _difficulty = null, _level = null, seed = 0) {
  const orng = operandRng(seed, TEMPLATE_ID)
  let b = randInt(orng, 10, 90)
  let c = randInt(orng, 10, 90)
  while (c === b) c = randInt(orng, 10, 90)
  const a = capFactor(orng, b + c)

  const operands = [a, b, c]
  const answer = a * (b + c)
  const id = `l1-reverse-${String(seed).padStart(5, '0')}`
  const traps = [
    mkTrap('a*b', operands, '只計咗第一組，漏咗第二組'),
    mkTrap('a*c', operands, '只計咗第二組，漏咗第一組'),
    mkTrap('b+c', operands, '加完冇再乘共同因數'),
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
    question: `${a} × ${b} + ${a} × ${c} = ?`,
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
    hint: '睇下兩個乘法式有咩相同。',
    hintLevel1: '睇下兩個乘法式有咩相同。',
    hintLevel2: '相同嗰個數，可以提出嚟一次過乘。',
    explanationSteps: [
      `兩組都有共同因數 ${a}。`,
      `合埋：${a} × (${b} + ${c})。`,
      `${b} + ${c} = ${b + c}，${a} × ${b + c} = ${answer}。`,
      `覆核（分開計）：${a * b} + ${a * c} = ${answer} ✓。`,
    ],
    methods: [
      { id: `${id}-m1`, label: '方法一：分開乘再加', steps: [`${a} × ${b} = ${a * b}`, `${a} × ${c} = ${a * c}`, `${a * b} + ${a * c} = ${answer}`] },
      { id: `${id}-m2`, label: '方法二：合埋一次過乘', steps: [`${b} + ${c} = ${b + c}`, `${a} × ${b + c} = ${answer}`] },
    ],
    source: 'generator',
  }

  verifyQuestion(q)
  return q
}

export default { id: TEMPLATE_ID, generate }
