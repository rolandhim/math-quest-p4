/* ════════════════════════════════════════════════════════════
   mq4 — templates/three-by-two.js
   課題 2 題型 4：三位 × 兩位。例 147×25（課本 p18–20）。
   答案由 operands 重算；V3 上限已放寬至 100000（三位×兩位可達 ~98901）。
   ════════════════════════════════════════════════════════════ */

import { randInt } from '../rng.js'
import { verifyQuestion } from '../verify.js'
import { mkTrap, operandRng, mulHint, commonMistakeFrom } from './_common.js'

export const TEMPLATE_ID = 'three-by-two'
export const LESSON = '2'
export const TOPIC = 'multiplication'
export const ANGLE = 'three-by-two'
export const CONCEPT_SOURCE = { pages: '18-20', concept: 'multiplication' }
export const DIFFICULTY = 'advanced'

export function generate(rng, _difficulty = null, _level = null, seed = 0) {
  const orng = operandRng(seed, TEMPLATE_ID)
  const a = randInt(orng, 123, 498) // 三位數
  const b = randInt(orng, 12, 49) // 兩位數

  const operands = [a, b]
  const answer = a * b
  const id = `l2-3x2-${String(seed).padStart(5, '0')}`
  const traps = [
    mkTrap('a', operands, '只寫返個三位數'),
    mkTrap('b', operands, '只寫返個兩位數'),
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
    question: `${a} × ${b} = ?`,
    operands,
    operation: 'a*b',
    answer: String(answer),
    answerDisplay: String(answer),
    acceptedAnswers: [String(answer)],
    options: [],
    correctIndex: -1,
    estimate: mulHint(a, b, answer),
    errorTraps: traps,
    commonMistake: commonMistakeFrom(traps),
    hint: '直式逐位乘：先乘個位，再乘十位（要補位），最後相加。',
    hintLevel1: '直式逐位乘：先乘個位，再乘十位（要補位），最後相加。',
    hintLevel2: '十位嗰一步乘完要補一個 0，進位唔好漏。',
    explanationSteps: [
      `拆做 ${a} × ${b % 10} + ${a} × ${Math.floor(b / 10) * 10}。`,
      `${a} × ${b % 10} = ${a * (b % 10)}。`,
      `${a} × ${Math.floor(b / 10) * 10} = ${a * Math.floor(b / 10) * 10}。`,
      `加埋：${a * (b % 10)} + ${a * Math.floor(b / 10) * 10} = ${answer}。`,
    ],
    methods: [
      { id: `${id}-m1`, label: '方法一：拆位展開', steps: [`${a}×${b % 10} = ${a * (b % 10)}`, `${a}×${Math.floor(b / 10) * 10} = ${a * Math.floor(b / 10) * 10}`, `${a * (b % 10)} + ${a * Math.floor(b / 10) * 10} = ${answer}`] },
      { id: `${id}-m2`, label: '方法二：直式', steps: [`${a} × ${b} = ${answer}`] },
    ],
    source: 'generator',
  }

  verifyQuestion(q)
  return q
}

export default { id: TEMPLATE_ID, generate }
