/* ════════════════════════════════════════════════════════════
   mq4 — templates/fastest-order.js
   課題 2 題型 8：揀最快次序 ★（課本 p21–23 結合性質）。
   三數連乘，問「邊個次序快啲」。答案 = choice id（'order-ab'|'order-ac'），
   唔係個積。正解由 derive.js deriveFastestOrder 程式推導（唔准手寫）：
   「先乘嗰對出到整十／整百就快」。
   ════════════════════════════════════════════════════════════ */

import { randInt, shuffle } from '../rng.js'
import { verifyQuestion } from '../verify.js'
import { operandRng } from './_common.js'
import { deriveFastestOrder } from '../derive.js'

export const TEMPLATE_ID = 'fastest-order'
export const LESSON = '2'
export const TOPIC = 'multiplication'
export const ANGLE = 'fastest-order'
export const CONCEPT_SOURCE = { pages: '21-23', concept: 'associative' }
export const DIFFICULTY = 'challenge'

const MAGIC = [[4, 25], [8, 25], [12, 25], [16, 25], [5, 16], [5, 18], [5, 14], [6, 15], [8, 15], [4, 15]]

export function generate(rng, _difficulty = null, _level = null, seed = 0) {
  const orng = operandRng(seed, TEMPLATE_ID)
  let m1 = null
  let m2 = null
  let z = null
  for (let t = 0; t < 100; t += 1) {
    const [p, q] = MAGIC[randInt(orng, 0, MAGIC.length - 1)]
    const zz = randInt(orng, 3, 19)
    if (zz === p || zz === q) continue
    if ((p * zz) % 10 !== 0 && (q * zz) % 10 !== 0) { m1 = p; m2 = q; z = zz; break }
    if (t === 99) throw new Error('fastest-order: 搵唔到中立第三數')
  }

  // a 固定 = 魔數一；b/c 位置隨機（b=m2,c=z 或 b=z,c=m2）→ 兩個次序 ~50/50
  const a = m1
  const swapped = rng() < 0.5
  const b = swapped ? z : m2
  const c = swapped ? m2 : z

  const operands = [a, b, c]
  const value = a * b * c
  const correct = deriveFastestOrder(operands)
  const id = `l2-fastord-${String(seed).padStart(5, '0')}`

  const allOptions = [
    { id: 'order-ab', label: `先計 ${a} × ${b} = ${a * b}，再 × ${c}` },
    { id: 'order-ac', label: `先計 ${a} × ${c} = ${a * c}，再 × ${b}` },
  ]
  const options = shuffle(rng, allOptions)
  const correctIndex = options.findIndex((o) => o.id === correct)

  const q = {
    id,
    lesson: LESSON,
    topic: TOPIC,
    conceptSource: CONCEPT_SOURCE,
    angle: ANGLE,
    difficulty: DIFFICULTY,
    type: 'mc',
    answerKind: 'choice',
    question: `計 ${a} × ${b} × ${c}。次序一：先 ${a}×${b} 再 ×${c}；次序二：先 ${a}×${c} 再 ×${b}。邊個次序快啲？`,
    operands,
    operation: 'a*b*c',
    answer: correct,
    acceptedAnswers: [correct],
    answerDisplay: allOptions.find((o) => o.id === correct).label,
    options,
    correctIndex,
    estimate: {
      value,
      operands: [a, b, c],
      note: `${a} × ${b} = ${a * b}，${a} × ${c} = ${a * c}，邊個係整十／整百就先乘嗰對。`,
    },
    displayValue: value,
    fastestOrder: correct,
    errorTraps: [],
    commonMistake: '冇睇清楚邊對先乘會出整十／整百，順序硬乘。',
    hint: '睇下邊兩個數乘埋會出整十／整百。',
    hintLevel1: '睇下邊兩個數乘埋會出整十／整百。',
    hintLevel2: '先乘出整十嗰對，第二步就幾乎免費（補零）。',
    explanationSteps: [
      `${a} × ${b} = ${a * b}；${a} × ${c} = ${a * c}。`,
      `邊個係整十／整百，就先乘嗰對。`,
      `正解：先 ${correct === 'order-ab' ? `${a}×${b}=${a * b}` : `${a}×${c}=${a * c}`}，再乘返剩低嗰個 = ${value}。`,
      `兩個次序答案都係 ${value}，快慢睇「先乘嗰對」圓唔圓整 ✓。`,
    ],
    methods: [
      { id: `${id}-m1`, label: '次序一', steps: [`${a} × ${b} = ${a * b}`, `${a * b} × ${c} = ${value}`] },
      { id: `${id}-m2`, label: '次序二', steps: [`${a} × ${c} = ${a * c}`, `${a * c} × ${b} = ${value}`] },
    ],
    source: 'generator',
  }

  verifyQuestion(q)
  return q
}

export default { id: TEMPLATE_ID, generate }
