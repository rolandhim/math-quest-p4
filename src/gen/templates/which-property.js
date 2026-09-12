/* ════════════════════════════════════════════════════════════
   mq4 — templates/which-property.js
   課題 1 題型 7：判斷用邊個性質 ★（重新設計）。
   出一個算式，選項係「結合性質」／「分配性質」，問用邊個性質。

   正解由題目形式程式判定（derive.js deriveProperty）：
     - 'a*b*c'   連乘（可重整 pair）  → 結合性質（associative）
     - 'a*(b+c)' 乘加／共同因數        → 分配性質（distributive）
   兩種形式約 50/50（由 rng 決定，確定性）；兩個性質都會出現。
   answer = choice id（'associative' | 'distributive'），唔係數字。
   ════════════════════════════════════════════════════════════ */

import { randInt, shuffle } from '../rng.js'
import { verifyQuestion } from '../verify.js'
import { capFactor } from './_common.js'
import { deriveProperty } from '../derive.js'

export const TEMPLATE_ID = 'which-property'
export const LESSON = '1'
export const TOPIC = 'distributive'
export const ANGLE = 'which-property'
export const CONCEPT_SOURCE = { pages: '21', concept: 'associative' }
export const DIFFICULTY = 'challenge'

export function generate(rng, _difficulty = null, _level = null, seed = 0) {
  // 形式由 rng 決定（~50/50，確定性）：product（連乘）vs sum-product（乘加）
  const form = rng() < 0.5 ? 'product' : 'sum-product'

  let a, b, c, value, operation
  if (form === 'product') {
    a = randInt(rng, 2, 20)
    b = randInt(rng, 2, 20)
    const cHi = Math.max(2, Math.min(20, Math.floor(1000 / (a * b))))
    c = randInt(rng, 2, cHi)
    while (c === b) c = randInt(rng, 2, cHi)
    value = a * b * c
    operation = 'a*b*c'
  } else {
    b = randInt(rng, 10, 90)
    c = randInt(rng, 10, 90)
    while (c === b) c = randInt(rng, 10, 90)
    a = capFactor(rng, b + c)
    value = a * (b + c)
    operation = 'a*(b+c)'
  }

  const operands = [a, b, c]
  const correct = deriveProperty({ operation }) // 'associative' | 'distributive'
  const id = `l1-prop-${String(seed).padStart(5, '0')}`

  const allOptions = [
    { id: 'associative', label: '結合性質' },
    { id: 'distributive', label: '分配性質' },
  ]
  const options = shuffle(rng, allOptions)
  const correctIndex = options.findIndex((o) => o.id === correct)

  const isAssoc = correct === 'associative'
  const q = {
    id,
    lesson: LESSON,
    topic: TOPIC,
    conceptSource: CONCEPT_SOURCE,
    angle: ANGLE,
    difficulty: DIFFICULTY,
    type: 'mc',
    answerKind: 'choice',
    question: form === 'product'
      ? `${a} × ${b} × ${c} = ?　（諗清楚：呢度用邊個性質？）`
      : `${a} × ${b} + ${a} × ${c} = ?　（諗清楚：呢度用邊個性質？）`,
    operands,
    operation,
    answer: correct,
    acceptedAnswers: [correct],
    answerDisplay: allOptions.find((o) => o.id === correct).label,
    options,
    correctIndex,
    estimate: {
      value,
      operands,
      note: `${a * b * c}（連乘）同 ${a * (b + c)}（乘加）差好遠，所以要認清用邊個性質`,
    },
    displayValue: value,
    property: correct,
    errorTraps: [],
    commonMistake: '見到乘號就當係結合性質，冇睇清楚中間嗰個係加號定乘號。',
    hint: '睇下中間嗰個符號係乘號定加號。',
    hintLevel1: '睇下中間嗰個符號係乘號定加號。',
    hintLevel2: '連乘（三個數乘埋）嘅次序點變都得；乘加（加號兩邊各有一組乘）就有共同因數。',
    explanationSteps: isAssoc
      ? [
          `呢度 ${a}、${b}、${c} 三個數連乘，乘嘅次序可以變，係結合性質。`,
          `${a} × ${b} = ${a * b}，再 × ${c} = ${value}。`,
          `（${b} × ${c} = ${b * c}，${a} × ${b * c} = ${value}，次序點執都得 ✓）`,
        ]
      : [
          `呢度 ${a}×${b} + ${a}×${c}，兩組都有共同因數 ${a}，係分配性質。`,
          `合埋：${a} × (${b} + ${c}) = ${a} × ${b + c} = ${value}。`,
          `（分開計：${a * b} + ${a * c} = ${value} ✓）`,
        ],
    methods: isAssoc
      ? [
          { id: `${id}-m1`, label: '方法一：順序乘', steps: [`${a} × ${b} = ${a * b}`, `${a * b} × ${c} = ${value}`] },
          { id: `${id}-m2`, label: '方法二：結合（先乘易乘嘅）', steps: [`${b} × ${c} = ${b * c}`, `${a} × ${b * c} = ${value}`] },
        ]
      : [
          { id: `${id}-m1`, label: '方法一：分開乘再加', steps: [`${a} × ${b} = ${a * b}`, `${a} × ${c} = ${a * c}`, `${a * b} + ${a * c} = ${value}`] },
          { id: `${id}-m2`, label: '方法二：合埋一次過乘', steps: [`${b} + ${c} = ${b + c}`, `${a} × ${b + c} = ${value}`] },
        ],
    source: 'generator',
  }

  verifyQuestion(q)
  return q
}

export default { id: TEMPLATE_ID, generate }
