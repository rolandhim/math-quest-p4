/* ════════════════════════════════════════════════════════════
   mq4 — templates/forward-expand.js
   課題 1（乘法分配性質）題型 1：正向展開。
   例：4 × (25 + 8) → 分開乘再加（課本 p6–8，方法一）。
   答案由 operands 重算，hint 零數字，errorTrap 全部喺白名單。
   ════════════════════════════════════════════════════════════ */

import { randInt } from '../rng.js'
import { verifyQuestion } from '../verify.js'
import { mkTrap, capFactor, operandRng, productEstimate, commonMistakeFrom } from './_common.js'

export const TEMPLATE_ID = 'forward-expand'
export const LESSON = '1'
export const TOPIC = 'distributive'
export const ANGLE = 'expand'
export const CONCEPT_SOURCE = { pages: '6-8', concept: 'distributive' }
export const DIFFICULTY = 'basic'

export function generate(rng, _difficulty = null, _level = null, seed = 0) {
  const orng = operandRng(seed, TEMPLATE_ID) // template 專屬 operand 流
  let b = randInt(orng, 10, 90) // 括號內第一個數
  let c = randInt(orng, 10, 90) // 括號內第二個數
  while (c === b) c = randInt(orng, 10, 90) // b、c 唔相同
  const a = capFactor(orng, b + c) // 因數 2–20，保證 answer ≤ 1000

  const operands = [a, b, c]
  const answer = a * (b + c)
  const id = `l1-expand-${String(seed).padStart(5, '0')}`
  const traps = [
    mkTrap('a*b', operands, '只乘咗括號入面第一個數'),
    mkTrap('a*c', operands, '只乘咗括號入面第二個數'),
    mkTrap('b+c', operands, '漏咗乘括號外面嗰個數'),
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
    question: `${a} × (${b} + ${c}) = ?`,
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
    hint: '括號外面嗰個數，要同括號入面每個數都乘一次。',
    hintLevel1: '括號外面嗰個數，要同括號入面每個數都乘一次。',
    hintLevel2: '分開乘完，先至加埋。',
    explanationSteps: [
      `括號外面係 ${a}，要同括號入面 ${b} 同 ${c} 各自乘一次。`,
      `${a} × ${b} = ${a * b}，${a} × ${c} = ${a * c}。`,
      `加埋：${a * b} + ${a * c} = ${answer}。`,
      `另一條路：先加括號，${b} + ${c} = ${b + c}，${a} × ${b + c} = ${answer}，答案一樣 ✓。`,
    ],
    methods: [
      { id: `${id}-m1`, label: '方法一：分開乘再加', steps: [`${a} × ${b} = ${a * b}`, `${a} × ${c} = ${a * c}`, `${a * b} + ${a * c} = ${answer}`] },
      { id: `${id}-m2`, label: '方法二：先加括號再乘', steps: [`${b} + ${c} = ${b + c}`, `${a} × ${b + c} = ${answer}`] },
    ],
    source: 'generator',
  }

  verifyQuestion(q)
  return q
}

export default { id: TEMPLATE_ID, generate }
