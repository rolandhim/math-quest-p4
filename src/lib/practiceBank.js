/* ════════════════════════════════════════════════════════════
   mq4 — practiceBank.js
   練習頁接駁唯讀題庫（Stage D）。

   主路徑：讀題庫 → shuffle 隊列 → 順序抽（避開最近 30 id / 15 組 operands）
   後備：題庫唔夠／唔存在 → runtime 生成（要過 generatorCodeHash 版本檢查）
   版本檢查：manifest.generatorCodeHash === CURRENT_GENERATOR_CODE_HASH
       - 對得上 → 題庫可用；唔夠先用後備生成器
       - 對唔上 → 題庫仍然用，但停用後備生成器（防漂移）

   題庫用 import.meta.glob 做 lazy dynamic import（code-split），
   唔准入主 bundle。檔名帶 content hash，由 manifest 揀正確檔案。

   抽題（照 generator-spec §3，一字不改）：
     隊列 = shuffle(題庫所有題目 id)
     pop 隊頭 → id 喺最近 30 / operands 喺最近 15 → 放隊尾，pop 下一條
     隊列見底 → 重新 shuffle（冇「做完」）

   明確唔做：題型比例控制、題型輪替、難度加權、間隔重複、掌握度。
   連續同類題目冇問題（用戶明講）。
   ════════════════════════════════════════════════════════════ */

import manifest from '../data/bank/manifest.json'
import { CURRENT_GENERATOR_CODE_HASH } from '../data/generator-version.js'
import { TEMPLATES, generateQuestion } from '../gen/registry.js'
import { verifyQuestion } from '../gen/verify.js'
import { mulberry32 } from '../gen/rng.js'

/* ── lazy 題庫 glob：檔名帶 content hash，manifest 揀檔 ─────── */
const banks = import.meta.glob('../data/bank/lesson*.json')

export const GENERATOR_CODE_HASH = CURRENT_GENERATOR_CODE_HASH

export const MAX_RECENT_IDS = 30
export const MAX_RECENT_OPS = 15

/* ── 測試鈎：setTestSeed() 令 shuffle 變成決定性（interact / check:practice 用）── */
let testSeed = null
export function setTestSeed(seed) {
  testSeed = seed
}
export function clearTestSeed() {
  testSeed = null
}

/** 生產環境亂數種子：crypto 有就用，冇就 Date.now（❌ 唔用 Math.random） */
function randomSeed() {
  try {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const a = new Uint32Array(1)
      crypto.getRandomValues(a)
      return a[0]
    }
  } catch (err) {
    /* fallthrough */
  }
  return (Date.now() ^ 0x9e3779b9) >>> 0
}

/** 抽題／洗牌用嘅 PRNG（測試 seed 優先） */
export function drawRng() {
  return mulberry32(testSeed != null ? testSeed : randomSeed())
}

/** operands 嘅「同一組數字」key（排序後 join，次序無關） */
export function operandKey(q) {
  return (q.operands || [])
    .map(Number)
    .slice()
    .sort((a, b) => a - b)
    .join(',')
}

/** 版本檢查：manifest 嘅 generatorCodeHash 對唔對得上現時程式碼 */
export function generatorVersionMatches(manifestHash) {
  return String(manifestHash) === String(CURRENT_GENERATOR_CODE_HASH)
}

/* ── localStorage（recentIds / recentOperandKeys 進度）────────── */
const LS_RECENT_IDS = 'mq4:recentIds:'
const LS_RECENT_OPS = 'mq4:recentOperandKeys:'

function lsGet(key) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage.getItem(key)
  } catch (err) {
    /* private mode / 封鎖 → 當冇 */
  }
  return null
}
function lsSet(key, value) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem(key, value)
  } catch (err) {
    /* 靜靜跳過 */
  }
}

function readRecent(lessonId) {
  let recentIds = []
  let recentOperandKeys = []
  try {
    const a = lsGet(LS_RECENT_IDS + lessonId)
    const b = lsGet(LS_RECENT_OPS + lessonId)
    if (a) recentIds = JSON.parse(a)
    if (b) recentOperandKeys = JSON.parse(b)
  } catch (err) {
    /* 壞 JSON → 由頭 */
  }
  return {
    recentIds: Array.isArray(recentIds) ? recentIds : [],
    recentOperandKeys: Array.isArray(recentOperandKeys) ? recentOperandKeys : [],
  }
}
function writeRecent(lessonId, recentIds, recentOperandKeys) {
  lsSet(LS_RECENT_IDS + lessonId, JSON.stringify(recentIds))
  lsSet(LS_RECENT_OPS + lessonId, JSON.stringify(recentOperandKeys))
}

/* ── 題庫檔攤平：byTopic[topic][difficulty][angle][] → flat [] ── */
export function flattenBank(parsed) {
  const out = []
  for (const topic of Object.values((parsed && parsed.byTopic) || {})) {
    for (const diff of Object.values(topic || {})) {
      for (const arr of Object.values(diff || {})) {
        for (const q of arr || []) out.push(q)
      }
    }
  }
  return out
}

/**
 * 抽題隊列（shuffle + 避最近 30 id / 15 組 operands）。
 * @param {object[]} questions flat 題目陣列
 * @param {{recentIds?: string[], recentOperandKeys?: string[], rng?: ()=>number}} opts
 * @returns {{ next(): object|null, recentIds: string[], recentOperandKeys: string[] }}
 */
export function createDrawQueue(questions, { recentIds = [], recentOperandKeys = [], rng = null } = {}) {
  const byId = new Map(questions.map((q) => [q.id, q]))
  const recIds = recentIds.slice(-MAX_RECENT_IDS)
  const recOps = recentOperandKeys.slice(-MAX_RECENT_OPS)
  const r = rng || drawRng()
  let queue = []

  function shuffleIds() {
    const ids = questions.map((q) => q.id)
    for (let i = ids.length - 1; i > 0; i -= 1) {
      const j = Math.floor(r() * (i + 1))
      const t = ids[i]
      ids[i] = ids[j]
      ids[j] = t
    }
    queue = ids
  }

  function commit(q) {
    recIds.push(q.id)
    if (recIds.length > MAX_RECENT_IDS) recIds.shift()
    recOps.push(operandKey(q))
    if (recOps.length > MAX_RECENT_OPS) recOps.shift()
    return q
  }

  function next() {
    if (questions.length === 0) return null
    if (queue.length === 0) shuffleIds()
    let scanned = 0
    while (queue.length > 0 && scanned < queue.length) {
      const id = queue[0]
      scanned += 1
      const q = byId.get(id)
      if (q && !recIds.includes(id) && !recOps.includes(operandKey(q))) {
        queue.shift()
        return commit(q)
      }
      // 唔啱 → 放隊尾，pop 下一條
      queue.push(queue.shift())
    }
    // 全部剩低都係「最近」→ 照拎隊頭（有 1000 題 vs 最近 30 唔會發生；防無限 loop）
    const id = queue.shift()
    const q = byId.get(id)
    if (!q) return null
    return commit(q)
  }

  return {
    next,
    get recentIds() {
      return recIds.slice()
    },
    get recentOperandKeys() {
      return recOps.slice()
    },
  }
}

/** 後備生成器：seed 遞增，verifyQuestion fail → seed+1 重試最多 10 次 */
export function makeFallback(lessonId, { seedStart = 1, verifyFn = verifyQuestion, rng = null } = {}) {
  const templates = TEMPLATES.filter((t) => t.lesson === String(lessonId))
  let seed = seedStart
  const r = rng || drawRng()
  return {
    templates,
    next() {
      if (templates.length === 0) return null
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const tpl = templates[Math.floor(r() * templates.length)]
        const q = generateQuestion(seed, { template: tpl.id })
        seed += 1
        try {
          verifyFn(q)
          return q
        } catch (err) {
          /* discard + seed+1 重試 */
        }
      }
      return null // 10 次都 fail → 唔出題
    },
  }
}

/**
 * 開一個課題嘅題目來源。
 * @param {string} lessonId
 * @param {{manifestOverride?, generatorHashOverride?, verifyFn?}} opts（測試用）
 * @returns {Promise<{kind:'bank'|'fallback'|'none', total:number|null,
 *                    next:()=>object|null, persist:()=>void}>}
 */
export async function openLessonSource(lessonId, opts = {}) {
  const id = String(lessonId)
  const mf = opts.manifestOverride || manifest
  const gh = opts.generatorHashOverride != null ? opts.generatorHashOverride : mf.generatorCodeHash
  const hashOk = generatorVersionMatches(gh)
  const entry = (mf.lessons || {})[id]

  let recent = readRecent(id)

  /* ── 主路徑：題庫 ─────────────────────────────────────────── */
  let questions = null
  if (entry) {
    try {
      const key = '../data/bank/' + entry.file
      const loader = banks[key]
      if (!loader) throw new Error('題庫檔唔存在：' + entry.file)
      const mod = await loader()
      questions = flattenBank(mod && mod.default ? mod.default : mod)
    } catch (err) {
      questions = null
    }
  }

  if (questions && questions.length > 0) {
    const queue = createDrawQueue(questions, {
      recentIds: recent.recentIds,
      recentOperandKeys: recent.recentOperandKeys,
    })
    return {
      kind: 'bank',
      total: questions.length,
      next: () => queue.next(),
      persist: () => writeRecent(id, queue.recentIds, queue.recentOperandKeys),
    }
  }

  /* ── 後備：runtime 生成（要過版本檢查）────────────────────── */
  if (hashOk) {
    const fallback = makeFallback(id, { verifyFn: opts.verifyFn || verifyQuestion })
    if (fallback.templates.length > 0) {
      const recIds = recent.recentIds.slice(-MAX_RECENT_IDS)
      const recOps = recent.recentOperandKeys.slice(-MAX_RECENT_OPS)
      return {
        kind: 'fallback',
        total: null,
        next: () => {
          let q = fallback.next()
          // 後備題都盡量避最近 id／operands（軟保險）
          for (let i = 0; i < 3 && q; i += 1) {
            if (recIds.includes(q.id) || recOps.includes(operandKey(q))) q = fallback.next()
            else break
          }
          if (q) {
            recIds.push(q.id)
            if (recIds.length > MAX_RECENT_IDS) recIds.shift()
            recOps.push(operandKey(q))
            if (recOps.length > MAX_RECENT_OPS) recOps.shift()
          }
          return q
        },
        persist: () => writeRecent(id, recIds, recOps),
      }
    }
  }

  /* ── 乜都冇 ─────────────────────────────────────────────── */
  return { kind: 'none', total: 0, next: () => null, persist: () => {} }
}
