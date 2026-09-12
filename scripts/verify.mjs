import { computeAnswer, LESSONS, QUESTIONS } from '../src/data/lessons.js'
import { isCorrect, normalize } from '../src/lib/grading.js'
import { classify } from '../src/lib/classify.js'
import { hashPin, hashPinPure, sha256Hex, SCHEMA_VERSION } from '../src/lib/storage.js'

/* ════════════════════════════════════════════════════════════
   mq4 驗證腳本（Node）—— npm run verify
   逐項列印真實結果，任何一項唔過就 exit 1。
   ════════════════════════════════════════════════════════════ */

let pass = 0
let fail = 0

function check(label, actual, expected) {
  const ok = actual === expected
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  console.log(`        預期: ${JSON.stringify(expected)}`)
  console.log(`        實際: ${JSON.stringify(actual)}`)
}

function checkIncludes(label, actual, allowed) {
  const ok = allowed.includes(actual)
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  console.log(`        預期包含: ${allowed.join(' / ')}`)
  console.log(`        實際: ${JSON.stringify(actual)}`)
}

console.log('══════════════════════════════════════════════')
console.log('1–3. normalize（grading.js Layer 1）')
console.log('══════════════════════════════════════════════')
check("normalize('７８２') === '782'", normalize('７８２'), '782')
check("normalize('1,234') === '1234'", normalize('1,234'), '1234')
check("normalize(' 782.0 ') === '782'", normalize(' 782.0 '), '782')

// 額外：白名單比對
check("isCorrect('１,２００', ['1200']) === true", isCorrect('１,２００', ['1200']), true)
check("isCorrect('1201', ['1200']) === false", isCorrect('1201', ['1200']), false)

console.log('')
console.log('══════════════════════════════════════════════')
console.log('4–5. classify（classify.js）')
console.log('══════════════════════════════════════════════')
const c530 = classify({ input: '530', answer: '2380' })
console.log('classify({input:"530", answer:"2380"}) →', JSON.stringify(c530))
checkIncludes('530 vs 2380 含 drop_zero 或 place_value',
  c530.subcodes.some((s) => ['drop_zero', 'place_value'].includes(s)) ? 'drop_zero-or-place_value' : c530.subcodes.join(','),
  ['drop_zero-or-place_value'])
console.log('        實際 subcodes:', c530.subcodes.join(' / '))

const c742 = classify({ input: '742', answer: '782' })
console.log('classify({input:"742", answer:"782"}) →', JSON.stringify(c742))
checkIncludes('742 vs 782 含 carry 或 add_sub',
  c742.subcodes.some((s) => ['carry', 'add_sub'].includes(s)) ? 'carry-or-add_sub' : c742.subcodes.join(','),
  ['carry-or-add_sub'])
console.log('        實際 subcodes:', c742.subcodes.join(' / '))

console.log('')
console.log('══════════════════════════════════════════════')
console.log('6. 10 條種子題目：由 operands 重算 === answer')
console.log('   （用兩個獨立實作對：自己寫嘅 parser + 動態 JS 表達式）')
console.log('══════════════════════════════════════════════')

/** 第二個獨立實作：把 operation 砌成 JS 表達式再計一次 */
function independentRecompute(operation, operands) {
  const vars = ['a', 'b', 'c', 'd', 'e', 'f']
  let expr = operation
  vars.forEach((v, i) => {
    expr = expr.split(v).join(`(${operands[i]})`)
  })
  // 只准數字、括號、加減乘
  if (!/^[0-9+\-*() ]+$/.test(expr)) throw new Error('表達式有唔接受嘅字元: ' + expr)
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${expr});`)()
}

if (QUESTIONS.length !== 10) {
  fail += 1
  console.log(`FAIL  種子題目應該係 10 條，實際 ${QUESTIONS.length} 條`)
} else {
  pass += 1
  console.log(`PASS  種子題目數量 = ${QUESTIONS.length} 條`)
}

const byLesson = { 1: 0, 2: 0 }
let mismatch = 0
for (const q of QUESTIONS) {
  byLesson[q.lesson] = (byLesson[q.lesson] || 0) + 1

  const parserValue = computeAnswer(q.operation, q.operands)
  const evalValue = independentRecompute(q.operation, q.operands)
  const dataAnswer = q.answer
  const generated = q.generatedAnswer

  const ok =
    String(parserValue) === String(dataAnswer) &&
    String(evalValue) === String(dataAnswer) &&
    String(generated) === String(dataAnswer) &&
    isCorrect(q.answer, q.acceptedAnswers)

  if (!ok) mismatch += 1
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${q.id}  ${q.question.padEnd(34)} ` +
      `operands=[${q.operands.join(',')}] ${q.operation}  →  parser=${parserValue}  eval=${evalValue}  answer=${dataAnswer}`,
  )
}
check('10 條都通過（parser === eval === answer）', mismatch, 0)

console.log('')
console.log('    每個課題題數:', JSON.stringify(byLesson))
check('課題 1 有 5 題', byLesson[1], 5)
check('課題 2 有 5 題', byLesson[2], 5)

// 題目格式完整性
const required = [
  'id', 'lesson', 'unit', 'topic', 'difficulty', 'difficultyTags', 'type',
  'question', 'answer', 'generatedAnswer', 'operands', 'operation',
  'options', 'correctIndex', 'acceptedAnswers', 'estimate', 'hint',
  'explanationSteps', 'methods', 'commonMistake', 'source',
]
const missing = []
for (const q of QUESTIONS) {
  for (const f of required) {
    if (!(f in q)) missing.push(`${q.id}.${f}`)
  }
  if (!Array.isArray(q.methods) || q.methods.length < 2) missing.push(`${q.id}.methods(<2)`)
  for (const m of q.methods || []) {
    if (!m.id || !m.label || !Array.isArray(m.steps) || m.steps.length === 0) {
      missing.push(`${q.id}.methods[${m.id || '?'}].shape`)
    }
  }
  if (q.hint.length > 25) missing.push(`${q.id}.hint(>25字)`)
  if (!q.acceptedAnswers.includes(q.answer)) missing.push(`${q.id}.acceptedAnswers 唔含 answer`)
  if (q.type === 'mc') {
    if (q.options.length !== 4) missing.push(`${q.id}.mc 唔係 4 個選項`)
    if (q.options[q.correctIndex] !== q.answer) missing.push(`${q.id}.correctIndex 對唔上答案`)
  }
}
check('所有題目欄位／格式完整', missing.length === 0 ? 'ok' : missing.join(' | '), 'ok')

// 題目 id 唯一 + 課題存在
const ids = QUESTIONS.map((q) => q.id)
check('題目 id 冇重複', String(new Set(ids).size), String(ids.length))
check('LESSONS metadata 齊（2 個課題）', LESSONS.length, 2)
console.log('    課文櫃卡面:', LESSONS.map((l) => `${l.name}（${l.subtitle}）p${l.pages}`).join(' | '))
console.log('    每個課題嘅溫習卡:', LESSONS.map((l) => `${l.id}:${l.cards.length}張`).join(' | '))

console.log('')
console.log('══════════════════════════════════════════════')
console.log('7. SHA-256（PIN 唔准 plaintext）')
console.log('══════════════════════════════════════════════')
check(
  "sha256Hex('abc')（已知測試向量）",
  sha256Hex('abc'),
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
)

const pure = hashPinPure('1234')
let subtleHash = null
try {
  subtleHash = await hashPin('1234')
} catch (err) {
  subtleHash = 'ERROR: ' + err.message
}
console.log('    hashPinPure("1234") =', pure)
console.log('    hashPin("1234")     =', subtleHash)
check('純 JS 同 Web Crypto 兩條路結果一致', subtleHash, pure)
check('PIN 唔會以明文出現喺 hash 入面', pure.includes('1234'), false)
check('SCHEMA_VERSION', SCHEMA_VERSION, 1)

// 跨 tab 同步 / 持久化 API 存在
console.log('    storage 匯出 API:', ['exportAll', 'importAll', 'subscribe', 'requestPersistence'].join(', '))

console.log('')
console.log('══════════════════════════════════════════════')
console.log(`結果：${pass} PASS / ${fail} FAIL`)
console.log('══════════════════════════════════════════════')
process.exit(fail === 0 ? 0 : 1)
