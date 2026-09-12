#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════
   mq4 — scripts/write-generator-version.mjs
   重新計算現時 generator 程式碼（src/gen/**）嘅 content hash，
   寫入 src/data/generator-version.js（前端 runtime 版本檢查用）。

   用法：npm run gen:version（或 build 前自動跑，見 package.json prebuild）
   ════════════════════════════════════════════════════════════ */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generatorCodeHash } from './bank-common.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'src', 'data', 'generator-version.js')

const hash = generatorCodeHash()

const content = `/* ════════════════════════════════════════════════════════════
   mq4 — generator-version.js
   現時 generator 程式碼（src/gen/**）嘅 content hash。

   ★ 自動生成檔：由 scripts/write-generator-version.mjs 重新計算並寫入，
     唔准手改。呢個值同 bank manifest 嘅 generatorCodeHash 對比，
     用嚟決定後備生成器（fallback）可唔可以用：
       - 對得上 → 題庫唔夠時可以用後備生成器
       - 對唔上 → 停用後備生成器（生成器同題庫可能已經漂移）

   生成方式同 scripts/bank-common.mjs 嘅 generatorCodeHash() 完全一致
   （sha256 over src/gen/**，路徑排序，含檔名）。
   ════════════════════════════════════════════════════════════ */

export const CURRENT_GENERATOR_CODE_HASH = '${hash}'

export default CURRENT_GENERATOR_CODE_HASH
`

fs.writeFileSync(OUT, content, 'utf8')
console.log('寫入', path.relative(ROOT, OUT), '→', hash)
