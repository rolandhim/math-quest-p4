/* ════════════════════════════════════════════════════════════
   mq4 — templates/estimate-first.js
   課題 2 題型 6：估算先行 ★（課本 p17–20 估算框）。
   先估（把非整十因數四捨五入到最接近整十）→ 答案 = 估算值（唔係精確積）。
   解釋步驟再示範「計精確值 → 比對」。
   ════════════════════════════════════════════════════════════ */

import { randInt } from '../rng.js'
import { verifyQuestion } from '../verify.js'
import { mkTrap, operandRng, safeNote, commonMistakeFrom } from './_common.js'

export const TEMPLATE_ID = 'estimate-first'
export const LESSON = '2'
export const TOPIC = 'multiplication'
export const ANGLE = 'estimate-first'
export const CONCEPT_SOURCE = { pages: '17-20', concept: 'multiplication' }
export const DIFFICULTY = 'advanced'

const TENS_POOL = [40, 50, 60, 70, 80, 90]

export function generate(rng, _difficulty = null, _level = null, seed = 0) {
  const orng = operandRng(seed, TEMPLATE_ID)
  const a = TENS_POOL[randInt(orng, 0, TENS_POOL.length - 1)] // 整十數
  let b = randInt(orng, 21, 99)
  while (b % 10 === 0) b = randInt(orng, 21, 99) // 個位非 0，先至要「估」
  const roundedB = Math.round(b / 10) * 10 // 四捨五入到最接近整十
  const answer = a * roundedB // 估算值（答案）
  const exact = a * b // 精確值（供比對）

  const operands = [a, roundedB]
  const id = `l2-est-${String(seed).padStart(5, '0')}`
  const traps = [
    mkTrap('a', operands, '只寫返個整十數'),
    mkTrap('b', operands, '只寫返估出嚟嗰個整十數'),
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
    question: `先估一估：${a} × ${b} 大約係幾多？（提示：先把 ${b} 估成最接近嘅整十數）`,
    operands,
    operation: 'a*b',
    answer: String(answer),
    answerDisplay: String(answer),
    acceptedAnswers: [String(answer)],
    options: [],
    correctIndex: -1,
    estimate: {
      value: exact,
      operands: [a, b],
      note: safeNote(String(answer),
        () => `真係計 ${a} × ${b} = ${exact}，睇下同你估嘅差幾遠`,
        () => `精確答案係 ${exact}，你嘅估算同佢比對下`,
      ),
    },
    errorTraps: traps,
    commonMistake: commonMistakeFrom(traps),
    hint: '先估，唔使計咁準。',
    hintLevel1: '先估，唔使計咁準。',
    hintLevel2: '把唔係整十嗰個數，四捨五入到最接近嘅整十再乘。',
    explanationSteps: [
      `先估：把 ${b} 估成 ${roundedB}。`,
      `估算：${a} × ${roundedB} = ${answer}。`,
      `再真係計：${a} × ${b} = ${exact}。`,
      `比對：估算 ${answer} 同精確 ${exact} 差 ${exact - answer}，估得夠近 ✓。`,
    ],
    methods: [
      { id: `${id}-m1`, label: '方法一：估成整十再乘', steps: [`${b} → ${roundedB}`, `${a} × ${roundedB} = ${answer}`] },
      { id: `${id}-m2`, label: '方法二：精確計再比對', steps: [`${a} × ${b} = ${exact}`, `估算 ${answer} 同 ${exact} 好近 ✓`] },
    ],
    source: 'generator',
    // 額外欄位（供設計意圖 gate：答案係估算，唔係精確積）
    exactValue: exact,
    roundedB,
    originalB: b,
  }

  verifyQuestion(q)
  return q
}

export default { id: TEMPLATE_ID, generate }
