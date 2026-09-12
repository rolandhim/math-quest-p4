/* ════════════════════════════════════════════════════════════
   mq4 — templates/mid-zero.js
   課題 2 題型 5：中間有 0。例 301×58（課本 p18–20）。
   三位數中間嗰位係 0，考「0 都要照乘、對位唔好亂」。
   ════════════════════════════════════════════════════════════ */

import { randInt } from '../rng.js'
import { verifyQuestion } from '../verify.js'
import { mkTrap, operandRng, mulHint, commonMistakeFrom } from './_common.js'

export const TEMPLATE_ID = 'mid-zero'
export const LESSON = '2'
export const TOPIC = 'multiplication'
export const ANGLE = 'mid-zero'
export const CONCEPT_SOURCE = { pages: '18-20', concept: 'multiplication' }
export const DIFFICULTY = 'advanced'

export function generate(rng, _difficulty = null, _level = null, seed = 0) {
  const orng = operandRng(seed, TEMPLATE_ID)
  const h = randInt(orng, 2, 5) // 百位
  const o = randInt(orng, 1, 9) // 個位（非 0，令個位乘有嘢做）
  const a = h * 100 + o // 中間係 0 嘅三位數（例 301、402…）
  const b = randInt(orng, 12, 59) // 兩位數

  const operands = [a, b]
  const answer = a * b
  const id = `l2-mid0-${String(seed).padStart(5, '0')}`
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
    hint: '中間嗰個 0 都要照乘，唔可以當佢冇咗。',
    hintLevel1: '中間嗰個 0 都要照乘，唔可以當佢冇咗。',
    hintLevel2: '0 乘任何數都係 0，但個位同百位都要各自乘、再對好位加。',
    explanationSteps: [
      `${a} 中間嗰位係 0，但都要照乘。`,
      `${a} × ${b % 10} = ${a * (b % 10)}。`,
      `${a} × ${Math.floor(b / 10)} = ${a * Math.floor(b / 10)}，補位 → ${a * Math.floor(b / 10) * 10}。`,
      `加埋：${a * (b % 10)} + ${a * Math.floor(b / 10) * 10} = ${answer}。`,
    ],
    methods: [
      { id: `${id}-m1`, label: '方法一：拆位展開', steps: [`${a}×${b % 10} = ${a * (b % 10)}`, `${a}×${Math.floor(b / 10)}×10 = ${a * Math.floor(b / 10) * 10}`, `${a * (b % 10)} + ${a * Math.floor(b / 10) * 10} = ${answer}`] },
      { id: `${id}-m2`, label: '方法二：直式', steps: [`${a} × ${b} = ${answer}`] },
    ],
    source: 'generator',
  }

  verifyQuestion(q)
  return q
}

export default { id: TEMPLATE_ID, generate }
