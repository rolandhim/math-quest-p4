/* ════════════════════════════════════════════════════════════
   mq4 — templates/find-error.js
   課題 1 題型 6：搵錯處 ★。展示「漏乘」錯誤，問正確答案（課本 p6 概念）。
   錯誤版本 = a×(b+c) 寫成 a×b + c（第二個數 c 冇乘 a）。
   結構保證：a≥2、c≥10 → a×b+c ≠ a×(b+c) 恒成立；
   但 verify 腳本仍會遞歸重算，確認錯誤版 ≠ 正確答案（100%）。
   ════════════════════════════════════════════════════════════ */

import { randInt } from '../rng.js'
import { verifyQuestion } from '../verify.js'
import { mkTrap, capFactor, operandRng, productEstimate, commonMistakeFrom } from './_common.js'

export const TEMPLATE_ID = 'find-error'
export const LESSON = '1'
export const TOPIC = 'distributive'
export const ANGLE = 'find-error'
export const CONCEPT_SOURCE = { pages: '6', concept: 'distributive' }
export const DIFFICULTY = 'advanced'

export function generate(rng, _difficulty = null, _level = null, seed = 0) {
  const orng = operandRng(seed, TEMPLATE_ID)
  let b = randInt(orng, 10, 90)
  let c = randInt(orng, 10, 90)
  while (c === b) c = randInt(orng, 10, 90)
  const a = capFactor(orng, b + c)

  const operands = [a, b, c]
  const answer = a * (b + c)
  const wrongValue = a * b + c // 漏乘：只乘咗 b，c 冇乘 a
  const id = `l1-finderror-${String(seed).padStart(5, '0')}`
  const traps = [
    mkTrap('a*b', operands, '只乘咗第一個數'),
    mkTrap('a*c', operands, '只乘咗第二個數'),
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
    question: `有同學咁計：${a} × (${b} + ${c}) = ${a} × ${b} + ${c} = ${wrongValue}。呢個計法啱唔啱？正確答案應該係幾多？`,
    operands,
    operation: 'a*(b+c)',
    answer: String(answer),
    answerDisplay: String(answer),
    acceptedAnswers: [String(answer)],
    options: [],
    correctIndex: -1,
    estimate: productEstimate(a, b + c),
    shownError: { expr: `${a} × ${b} + ${c}`, value: wrongValue, kind: 'miss-multiply' },
    errorTraps: traps,
    commonMistake: commonMistakeFrom(traps),
    hint: '括號入面每個數都要乘。',
    hintLevel1: '括號入面每個數都要乘。',
    hintLevel2: '睇下有邊個數冇被乘到。',
    explanationSteps: [
      `佢寫 ${a}×${b} + ${c}，即係淨係乘咗 ${b}，冇乘 ${c}。`,
      `正確：${a}×${b} + ${a}×${c} = ${a * b} + ${a * c} = ${answer}。`,
      `另一條路：先計括號 ${b}+${c} = ${b + c}，${a}×${b + c} = ${answer}。`,
    ],
    methods: [
      { id: `${id}-m1`, label: '方法一：先計括號', steps: [`${b} + ${c} = ${b + c}`, `${a} × ${b + c} = ${answer}`] },
      { id: `${id}-m2`, label: '方法二：分開乘再加', steps: [`${a} × ${b} = ${a * b}`, `${a} × ${c} = ${a * c}`, `${a * b} + ${a * c} = ${answer}`] },
    ],
    source: 'generator',
  }

  verifyQuestion(q)
  return q
}

export default { id: TEMPLATE_ID, generate }
