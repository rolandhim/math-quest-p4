/* ════════════════════════════════════════════════════════════
   mq4 — templates/find-error-vertical.js
   課題 2 題型 9：搵錯處（直式）★（課本 p18–20 概念）。
   展示一個真嘅錯直式（進位錯／漏補位／漏加），問「邊一步開始錯」。
   答案 = choice id（'step-1'|'step-2'|'step-3'），唔係數字。
   陷阱值由 derive.js findErrorVertical 重算，verify.js V7 交叉核對（真錯）。
   ════════════════════════════════════════════════════════════ */

import { randInt, shuffle } from '../rng.js'
import { verifyQuestion } from '../verify.js'
import { operandRng } from './_common.js'
import { findErrorVertical } from '../derive.js'

export const TEMPLATE_ID = 'find-error-vertical'
export const LESSON = '2'
export const TOPIC = 'multiplication'
export const ANGLE = 'find-error-vertical'
export const CONCEPT_SOURCE = { pages: '18-20', concept: 'multiplication' }
export const DIFFICULTY = 'challenge'

const KINDS = ['miss-carry', 'miss-shift', 'miss-add']

export function generate(rng, _difficulty = null, _level = null, seed = 0) {
  const orng = operandRng(seed, TEMPLATE_ID)
  const ta = randInt(orng, 1, 3)
  let oa = randInt(orng, 2, 9)
  const tb = randInt(orng, 1, 3)
  let ob = randInt(orng, 2, 9)
  let guard = 0
  while (oa * ob < 10 && guard < 50) { ob = randInt(orng, 2, 9); guard += 1 } // 保證有進位 → miss-carry 永遠有效

  const a = ta * 10 + oa
  const b = tb * 10 + ob
  const kind = KINDS[randInt(orng, 0, KINDS.length - 1)]
  const info = findErrorVertical([a, b], kind)

  const operands = [a, b]
  const total = a * b
  const id = `l2-finderr-${String(seed).padStart(5, '0')}`

  const allOptions = [
    { id: 'step-1', label: '步驟一（個位乘）' },
    { id: 'step-2', label: '步驟二（十位乘）' },
    { id: 'step-3', label: '步驟三（相加）' },
  ]
  const options = shuffle(rng, allOptions)
  const correctIndex = options.findIndex((o) => o.id === info.step)

  const q = {
    id,
    lesson: LESSON,
    topic: TOPIC,
    conceptSource: CONCEPT_SOURCE,
    angle: ANGLE,
    difficulty: DIFFICULTY,
    type: 'mc',
    answerKind: 'choice',
    question: `小明用直式計 ${a} × ${b}，寫咗：① 個位乘 ${a}×${ob}=${info.s1}；② 十位乘 ${info.s2Text}；③ ${info.s3Text}。邊一步開始錯咗？`,
    operands,
    operation: 'a*b',
    answer: info.step,
    acceptedAnswers: [info.step],
    answerDisplay: allOptions.find((o) => o.id === info.step).label,
    options,
    correctIndex,
    estimate: {
      value: total,
      operands: [a, b],
      note: `直式乘法要逐位乘再補位，${a} × ${b} 嘅正確答案唔會係 ${info.wrong}。`,
    },
    displayValue: total,
    errorKind: kind,
    shownError: { step: info.step, wrongValue: info.wrong, correctValue: info.correct },
    errorTraps: [],
    commonMistake: '直式計嗰陣漏咗補位／進位，或者加漏咗部分積。',
    hint: '逐一步覆核：個位乘 → 十位乘（要補位）→ 相加。',
    hintLevel1: '逐一步覆核：個位乘 → 十位乘（要補位）→ 相加。',
    hintLevel2: '十位乘嗰步要喺結果後面補一個 0；進位嗰啲數唔可以漏。',
    explanationSteps: [
      `步驟一正確：${a} × ${ob} = ${a * ob}。`,
      `步驟二正確：${a} × ${tb} = ${a * tb}，補位後 ${a * tb * 10}。`,
      `步驟三正確：${a * ob} + ${a * tb * 10} = ${total}。`,
      `佢喺「${allOptions.find((o) => o.id === info.step).label}」開始錯咗。`,
    ],
    methods: [
      { id: `${id}-m1`, label: '方法一：逐步覆核', steps: [`個位乘 ${a}×${ob} = ${a * ob}`, `十位乘 ${a}×${tb}×10 = ${a * tb * 10}`, `相加 = ${total}`] },
      { id: `${id}-m2`, label: '方法二：直接計對答案', steps: [`${a} × ${b} = ${total}`] },
    ],
    source: 'generator',
  }

  verifyQuestion(q)
  return q
}

export default { id: TEMPLATE_ID, generate }
