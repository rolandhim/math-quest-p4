/* ════════════════════════════════════════════════════════════
   mq4 — verify-lesson1.mjs —— node scripts/verify-lesson1.mjs
   課題 1（乘法分配性質）其餘 10 款題型嘅驗證。
   任何一項唔過就 exit 1。

   驗證項：
     ① 10,000 題（seed 0..9999，10 款輪流）零 throw + 每款題數 + 效能
     ② 每款題型題數分佈
     ③ 答案正確性獨立重算（每條題用一條獨立路徑，唔用 computeAnswer）
     ④ 決定性：同 seed 兩次逐 bytes 相等
     ⑤ 答案唯一性：MC 四值互異 + correctIndex；打字題 options 空
     ⑥ 方程式題型唯一解（solve.js 獨立窮舉）
     ⑦ 撞題率：5 款題型出同一組 (數字,答案) —— 改前 98.7% → 改後
     ⑧ fastest／which-property（choice）：正解可程式重推、
        兩個方法／兩個性質都出現過、correctIndex 指中正解 100%
   ════════════════════════════════════════════════════════════ */

import { generateQuestion, TEMPLATES } from '../src/gen/registry.js'
import { verifyQuestion } from '../src/gen/verify.js'
import { uniqueTargetValue } from '../src/gen/solve.js'
import { makeRng, randInt } from '../src/gen/rng.js'
import { deriveFastestMethod, fastestCosts, deriveProperty } from '../src/gen/derive.js'
import { isLinkedSeed, LINKED_NUM, LINKED_DEN } from '../src/gen/templates/_common.js'

const TEMPLATE_IDS = TEMPLATES.map((t) => t.id).filter((id) => id !== 'symbol-blank')
const N = 10000

let fail = 0
function gate(ok, label, detail = '') {
  if (!ok) fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  →  ' + detail : ''}`)
}

console.log('══════════════════════════════════════════════════')
console.log(`課題 1 — 其餘 ${TEMPLATE_IDS.length} 款題型驗證`)
console.log(`題型：${TEMPLATE_IDS.join('、')}`)
console.log('══════════════════════════════════════════════════\n')

/* ── 獨立重算（唔用 computeAnswer，直接用 operands 依 angle 重算） ── */
function numericRecompute(q) {
  const o = q.operands.map(Number)
  switch (q.angle) {
    case 'expand':
    case 'reverse':
    case 'fastest':
    case 'find-error':
    case 'word-to-expression':
      return o[0] * (o[1] + o[2])
    case 'subtract':
      return o[0] * (o[1] - o[2])
    case 'decompose':
      return q.operation === 'a+c' ? o[0] + o[2] : o[0] - o[2]
    case 'which-property':
      return q.operation === 'a*b*c' ? o[0] * o[1] * o[2] : o[0] * (o[1] + o[2])
    case 'reverse-unknown':
      return o[1]
    case 'fill-blank':
      return o[0] + o[1]
    default:
      throw new Error('unknown angle ' + q.angle)
  }
}

/* ── 額外結構不變量（每款） ── */
function structuralInvariants(q) {
  const o = q.operands.map(Number)
  const errs = []
  if (q.angle === 'subtract' && o[1] - o[2] < 0) errs.push('減法結果負數')
  if (q.angle === 'reverse-unknown' && o[0] * o[1] !== o[2]) errs.push('□×因數 ≠ 乘積')
  if (q.angle === 'decompose') {
    const base = Number(q.answer)
    const k = o[2]
    const n = o[0]
    const okSign = q.operation === 'a+c' ? base - k === n : base + k === n
    if (!okSign) errs.push(`拆數唔還原（base=${base} k=${k} n=${n}）`)
    if (base % 10 !== 0) errs.push(`base 唔係整十數（${base}）`)
  }
  if (q.angle === 'find-error') {
    const wrong = q.shownError.value
    if (wrong === Number(q.answer)) errs.push('錯誤版本 == 正確答案')
    if (wrong !== o[0] * o[1] + o[2]) errs.push('錯誤版本唔係「漏乘」結構')
  }
  return errs
}

/* ── ① 10,000 題零 throw ＋ ② 分佈 ＋ 效能 ──────────── */
const byType = {}
for (const id of TEMPLATE_IDS) byType[id] = 0
let throws = 0
let firstErr = null
const questions = []
const t0 = performance.now()
for (let seed = 0; seed < N; seed += 1) {
  const tpl = TEMPLATE_IDS[seed % TEMPLATE_IDS.length]
  try {
    const q = generateQuestion(seed, { template: tpl })
    byType[tpl] += 1
    questions.push(q)
  } catch (err) {
    throws += 1
    if (!firstErr) firstErr = `seed=${seed} template=${tpl}：${err.message}`
  }
}
const t1 = performance.now()
const ms = t1 - t0

console.log(`① 生成 ${N} 題（${TEMPLATE_IDS.length} 款輪流，seed 0..9999）`)
gate(throws === 0, '零 throw', throws === 0 ? `${N} 題全部生成` : `${throws} 題 throw，首錯：${firstErr}`)
gate(ms < 3000, `效能 < 3 秒（實際 ${ms.toFixed(1)} ms）`)
console.log('')

console.log('② 每款題型題數分佈')
let distOk = true
for (const id of TEMPLATE_IDS) {
  const n = byType[id]
  if (n <= 0) distOk = false
  console.log(`    ${id.padEnd(20)} : ${n} 題`)
}
gate(distOk, `${TEMPLATE_IDS.length} 款全部有貨`, distOk ? `總計 ${N} 題` : '有款冇貨')
console.log('')

/* ── ③ 答案正確性獨立重算 ＋ 結構不變量 ────────────────── */
let recomputeFail = 0
let firstRecomputeErr = null
let structFail = 0
let firstStructErr = null
for (const q of questions) {
  const indep = numericRecompute(q)
  const target = q.answerKind === 'choice' ? q.displayValue : q.answer
  if (String(indep) !== String(target)) {
    recomputeFail += 1
    if (!firstRecomputeErr) firstRecomputeErr = `${q.id}：獨立重算 ${indep} ≠ ${target}`
  }
  const errs = structuralInvariants(q)
  if (errs.length > 0) {
    structFail += 1
    if (!firstStructErr) firstStructErr = `${q.id}：${errs.join('；')}`
  }
  // 順手獨立再跑一次 verifyQuestion（V1–V7）
  try {
    verifyQuestion(q)
  } catch (err) {
    recomputeFail += 1
    if (!firstRecomputeErr) firstRecomputeErr = `${q.id} 獨立 verify throw：${err.message}`
  }
}
console.log('③ 答案正確性獨立重算（獨立路徑，唔用 computeAnswer）')
gate(recomputeFail === 0, '100% 重算一致', recomputeFail === 0 ? `${questions.length} 題全部一致` : `${recomputeFail} 題唔過，首錯：${firstRecomputeErr}`)
gate(structFail === 0, '結構不變量', structFail === 0 ? '減法非負／拆數還原／逆向乘積 全 pass' : `${structFail} 題唔過，首錯：${firstStructErr}`)
console.log('')

/* ── ④ 決定性：同 seed 兩次逐 bytes 相等 ─────────────── */
let detFail = 0
for (let seed = 0; seed < 1000; seed += 1) {
  const tpl = TEMPLATE_IDS[seed % TEMPLATE_IDS.length]
  const a = JSON.stringify(generateQuestion(seed, { template: tpl }))
  const b = JSON.stringify(generateQuestion(seed, { template: tpl }))
  if (a !== b) {
    detFail += 1
    break
  }
}
console.log('④ 決定性（1,000 seed × 2 次，逐 bytes 相等）')
gate(detFail === 0, '同 seed 兩次 JSON 完全相等', detFail === 0 ? '1000/1000 一致' : `${detFail} 唔一致`)
console.log('')

/* ── ⑤ 答案唯一性（MC 四值互異 + correctIndex；打字題空選項） ── */
let uniqFail = 0
let firstUniqErr = null
for (const q of questions) {
  if (q.type === 'mc') {
    if (q.answerKind === 'choice') {
      // choice：選項係 {id,label}，id 互異，correctIndex 指中 answer id
      if (q.options.length < 2) { uniqFail += 1; if (!firstUniqErr) firstUniqErr = `${q.id} choice 選項唔夠`; continue }
      if (new Set(q.options.map((o) => o.id)).size !== q.options.length) { uniqFail += 1; if (!firstUniqErr) firstUniqErr = `${q.id} choice id 重複`; continue }
      if (q.options[q.correctIndex].id !== q.answer) { uniqFail += 1; if (!firstUniqErr) firstUniqErr = `${q.id} choice correctIndex 指唔中`; continue }
    } else {
      if (q.options.length !== 4) { uniqFail += 1; if (!firstUniqErr) firstUniqErr = `${q.id} MC 選項唔係 4`; continue }
      if (new Set(q.options).size !== 4) { uniqFail += 1; if (!firstUniqErr) firstUniqErr = `${q.id} MC 選項重複`; continue }
      if (String(q.options[q.correctIndex]) !== q.answer) { uniqFail += 1; if (!firstUniqErr) firstUniqErr = `${q.id} correctIndex 指唔中`; continue }
    }
  } else if (q.options.length !== 0 || q.correctIndex !== -1) {
    uniqFail += 1
    if (!firstUniqErr) firstUniqErr = `${q.id} 打字題 options/index 唔啱`
  }
}
console.log('⑤ 答案唯一性（MC 四值互異 + correctIndex；打字題空選項）')
gate(uniqFail === 0, '全部唯一', uniqFail === 0 ? `${questions.length} 題全部過` : `${uniqFail} 題唔過，首錯：${firstUniqErr}`)
console.log('')

/* ── ⑥ 方程式題型（decompose／reverse-unknown／fill-blank）唯一解 ── */
let eqFail = 0
let firstEqErr = null
let eqCount = 0
for (const q of questions) {
  if (!q.equation) continue
  eqCount += 1
  const unique = uniqueTargetValue(q.equation.lhs, q.equation.rhs, q.targetSymbol)
  if (unique === null || String(unique) !== q.answer) {
    eqFail += 1
    if (!firstEqErr) firstEqErr = `${q.id}（solve 得 ${unique}，答案 ${q.answer}）`
  }
}
console.log('⑥ 方程式題型唯一解（solve.js 獨立窮舉）')
gate(eqFail === 0, '100% 唯一', eqFail === 0 ? `${eqCount} 條方程式題全部唯一` : `${eqFail} 條唔過，首錯：${firstEqErr}`)
console.log('')

/* ── ⑦ 撞題率：5 款題型出同一組 (數字, 答案) ─────────── */
const GROUP_IDS = ['forward-expand', 'reverse-combine', 'fastest', 'find-error', 'word-to-expression']

// 改前模擬：舊 code 五款共用 makeRng(seed)；fastest 若 buildMc 失敗會 regenerate 而分叉
function legacyOperands(seed) {
  const rng = makeRng(seed)
  let b = randInt(rng, 10, 90)
  let c = randInt(rng, 10, 90)
  while (c === b) c = randInt(rng, 10, 90)
  const hi = Math.min(20, Math.floor(1000 / (b + c)))
  const a = 2 + Math.floor(rng() * (hi - 2 + 1))
  return [a, b, c]
}
function legacyBeforeSame(seed) {
  const [a, b, c] = legacyOperands(seed)
  const vals = new Set([String(a * (b + c)), String(a * b), String(a * c), String(b + c)])
  return vals.size === 4 // fastest 第一次就成功 → 五款全部同組
}

function numericKey(q) {
  const val = q.answerKind === 'choice' ? q.displayValue : q.answer
  return q.operands.map(Number).join(',') + '=' + String(val)
}

let beforeSame = 0
let afterSame = 0
let linkedSeeds = 0
let linkedSame = 0
for (let seed = 0; seed < N; seed += 1) {
  if (legacyBeforeSame(seed)) beforeSame += 1

  const group = GROUP_IDS.map((id) => generateQuestion(seed, { template: id }))
  const keys = group.map(numericKey)
  const same = new Set(keys).size === 1
  if (same) afterSame += 1
  if (isLinkedSeed(seed)) {
    linkedSeeds += 1
    if (same) linkedSame += 1
  }
}
const beforePct = (100 * beforeSame / N).toFixed(2)
const afterPct = (100 * afterSame / N).toFixed(2)
console.log('⑦ 撞題率（5 款題型出同一組 (數字,答案)）')
console.log(`    改前（舊 code 模擬，10,000 seed）: ${beforePct}%`)
console.log(`    改後（新 code，10,000 seed）        : ${afterPct}%`)
console.log(`    設計目標（刻意同組）               : ${((100 * LINKED_NUM) / LINKED_DEN).toFixed(1)}%`)
gate(
  afterSame <= linkedSeeds + N * 0.01 && afterSame >= linkedSame - N * 0.01,
  '改後撞題率喺目標範圍內（~15% 刻意同組）',
  `改後 ${afterSame}/${N}（${afterPct}%）`
)
console.log(`    （同組 seed 共 ${linkedSeeds} 個，其中 ${linkedSame} 個確實 5 款同組）`)
console.log('')

/* ── ⑧ fastest / which-property（choice 題型） ─────────── */
const fastestQs = questions.filter((q) => q.angle === 'fastest')
const propQs = questions.filter((q) => q.angle === 'which-property')

let fastFail = 0
let firstFastErr = null
let fastCostFail = 0
const fastM1 = fastestQs.filter((q) => q.answer === 'method-1').length
const fastM2 = fastestQs.filter((q) => q.answer === 'method-2').length
for (const q of fastestQs) {
  const derived = deriveFastestMethod(q.operands.map(Number))
  if (derived !== q.answer) { fastFail += 1; if (!firstFastErr) firstFastErr = `${q.id} 重推=${derived} ≠ answer=${q.answer}`; continue }
  if (q.options[q.correctIndex].id !== q.answer) { fastFail += 1; if (!firstFastErr) firstFastErr = `${q.id} correctIndex 指唔中正解`; continue }
  const c = fastestCosts(q.operands.map(Number))
  const correctIsCheaper = q.answer === 'method-1' ? c.method1 < c.method2 : c.method2 <= c.method1
  if (!correctIsCheaper) { fastCostFail += 1; if (!firstFastErr) firstFastErr = `${q.id} 正解唔係運算較少（m1=${c.method1} m2=${c.method2}）` }
}
const fastTotal = fastestQs.length
const pctM1 = fastTotal ? (100 * fastM1 / fastTotal).toFixed(1) : '0.0'
const pctM2 = fastTotal ? (100 * fastM2 / fastTotal).toFixed(1) : '0.0'
console.log('⑧a fastest（揀邊個方法快）')
console.log(`    方法一（分開乘）出現 : ${fastM1}/${fastTotal}（${pctM1}%）`)
console.log(`    方法二（先加埋）出現 : ${fastM2}/${fastTotal}（${pctM2}%）`)
gate(fastFail === 0, '正解可程式重推 + correctIndex 指中 100%', fastFail === 0 ? `${fastTotal} 題全對` : `${fastFail} 題唔過，首錯：${firstFastErr}`)
gate(fastCostFail === 0, '正解真係運算較少', fastCostFail === 0 ? `${fastTotal} 題全對` : `${fastCostFail} 題正解反而貴，首錯：${firstFastErr}`)
gate(fastM1 >= fastTotal * 0.3 && fastM2 >= fastTotal * 0.3, '兩個方法都 ≥30%', `方法一 ${pctM1}%、方法二 ${pctM2}%`)

let propFail = 0
let firstPropErr = null
const assoc = propQs.filter((q) => q.answer === 'associative').length
const dist = propQs.filter((q) => q.answer === 'distributive').length
for (const q of propQs) {
  const derived = deriveProperty(q)
  if (derived !== q.answer) { propFail += 1; if (!firstPropErr) firstPropErr = `${q.id} 重推=${derived} ≠ answer=${q.answer}`; continue }
  if (q.options[q.correctIndex].id !== q.answer) { propFail += 1; if (!firstPropErr) firstPropErr = `${q.id} correctIndex 指唔中正解`; continue }
}
const propTotal = propQs.length
const pctAssoc = propTotal ? (100 * assoc / propTotal).toFixed(1) : '0.0'
const pctDist = propTotal ? (100 * dist / propTotal).toFixed(1) : '0.0'
console.log('')
console.log('⑧b which-property（用邊個性質）')
console.log(`    結合性質出現 : ${assoc}/${propTotal}（${pctAssoc}%）`)
console.log(`    分配性質出現 : ${dist}/${propTotal}（${pctDist}%）`)
gate(propFail === 0, '正解可程式重推 + correctIndex 指中 100%', propFail === 0 ? `${propTotal} 題全對` : `${propFail} 題唔過，首錯：${firstPropErr}`)
gate(assoc >= propTotal * 0.3 && dist >= propTotal * 0.3, '兩個性質都 ≥30%', `結合 ${pctAssoc}%、分配 ${pctDist}%`)
console.log('')

/* ── ✗ 搵錯處：錯誤版本 ≠ 正確答案 ───────────────────── */
const findErrQs = questions.filter((q) => q.angle === 'find-error')
let wrongEq = 0
let firstWrong = null
for (const q of findErrQs) {
  if (q.shownError.value === Number(q.answer)) {
    wrongEq += 1
    if (!firstWrong) firstWrong = `${q.id} 錯誤版本 ${q.shownError.value} == 正確 ${q.answer}`
  }
}
console.log(`✗ 搵錯處（共 ${findErrQs.length} 題）`)
gate(wrongEq === 0, '錯誤版本 ≠ 正確答案（100%）', wrongEq === 0 ? `${findErrQs.length}/${findErrQs.length} 全部唔同` : `${wrongEq} 題出事，首錯：${firstWrong}`)

console.log('')
console.log('══════════════════════════════════════════════════')
console.log(fail === 0 ? '課題 1 其餘 10 款題型全部驗證通過 ✓' : `有 ${fail} 項唔過 ✗`)
console.log('══════════════════════════════════════════════════')
process.exit(fail === 0 ? 0 : 1)
