#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════
   verify-schema.mjs —— npm run check:schema（S1–S4）

   按 canonical schema v1（math-quest-p4-question-schema-v1.md §5）：
     S1  每題必填欄位齊、型別正確、冇 undefined
     S2  estimate.value ≠ Number(answer)；estimate.note / hint 唔包答案字串
     S3  answerDisplay：choice 型 === 對應 option 嘅 label；number 型 === answer
     S4  options 全係 {id,label}、id 互不相等、correctIndex 指中 answer

   生成 5,000 題（seed 0..4999，輪住 11 個 template），
   任何一題違反即記低並 exit 1。
   ════════════════════════════════════════════════════════════ */

import { TEMPLATES, generateQuestion } from '../src/gen/registry.js'

const N = Number(process.argv[2] || 5000)

/* ── 小工具 ─────────────────────────────────────────────── */
function isStr(x) { return typeof x === 'string' && x.length > 0 }
function isObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x) }
function isNumArr(x) { return Array.isArray(x) && x.every((n) => typeof n === 'number' && Number.isFinite(n)) }
function isStrArr(x) { return Array.isArray(x) && x.every((n) => typeof n === 'string') }

/* ── S1：必填欄位 + 型別 ───────────────────────────────── */
function checkS1(q, tpl) {
  const errs = []
  const need = (cond, msg) => { if (!cond) errs.push(msg) }

  need(isStr(q.id), 'id 唔係非空字串')
  need(isStr(q.lesson), 'lesson 唔係非空字串')
  need(isStr(q.topic), 'topic 唔係非空字串')
  need(isStr(q.angle), 'angle 唔係非空字串')
  need(isObj(q.conceptSource) && isStr(q.conceptSource.pages) && isStr(q.conceptSource.concept),
    'conceptSource 缺 {pages, concept}')
  need(['basic', 'advanced', 'challenge'].includes(q.difficulty), 'difficulty 唔合法')
  need(isStr(q.question), 'question 唔係非空字串')
  need(q.type === 'mc' || q.type === 'type-answer', 'type 唔係 mc / type-answer')
  need(q.answerKind === 'number' || q.answerKind === 'choice', 'answerKind 唔係 number / choice')
  need(typeof q.answer === 'string', 'answer 唔係字串')
  need(isStr(q.answerDisplay), 'answerDisplay 唔係非空字串')
  need(isStrArr(q.acceptedAnswers) && q.acceptedAnswers.length >= 1, 'acceptedAnswers 唔係非空字串陣列')
  need(isStr(q.hint), 'hint 唔係非空字串')
  need(isStr(q.commonMistake), 'commonMistake 唔係非空字串')
  need(isStr(q.operation), 'operation 唔係非空字串')
  need(isNumArr(q.operands), 'operands 唔係數字陣列')
  need(isStrArr(q.explanationSteps) && q.explanationSteps.length >= 1, 'explanationSteps 唔係非空字串陣列')
  need(Array.isArray(q.methods) && q.methods.length >= 2, 'methods 少過 2 個')
  for (const m of q.methods || []) {
    need(isStr(m.id) && isStr(m.label) && isStrArr(m.steps) && m.steps.length >= 1,
      `method「${m && m.id}」缺 id/label/steps`)
  }
  // estimate
  need(isObj(q.estimate), 'estimate 唔係 object')
  need(typeof q.estimate.value === 'number' && Number.isFinite(q.estimate.value), 'estimate.value 唔係有限數字')
  need(isNumArr(q.estimate.operands), 'estimate.operands 唔係數字陣列')
  need(isStr(q.estimate.note), 'estimate.note 唔係非空字串')
  // errorTraps
  need(Array.isArray(q.errorTraps), 'errorTraps 唔係陣列')
  // source
  need(q.source === 'generator' || q.source === 'prebuilt', 'source 唔合法')

  return errs
}

/* ── S2：estimate 唔可以係答案、note/hint 唔可以洩漏答案 ── */
/* 洩漏檢查跟 safeNote 一致：數字答案用「數字 token 比對」
   （answer=20 遇上「720」唔算洩漏）；非數字（choice id）用文字包含。 */
function noteLeaks(ansStr, text) {
  const t = String(text)
  if (/^\d+$/.test(ansStr)) {
    const n = Number(ansStr)
    const tokens = t.match(/\d+/g) ?? []
    return tokens.some((tok) => Number(tok) === n)
  }
  return t.includes(ansStr)
}

function checkS2(q) {
  const errs = []
  const ansStr = String(q.answer)
  if (q.estimate.value === Number(q.answer)) {
    errs.push(`estimate.value=${q.estimate.value} 等於答案 ${ansStr}`)
  }
  if (noteLeaks(ansStr, q.estimate.note)) {
    errs.push(`estimate.note 洩漏答案「${ansStr}」：${q.estimate.note}`)
  }
  if (noteLeaks(ansStr, q.hint)) {
    errs.push(`hint 洩漏答案「${ansStr}」：${q.hint}`)
  }
  return errs
}

/* ── S3：answerDisplay 對得上 ───────────────────────────── */
function checkS3(q) {
  const errs = []
  if (q.answerKind === 'choice') {
    const label = q.options[q.correctIndex] && q.options[q.correctIndex].label
    if (q.answerDisplay !== label) {
      errs.push(`answerDisplay="${q.answerDisplay}" ≠ 正解 option label="${label}"`)
    }
  } else if (q.answerDisplay !== String(q.answer)) {
    errs.push(`number 型 answerDisplay="${q.answerDisplay}" ≠ answer="${q.answer}"`)
  }
  return errs
}

/* ── S4：options 格式 + correctIndex 指中答案 ───────────── */
function checkS4(q) {
  const errs = []
  if (q.type === 'mc') {
    if (!Array.isArray(q.options) || q.options.length < 2) {
      errs.push(`mc 題 options 少過 2 個`)
      return errs
    }
    const ids = q.options.map((o) => (o && o.id))
    if (ids.some((id) => typeof id !== 'string' || id.length === 0)) {
      errs.push(`有 option 唔係 {id,label}（缺 id）`)
    }
    if (new Set(ids).size !== ids.length) {
      errs.push(`option id 重複：${ids.join(' | ')}`)
    }
    if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= q.options.length) {
      errs.push(`correctIndex=${q.correctIndex} 越界`)
    } else if (String(q.options[q.correctIndex].id) !== String(q.answer)) {
      errs.push(`correctIndex 指中 id=${q.options[q.correctIndex].id} ≠ answer=${q.answer}`)
    }
  } else {
    if (!Array.isArray(q.options) || q.options.length !== 0) {
      errs.push(`type-answer 題 options 應該係 []（實際 ${JSON.stringify(q.options)}）`)
    }
    if (q.correctIndex !== -1) {
      errs.push(`type-answer 題 correctIndex 應該係 -1（實際 ${q.correctIndex}）`)
    }
  }
  return errs
}

/* ── 主流程 ─────────────────────────────────────────────── */
const byTpl = {}
const problems = []
let thrown = 0

const t0 = Date.now()
for (let seed = 0; seed < N; seed += 1) {
  const tpl = TEMPLATES[seed % TEMPLATES.length]
  let q
  try {
    q = generateQuestion(seed, { template: tpl.id })
  } catch (err) {
    thrown += 1
    problems.push({ seed, tpl: tpl.id, why: `generation threw: ${err.message}` })
    continue
  }

  byTpl[tpl.id] = (byTpl[tpl.id] || 0) + 1

  const errs = [
    ...checkS1(q, tpl),
    ...checkS2(q),
    ...checkS3(q),
    ...checkS4(q),
  ]
  if (errs.length > 0) {
    problems.push({ seed, tpl: tpl.id, id: q.id, why: errs.join('；') })
  }
}
const ms = Date.now() - t0

/* ── 報告 ───────────────────────────────────────────────── */
console.log('══════════════════════════════════════════════')
console.log('schema v1 驗證（S1–S4）')
console.log('══════════════════════════════════════════════')
console.log(`目標題數   : ${N}（seed 0..${N - 1}，輪住 ${TEMPLATES.length} 個 template）`)
console.log(`實際生成   : ${N - thrown}`)
console.log(`generation 拋錯 : ${thrown}`)
console.log(`時長       : ${ms} ms`)
console.log('')
console.log('=== 每個 template 生成題數 ===')
for (const t of TEMPLATES) {
  console.log(`  ${t.id.padEnd(18)} ${String(byTpl[t.id] || 0).padStart(5)} 題`)
}
console.log('')
console.log(`違反題數   : ${problems.length}`)
if (problems.length > 0) {
  console.log('')
  console.log('=== 問題題目（最多示 20 條）===')
  for (const p of problems.slice(0, 20)) {
    console.log(`  seed ${p.seed} [${p.tpl}] ${p.id || ''} → ${p.why}`)
  }
  console.log('')
  console.log(`✗ 有 ${problems.length} 條題目唔過 schema gate`)
  process.exit(1)
}
console.log('✅ 全部通過：S1 欄位齊、S2 估算唔洩漏、S3 answerDisplay 對齊、S4 options 格式正確')
process.exit(0)
