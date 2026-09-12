/* ════════════════════════════════════════════════════════════
   mq4 — templates/two-digit-swap.js
   課題 2 題型 3：兩位數乘法（交換）。例 4×12 當 12×4（課本 p15）。
   掉轉乘數次序，答案一樣（交換性質）。
   ════════════════════════════════════════════════════════════ */

import { randInt } from '../rng.js'
import { verifyQuestion } from '../verify.js'
import { mkTrap, operandRng, mulHint, commonMistakeFrom } from './_common.js'

export const TEMPLATE_ID = 'two-digit-swap'
export const LESSON = '2'
export const TOPIC = 'multiplication'
export const ANGLE = 'two-digit-swap'
export const CONCEPT_SOURCE = { pages: '15', concept: 'multiplication' }
export const DIFFICULTY = 'basic'

export function generate(rng, _difficulty = null, _level = null, seed = 0) {
  const orng = operandRng(seed, TEMPLATE_ID)
  const a = randInt(orng, 2, 9) // 一位數
  const b = randInt(orng, 12, 99) // 兩位數

  const operands = [a, b]
  const answer = a * b
  const id = `l2-swap-${String(seed).padStart(5, '0')}`
  const traps = [
    mkTrap('a', operands, '只寫返個一位數'),
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
    question: `計 ${b} × ${a}，可以掉轉做 ${a} × ${b} 嚟計。答案係幾多？`,
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
    hint: '乘數嘅次序掉轉，答案一樣。',
    hintLevel1: '乘數嘅次序掉轉，答案一樣。',
    hintLevel2: '邊個數細，就攞佢做乘數，計起上嚟易啲。',
    explanationSteps: [
      `${b} × ${a} 同 ${a} × ${b} 答案一樣（交換）。`,
      `${a} × ${b} = ${answer}。`,
      `所以 ${b} × ${a} = ${answer} ✓。`,
    ],
    methods: [
      { id: `${id}-m1`, label: '方法一：直接乘', steps: [`${b} × ${a} = ${answer}`] },
      { id: `${id}-m2`, label: '方法二：掉轉乘（交換）', steps: [`${a} × ${b} = ${answer}`, `所以 ${b} × ${a} = ${answer}`] },
    ],
    source: 'generator',
  }

  verifyQuestion(q)
  return q
}

export default { id: TEMPLATE_ID, generate }
