/* ════════════════════════════════════════════════════════════
   mq4 — templates/fastest.js
   課題 1 題型 5：揀最快方法 ★（重新設計）。
   出算式 a×b + a×c，並列兩個方法，問「邊個方法快啲」。

   正解 = derive.js deriveFastestMethod(operands) 程式推導：
     方法一「分開乘」= 乘 a 兩次 + 加一次（cost1 = 2×multCost(a)+1）
     方法二「先加埋」= 加一次 + 乘 (b+c) 一次（cost2 = multCost(b+c)+1）
     成本較細者勝；平手 → method-2。兩個方法都可能係正解。
   answer = choice id（'method-1' | 'method-2'），唔係數字。
   ════════════════════════════════════════════════════════════ */

import { randInt, shuffle } from '../rng.js'
import { verifyQuestion } from '../verify.js'
import { capFactor, operandRng } from './_common.js'
import { deriveFastestMethod, fastestCosts } from '../derive.js'

export const TEMPLATE_ID = 'fastest'
export const LESSON = '1'
export const TOPIC = 'distributive'
export const ANGLE = 'fastest'
export const CONCEPT_SOURCE = { pages: '21-23', concept: 'distributive' }
export const DIFFICULTY = 'challenge'

export function generate(rng, _difficulty = null, _level = null, seed = 0) {
  const orng = operandRng(seed, TEMPLATE_ID) // template 專屬 operand 流
  let b = randInt(orng, 10, 90)
  let c = randInt(orng, 10, 90)
  while (c === b) c = randInt(orng, 10, 90)
  const a = capFactor(orng, b + c)

  const operands = [a, b, c]
  const value = a * (b + c)
  const id = `l1-fastest-${String(seed).padStart(5, '0')}`

  // 正解由 operands 程式推導（唔准手寫）
  const correct = deriveFastestMethod(operands)
  const costs = fastestCosts(operands)

  // 兩個方法（id 固定），用主 rng 洗牌避免位置偏見
  const allMethods = [
    { id: 'method-1', label: '方法一：分開乘（逐個乘再加）' },
    { id: 'method-2', label: '方法二：先加埋（合埋一次過乘）' },
  ]
  const options = shuffle(rng, allMethods)
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
    question: `計 ${a} × ${b} + ${a} × ${c}。方法一：分開乘（${a}×${b} 再加 ${a}×${c}）；方法二：先加埋（${a}×(${b}+${c})）。邊個方法快啲？`,
    operands,
    operation: 'a*(b+c)',
    answer: correct,
    acceptedAnswers: [correct],
    answerDisplay: allMethods.find((m) => m.id === correct).label,
    options,
    correctIndex,
    estimate: {
      value,
      operands: [a, b + c],
      note: `兩個方法嘅答案都係 ${value}，重點係數下邊個方法要乘少一次`,
    },
    displayValue: value,
    fastestMethod: correct,
    fastestCosts: costs,
    errorTraps: [],
    commonMistake: '冇數清楚每個方法各自要乘幾多次就揀。',
    hint: '數下兩個方法各自要乘幾多次。',
    hintLevel1: '數下兩個方法各自要乘幾多次。',
    hintLevel2: '乘整十數／乘數表入面嘅數好快；兩位數拆位就慢啲。',
    explanationSteps: [
      `方法一（分開乘）：${a}×${b} 同 ${a}×${c}，要乘 ${a} 兩次，再加一次。`,
      `方法二（先加埋）：${b}+${c}=${b + c}，再乘 ${a} 一次。`,
      ...(correct === 'method-1'
        ? [`${a} 係乘數表入面嘅數，${a}×${b}、${a}×${c} 直接背得出，唔使先加 → 方法一快啲。`]
        : (b + c) % 10 === 0
          ? [`${b}+${c}=${b + c} 係整十數，一次過乘最爽 → 方法二快啲。`]
          : (b + c) % 5 === 0
            ? [`${b}+${c}=${b + c} 係 5 嘅倍數，幾好乘，合埋乘少一次 → 方法二快啲。`]
            : [`${a} 係兩位數，合埋一次過乘（乘少一次）→ 方法二快啲。`]),
      `兩個方法答案都係 ${value} ✓。`,
    ],
    methods: [
      { id: 'method-1', label: '方法一：分開乘', steps: [`${a} × ${b} = ${a * b}`, `${a} × ${c} = ${a * c}`, `${a * b} + ${a * c} = ${value}`] },
      { id: 'method-2', label: '方法二：先加埋', steps: [`${b} + ${c} = ${b + c}`, `${a} × ${b + c} = ${value}`] },
    ],
    source: 'generator',
  }

  verifyQuestion(q)
  return q
}

export default { id: TEMPLATE_ID, generate }
