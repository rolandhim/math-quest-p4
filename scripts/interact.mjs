/* ════════════════════════════════════════════════════════════
   interact.mjs —— npm run interact
   真正用 jsdom 開個 DOM，render 個 app，逐下撳掣，
   驗證三層遞進、3 秒鎖、答啱出步驟＋兩個方法。
   ════════════════════════════════════════════════════════════ */

import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { importMetaGlobPlugin } from './glob-plugin.mjs'

const root = path.resolve(import.meta.dirname, '..')
const outfile = path.join(root, '.smoke', 'interact.bundle.mjs')
fs.mkdirSync(path.dirname(outfile), { recursive: true })

await build({
  entryPoints: [path.join(root, 'scripts', 'interact-entry.jsx')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  loader: { '.css': 'empty' },
  outfile,
  logLevel: 'warning',
  plugins: [importMetaGlobPlugin()],
  packages: 'external',
})

// ── 先搭好 DOM 環境，之後才 import bundle ──────────────
let JSDOM
try {
  ;({ JSDOM } = await import('jsdom'))
} catch (err) {
  console.log('跳過 interactive 測試：未裝 jsdom（npm i -D jsdom）')
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
globalThis.Blob = dom.window.Blob
globalThis.URL = dom.window.URL
globalThis.IS_REACT_ACT_ENVIRONMENT = true
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
  writable: true,
})
// jsdom 冇 localStorage 嘅話，storage.js 會自動跌落 in-memory（唔會爆）
globalThis.localStorage = dom.window.localStorage

const mod = await import(pathToFileURL(outfile).href)

console.log('══════════════════════════════════════════════')
console.log('C. 真正撳掣測試（jsdom + React 18）')
console.log('══════════════════════════════════════════════')

let fail = 0
const results = await mod.runInteractive()
for (const r of results) {
  if (!r.got) fail += 1
  console.log(`${r.got ? 'PASS' : 'FAIL'}  ${r.step}`)
  console.log(`        ${r.detail}`)
}

console.log('')
console.log(fail === 0 ? `全部 ${results.length} 項互動測試通過 ✓` : `有 ${fail} 項唔過 ✗`)
process.exit(fail === 0 ? 0 : 1)
