/* ════════════════════════════════════════════════════════════
   mq4 — templates/tens-multiply.js
   課題 2（乘法的運算）題型 1：乘以整十數（補零）。例 16×20（課本 p12–14）。
   答案由 operands 重算，errorTrap 全喺白名單。
   ════════════════════════════════════════════════════════════ */

import { randInt } from '../rng.js'
import { verifyQuestion } from '../verify.js'
import { mkTrap, operandRng, mulHint, commonMistakeFrom } from './_common.js'

export const TEMPLATE_ID = 'tens-multiply'
export const LESSON = '2'
export const TOPIC = 'multiplication'
export const ANGLE = 'tens-multiply'
export const CONCEPT_SOURCE = { pages: '12-14', concept: 'multiplication' }
export const DIFFICULTY = 'basic'

export function generate(rng, _difficulty = null, _level = null, seed = 0) {
  const orng = operandRng(seed, TEMPLATE_ID)
  const d = randInt(orng, 2, 9) // 整十數嘅「個位」部分
  const tens = d * 10
  const hi = Math.min(99, Math.floor(100000 / tens))
  const a = randInt(orng, 11, hi)

  const operands = [a, tens, d] // d 係供「漏補零」trap 重算用
  const answer = a * tens
  const id = `l2-tens-${String(seed).padStart(5, '0')}`
  const traps = [
    mkTrap('a*c', operands, '乘完冇補返個零'),
    mkTrap('b', operands, '把整十數當成答案'),
    mkTrap('c', operands, '只寫咗個位部分'),
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
    question: `${a} × ${tens} = ?`,
    operands,
    operation: 'a*b',
    answer: String(answer),
    answerDisplay: String(answer),
    acceptedAnswers: [String(answer)],
    options: [],
    correctIndex: -1,
    estimate: mulHint(a, tens, answer),
    errorTraps: traps,
    commonMistake: commonMistakeFrom(traps),
    hint: '整十數可以先當個位數咁乘，計完補返個零。',
    hintLevel1: '整十數可以先當個位數咁乘，計完補返個零。',
    hintLevel2: `${a} × ${d} 計咗之後，記得喺尾巴補一個 0。`,
    explanationSteps: [
      `${tens} 即係 ${d} 個十。`,
      `先當 ${tens} 係 ${d}：${a} × ${d} = ${a * d}。`,
      `因為係 ${tens}，尾巴補一個 0 → ${answer}。`,
      `覆核：${a} × ${tens} = ${a} × ${d} × 10 = ${answer}。`,
    ],
    methods: [
      { id: `${id}-m1`, label: '方法一：補零法', steps: [`${a} × ${d} = ${a * d}`, `補一個 0 → ${answer}`] },
      { id: `${id}-m2`, label: '方法二：拆做兩個十再乘', steps: [`${tens} = ${d} × 10`, `${a} × ${d} × 10 = ${answer}`] },
    ],
    source: 'generator',
  }

  verifyQuestion(q)
  return q
}

export default { id: TEMPLATE_ID, generate }
