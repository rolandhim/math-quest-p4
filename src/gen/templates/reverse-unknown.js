/* ════════════════════════════════════════════════════════════
   mq4 — templates/reverse-unknown.js
   課題 1 題型 9：逆向反推。□ × f = P，搵未知因數（課本 p9 概念反向）。
   答案 = P ÷ f = m，由 operands 重算（m = operands[1]）。

   機器可讀 equation：lhs = □×f，rhs = P。solve.js 窮舉唯一解 m。
   ════════════════════════════════════════════════════════════ */

import { randInt } from '../rng.js'
import { verifyQuestion } from '../verify.js'
import { uniqueTargetValue } from '../solve.js'
import { mkTrap, commonMistakeFrom, safeNote } from './_common.js'

export const TEMPLATE_ID = 'reverse-unknown'
export const LESSON = '1'
export const TOPIC = 'distributive'
export const ANGLE = 'reverse-unknown'
export const CONCEPT_SOURCE = { pages: '9', concept: 'distributive' }
export const DIFFICULTY = 'challenge'

export function generate(rng, _difficulty = null, _level = null, seed = 0) {
  const f = randInt(rng, 2, 20) // 已知因數
  let m = randInt(rng, 10, 90) // 未知因數（答案）
  while (m === f) m = randInt(rng, 10, 90)
  const P = f * m // 乘積

  const operands = [f, m, P]
  const answer = m
  const id = `l1-revunk-${String(seed).padStart(5, '0')}`
  const traps = [
    mkTrap('a', operands, '寫返已知嗰個因數'),
    mkTrap('c', operands, '寫返乘積'),
    mkTrap('b+c', operands, '兩個數亂加'),
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
    question: `□ × ${f} = ${P}`,
    operands,
    operation: 'b', // answer = m = operands[1]
    answer: String(answer),
    answerDisplay: String(answer),
    acceptedAnswers: [String(answer)],
    options: [],
    correctIndex: -1,
    estimate: {
      value: P,
      operands: [f, m],
      note: safeNote(String(answer),
        () => `右邊係 ${P}，□ 乘 ${f} 一定要等於 ${P}`,
        () => `已知因數係 ${f}，你個答案 × ${f} 要等於右邊嗰個數`,
      ),
    },
    errorTraps: traps,
    commonMistake: commonMistakeFrom(traps),
    hint: '乘嘅逆運算係除。',
    hintLevel1: '乘嘅逆運算係除。',
    hintLevel2: '用已知嗰個因數去除乘積。',
    explanationSteps: [
      `□ × ${f} = ${P}，即係問「幾多乘 ${f} 等於 ${P}」。`,
      `用除法：${P} ÷ ${f} = ${m}。`,
      `驗算：${m} × ${f} = ${P} ✓。`,
    ],
    methods: [
      { id: `${id}-m1`, label: '方法一：逆向（除返）', steps: [`${P} ÷ ${f} = ${m}`, `所以 □ = ${m}`] },
      { id: `${id}-m2`, label: '方法二：驗算（乘返）', steps: [`諗邊個數乘 ${f} 等於 ${P}`, `${m} × ${f} = ${P} ✓`, `所以 □ = ${m}`] },
    ],
    source: 'generator',
    targetSymbol: '□',
    freeSymbols: [],
    equation: {
      lhs: [{ c: f, syms: ['□'] }],
      rhs: [{ c: P, syms: [] }],
    },
  }

  verifyQuestion(q)
  const unique = uniqueTargetValue(q.equation.lhs, q.equation.rhs, q.targetSymbol)
  if (unique === null || String(unique) !== q.answer) {
    throw new Error(`reverse-unknown(${id})：唯一解檢查失敗（solve 得 ${unique}，答案 ${q.answer}）`)
  }
  return q
}

export default { id: TEMPLATE_ID, generate }
