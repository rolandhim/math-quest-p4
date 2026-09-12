#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════
   mq4 — scripts/build-bank.mjs
   Stage C：預先產生、逐條驗證、凍結成唯讀題庫。

   用法：
     node scripts/build-bank.mjs               # 產生課題 1 + 2 題庫 + manifest
     node scripts/build-bank.mjs --lesson 1    # 只做課題 1（合併入現有 manifest）
     node scripts/build-bank.mjs --check       # 唔寫檔，只跑 gate（exit 0/1）

   流程（每條題目）：
     1. 用現時生成器 + seed 產生
     2. 按 (template, operands 排序後, 題幹文字) dedupe
     3. verifyQuestion（V1–V7）—— 任何一條 fail → 唔寫檔、exit 1
     4. 符號填空再過 G48/G49/G50
     5. 確定性序列化（stableStringify）凍結落盤
   ════════════════════════════════════════════════════════════ */

import fs from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { TEMPLATES, generateQuestion } from '../src/gen/registry.js'
import {
  stableStringify, sha256Hex, dedupeKey, generatorCodeHash,
  runContentGates, regenerateQuestion, assertSymbolDomain,
} from './bank-common.mjs'

/* ── 題庫目標題數 ────────────────────────────────────────────
   受 G37「解壓 ≤1.5MB」限制：1,500 條完整題目 raw 約 2.1MB（UTF-8 字節），
   物理上超標。實測 1,000 條 → raw ~1.4MB、gzip ~120KB，兩者都安全。
   （brief §4 明示：超過就老實報告、提對策（例每課題 1,000 條），唔准靜靜減數。） */
const TARGET = 1000

const ROOT = path.resolve(import.meta.dirname, '..')
const BANK_DIR = path.join(ROOT, 'src', 'data', 'bank')
const MANIFEST = path.join(BANK_DIR, 'manifest.json')

/* 題型 unique 空間天花板（改動 template 屬禁區，唔可以靠改 template 湊數） */
const CAPS = { 'triple-product': 70 }

/* ── CLI ─────────────────────────────────────────────────── */
const args = process.argv.slice(2)
let onlyLesson = null
let checkOnly = false
for (const a of args) {
  if (a === '--check') checkOnly = true
  else if (a === '--lesson') { const i = args.indexOf('--lesson'); onlyLesson = args[i + 1] || null }
}

/* ── quota 分配：均分 + 餘數 round-robin，尊重每型天花板 ───── */
function planQuotas(templates, target) {
  const quotas = {}
  for (const t of templates) {
    const cap = CAPS[t.id] ?? Infinity
    quotas[t.id] = Math.min(Math.floor(target / templates.length), cap)
  }
  let remaining = target - Object.values(quotas).reduce((a, b) => a + b, 0)
  let i = 0
  let guard = 0
  while (remaining > 0 && guard < 1000) {
    const t = templates[i % templates.length]
    const cap = CAPS[t.id] ?? Infinity
    if (quotas[t.id] < cap) { quotas[t.id] += 1; remaining -= 1 }
    i += 1
    guard += 1
  }
  return quotas
}

/* ── 每型 level 清單 ──────────────────────────────────────── */
function levelsFor(tpl) {
  if (tpl.id === 'symbol-blank') return [1, 2, 3, 4, 5, 6]
  if (tpl.id === 'symbol-blank-l2') return [1, 2]
  return [null]
}

/* ── 逐條 dedupe 產生 ─────────────────────────────────────── */
function fill(tpl, level, n, shortfall) {
  const seen = new Set()
  const out = []
  let seed = 0
  const MAX = 5000
  while (out.length < n && seed < MAX) {
    let q
    try {
      q = generateQuestion(seed, { template: tpl.id, level })
    } catch (err) {
      seed += 1
      continue
    }
    const k = dedupeKey(q, tpl.id)
    if (!seen.has(k)) { seen.add(k); out.push(q) }
    seed += 1
  }
  if (out.length < n) shortfall.push(`${tpl.id}${level ? `-L${level}` : ''}=${out.length}/${n}`)
  return out
}

function generateForTemplate(tpl, quota, shortfall) {
  const levels = levelsFor(tpl)
  const out = []
  if (levels.length === 1) {
    out.push(...fill(tpl, levels[0], quota, shortfall))
  } else {
    const per = Math.floor(quota / levels.length)
    let rem = quota - per * levels.length
    for (const L of levels) {
      const n = per + (rem > 0 ? 1 : 0)
      if (rem > 0) rem -= 1
      out.push(...fill(tpl, L, n, shortfall))
    }
  }
  return out
}

/* ── 產生一個課題嘅題庫 ──────────────────────────────────── */
function buildLesson(lessonId) {
  const templates = TEMPLATES.filter((t) => t.lesson === lessonId)
  const quotas = planQuotas(templates, TARGET)
  const shortfall = []
  const questions = []
  for (const t of templates) {
    questions.push(...generateForTemplate(t, quotas[t.id], shortfall))
  }

  /* 攤平成 byTopic[topic][difficulty][type] */
  const byTopic = {}
  for (const q of questions) {
    byTopic[q.topic] = byTopic[q.topic] || {}
    byTopic[q.topic][q.difficulty] = byTopic[q.topic][q.difficulty] || {}
    byTopic[q.topic][q.difficulty][q.angle] = byTopic[q.topic][q.difficulty][q.angle] || []
    byTopic[q.topic][q.difficulty][q.angle].push(q)
  }

  return { lesson: lessonId, questions, byTopic, quotas, shortfall }
}

/* ── 組裝 bank object + 序列化 ────────────────────────────── */
function assembleBank(lesson) {
  const meta = {
    lesson: lesson.lesson,
    generatorCodeHash: generatorCodeHash(),
    count: lesson.questions.length,
    questionTypes: new Set(lesson.questions.map((q) => q.angle)).size,
  }
  const obj = { meta, byTopic: lesson.byTopic }
  const json = stableStringify(obj)
  return { obj, json, meta }
}

/* ── 主流程 ──────────────────────────────────────────────── */
function main() {
  assertSymbolDomain()
  const lessons = onlyLesson ? [onlyLesson] : ['1', '2']
  const built = []
  let hardFail = 0

  for (const lid of lessons) {
    const lesson = buildLesson(lid)
    const { json, meta } = assembleBank(lesson)
    const rawBytes = Buffer.byteLength(json, 'utf8')
    const gzipBytes = gzipSync(json).length
    const sha = sha256Hex(json)

    console.log(`\n════════ 課題 ${lid} 題庫 ════════`)
    console.log(`題數       : ${lesson.questions.length}（目標 ${TARGET}）`)
    console.log(`題型數     : ${meta.questionTypes} 款`)
    console.log(`raw        : ${(rawBytes / 1024 / 1024).toFixed(2)} MB（${rawBytes} bytes）`)
    console.log(`gzip       : ${(gzipBytes / 1024).toFixed(1)} KB`)
    if (lesson.shortfall.length) console.log(`⚠ 搵唔夠（dedupe 天花板）: ${lesson.shortfall.join('、')}`)

    /* 逐型題數 */
    const cnt = {}
    for (const q of lesson.questions) cnt[q.angle] = (cnt[q.angle] || 0) + 1
    console.log('逐題型題數 : ' + Object.entries(cnt).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${k}=${v}`).join('、'))

    /* 內容 gate（C1–C10 / G47–G50） */
    const content = runContentGates(lesson.questions, { lessonLabel: `lesson${lid}` })
    const cFail = content.filter((r) => !r.ok)
    for (const r of content) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.id.padEnd(4)} ${r.label}  →  ${r.detail}`)
    if (cFail.length > 0) {
      console.log(`✗ 課題 ${lid} 有 ${cFail.length} 項內容 gate 唔過 → 唔寫檔`)
      hardFail += 1
      continue
    }

    /* G37：大小 gate */
    const g37ok = gzipBytes <= 250 * 1024 && rawBytes <= 1.5 * 1024 * 1024
    console.log(`  ${g37ok ? 'PASS' : 'FAIL'}  G37  大小（gzip ≤250KB ＋ 解壓 ≤1.5MB）  →  gzip ${(gzipBytes / 1024).toFixed(1)}KB, raw ${(rawBytes / 1024 / 1024).toFixed(2)}MB`)
    if (!g37ok) { hardFail += 1; continue }

    /* G41：每題重生成逐 bytes 相等 */
    let g41Fail = 0
    let g41First = null
    for (const q of lesson.questions) {
      try {
        const r = regenerateQuestion(q)
        if (stableStringify(r) !== stableStringify(q)) { g41Fail += 1; if (!g41First) g41First = q.id }
      } catch (err) { g41Fail += 1; if (!g41First) g41First = `${q.id}：${err.message}` }
    }
    console.log(`  ${g41Fail === 0 ? 'PASS' : 'FAIL'}  G41  每題重生成逐 bytes 相等  →  ${g41Fail === 0 ? `${lesson.questions.length} 題全等` : `${g41Fail} 題唔等，首錯 ${g41First}`}`)
    if (g41Fail > 0) { hardFail += 1; continue }

    built.push({ lesson: lid, json, sha, rawBytes, gzipBytes, meta, count: lesson.questions.length })
  }

  if (hardFail > 0) {
    console.log(`\n✗ build 失敗：${hardFail} 個課題有硬 gate 唔過，冇寫任何檔`)
    process.exit(1)
  }

  if (checkOnly) {
    console.log(`\n✅ --check 模式：全部 gate 通過（唔寫檔）`)
    process.exit(0)
  }

  /* 寫檔 */
  fs.mkdirSync(BANK_DIR, { recursive: true })
  const manifest = readManifest()
  for (const b of built) {
    const hash8 = b.sha.slice(0, 8)
    const file = `lesson${b.lesson}.${hash8}.json`
    fs.writeFileSync(path.join(BANK_DIR, file), b.json)
    manifest.lessons[b.lesson] = { file, count: b.count, sha256: b.sha }
    console.log(`寫好：${file}（${b.count} 題，sha256 ${b.sha.slice(0, 12)}…）`)
  }
  manifest.generatorCodeHash = generatorCodeHash()
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')
  console.log(`寫好：manifest.json（generatorCodeHash ${manifest.generatorCodeHash.slice(0, 12)}…）`)
  console.log('\n✅ 題庫凍結完成')
}

function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
  } catch {
    return { generatorCodeHash: '', lessons: {} }
  }
}

main()
