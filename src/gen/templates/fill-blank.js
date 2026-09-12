/* ════════════════════════════════════════════════════════════
   mq4 — templates/fill-blank.js
   課題 1 題型 10：填空（遮位自測）。a×c + b×c = (□)×c，□ = a+b
   （課本教學步驟；同 symbol-blank L3 唔同：呢度兩個係數 a ≠ b）。
   答案 = a+b，由 operands 重算。

   機器可讀 equation：lhs = a×c + b×c，rhs = □×c。solve.js 唯一解 a+b。
   ════════════════════════════════════════════════════════════ */

import { randInt } from '../rng.js'
import { verifyQuestion } from '../verify.js'
import { uniqueTargetValue } from '../solve.js'
import { mkTrap, commonMistakeFrom, safeNote } from './_common.js'

export const TEMPLATE_ID = 'fill-blank'
export const LESSON = '1'
export const TOPIC = 'distributive'
export const ANGLE = 'fill-blank'
export const CONCEPT_SOURCE = { pages: '6-11', concept: 'distributive' }
export const DIFFICULTY = 'basic'

export function generate(rng, _difficulty = null, _level = null, seed = 0) {
  const a = randInt(rng, 2, 20) // 第一個係數
  let b = randInt(rng, 2, 20) // 第二個係數
  while (b === a) b = randInt(rng, 2, 20)
  let c = randInt(rng, 10, 90) // 共同因數
  while (c === a || c === b) c = randInt(rng, 10, 90) // 保證 trap 互異

  const operands = [a, b, c]
  const answer = a + b
  const id = `l1-fill-${String(seed).padStart(5, '0')}`
  const traps = [
    mkTrap('a', operands, '填咗第一個係數'),
    mkTrap('b', operands, '填咗第二個係數'),
    mkTrap('b+c', operands, '亂加第二個係數同因數'),
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
    question: `${a} × ${c} + ${b} × ${c} = (□) × ${c}`,
    operands,
    operation: 'a+b',
    answer: String(answer),
    answerDisplay: String(answer),
    acceptedAnswers: [String(answer)],
    options: [],
    correctIndex: -1,
    estimate: {
      value: (a + b) * c,
      operands: [a, b, c],
      note: safeNote(String(answer),
        () => `左邊 = ${(a + b) * c}，□ × ${c} 都要等於嗰個數`,
        () => `兩組嘅係數係 ${a} 同 ${b}，加埋就係 □ 嗰個數`,
        () => `左邊 ${a} × ${c} 加 ${b} × ${c} 嘅值，□ × ${c} 都要啱返`,
      ),
    },
    errorTraps: traps,
    commonMistake: commonMistakeFrom(traps),
    hint: '兩組乘法嘅共同因數係邊個？',
    hintLevel1: '兩組乘法嘅共同因數係邊個？',
    hintLevel2: '括號入面要填嘅，係兩個係數加埋。',
    explanationSteps: [
      `兩組都有共同因數 ${c}，所以右邊係 (□) × ${c}。`,
      `□ 係兩個係數 ${a} 同 ${b} 加埋：${a} + ${b} = ${answer}。`,
      `驗算：${answer} × ${c} = ${answer * c}；左邊 ${a * c} + ${b * c} = ${a * c + b * c}，相等 ✓。`,
    ],
    methods: [
      { id: `${id}-m1`, label: '方法一：找共同因數', steps: [`兩組都有 ${c}`, `括號入面係 ${a} + ${b} = ${answer}`] },
      { id: `${id}-m2`, label: '方法二：驗算', steps: [`代 ${answer} 入去：${answer} × ${c} = ${answer * c}`, `左邊 = ${a * c} + ${b * c} = ${a * c + b * c}`, `兩邊相等 ✓`] },
    ],
    source: 'generator',
    targetSymbol: '□',
    freeSymbols: [],
    equation: {
      lhs: [{ c: a * c, syms: [] }, { c: b * c, syms: [] }],
      rhs: [{ c: c, syms: ['□'] }],
    },
  }

  verifyQuestion(q)
  const unique = uniqueTargetValue(q.equation.lhs, q.equation.rhs, q.targetSymbol)
  if (unique === null || String(unique) !== q.answer) {
    throw new Error(`fill-blank(${id})：唯一解檢查失敗（solve 得 ${unique}，答案 ${q.answer}）`)
  }
  return q
}

export default { id: TEMPLATE_ID, generate }
