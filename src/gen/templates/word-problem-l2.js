/* ════════════════════════════════════════════════════════════
   mq4 — templates/word-problem-l2.js
   課題 2 題型 11：應用題（乘加／乘減）情境（課題 3 概念同源）。
   答案 = 乘完再加／減，由 operands 重算（operation 'a*b+c' / 'a*b-c'）。
   ════════════════════════════════════════════════════════════ */

import { randInt } from '../rng.js'
import { verifyQuestion } from '../verify.js'
import { mkTrap, operandRng, commonMistakeFrom, safeNote } from './_common.js'

export const TEMPLATE_ID = 'word-problem-l2'
export const LESSON = '2'
export const TOPIC = 'multiplication'
export const ANGLE = 'word-problem-l2'
export const CONCEPT_SOURCE = { pages: '15-17', concept: 'multiplication' }
export const DIFFICULTY = 'advanced'

export function generate(rng, _difficulty = null, _level = null, seed = 0) {
  const orng = operandRng(seed, TEMPLATE_ID)
  const unit = randInt(orng, 3, 12) // 每盒／每包數量
  const qty = randInt(orng, 2, 9) // 盒數
  const base = unit * qty
  const isAdd = rng() < 0.5 // 乘加 vs 乘減

  let extra
  let operation
  let answer
  let question
  if (isAdd) {
    extra = randInt(orng, 2, 9)
    operation = 'a*b+c'
    answer = base + extra
    question = `一盒有 ${unit} 個，買咗 ${qty} 盒，另外再攞 ${extra} 個。一共幾多個？`
  } else {
    const hi = Math.max(2, base - 2)
    extra = randInt(orng, 2, hi)
    operation = 'a*b-c'
    answer = base - extra
    question = `一盒有 ${unit} 個，買咗 ${qty} 盒，分咗 ${extra} 個畀同學。仲剩幾多個？`
  }

  const operands = [unit, qty, extra]
  const id = `l2-word-${String(seed).padStart(5, '0')}`
  const traps = [
    mkTrap('a*b', operands, '計咗幾盒嘅總數就停咗（冇加/減嗰啲）'),
    mkTrap('b+c', operands, '把盒數同散數亂加'),
    mkTrap('a', operands, '寫返每盒數量'),
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
    question,
    operands,
    operation,
    answer: String(answer),
    answerDisplay: String(answer),
    acceptedAnswers: [String(answer)],
    options: [],
    correctIndex: -1,
    estimate: {
      value: base,
      operands: [unit, qty],
      note: safeNote(String(answer),
        () => `先計 ${unit} × ${qty} = ${base}，再${isAdd ? '加' : '減'}返個散數`,
        () => `${unit} × ${qty} 已經係 ${base}`,
      ),
    },
    errorTraps: traps,
    commonMistake: commonMistakeFrom(traps),
    hint: '先乘出幾盒嘅總數，再處理加／減。',
    hintLevel1: '先乘出幾盒嘅總數，再處理加／減。',
    hintLevel2: isAdd ? '乘完總數，記得再加返額外嗰啲。' : '乘完總數，記得再減返分咗嗰啲。',
    explanationSteps: [
      `先計幾盒：${unit} × ${qty} = ${base}。`,
      isAdd
        ? `再加散買嗰 ${extra} 個：${base} + ${extra} = ${answer}。`
        : `再減分咗嗰 ${extra} 個：${base} - ${extra} = ${answer}。`,
      `所以答案係 ${answer}。`,
    ],
    methods: [
      { id: `${id}-m1`, label: '方法一：先乘再加減', steps: [`${unit} × ${qty} = ${base}`, isAdd ? `${base} + ${extra} = ${answer}` : `${base} - ${extra} = ${answer}`] },
      { id: `${id}-m2`, label: '方法二：直接列式', steps: [`${unit} × ${qty} ${isAdd ? '+' : '-'} ${extra} = ${answer}`] },
    ],
    source: 'generator',
  }

  verifyQuestion(q)
  return q
}

export default { id: TEMPLATE_ID, generate }
