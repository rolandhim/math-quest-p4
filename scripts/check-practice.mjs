#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════
   mq4 — scripts/check-practice.mjs —— npm run check:practice
   Stage D gate：驗證練習頁接駁唯讀題庫。

   覆蓋 10 項斷言：
     #1  練習頁題目全部嚟自題庫
     #2  連續 50 題冇 id 喺最近 30 重複
     #3  連續 50 題冇 operands 喺最近 15 重複
     #4  隊列走完重新 shuffle 繼續出
     #5  題庫檔唔存在 → 成功 fallback
     #6  後備生成器連續 10 次 fail → 唔出題（「暫時冇題」）
     #7  generatorCodeHash 對唔上 → 停用後備生成器
     #8  首條題目 render < 300ms
     #9  打字題 Enter = 提交；再按 = 下一題
     #10 主 bundle 唔包含題庫內容（build 後檢查 chunk）

   照 check-ui-compat / interact 嘅模式：esbuild 打包（含 import.meta.glob
   展開 plugin）→ jsdom 開 DOM → import bundle → 真撳掣。
   ════════════════════════════════════════════════════════════ */

import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { importMetaGlobPlugin } from './glob-plugin.mjs'

const root = path.resolve(import.meta.dirname, '..')
const outfile = path.join(root, '.smoke', 'check-practice.bundle.mjs')
fs.mkdirSync(path.dirname(outfile), { recursive: true })

await build({
  entryPoints: [path.join(root, 'scripts', 'check-practice-entry.jsx')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  loader: { '.css': 'empty' },
  outfile,
  logLevel: 'warning',
  packages: 'external',
  plugins: [importMetaGlobPlugin()],
})

let JSDOM
try {
  ;({ JSDOM } = await import('jsdom'))
} catch (err) {
  console.log('跳過 check:practice：未裝 jsdom（npm i -D jsdom）')
  process.exit(0)
}

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost:5173/',
  pretendToBeVisual: true,
})

globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.HTMLInputElement = dom.window.HTMLInputElement
globalThis.Event = dom.window.Event
globalThis.MouseEvent = dom.window.MouseEvent
globalThis.KeyboardEvent = dom.window.KeyboardEvent
globalThis.Blob = dom.window.Blob
globalThis.URL = dom.window.URL
globalThis.IS_REACT_ACT_ENVIRONMENT = true
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
  writable: true,
})
globalThis.localStorage = dom.window.localStorage

const mod = await import(pathToFileURL(outfile).href)

console.log('══════════════════════════════════════════════')
console.log('F. 練習頁接駁題庫（check:practice）')
console.log('══════════════════════════════════════════════')

let fail = 0
const all = []

const logicResults = await mod.runLogicChecks()
all.push(...logicResults)

const enterResults = await mod.runEnterCheck()
all.push(...enterResults)

/* ── #10 主 bundle 唔包含題庫內容 ─────────────────────────── */
{
  const SENTINELS = ['l1-decompose-00000', 'l2-est-00000']
  let ok = false
  let detail = ''
  try {
    execFileSync(path.join(root, 'node_modules', '.bin', 'vite'), ['build'], {
      cwd: root,
      stdio: 'pipe',
    })
    const assets = path.join(root, 'dist', 'assets')
    const files = fs.existsSync(assets) ? fs.readdirSync(assets).filter((f) => f.endsWith('.js')) : []
    const main = files.find((f) => /^index-.*\.js$/.test(f)) || null
    const others = files.filter((f) => f !== main)

    let mainLeak = false
    let splitChunks = 0
    if (main) {
      const txt = fs.readFileSync(path.join(assets, main), 'utf8')
      mainLeak = SENTINELS.some((s) => txt.includes(s))
    }
    for (const f of others) {
      const txt = fs.readFileSync(path.join(assets, f), 'utf8')
      if (SENTINELS.some((s) => txt.includes(s))) splitChunks += 1
    }
    ok = !!main && !mainLeak && splitChunks >= 2
    detail = `主 bundle=${main ? main : '（搵唔到）'}（洩漏=${mainLeak}）｜題庫獨立 chunk=${splitChunks} 個（檔：${others.join(', ') || '冇'}）`
  } catch (err) {
    detail = 'vite build 失敗：' + err.message
  }
  all.push({ step: '#10 主 bundle 唔包含題庫內容（code-split）', got: ok, detail })
}

for (const r of all) {
  if (!r.got) fail += 1
  console.log(`${r.got ? 'PASS' : 'FAIL'}  ${r.step}`)
  console.log(`        ${r.detail}`)
}

console.log('')
console.log(fail === 0 ? `全部 ${all.length} 項 check:practice 通過 ✓` : `有 ${fail} 項唔過 ✗`)
process.exit(fail === 0 ? 0 : 1)
