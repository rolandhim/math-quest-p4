/* ════════════════════════════════════════════════════════════
   check-ui-compat.mjs —— npm run check:ui-compat
   真正用 jsdom render QuestionCard，逐下撳掣，驗證 MC options
   同時支援舊 seed 字串形狀同新 {id,label} 形狀，同 answerDisplay
   出 label 唔漏 raw id。照 interact.mjs 嘅模式：esbuild 打包 →
   jsdom 開 DOM → import bundle → 真撳掣。唔郁 src/。
   ════════════════════════════════════════════════════════════ */

import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const root = path.resolve(import.meta.dirname, '..')
const outfile = path.join(root, '.smoke', 'check-ui-compat.bundle.mjs')
fs.mkdirSync(path.dirname(outfile), { recursive: true })

await build({
  entryPoints: [path.join(root, 'scripts', 'check-ui-compat-entry.jsx')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  loader: { '.css': 'empty' },
  outfile,
  logLevel: 'warning',
  packages: 'external',
})

let JSDOM
try {
  ;({ JSDOM } = await import('jsdom'))
} catch (err) {
  console.log('跳過 check:ui-compat：未裝 jsdom')
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
globalThis.localStorage = dom.window.localStorage

const mod = await import(pathToFileURL(outfile).href)

console.log('══════════════════════════════════════════════')
console.log('E. QuestionCard options / answerDisplay 兼容性驗證')
console.log('══════════════════════════════════════════════')

let fail = 0
const results = await mod.runUiCompatCheck()
for (const r of results) {
  if (!r.got) fail += 1
  console.log(`${r.got ? 'PASS' : 'FAIL'}  ${r.step}`)
  console.log(`        ${r.detail}`)
}

console.log('')
console.log(fail === 0 ? `全部 ${results.length} 項兼容性測試通過 ✓` : `有 ${fail} 項唔過 ✗`)
process.exit(fail === 0 ? 0 : 1)
