#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════
   mq4 — scripts/check-bank.mjs —— npm run check:bank
   常設 gate：讀凍結咗嘅題庫檔 + manifest，逐條驗證。

   覆蓋：
     C1–C10   內容正確性（verifyQuestion、id 唯一、題幹 distinct、洩漏、
              estimate 數字、conceptSource、answerDisplay、題型數、難度格、choice 分支）
     G37      大小（gzip ≤250KB ＋ 解壓 ≤1.5MB）
     G41      每題用現時生成器 + seed 重生成 → 逐 bytes 相等（防漂移）
     G42      Node 同 browser(jsdom) 同一 PRNG → 100 題 hash 相等
     G43      PRNG fixtures（50 seed × 20 output）凍結對比
     G44      檔名帶 content hash + manifest mapping 正確
     G46      首次出題 <300ms（載入題庫 → 第一題）
     G47      廣度（L1≥11 款、L2≥12 款、conceptSource 齊）
     G48/G49/G50 符號填空唯一解／代入／唔准移項
   ════════════════════════════════════════════════════════════ */

import fs from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { performance } from 'node:perf_hooks'
import { build } from 'esbuild'
import { JSDOM } from 'jsdom'
import { mulberry32 } from '../src/gen/rng.js'
import {
  stableStringify, sha256Hex, generatorCodeHash, runContentGates,
  regenerateQuestion, assertSymbolDomain,
} from './bank-common.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const BANK_DIR = path.join(ROOT, 'src', 'data', 'bank')
const MANIFEST = path.join(BANK_DIR, 'manifest.json')

let fail = 0
function gate(ok, label, detail = '') {
  if (!ok) fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  →  ' + detail : ''}`)
}

console.log('══════════════════════════════════════════════')
console.log('題庫常設 gate（check:bank）')
console.log('══════════════════════════════════════════════\n')

/* ── 讀 manifest ─────────────────────────────────────────── */
let manifest
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
} catch (err) {
  gate(false, '讀 manifest.json', `讀唔到：${err.message}`)
  process.exit(1)
}

const lessonIds = Object.keys(manifest.lessons || {})

/* ── 載入各課題題庫 ──────────────────────────────────────── */
const banks = {}
let loadFail = 0
for (const lid of lessonIds) {
  const entry = manifest.lessons[lid]
  const filePath = path.join(BANK_DIR, entry.file)
  if (!fs.existsSync(filePath)) {
    gate(false, `G44 lesson${lid} 檔存在`, `${entry.file} 搵唔到`)
    loadFail += 1
    continue
  }
  const raw = fs.readFileSync(filePath, 'utf8')
  const parsed = JSON.parse(raw)
  banks[lid] = { entry, filePath, raw, parsed }
}

/* ── G44：檔名 content hash + manifest mapping ─────────────── */
console.log('G44  檔名 content hash + manifest mapping')
for (const lid of lessonIds) {
  const b = banks[lid]
  if (!b) continue
  const sha = sha256Hex(b.raw)
  const expectedFile = `lesson${lid}.${sha.slice(0, 8)}.json`
  const okFile = b.entry.file === expectedFile
  const okSha = b.entry.sha256 === sha
  const okCount = b.entry.count === b.parsed.meta.count
  const actualCount = b.parsed.meta.count
  gate(okFile && okSha && okCount, `lesson${lid}`,
    `${b.entry.file}（hash ${sha.slice(0, 8)}）count=${actualCount}` +
    (okFile ? '' : ` ✗檔名錯（應 ${expectedFile}）`) +
    (okSha ? '' : ' ✗sha256 唔符') +
    (okCount ? '' : ` ✗manifest count=${b.entry.count}`))
}
console.log('')

/* ── flatten 每課題題目 ───────────────────────────────────── */
function flatten(parsed) {
  const out = []
  for (const topic of Object.values(parsed.byTopic)) {
    for (const diff of Object.values(topic)) {
      for (const arr of Object.values(diff)) {
        for (const q of arr) out.push(q)
      }
    }
  }
  return out
}

/* ── C2：id 跨課題全唯一 ──────────────────────────────────── */
const allIds = []
for (const lid of lessonIds) {
  if (banks[lid]) allIds.push(...flatten(banks[lid].parsed).map((q) => q.id))
}
console.log('C2   id 跨課題全唯一')
gate(new Set(allIds).size === allIds.length, '跨課題 id 全唯一',
  `${allIds.length} 個 id，${new Set(allIds).size} 個 unique`)
console.log('')

/* ── 內容 gate（C1、C3–C10、G47–G50）＋ G37 ＋ G41 ─────────── */
for (const lid of lessonIds) {
  const b = banks[lid]
  if (!b) continue
  const questions = flatten(b.parsed)
  const label = `lesson${lid}`

  console.log(`──────── lesson${lid}（${questions.length} 題）────────`)

  const content = runContentGates(questions, { lessonLabel: label })
  for (const r of content) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.id.padEnd(4)} ${r.label}  →  ${r.detail}`)

  /* G37 */
  const rawBytes = Buffer.byteLength(b.raw, 'utf8')
  const gzipBytes = gzipSync(b.raw).length
  gate(gzipBytes <= 250 * 1024 && rawBytes <= 1.5 * 1024 * 1024,
    `G37  大小（gzip ≤250KB ＋ 解壓 ≤1.5MB）[${label}]`,
    `gzip ${(gzipBytes / 1024).toFixed(1)}KB, raw ${(rawBytes / 1024 / 1024).toFixed(2)}MB`)

  /* G41 */
  let g41Fail = 0
  let g41First = null
  for (const q of questions) {
    try {
      const r = regenerateQuestion(q)
      if (stableStringify(r) !== stableStringify(q)) { g41Fail += 1; if (!g41First) g41First = q.id }
    } catch (err) { g41Fail += 1; if (!g41First) g41First = `${q.id}：${err.message}` }
  }
  gate(g41Fail === 0, `G41  每題重生成逐 bytes 相等 [${label}]`,
    g41Fail === 0 ? `${questions.length} 題全等` : `${g41Fail} 題唔等，首錯 ${g41First}`)
  console.log('')
}

/* ── G43：PRNG fixtures 凍結對比 ──────────────────────────── */
const FIXTURE = path.join(ROOT, 'src', 'gen', '__fixtures__', 'prng.json')
let g43ok = true
let g43Detail = ''
if (!fs.existsSync(FIXTURE)) {
  g43ok = false
  g43Detail = 'fixture 檔唔存在'
} else {
  const fix = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'))
  const seeds = Object.keys(fix.seeds).map(Number)
  if (seeds.length < 50) { g43ok = false; g43Detail = `fixture 得 ${seeds.length} 個 seed` }
  else {
    for (const s of seeds) {
      const r = mulberry32(s)
      const cur = []
      for (let i = 0; i < 20; i++) cur.push(r())
      const frozen = fix.seeds[String(s)]
      for (let i = 0; i < 20; i++) {
        if (cur[i] !== frozen[i]) { g43ok = false; g43Detail = `seed ${s} output[${i}] ${cur[i]} ≠ ${frozen[i]}`; break }
      }
      if (!g43ok) break
    }
  }
}
gate(g43ok, 'G43  PRNG fixtures 凍結一致（50 seed × 20 output）', g43ok ? '全部一致' : g43Detail)

/* ── G46：首次出題 <300ms ─────────────────────────────────── */
/* 由磁碟重新讀檔 + parse + 攞第一題，模擬「載入題庫 → 第一題 render」嘅載入成本 */
{
  const lid = lessonIds[0]
  const t0 = performance.now()
  const fp = path.join(BANK_DIR, manifest.lessons[lid].file)
  const raw = fs.readFileSync(fp, 'utf8')
  const parsed = JSON.parse(raw)
  const first = flatten(parsed)[0]
  const ms = performance.now() - t0
  gate(ms < 300 && first != null, 'G46  首次出題 <300ms（載入題庫 → 第一題）',
    `${ms.toFixed(1)} ms（lesson${lid}，第一題 ${first ? first.id : '冇'}）`)
}

/* ── G42：Node vs browser(jsdom) 同一 PRNG ────────────────── */
{
  let g42ok = false
  let g42Detail = ''
  try {
    const outfile = path.join(ROOT, '.smoke', 'gen-bundle.iife.js')
    fs.mkdirSync(path.dirname(outfile), { recursive: true })
    await build({
      entryPoints: [path.join(ROOT, 'src', 'gen', 'registry.js')],
      bundle: true,
      format: 'iife',
      globalName: '__MQ4GEN__',
      platform: 'browser',
      outfile,
      logLevel: 'silent',
    })

    const nodeQs = []
    const { TEMPLATES, generateQuestion } = await import('../src/gen/registry.js')
    for (let seed = 0; seed < 100; seed++) {
      nodeQs.push(generateQuestion(seed, { template: TEMPLATES[seed % TEMPLATES.length].id }))
    }
    const nodeHash = sha256Hex(stableStringify(nodeQs))

    const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only' })
    dom.window.eval(fs.readFileSync(outfile, 'utf8'))
    const gen = dom.window.__MQ4GEN__
    const browserQs = []
    for (let seed = 0; seed < 100; seed++) {
      browserQs.push(gen.generateQuestion(seed, { template: gen.TEMPLATES[seed % gen.TEMPLATES.length].id }))
    }
    const browserHash = sha256Hex(stableStringify(browserQs))
    g42ok = nodeHash === browserHash
    g42Detail = g42ok ? 'Node 同 jsdom 100 題 hash 一致' : `Node ${nodeHash.slice(0, 12)} ≠ jsdom ${browserHash.slice(0, 12)}`
  } catch (err) {
    g42Detail = `G42 執行失敗：${err.message}`
  }
  gate(g42ok, 'G42  Node 同 browser(jsdom) 同一 PRNG → 100 題 hash 相等', g42Detail)
}

/* ── 總結 ────────────────────────────────────────────────── */
console.log('')
console.log('══════════════════════════════════════════════')
console.log(fail === 0 ? '✅ check:bank 全部通過' : `✗ 有 ${fail} 項唔過`)
console.log('══════════════════════════════════════════════')
process.exit(fail === 0 ? 0 : 1)
