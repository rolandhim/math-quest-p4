/* ════════════════════════════════════════════════════════════
   mq4 — templates/triple-product.js
   課題 2 題型 7：三數連乘（結合性質）。例 4×9×25（課本 p21–23）。
   兩數先乘出整十／整百，再乘第三個（結合性質）。
   ════════════════════════════════════════════════════════════ */

import { randInt } from '../rng.js'
import { verifyQuestion } from '../verify.js'
import { mkTrap, operandRng, safeNote, commonMistakeFrom } from './_common.js'

export const TEMPLATE_ID = 'triple-product'
export const LESSON = '2'
export const TOPIC = 'multiplication'
export const ANGLE = 'triple-product'
export const CONCEPT_SOURCE = { pages: '21-23', concept: 'associative' }
export const DIFFICULTY = 'advanced'

const MAGIC = [[4, 25], [8, 25], [12, 25], [16, 25], [5, 16], [5, 18], [5, 14], [6, 15], [8, 15], [4, 15]]

export function generate(rng, _difficulty = null, _level = null, seed = 0) {
  const orng = operandRng(seed, TEMPLATE_ID)
  const [p, m] = MAGIC[randInt(orng, 0, MAGIC.length - 1)]
  const r = randInt(orng, 3, 9) // 第三個數

  const operands = [p, m, r]
  const answer = p * m * r
  const id = `l2-triple-${String(seed).padStart(5, '0')}`
  const traps = [
    mkTrap('a', operands, '只寫返第一個數'),
    mkTrap('b', operands, '只寫返第二個數'),
    mkTrap('c', operands, '只寫返第三個數'),
  ]

  const low = r - 1 >= 2 ? r - 1 : r + 1
  const estValue = p * m * low

  const q = {
    id,
    lesson: LESSON,
    topic: TOPIC,
    conceptSource: CONCEPT_SOURCE,
    angle: ANGLE,
    difficulty: DIFFICULTY,
    type: 'type-answer',
    answerKind: 'number',
    question: `${p} × ${m} × ${r} = ?`,
    operands,
    operation: 'a*b*c',
    answer: String(answer),
    answerDisplay: String(answer),
    acceptedAnswers: [String(answer)],
    options: [],
    correctIndex: -1,
    estimate: {
      value: estValue,
      operands: [p, m, low],
      note: safeNote(String(answer),
        () => `${p} × ${m} × ${low} = ${estValue}，答案應該喺 ${estValue} 附近`,
        () => `先乘 ${p} × ${m} = ${p * m}，再乘返 ${r} 就係答案`,
      ),
    },
    errorTraps: traps,
    commonMistake: commonMistakeFrom(traps),
    hint: '睇下邊兩個數乘埋會出整十／整百，先乘嗰對。',
    hintLevel1: '睇下邊兩個數乘埋會出整十／整百，先乘嗰對。',
    hintLevel2: '乘嘅次序可以變（結合性質），揀易乘嗰對先。',
    explanationSteps: [
      `結合性質：乘嘅次序點變都得。`,
      `揀易乘嗰對：${p} × ${m} = ${p * m}。`,
      `再乘 ${r}：${p * m} × ${r} = ${answer}。`,
      `（順序乘 ${p}×${m}=${p * m}，×${r}=${answer} 都得，答案一樣 ✓）`,
    ],
    methods: [
      { id: `${id}-m1`, label: '方法一：先乘整十嗰對', steps: [`${p} × ${m} = ${p * m}`, `${p * m} × ${r} = ${answer}`] },
      { id: `${id}-m2`, label: '方法二：順序乘', steps: [`${p} × ${m} = ${p * m}`, `${p * m} × ${r} = ${answer}`] },
    ],
    source: 'generator',
  }

  verifyQuestion(q)
  return q
}

export default { id: TEMPLATE_ID, generate }
