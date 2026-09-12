#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════
   check-symbol-blank.mjs —— npm run check:symbol-blank
   「符號填空」獨立驗證 gate（Node 版，完全自足）。

   ★ 獨立性鐵律：
     - 只 import registry.js 嘅 generateQuestion(seed) 去「產生題目」；
     - 驗證邏輯全部自己寫：由 question 文字 parse → 自己線性求解 → 判斷唯一性；
     - ❌ 唔准 import solve.js；
     - ❌ 唔准讀 q.lhs / q.rhs / q.targetSymbol / q.equation 等結構欄位去做驗證
       （唯一用到嘅係 question 文字、answer 字串、level 數字）。

   驗證四件事：
     ① question 文字 parse 得到（啱啱一個 '='、有符號、token 合理）
     ② 恰恰好一個符號被唯一確定
     ③ 嗰個唯一值 === answer
     ④ 同一個 seed 生成兩次，question 文字逐 bytes 一致

   符號域 = 正整數 1..200，排除 0。

   用法：
     node scripts/check-symbol-blank.mjs [N]            # 預設 5000
     node scripts/check-symbol-blank.mjs --dump-only [N]  # 只出 dump，唔驗證
   ════════════════════════════════════════════════════ */

import fs from 'node:fs'
import path from 'node:path'
import { generateQuestion } from '../src/gen/registry.js'

const DOMAIN = { lo: 1, hi: 200 }
const DUMP = '/tmp/sb_dump.jsonl'
const VERDICTS = '/tmp/sb_verdicts_node.json'

/* ── CLI ─────────────────────────────────────────────── */
let N = 5000
let dumpOnly = false
for (const a of process.argv.slice(2)) {
  if (a === '--dump-only') dumpOnly = true
  else if (/^\d+$/.test(a)) N = Number(a)
}

/* ── 自己寫嘅 tokenizer（等價於 Python 版，但係獨立實作） ── */
function tokenize(s) {
  s = s
    .replace(/×/g, '*')
    .replace(/−/g, '-')
    .replace(/－/g, '-')
    .replace(/÷/g, '/')
  const re = /\d+|[^\s\d()+*\-/=]+|[()+*\-/=]/g
  const out = []
  let m
  while ((m = re.exec(s)) !== null) out.push(m[0])
  return out
}

const OPS = new Set(['+', '-', '*', '/', '(', ')'])

/* ── 自己寫嘅運算式求值（只接受整數 + * - / 同括號） ── */
function buildExpr(tokens, assign) {
  const parts = []
  for (const t of tokens) {
    if (OPS.has(t)) parts.push(t)
    else if (/^\d+$/.test(t)) parts.push(t)
    else parts.push(String(assign[t]))
  }
  return parts.join('')
}

function ev(tokens, assign) {
  const expr = buildExpr(tokens, assign)
  // eslint-disable-next-line no-new-func
  return Function('"use strict";return (' + expr + ')')()
}

/* ── 線性化：表達式 = c + m*f（f = 唯一自由符號） ── */
function linearCoeffs(tokens, others, probe) {
  const f = others[0]
  const v1 = ev(tokens, { ...probe, [f]: 1 })
  const v2 = ev(tokens, { ...probe, [f]: 2 })
  const m = v2 - v1
  const c = v1 - m
  return { c, m }
}

/* ── 喺 others（自由符號）下，有冇賦值令 LHS == RHS？ ── */
function existsFree(lhsT, rhsT, others, probe) {
  if (others.length === 0) {
    return ev(lhsT, probe) === ev(rhsT, probe)
  }
  if (others.length === 1) {
    const { c: cL, m: mL } = linearCoeffs(lhsT, others, probe)
    const { c: cR, m: mR } = linearCoeffs(rhsT, others, probe)
    if (mL === mR) return cL === cR // 與 f 無關
    const num = cR - cL
    const den = mL - mR
    if (den === 0 || num % den !== 0) return false
    const f = num / den
    return Number.isInteger(f) && f >= DOMAIN.lo && f <= DOMAIN.hi
  }
  // 2+ 個自由符號：縮細域 brute force（本設計最多 1 個，純保險）
  const lo = 1
  const hi = 40
  const idx = new Array(others.length).fill(lo)
  for (;;) {
    const a = { ...probe }
    for (let i = 0; i < others.length; i += 1) a[others[i]] = idx[i]
    if (ev(lhsT, a) === ev(rhsT, a)) return true
    let i = others.length - 1
    while (i >= 0) {
      idx[i] += 1
      if (idx[i] <= hi) break
      idx[i] = lo
      i -= 1
    }
    if (i < 0) break
  }
  return false
}

/* ── 某符號嘅值域：所有令等式「有可能成立」嘅候選值 ── */
function determinedValues(sym, syms, lhsT, rhsT) {
  const others = syms.filter((s) => s !== sym)
  const hits = []
  for (let v = DOMAIN.lo; v <= DOMAIN.hi; v += 1) {
    const probe = { [sym]: v }
    if (existsFree(lhsT, rhsT, others, probe)) hits.push(v)
  }
  return hits
}

/* ── 對一條題目文字做獨立驗證 ── */
function checkOne(txt, ansStr) {
  const eqCount = (txt.match(/=/g) || []).length
  if (eqCount !== 1) return { ok: false, why: `'='唔止一個（${eqCount} 個）` }
  const [lhsStr, rhsStr] = txt.split('=')
  const lhsT = tokenize(lhsStr)
  const rhsT = tokenize(rhsStr)
  const syms = [...new Set([...lhsT, ...rhsT].filter((t) => !/^\d+$/.test(t) && !OPS.has(t)))].sort()
  if (syms.length === 0) return { ok: false, why: '冇符號' }

  const det = {}
  for (const s of syms) {
    const hs = determinedValues(s, syms, lhsT, rhsT)
    if (hs.length === 1) det[s] = hs[0]
  }

  if (Object.keys(det).length === 0) return { ok: false, why: '冇符號被唯一確定' }
  if (Object.keys(det).length > 1) {
    return { ok: false, why: `多過一個被確定: ${JSON.stringify(det)}` }
  }
  const onlyVal = Object.values(det)[0]
  if (String(onlyVal) !== ansStr) return { ok: false, why: `實際唯一解 = ${onlyVal}（佢報 ${ansStr}）` }
  return { ok: true }
}

/* ── 主流程 ─────────────────────────────────────────── */
const byLevel = {}
const problems = []
const dumpLines = []
const verdictLines = []

const t0 = Date.now()
for (let seed = 0; seed < N; seed += 1) {
  let q1
  let q2
  try {
    q1 = generateQuestion(seed)
    q2 = generateQuestion(seed) // 同 seed 兩次，驗逐 bytes 一致
  } catch (err) {
    problems.push({ seed, level: null, txt: '(generation threw)', ans: null, why: `generation threw: ${err.message}` })
    if (!dumpOnly) verdictLines.push(JSON.stringify({ seed, ok: false, why: `threw:${err.message}` }))
    continue
  }

  const txt = q1.question
  let ans = String(q1.answer)
  const level = q1.level

  // ── 測試掛勾（fault injection，僅測試用；冇設 env 就永遠唔行） ──
  //   設 SB_INJECT_BAD=seed:錯答案 會喺指定 seed 嘅 answer 注入錯值，
  //   用嚟驗證 gate 確實會 catch 錯答案。正常跑（無 env）完全唔受影響。
  const inject = process.env.SB_INJECT_BAD
  if (inject && !dumpOnly) {
    const [injSeed, injAns] = inject.split(':')
    if (Number(injSeed) === seed) ans = injAns
  }

  // ④ 兩次逐 bytes 一致
  if (q1.question !== q2.question || String(q1.answer) !== String(q2.answer)) {
    problems.push({ seed, level, txt, ans, why: '同 seed 兩次逐 bytes 唔一致' })
    if (!dumpOnly) verdictLines.push(JSON.stringify({ seed, ok: false, why: 'bytes-mismatch' }))
    continue
  }

  // 寫 dump（q/ans/level 係 Python 版讀嘅欄位，seed 供交叉核對）
  dumpLines.push(JSON.stringify({ seed, q: txt, ans, level }))

  // 獨立驗證（只靠文字）
  const r = checkOne(txt, ans)

  byLevel[level] = byLevel[level] || { n: 0, ok: 0 }
  byLevel[level].n += 1
  if (r.ok) {
    byLevel[level].ok += 1
    if (!dumpOnly) verdictLines.push(JSON.stringify({ seed, ok: true }))
  } else {
    problems.push({ seed, level, txt, ans, why: r.why })
    if (!dumpOnly) verdictLines.push(JSON.stringify({ seed, ok: false, why: r.why }))
  }
}
const ms = Date.now() - t0

// 同步寫出，保證 process.exit 前一定落咗盤
fs.writeFileSync(DUMP, dumpLines.join('\n') + (dumpLines.length ? '\n' : ''))
if (!dumpOnly) fs.writeFileSync(VERDICTS, verdictLines.join('\n') + (verdictLines.length ? '\n' : ''))

if (dumpOnly) {
  console.log(`dump 寫好：${DUMP}（${N} 條）`)
  process.exit(0)
}

/* ── 報告 ───────────────────────────────────────────── */
console.log('══════════════════════════════════════════════')
console.log('symbol-blank 獨立驗證（Node 版 · 自足線性求解）')
console.log('══════════════════════════════════════════════')
console.log(`題目數   : ${N}（seed 0..${N - 1}）`)
console.log(`時長     : ${ms} ms`)
console.log('')
console.log('=== 每級統計 ===')
for (const lv of Object.keys(byLevel).sort((a, b) => a - b)) {
  const d = byLevel[lv]
  console.log(`  L${lv}: ${String(d.n).padStart(5)} 題 | 通過 ${String(d.ok).padStart(5)}`)
}
console.log('')
console.log(`通過     : ${N - problems.length}`)
console.log(`問題數   : ${problems.length}`)
if (problems.length > 0) {
  console.log('')
  console.log('=== 問題題目（最多示 20 條）===')
  for (const p of problems.slice(0, 20)) {
    console.log(`  seed ${p.seed} L${p.level}: ${p.txt}  （佢報 ${p.ans}）→ ${p.why}`)
  }
  console.log('')
  console.log(`✗ 有 ${problems.length} 條題目唔過 gate`)
  process.exit(1)
}
console.log('✅ 全部通過：每條題目都係「恰恰好一個符號被唯一確定，且值 === answer」')
process.exit(0)
