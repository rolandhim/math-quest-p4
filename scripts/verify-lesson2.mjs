/* ════════════════════════════════════════════════════════════
   mq4 — verify-lesson2.mjs —— npm run check:lesson2
   課題 2（乘法的運算）12 款題型嘅驗證。任何一項唔過就 exit 1。

   驗證項：
     ① 每款題型 500 條，verifyQuestion（V1–V7）零違反
     ② 唯一解（symbol-blank-l2 / reverse-l2：solve.js 窮舉）
     ③ 提示洩漏（estimate.note / hint / commonMistake 唔准含答案，token 比對）
     ④ estimate.note 有數字比率（每款 ≥95%）
     ⑤ ★ 設計意圖：印出「渲染出嚟嘅題目文字」+ 斷言佢真係問嗰件事
        （fastest-order 答案係 order-*；find-error-vertical 陷阱真錯 + 答案係步驟；
         estimate-first 題文含「估」+ 答案唔係精確積）
     ⑥ 語料多樣性：逐款 distinct 比率；跨題型撞題率 < 30%；choice 分支 ≥30%
     ⑦ 課本依據：每款都有 conceptSource（G47）
   ════════════════════════════════════════════════════════════ */

import { generateQuestion, TEMPLATES } from '../src/gen/registry.js'
import { verifyQuestion } from '../src/gen/verify.js'
import { uniqueTargetValue } from '../src/gen/solve.js'
import { deriveFastestOrder, findErrorVertical } from '../src/gen/derive.js'

const LESSON2 = TEMPLATES.filter((t) => t.lesson === '2')
const IDS = LESSON2.map((t) => t.id)
const PER_TYPE = 500

let fail = 0
function gate(ok, label, detail = '') {
  if (!ok) fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  →  ' + detail : ''}`)
}

/* 數字答案用「數字 token 比對」；choice id 用文字包含比對 */
function leaks(ansStr, text) {
  const t = String(text)
  if (/^\d+$/.test(ansStr)) {
    const n = Number(ansStr)
    const tokens = t.match(/\d+/g) ?? []
    return tokens.some((tok) => Number(tok) === n)
  }
  return t.includes(ansStr)
}

console.log('══════════════════════════════════════════════════')
console.log(`課題 2（乘法的運算）${IDS.length} 款題型驗證`)
console.log(`題型：${IDS.join('、')}`)
console.log('══════════════════════════════════════════════════\n')

/* ── ① 生成 + verifyQuestion 零違反 ─────────────────── */
const byType = {}
for (const id of IDS) byType[id] = new Array(PER_TYPE).fill(null)
let throws = 0
let firstErr = null
const t0 = performance.now()
for (const id of IDS) {
  for (let seed = 0; seed < PER_TYPE; seed += 1) {
    try {
      const q = generateQuestion(seed, { template: id })
      verifyQuestion(q) // 獨立再跑一次 V1–V7
      byType[id][seed] = q
    } catch (err) {
      throws += 1
      if (!firstErr) firstErr = `${id} seed=${seed}：${err.message}`
    }
  }
}
const ms = performance.now() - t0

console.log(`① 生成 ${IDS.length} 款 × ${PER_TYPE} 條（共 ${IDS.length * PER_TYPE}）`)
gate(throws === 0, '零 throw + verifyQuestion 零違反', throws === 0 ? `${IDS.length * PER_TYPE} 條全部通過` : `${throws} 條 throw，首錯：${firstErr}`)
console.log(`    每款題數：${IDS.map((id) => `${id}=${byType[id].length}`).join('、')}`)
console.log(`    時長：${ms.toFixed(1)} ms\n`)

/* ── ⑦ 課本依據（G47） ─────────────────────────────── */
const noSource = LESSON2.filter((t) => !(t.conceptSource && t.conceptSource.pages && t.conceptSource.concept))
console.log('⑦ 課本依據（conceptSource）')
gate(noSource.length === 0, `${IDS.length} 款全部有 conceptSource`, noSource.length === 0 ? '齊全' : `缺：${noSource.map((t) => t.id).join('、')}`)
console.log(`    ${IDS.map((id) => `${id}=${LESSON2.find((t) => t.id === id).conceptSource.pages}`).join('、')}\n`)

/* ── ② 唯一解（方程式題型） ────────────────────────── */
let eqFail = 0
let firstEqErr = null
let eqCount = 0
for (const q of [...byType['symbol-blank-l2'], ...byType['reverse-l2']]) {
  if (!q.equation) continue
  eqCount += 1
  const unique = uniqueTargetValue(q.equation.lhs, q.equation.rhs, q.targetSymbol)
  if (unique === null || String(unique) !== q.answer) {
    eqFail += 1
    if (!firstEqErr) firstEqErr = `${q.id}（solve 得 ${unique}，答案 ${q.answer}）`
  }
}
console.log('② 唯一解（symbol-blank-l2 / reverse-l2 窮舉）')
gate(eqFail === 0, '100% 唯一', eqFail === 0 ? `${eqCount} 條方程式題全部唯一` : `${eqFail} 條唔過，首錯：${firstEqErr}`)
console.log('')

/* ── ③ 提示洩漏 ────────────────────────────────────── */
let leakFail = 0
let firstLeak = null
for (const id of IDS) {
  for (const q of byType[id]) {
    const ansStr = String(q.answer)
    const fields = [['estimate.note', q.estimate && q.estimate.note], ['hint', q.hint], ['hintLevel1', q.hintLevel1], ['hintLevel2', q.hintLevel2], ['commonMistake', q.commonMistake]]
    for (const [name, txt] of fields) {
      if (typeof txt === 'string' && leaks(ansStr, txt)) {
        leakFail += 1
        if (!firstLeak) firstLeak = `${q.id} ${name} 洩漏「${ansStr}」：${txt}`
      }
    }
  }
}
console.log('③ 提示洩漏（token 比對）')
gate(leakFail === 0, 'estimate.note / hint / commonMistake 零洩漏', leakFail === 0 ? `${IDS.length * PER_TYPE} 條全部乾淨` : `${leakFail} 條洩漏，首錯：${firstLeak}`)
console.log('')

/* ── ④ estimate.note 有數字比率（每款 ≥95%） ────────── */
console.log('④ estimate.note 含具體數字比率（每款 ≥95%）')
let estDigitsAllOk = true
const estRatios = {}
for (const id of IDS) {
  const withDigit = byType[id].filter((q) => /\d/.test(String(q.estimate && q.estimate.note))).length
  const ratio = byType[id].length ? withDigit / byType[id].length : 0
  estRatios[id] = ratio
  const ok = ratio >= 0.95
  if (!ok) estDigitsAllOk = false
  console.log(`    ${id.padEnd(20)} : ${(100 * ratio).toFixed(1)}%`)
}
gate(estDigitsAllOk, '每款 estimate.note 有數字比率 ≥95%', estDigitsAllOk ? '全部達標' : '有款低過 95%')
console.log('')

/* ── ⑤ ★ 設計意圖（印出渲染文字 + 斷言） ────────────── */
console.log('⑤ 設計意圖（渲染出嚟嘅題目文字）')
console.log('─'.repeat(60))

// 逐一印出每款嘅一條真實渲染題目 + 答案
for (const id of IDS) {
  const q = byType[id][0]
  const ansText = q.answerKind === 'choice' ? `${q.answer}（${q.answerDisplay}）` : q.answer
  console.log(`  [${id}]`)
  console.log(`    題目：${q.question}`)
  console.log(`    答案：${ansText}`)
}
console.log('─'.repeat(60))

// fastest-order：答案係 order-*，唔係數字
let foFail = 0
let fo1 = 0
let fo2 = 0
for (const q of byType['fastest-order']) {
  if (!/^order-/.test(String(q.answer))) { foFail += 1; continue }
  if (deriveFastestOrder(q.operands.map(Number)) !== q.answer) foFail += 1
  if (q.answer === 'order-ab') fo1 += 1
  else if (q.answer === 'order-ac') fo2 += 1
  else foFail += 1
}
gate(foFail === 0, 'fastest-order 答案係 order-* choice（唔係數字）', foFail === 0 ? '全部係 order-ab / order-ac' : `${foFail} 條唔過`)

// find-error-vertical：陷阱真錯（獨立重算）+ 答案係步驟
let feFail = 0
let firstFeErr = null
const feSteps = { 'step-1': 0, 'step-2': 0, 'step-3': 0 }
for (const q of byType['find-error-vertical']) {
  if (!/^step-/.test(String(q.answer))) { feFail += 1; if (!firstFeErr) firstFeErr = `${q.id} 答案唔係步驟`; continue }
  feSteps[q.answer] = (feSteps[q.answer] || 0) + 1
  const info = findErrorVertical(q.operands.map(Number), q.errorKind)
  if (info.wrong === info.correct) { feFail += 1; if (!firstFeErr) firstFeErr = `${q.id} 陷阱值 ${info.wrong} == 正確 ${info.correct}`; continue }
  if (String(q.shownError.wrongValue) !== String(info.wrong)) { feFail += 1; if (!firstFeErr) firstFeErr = `${q.id} shownError ${q.shownError.wrongValue} ≠ 重算 ${info.wrong}`; continue }
  if (q.answer !== info.step) { feFail += 1; if (!firstFeErr) firstFeErr = `${q.id} answer=${q.answer} ≠ 重推 step=${info.step}` }
}
gate(feFail === 0, 'find-error-vertical 陷阱真錯 + 答案係步驟', feFail === 0 ? `${byType['find-error-vertical'].length} 條全對` : `${feFail} 條唔過，首錯：${firstFeErr}`)

// estimate-first：題文含「估」+ 答案唔係精確積
let efFail = 0
for (const q of byType['estimate-first']) {
  if (!q.question.includes('估')) efFail += 1
  if (Number(q.answer) === q.exactValue) efFail += 1
}
gate(efFail === 0, 'estimate-first 題文含「估」+ 答案唔係精確積', efFail === 0 ? `${byType['estimate-first'].length} 條全對` : `${efFail} 條唔過`)

// symbol-blank-l2：答案係空白嘅數值（唯一），唔係整條式
let sbFail = 0
for (const q of byType['symbol-blank-l2']) {
  if (!/^\d+$/.test(String(q.answer))) sbFail += 1
}
gate(sbFail === 0, 'symbol-blank-l2 答案係空白數值（number）', sbFail === 0 ? `${byType['symbol-blank-l2'].length} 條全對` : `${sbFail} 條唔過`)
console.log('')

/* ── ⑥ 語料多樣性 ──────────────────────────────────── */
console.log('⑥ 語料多樣性')
// 逐款 distinct (operands, answer) 比率（統計，非硬門檻——估算題／連乘題組合空間天然細）
let minRatio = 1
for (const id of IDS) {
  const qs = byType[id].filter(Boolean)
  const key = (q) => {
    const val = q.answerKind === 'choice' ? q.displayValue : q.answer
    return q.operands.map(Number).join(',') + '=' + String(val)
  }
  const uniq = new Set(qs.map(key)).size
  const ratio = qs.length ? uniq / qs.length : 0
  minRatio = Math.min(minRatio, ratio)
  console.log(`    ${id.padEnd(20)} : distinct ${(100 * ratio).toFixed(1)}%`)
}
console.log(`    （最低一款 distinct ${(100 * minRatio).toFixed(1)}%）`)

// 跨題型撞題率：每 seed，12 款出同一組 operands 嘅比率 < 30%
const opKey = (q) => q.operands.map(Number).join(',')
let collideSeeds = 0
let skippedSeeds = 0
for (let seed = 0; seed < PER_TYPE; seed += 1) {
  const qs = IDS.map((id) => byType[id][seed])
  if (qs.some((q) => q == null)) { skippedSeeds += 1; continue }
  const keys = qs.map(opKey)
  if (new Set(keys).size !== keys.length) collideSeeds += 1
}
const collidePct = (100 * collideSeeds) / Math.max(1, PER_TYPE - skippedSeeds)
console.log(`    跨題型撞題率（同一組 operands）: ${collideSeeds}/${PER_TYPE - skippedSeeds}（${collidePct.toFixed(1)}%）`)
gate(collidePct < 30, '跨題型撞題率 < 30%', `${collidePct.toFixed(1)}%`)

// choice 題型：每個分支出現率 ≥30%
const foTotal = byType['fastest-order'].length
const foPct1 = (100 * fo1) / foTotal
const foPct2 = (100 * fo2) / foTotal
console.log(`    fastest-order 分支：order-ab ${fo1}（${foPct1.toFixed(1)}%）、order-ac ${fo2}（${foPct2.toFixed(1)}%）`)
gate(fo1 >= foTotal * 0.3 && fo2 >= foTotal * 0.3, 'fastest-order 每個分支 ≥30%', `order-ab ${foPct1.toFixed(1)}%、order-ac ${foPct2.toFixed(1)}%`)

const feTotal = byType['find-error-vertical'].length
const fePct1 = (100 * (feSteps['step-1'] || 0)) / feTotal
const fePct2 = (100 * (feSteps['step-2'] || 0)) / feTotal
const fePct3 = (100 * (feSteps['step-3'] || 0)) / feTotal
console.log(`    find-error-vertical 分支：step-1 ${(feSteps['step-1'] || 0)}（${fePct1.toFixed(1)}%）、step-2 ${(feSteps['step-2'] || 0)}（${fePct2.toFixed(1)}%）、step-3 ${(feSteps['step-3'] || 0)}（${fePct3.toFixed(1)}%）`)
gate(
  (feSteps['step-1'] || 0) >= feTotal * 0.3 && (feSteps['step-2'] || 0) >= feTotal * 0.3 && (feSteps['step-3'] || 0) >= feTotal * 0.3,
  'find-error-vertical 每個分支 ≥30%',
  `step-1 ${fePct1.toFixed(1)}%、step-2 ${fePct2.toFixed(1)}%、step-3 ${fePct3.toFixed(1)}%`,
)
console.log('')

/* ── ⑧ find-error-vertical 顯示文字 gate（新增，Stage B2.1）──
   由「渲染出嚟嘅題目文字」重新 parse，唔准讀 info.s1/s2/s3 等渲染狀態。 */
function parseFindErrorVerticalText(text) {
  const head = text.match(/直式計 (\d+) × (\d+)/)
  if (!head) return null
  const a = Number(head[1])
  const b = Number(head[2])
  const tb = Math.floor(b / 10)
  const ob = b % 10
  const p1 = a * ob
  const p2 = a * tb
  const p2s = p2 * 10

  const s1 = text.match(/① 個位乘 (\d+)×(\d+)=(\d+)/)
  const s2 = text.match(/② 十位乘 (\d+)×(\d+)=(\d+)/)
  const s2shift = text.match(/② 十位乘 [^；]*補位後=(\d+)/)
  const s3eq = text.match(/③ 相加 (\d+)\+(\d+)=(\d+)/)
  const s3desc = text.match(/③ 相加：佢只寫咗 (\d+)，冇加到 (\d+)/)

  if (!s1 || !s2) return null
  return {
    a, b, tb, ob, p1, p2, p2s,
    s1: { A: Number(s1[1]), B: Number(s1[2]), C: Number(s1[3]) },
    s2: { A: Number(s2[1]), B: Number(s2[2]), C: Number(s2[3]), shift: s2shift ? Number(s2shift[1]) : null },
    s3eq: s3eq ? { X: Number(s3eq[1]), Y: Number(s3eq[2]), Z: Number(s3eq[3]) } : null,
    s3desc: s3desc ? { P: Number(s3desc[1]), Q: Number(s3desc[2]) } : null,
  }
}

console.log('⑧ find-error-vertical 顯示文字（由渲染文字 parse，唔讀內部狀態）')
const feQs = byType['find-error-vertical'].filter(Boolean)
let feTextParseFail = 0
let feTextFirst = null
let feEqFail = 0
let feEqFirst = null
let feDevFail = 0
let feDevFirst = null
let feShiftFail = 0
let feShiftFirst = null
let feTotalChecked = 0
for (const q of feQs) {
  const p = parseFindErrorVerticalText(q.question)
  if (!p) {
    feTextParseFail += 1
    if (!feTextFirst) feTextFirst = `${q.id} parse 唔到：${q.question}`
    continue
  }
  feTotalChecked += 1

  // gate 1：除咗標示為錯嗰步，其餘每一步顯示算式都要算術成立
  const flag = q.answer // 'step-1' | 'step-2' | 'step-3'
  const eqChecks = []
  if (flag !== 'step-1') eqChecks.push([`① ${p.s1.A}×${p.s1.B}=${p.s1.C}`, p.s1.A * p.s1.B === p.s1.C])
  if (flag !== 'step-2') {
    eqChecks.push([`② ${p.s2.A}×${p.s2.B}=${p.s2.C}`, p.s2.A * p.s2.B === p.s2.C])
    eqChecks.push([`② 補位後 ${p.s2.shift}`, p.s2.shift === p.s2.C * 10])
  }
  if (flag !== 'step-3' && p.s3eq) eqChecks.push([`③ ${p.s3eq.X}+${p.s3eq.Y}=${p.s3eq.Z}`, p.s3eq.X + p.s3eq.Y === p.s3eq.Z])
  const eqBad = eqChecks.filter(([, ok]) => !ok)
  if (eqBad.length > 0) {
    feEqFail += 1
    if (!feEqFirst) feEqFirst = `${q.id}（${q.errorKind}）顯示假等式：${eqBad.map(([t]) => t).join('、')}`
  }

  // gate 2：由文字重新推導「第一步錯」，必須等於 answer
  const wrongs = [
    p.s1.C !== p.p1,                                     // ① 個位乘積錯
    p.s2.C !== p.p2 || p.s2.shift === null,              // ② 十位乘積錯 或 漏補位
    p.s3eq ? p.s3eq.X + p.s3eq.Y !== p.s3eq.Z : true,    // ③ 相加錯（描述句 = 漏加）
  ]
  const firstIdx = wrongs.indexOf(true)
  const derived = firstIdx === 0 ? 'step-1' : firstIdx === 1 ? 'step-2' : firstIdx === 2 ? 'step-3' : null
  if (derived !== q.answer) {
    feDevFail += 1
    if (!feDevFirst) feDevFirst = `${q.id}（${q.errorKind}）重推 ${derived} ≠ answer ${q.answer}`
  }

  // gate 3：miss-shift 嘅 ② 唔准含「補位」二字
  if (q.errorKind === 'miss-shift') {
    const seg2 = q.question.match(/② 十位乘 [^；]*/)?.[0] ?? ''
    if (seg2.includes('補位')) {
      feShiftFail += 1
      if (!feShiftFirst) feShiftFirst = `${q.id} ② 含「補位」：${seg2}`
    }
  }
}
gate(feTextParseFail === 0, '顯示文字可 parse（≥500 條）', feTextParseFail === 0 ? `${feTotalChecked} 條全部 parse 到` : `${feTextParseFail} 條 parse 唔到，首錯：${feTextFirst}`)
gate(feEqFail === 0, '顯示等式為真（除標示錯嗰步）', feEqFail === 0 ? `${feTotalChecked} 條全部成立` : `${feEqFail} 條有假等式，首錯：${feEqFirst}`)
gate(feDevFail === 0, '恰恰好一個第一步偏離 = answer', feDevFail === 0 ? `${feTotalChecked} 條重推全等 answer` : `${feDevFail} 條唔符，首錯：${feDevFirst}`)
gate(feShiftFail === 0, 'miss-shift ② 唔准含「補位」二字', feShiftFail === 0 ? '全部冇「補位」' : `${feShiftFail} 條含「補位」，首錯：${feShiftFirst}`)
console.log('')


console.log(fail === 0 ? '課題 2 十二款題型全部驗證通過 ✓' : `有 ${fail} 項唔過 ✗`)
console.log('══════════════════════════════════════════════════')
process.exit(fail === 0 ? 0 : 1)
