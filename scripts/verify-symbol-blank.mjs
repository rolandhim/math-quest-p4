/* ════════════════════════════════════════════════════════════
   mq4 — verify-symbol-blank.mjs —— node scripts/verify-symbol-blank.mjs
   符號填空 6 級階梯嘅垂直切片驗證。輸出真實數字，任何一項唔過 exit 1。

   驗證項：
     ① 10,000 題（seed 0..9999）零 throw
     ② 唯一解：10,000 題 100% 唯一（獨立再窮舉一次）
     ③ 決定性：同一 seed 生兩次 → JSON.stringify 逐 bytes 相等
     ④ 唔同 seed 有分別（內容唔死板）
     ⑤ Node vs browser(jsdom)：各生成 100 題，hash 完全相等
     ⑥ 效能：10,000 題 < 2 秒（報實際 ms）
     ⑦ 級別覆蓋：6 級每級都生得到（報每級題數）
   ════════════════════════════════════════════════════════════ */

import { generateQuestion } from '../src/gen/registry.js'
import { verifyQuestion } from '../src/gen/verify.js'
import { uniqueTargetValue } from '../src/gen/solve.js'
import { sha256Hex } from '../src/lib/storage.js'

let fail = 0
function gate(ok, label, detail = '') {
  if (!ok) fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  →  ' + detail : ''}`)
}

console.log('══════════════════════════════════════════════')
console.log('符號填空 6 級階梯 — 垂直切片驗證')
console.log('══════════════════════════════════════════════\n')

/* ── ① 10,000 題零 throw + ⑥ 效能 + ⑦ 級別覆蓋 ─────────── */
const N = 10000
const byLevel = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
let throws = 0
let firstErr = null
const t0 = performance.now()
for (let seed = 0; seed < N; seed += 1) {
  const level = (seed % 6) + 1
  try {
    const q = generateQuestion(seed, { level })
    byLevel[level] += 1
  } catch (err) {
    throws += 1
    if (!firstErr) firstErr = err.message
  }
}
const t1 = performance.now()
const ms = t1 - t0

console.log('① 生成 10,000 題（seed 0..9999）')
gate(throws === 0, '零 throw', throws === 0 ? `${N} 題全部生成` : `${throws} 題 throw，首錯：${firstErr}`)
gate(ms < 2000, `效能 < 2 秒（實際 ${ms.toFixed(1)} ms）`)
console.log('')

/* ── ② 唯一解：獨立再窮舉一次 ──────────────────────────── */
let nonUnique = 0
let firstNonUnique = null
for (let seed = 0; seed < N; seed += 1) {
  const level = (seed % 6) + 1
  const q = generateQuestion(seed, { level })
  const unique = uniqueTargetValue(q.equation.lhs, q.equation.rhs, q.targetSymbol)
  if (unique === null || String(unique) !== q.answer) {
    nonUnique += 1
    if (!firstNonUnique) firstNonUnique = `${q.id}（solve 得 ${unique}，答案 ${q.answer}）`
  }
  // 順手獨立再跑一次 V1–V6
  try {
    verifyQuestion(q)
  } catch (err) {
    nonUnique += 1
    if (!firstNonUnique) firstNonUnique = `${q.id} 獨立 verify throw：${err.message}`
  }
}
console.log('② 唯一解 + 獨立重驗（10,000 題）')
gate(nonUnique === 0, '100% 唯一解', nonUnique === 0 ? '全部唯一' : `${nonUnique} 題唔過，首錯：${firstNonUnique}`)
console.log('')

/* ── ③ 決定性：同 seed 生兩次逐 bytes 相等 ─────────────── */
let detFail = 0
for (let seed = 0; seed < 1000; seed += 1) {
  const level = (seed % 6) + 1
  const a = JSON.stringify(generateQuestion(seed, { level }))
  const b = JSON.stringify(generateQuestion(seed, { level }))
  if (a !== b) {
    detFail += 1
    break
  }
}
console.log('③ 決定性（1,000 seed × 2 次，逐 bytes 相等）')
gate(detFail === 0, '同 seed 兩次 JSON 完全相等', detFail === 0 ? '1000/1000 一致' : `${detFail} 唔一致`)
console.log('')

/* ── ④ 唔同 seed 有分別（內容唔死板） ─────────────────── */
const contentKeys = new Set()
let totalDup = 0
for (let seed = 0; seed < N; seed += 1) {
  const q = generateQuestion(seed, { level: (seed % 6) + 1 })
  const key = `${q.level}:${q.operands.join(',')}:${q.targetSymbol}`
  if (contentKeys.has(key)) totalDup += 1
  contentKeys.add(key)
}
console.log('④ 唔同 seed 有分別')
gate(
  contentKeys.size > N * 0.9,
  '內容唔死板',
  `10,000 題有 ${contentKeys.size} 組唔同內容（重複 ${totalDup} 題）`,
)
console.log('')

/* ── ⑤ Node vs browser(jsdom) 一致性 ────────────────────── */
const NODE_COUNT = 100
const nodeSeeds = Array.from({ length: NODE_COUNT }, (_, i) => i)
const nodeQuestions = nodeSeeds.map((s) => generateQuestion(s, { level: (s % 6) + 1 }))
const nodeJson = JSON.stringify(nodeQuestions)
const nodeHash = sha256Hex(nodeJson)

let browserOk = false
let browserDetail = ''
let browserHash = null
try {
  const { build } = await import('esbuild')
  const { JSDOM } = await import('jsdom')
  const path = await import('node:path')
  const root = path.default.resolve(import.meta.dirname, '..')
  const entry = path.default.join(root, 'scripts', 'gen-browser-entry.js')

  const result = await build({
    entryPoints: [entry],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    write: false,
    logLevel: 'silent',
  })
  const code = result.outputFiles[0].text

  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    runScripts: 'dangerously',
    url: 'http://localhost:5173/',
  })
  const script = dom.window.document.createElement('script')
  script.textContent = code
  dom.window.document.body.appendChild(script)

  if (!dom.window.__mq4gen || typeof dom.window.__mq4gen.generateBatchJson !== 'function') {
    browserDetail = 'browser bundle 冇 expose __mq4gen.generateBatchJson'
  } else {
    const browserJson = dom.window.__mq4gen.generateBatchJson(nodeSeeds)
    browserHash = sha256Hex(browserJson)
    browserOk = browserJson === nodeJson && browserHash === nodeHash
    if (!browserOk) {
      browserDetail = `Node hash=${nodeHash} Browser hash=${browserHash}（唔相等）`
    }
  }
} catch (err) {
  browserDetail = '未做：' + err.message
}

console.log(`⑤ Node vs browser(jsdom)（各 ${NODE_COUNT} 題）`)
console.log(`    Node sha256:     ${nodeHash}`)
console.log(`    Browser sha256:  ${browserHash || '—'}`)
gate(browserOk, 'hash 完全相等', browserOk ? '兩邊逐 bytes 一致' : browserDetail)
console.log('')

/* ── ⑦ 級別覆蓋 ───────────────────────────────────────── */
console.log('⑦ 級別覆蓋（每級題數）')
let allLevelsOk = true
for (const L of [1, 2, 3, 4, 5, 6]) {
  const n = byLevel[L]
  if (n <= 0) allLevelsOk = false
  console.log(`    L${L}（${['basic','basic','advanced','advanced','challenge','challenge'][L-1]}）: ${n} 題`)
}
gate(allLevelsOk, '6 級全部有貨', `總計 ${N} 題`)

console.log('')
console.log('══════════════════════════════════════════════')
console.log(fail === 0 ? '全部符號填空驗證通過 ✓' : `有 ${fail} 項唔過 ✗`)
console.log('══════════════════════════════════════════════')
process.exit(fail === 0 ? 0 : 1)
