/* ════════════════════════════════════════════════════════════
   mq4 — resolveQuestion.js
   「再試一次」舊 record 反查（方案 C 嘅 B：舊資料 fallback）。

   渲染時逐條 attempt 反查佢應顯示嘅題目：
     1. attempt 有 snapshot → 直接用（自足，唔使反查）。
     2. 冇 snapshot → 先查舊手寫 seed 題（getQuestionById，同步）。
     3. 再唔得 → 由 id prefix（l1- → 課題 1）推課題 → 經 manifest.json
        lazy import 對應題庫檔 → 查 id → 查到就即時 backfill 寫返 snapshot。
     4. 全部查唔到 → 回傳明確 status:'missing'（UI 顯示「已經更新」＋移除，
        唔准靜靜唔見）。

   注意：題庫 1000 題 JSON 唔細，唔准 eager import；批次查同一課題時，
   題庫只 import 一次（bankCache）。
   ════════════════════════════════════════════════════════════ */

import manifest from '../data/bank/manifest.json'
import { getQuestionById } from '../data/lessons.js'
import { buildSnapshot, backfillAttemptSnapshot } from './storage.js'

/* ── lazy 題庫 glob（同 practiceBank 一樣，靠 Vite / esbuild 展開）── */
const banks = import.meta.glob('../data/bank/lesson*.json')

/** 批次查同一課題時，題庫只 import 一次（cache：lessonId → Map<id, question>） */
const bankCache = new Map()

/** 由 id prefix 推課題（l1-… → '1'，l2-… → '2'；其他 → null） */
export function lessonIdFromQuestionId(id) {
  const m = /^l(\d+)-/.exec(String(id || ''))
  return m ? m[1] : null
}

/** lazy import 一個課題題庫，攤平成 id → question 嘅 Map（只 import 一次） */
async function loadBankMap(lessonId) {
  const lid = String(lessonId)
  if (bankCache.has(lid)) return bankCache.get(lid)
  const entry = (manifest.lessons || {})[lid]
  if (!entry) return null
  const key = '../data/bank/' + entry.file
  const loader = banks[key]
  if (!loader) return null
  try {
    const mod = await loader()
    const parsed = mod && mod.default ? mod.default : mod
    const map = new Map()
    for (const topic of Object.values((parsed && parsed.byTopic) || {})) {
      for (const diff of Object.values(topic || {})) {
        for (const arr of Object.values(diff || {})) {
          for (const q of arr || []) if (q && q.id) map.set(q.id, q)
        }
      }
    }
    bankCache.set(lid, map)
    return map
  } catch (err) {
    bankCache.set(lid, null)
    return null
  }
}

/**
 * 反查一條 attempt 應顯示嘅題目。
 * @param {{questionId?:string, lessonId?:string, snapshot?:object}} attempt
 * @returns {Promise<{status:'snapshot'|'seed'|'bank'|'missing', question:object|null}>}
 */
export async function resolveQuestionForAttempt(attempt) {
  if (!attempt) return { status: 'missing', question: null }

  // 1. 有 snapshot → 直接用（唔再反查）
  const snap = attempt.snapshot
  if (snap && typeof snap === 'object' && typeof snap.question === 'string' && snap.question !== '') {
    return { status: 'snapshot', question: snap }
  }

  const id = String(attempt.questionId || '')

  // 2. 舊手寫 seed 題（N1-… / N2-…，同步）
  const seed = getQuestionById(id)
  if (seed) return { status: 'seed', question: buildSnapshot(seed) }

  // 3. 題庫 lazy 反查 + backfill
  const lid = lessonIdFromQuestionId(id) || String(attempt.lessonId || '')
  if (lid) {
    const map = await loadBankMap(lid)
    const q = map ? map.get(id) : null
    if (q) {
      const snap2 = buildSnapshot(q)
      await backfillAttemptSnapshot(lid, id, snap2)
      return { status: 'bank', question: snap2 }
    }
  }

  // 4. 查唔到 → 明確狀態（UI 顯示「已經更新」＋移除，唔准 null 就算）
  return { status: 'missing', question: null }
}
