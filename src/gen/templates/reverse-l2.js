/* ════════════════════════════════════════════════════════════
   mq4 — templates/reverse-l2.js
   課題 2 題型 10：逆向。例 ( )×20 = 480（概念反向，整十數乘法）。
   答案 = P ÷ f = m，由 operands 重算。equation + solve.js 唯一解。
   ════════════════════════════════════════════════════════════ */

import { randInt } from '../rng.js'
import { verifyQuestion } from '../verify.js'
import { uniqueTargetValue } from '../solve.js'
import { mkTrap, operandRng, commonMistakeFrom, safeNote } from './_common.js'

export const TEMPLATE_ID = 'reverse-l2'
export const LESSON = '2'
export const TOPIC = 'multiplication'
export const ANGLE = 'reverse-l2'
export const CONCEPT_SOURCE = { pages: '12-14', concept: 'multiplication' }
export const DIFFICULTY = 'challenge'

export function generate(rng, _difficulty = null, _level = null, seed = 0) {
  const orng = operandRng(seed, TEMPLATE_ID)
  const f = randInt(orng, 2, 9) * 10 // 整十數因數（20..90）
  let m = randInt(orng, 12, 40) // 未知因數（答案）
  while (m === f) m = randInt(orng, 12, 40)
  const P = f * m

  const operands = [f, m, P]
  const answer = m
  const id = `l2-rev-${String(seed).padStart(5, '0')}`
  const traps = [
    mkTrap('a', operands, '寫返已知嗰個整十數'),
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
    question: `□ × ${f} = ${P}，□ 係幾多？`,
    operands,
    operation: 'b',
    answer: String(answer),
    answerDisplay: String(answer),
    acceptedAnswers: [String(answer)],
    options: [],
    correctIndex: -1,
    estimate: {
      value: P,
      operands: [f, m],
      note: safeNote(String(answer),
        () => `□ × ${f} 要等於 ${P}，即係問幾多乘 ${f} 得 ${P}`,
        () => `用 ${P} 除返 ${f} 就搵到 □`,
      ),
    },
    errorTraps: traps,
    commonMistake: commonMistakeFrom(traps),
    hint: '乘嘅逆運算係除。',
    hintLevel1: '乘嘅逆運算係除。',
    hintLevel2: '用已知嗰個整十數去除乘積。',
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
    throw new Error(`reverse-l2(${id})：唯一解檢查失敗（solve 得 ${unique}，答案 ${q.answer}）`)
  }
  return q
}

export default { id: TEMPLATE_ID, generate }
