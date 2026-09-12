/* ════════════════════════════════════════════════════════════
   mq4 — gen-browser-entry.js
   畀 esbuild 打包做 IIFE，再喺 jsdom 嘅 window 入面跑，
   證明 src/gen 嘅核心引擎喺「browser 環境」同 Node 完全一致
   （冇依賴任何 Node API）。
   ════════════════════════════════════════════════════════════ */

import { generateQuestion } from '../src/gen/registry.js'
import { verifyQuestion } from '../src/gen/verify.js'
import { uniqueTargetValue } from '../src/gen/solve.js'

/** 喺 browser 環境內生成 + 序列化，回傳 JSON 字串。 */
function generateBatchJson(seeds) {
  const arr = seeds.map((s) => generateQuestion(s, { level: (s % 6) + 1 }))
  return JSON.stringify(arr)
}

globalThis.__mq4gen = { generateBatchJson, verifyQuestion, uniqueTargetValue }
