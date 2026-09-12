/* ════════════════════════════════════════════════════════════
   mq4 — scripts/bank-common.mjs
   題庫 build / check 共用嘅工具（唔係獨立 script，唔會直接行）。

   內容：
     - stableStringify()  —— 確定性序列化（key 固定排序，唔靠 JSON.stringify）
     - sha256Hex()        —— content hash
     - dedupeKey()        —— (template, operands 排序後, 題幹文字)
     - angleToTemplateId()—— question.angle → template id（G41 重生成用）
     - generatorCodeHash()—— sha256 of src/gen/**
     - leaks()            —— 答案洩漏掃描（數字 token 比對）
     - 內容 gate（C1–C10、G47/G48/G49/G50）—— 純函式，build 同 check 共用
   ════════════════════════════════════════════════════════════ */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { TEMPLATES, generateQuestion } from '../src/gen/registry.js'
import { verifyQuestion } from '../src/gen/verify.js'
import { uniqueTargetValue, evalSide, SYMBOL_LO, SYMBOL_HI } from '../src/gen/solve.js'

/* ── 確定性序列化（固定 key 順序，遞迴）────────────────────── */
export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']'
  const keys = Object.keys(value).sort()
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}'
}

/* ── sha256（hex）─────────────────────────────────────────── */
export function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex')
}

/* ── generator code hash：sha256 over src/gen/**（路徑排序，含檔名）── */
export function generatorCodeHash() {
  const root = path.resolve(import.meta.dirname, '..', 'src', 'gen')
  const files = []
  ;(function walk(dir) {
    for (const name of fs.readdirSync(dir).sort()) {
      const p = path.join(dir, name)
      if (fs.statSync(p).isDirectory()) walk(p)
      else if (name.endsWith('.js')) files.push(p)
    }
  })(root)
  const h = crypto.createHash('sha256')
  for (const f of files) {
    h.update(f.slice(root.length + 1) + '\u0000')
    h.update(fs.readFileSync(f))
    h.update('\u0000')
  }
  return h.digest('hex')
}

/* ── angle → template id（每個 angle 全站唯一）──────────────── */
const ANGLE_TO_TEMPLATE = new Map(TEMPLATES.map((t) => [t.angle, t.id]))
export function angleToTemplateId(angle) {
  return ANGLE_TO_TEMPLATE.get(angle) || null
}

/* ── dedupe key：(template, operands 排序後, 題幹文字) ───────── */
export function dedupeKey(q, tplId) {
  const ops = (q.operands || []).map(Number).slice().sort((a, b) => a - b).join(',')
  return `${tplId}\u0000${ops}\u0000${q.question}`
}

/* ── 答案洩漏掃描：數字答案用 token 比對；choice id 用子字串 ── */
export function leaks(ansStr, text) {
  const t = String(text)
  if (/^\d+$/.test(ansStr)) {
    const n = Number(ansStr)
    const tokens = t.match(/\d+/g) ?? []
    return tokens.some((tok) => Number(tok) === n)
  }
  return t.includes(ansStr)
}

/* ── 由 id 抽出 seed（所有 id 都係 `...-00000` 格式）────────── */
export function seedFromId(id) {
  const seg = String(id).split('-').pop()
  const n = Number(seg)
  return Number.isInteger(n) ? n : null
}

/* ── G41：用現時生成器 + seed 重生成，逐 bytes（stableStringify）相等 ── */
export function regenerateQuestion(q) {
  const seed = seedFromId(q.id)
  if (seed === null) throw new Error(`G41: 抽唔到 seed：${q.id}`)
  const tplId = angleToTemplateId(q.angle)
  if (!tplId) throw new Error(`G41: 未知 angle「${q.angle}」`)
  return generateQuestion(seed, { template: tplId, level: q.level ?? null })
}

/* ════════════════════════════════════════════════════════════
   內容 gate（build 同 check 共用）
   輸入：questions（flat array，全部題目，連 meta 前已經攤平）
   回傳：Array<{ id, label, ok, detail }>
   ════════════════════════════════════════════════════════════ */

export function runContentGates(questions, { lessonLabel = '' } = {}) {
  const results = []
  const G = (id, label, ok, detail = '') => results.push({ id, label, ok, detail })

  const L = lessonLabel ? ` [${lessonLabel}]` : ''

  /* ── C1：每題跑 verifyQuestion（V1–V7）──────────────────── */
  let c1Fail = 0
  let c1First = null
  for (const q of questions) {
    try {
      verifyQuestion(q)
    } catch (err) {
      c1Fail += 1
      if (!c1First) c1First = `${q.id}：${err.message}`
    }
  }
  G('C1', `每題 verifyQuestion(V1–V7)${L}`, c1Fail === 0, c1Fail === 0 ? `${questions.length} 題全過` : `${c1Fail} 題 fail，首錯 ${c1First}`)

  /* ── C2：id 全唯一（跨課題喺 check-bank 度做，呢度只做本地）── */
  const ids = questions.map((q) => q.id)
  const idUniq = new Set(ids).size === ids.length
  G('C2', `id 本地唯一${L}`, idUniq, idUniq ? `${ids.length} 個 id 全唯一` : `有重複（${ids.length - new Set(ids).size} 個）`)

  /* ── C3：題幹零重複；distinct 比率 ≥95% ────────────────── */
  const stems = questions.map((q) => q.question)
  const stemUniq = new Set(stems).size
  const stemRatio = stems.length ? stemUniq / stems.length : 0
  G('C3', `題幹零重複 + distinct ≥95%${L}`, stemRatio >= 0.95, `distinct ${(100 * stemRatio).toFixed(2)}%（${stemUniq}/${stems.length}）`)

  /* ── C4：hint/estimate.note/commonMistake 唔含答案 ───────── */
  let c4Fail = 0
  let c4First = null
  for (const q of questions) {
    const ansStr = String(q.answer)
    const fields = [
      ['estimate.note', q.estimate && q.estimate.note],
      ['hint', q.hint],
      ['hintLevel1', q.hintLevel1],
      ['hintLevel2', q.hintLevel2],
      ['commonMistake', q.commonMistake],
    ]
    for (const [name, txt] of fields) {
      if (typeof txt === 'string' && leaks(ansStr, txt)) {
        c4Fail += 1
        if (!c4First) c4First = `${q.id} ${name} 洩漏「${ansStr}」：${txt}`
      }
    }
  }
  G('C4', `提示欄位零洩漏答案${L}`, c4Fail === 0, c4Fail === 0 ? `${questions.length} 題全乾淨` : `${c4Fail} 題洩漏，首錯 ${c4First}`)

  /* ── C5：estimate.note 含具體數字比率 ≥95%（每題型）────── */
  const estByType = {}
  for (const q of questions) {
    const t = q.angle
    estByType[t] = estByType[t] || { n: 0, digit: 0 }
    estByType[t].n += 1
    if (/\d/.test(String(q.estimate && q.estimate.note))) estByType[t].digit += 1
  }
  let c5Ok = true
  let c5Detail = []
  for (const t of Object.keys(estByType)) {
    const r = estByType[t].n ? estByType[t].digit / estByType[t].n : 0
    if (r < 0.95) { c5Ok = false; c5Detail.push(`${t}=${(100 * r).toFixed(1)}%`) }
  }
  G('C5', `estimate.note 有數字比率 ≥95%（每題型）${L}`, c5Ok, c5Ok ? '全部題型達標' : `低過 95%：${c5Detail.join('、')}`)

  /* ── C6 / G47：每題型有 conceptSource；廣度（L1≥11、L2≥12）── */
  const typeSet = new Set(questions.map((q) => q.angle))
  let c6Fail = 0
  for (const q of questions) {
    if (!(q.conceptSource && q.conceptSource.pages && q.conceptSource.concept)) c6Fail += 1
  }
  const needBreadth = lessonLabel === 'lesson1' ? 11 : lessonLabel === 'lesson2' ? 12 : 0
  G('G47', `廣度 + conceptSource 齊${L}`, c6Fail === 0 && typeSet.size >= needBreadth,
    `題型 ${typeSet.size} 款${needBreadth ? `（需 ≥${needBreadth}）` : ''}，缺 conceptSource ${c6Fail} 題`)

  /* ── C7：answerDisplay 對 choice 要係 label ─────────────── */
  let c7Fail = 0
  let c7First = null
  for (const q of questions) {
    if (q.answerKind === 'choice') {
      const label = q.options[q.correctIndex] && q.options[q.correctIndex].label
      if (q.answerDisplay !== label) { c7Fail += 1; if (!c7First) c7First = `${q.id} answerDisplay="${q.answerDisplay}" ≠ label="${label}"` }
    } else if (q.answerDisplay !== String(q.answer)) {
      c7Fail += 1
      if (!c7First) c7First = `${q.id} number answerDisplay="${q.answerDisplay}" ≠ answer="${q.answer}"`
    }
  }
  G('C7', `answerDisplay 對齊${L}`, c7Fail === 0, c7Fail === 0 ? '全對' : `${c7Fail} 題唔過，首錯 ${c7First}`)

  /* ── C8：每題型 ≥100（spec 硬底線 <50 = fail）──────────── */
  const cntByType = {}
  for (const q of questions) cntByType[q.angle] = (cntByType[q.angle] || 0) + 1
  const below50 = []
  const below100 = []
  for (const t of Object.keys(cntByType)) {
    if (cntByType[t] < 50) below50.push(`${t}=${cntByType[t]}`)
    else if (cntByType[t] < 100) below100.push(`${t}=${cntByType[t]}`)
  }
  G('C8', `每題型 ≥100 條（<50 硬 fail）${L}`,
    below50.length === 0,
    below50.length === 0
      ? (below100.length === 0 ? '全部題型 ≥100' : `以下題型 50–99（warning）：${below100.join('、')}`)
      : `<50（fail）：${below50.join('、')}`)

  /* ── C9：難度分佈每格有貨 ─────────────────────────────── */
  // 題目按 (topic, difficulty, type) 分格；每格都要有貨。
  const cells = {}
  for (const q of questions) {
    const key = `${q.topic}/${q.difficulty}/${q.angle}`
    cells[key] = (cells[key] || 0) + 1
  }
  const emptyCells = Object.entries(cells).filter(([, n]) => n === 0)
  G('C9', `難度分佈每格有貨${L}`, emptyCells.length === 0 && Object.keys(cells).length > 0,
    `${Object.keys(cells).length} 格全部有貨` + (emptyCells.length ? `（空：${emptyCells.map(([k]) => k).join('、')}）` : ''))

  /* ── C10：choice 題型每個分支 ≥30% ─────────────────────── */
  const choiceTypes = [...new Set(questions.filter((q) => q.answerKind === 'choice').map((q) => q.angle))]
  let c10Fail = 0
  const c10Detail = []
  for (const t of choiceTypes) {
    const qs = questions.filter((q) => q.angle === t)
    const branches = {}
    for (const q of qs) branches[q.answer] = (branches[q.answer] || 0) + 1
    for (const b of Object.keys(branches)) {
      const ratio = qs.length ? branches[b] / qs.length : 0
      if (ratio < 0.3) { c10Fail += 1; c10Detail.push(`${t}/${b}=${(100 * ratio).toFixed(1)}%`) }
    }
  }
  G('C10', `choice 分支 ≥30%${L}`, c10Fail === 0, c10Fail === 0 ? `${choiceTypes.length} 款 choice 全過` : c10Detail.join('、'))

  /* ── G48/G49/G50：符號填空（唯一解 / 代入 / 唔准移項）──── */
  const sbQs = questions.filter((q) => q.angle === 'symbol-blank' || q.angle === 'symbol-blank-l2')
  let g48Fail = 0
  let g48First = null
  let g49Fail = 0
  let g49First = null
  let g50Fail = 0
  let g50First = null
  for (const q of sbQs) {
    if (!q.equation || !q.targetSymbol) { g48Fail += 1; if (!g48First) g48First = `${q.id} 缺 equation/targetSymbol`; continue }
    // G48：窮舉 1..200（排除 0），唯一解 === answer
    const uniq = uniqueTargetValue(q.equation.lhs, q.equation.rhs, q.targetSymbol, { lo: SYMBOL_LO, hi: SYMBOL_HI })
    if (uniq === null || String(uniq) !== String(q.answer)) {
      g48Fail += 1
      if (!g48First) g48First = `${q.id} 唯一解 ${uniq} ≠ answer ${q.answer}`
    }
    // G49：答案代入後兩邊相等（程式重算，free symbol 用 7）
    const env = { [q.targetSymbol]: Number(q.answer) }
    for (const f of q.freeSymbols || []) env[f] = 7
    const lhsVal = evalSide(q.equation.lhs, env)
    const rhsVal = evalSide(q.equation.rhs, env)
    if (lhsVal !== rhsVal) {
      g49Fail += 1
      if (!g49First) g49First = `${q.id} 代入後 lhs=${lhsVal} ≠ rhs=${rhsVal}`
    }
    // G50：唔准移項 → 答案必須直接係題目入面一個可見 operand
    //      （禁止形式嘅答案都要經逆運算計出嚟，唔會喺 operands 度）
    const ansNum = Number(q.answer)
    const inOperands = (q.operands || []).some((o) => Number(o) === ansNum)
    if (!inOperands) {
      g50Fail += 1
      if (!g50First) g50First = `${q.id} 答案 ${q.answer} 唔喺 operands [${q.operands}]（疑似要移項）`
    }
  }
  G('G48', `符號填空唯一解（域 1..200 排除 0）${L}`, g48Fail === 0, g48Fail === 0 ? `${sbQs.length} 題全唯一` : `${g48Fail} 題唔過，首錯 ${g48First}`)
  G('G49', `符號填空代入後兩邊相等${L}`, g49Fail === 0, g49Fail === 0 ? `${sbQs.length} 題全等` : `${g49Fail} 題唔過，首錯 ${g49First}`)
  G('G50', `符號填空唔准移項${L}`, g50Fail === 0, g50Fail === 0 ? `${sbQs.length} 題答案都可直接睇出` : `${g50Fail} 題唔過，首錯 ${g50First}`)

  return results
}

/* ── 斷言：符號域必須排除 0（G48 前提）────────────────────── */
export function assertSymbolDomain() {
  if (SYMBOL_LO !== 1 || SYMBOL_HI !== 200) {
    throw new Error(`G48 前提違反：符號域應係 1..200，實際 ${SYMBOL_LO}..${SYMBOL_HI}`)
  }
  return { lo: SYMBOL_LO, hi: SYMBOL_HI }
}
