/* ════════════════════════════════════════════════════════════
   mq4 — scripts/check-retry.mjs —— npm run check:retry
   「再試一次」bug 修復 gate：驗證 D1（題庫題目渲染到）+ D2（needsHint 傳遞）。

   照 check-practice / check-ui-compat 嘅模式：esbuild 打包（含 import.meta.glob
   展開 plugin）→ jsdom 開 DOM → import bundle → 真 render + 真撳。

   支援 tamper：RETRY_INJECT_BAD=<case> 令指定 case 故意失敗，用嚟證明
   呢條 gate 真係識 fail（exit != 0）。
   ════════════════════════════════════════════════════════════ */

import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { importMetaGlobPlugin } from './glob-plugin.mjs'

/* ── tamper case 名校驗（防靜靜 exit 0 嘅假陽性）──
   合法 case 名 = check-retry-entry.jsx 入面 runRetryCheck() 嘅 8 個 case
   （a–h）。傳咗唔存在嘅 case 名要即刻大聲失敗，唔准照 run。 */
const VALID_TAMPER_CASES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const injectBad = process.env.RETRY_INJECT_BAD
if (injectBad && !VALID_TAMPER_CASES.includes(injectBad)) {
  console.error(`❌ RETRY_INJECT_BAD=${injectBad} 唔係合法 case 名。合法：${VALID_TAMPER_CASES.join(', ')}`)
  process.exit(2)
}

const root = path.resolve(import.meta.dirname, '..')
const outfile = path.join(root, '.smoke', 'check-retry.bundle.mjs')
fs.mkdirSync(path.dirname(outfile), { recursive: true })

await build({
  entryPoints: [path.join(root, 'scripts', 'check-retry-entry.jsx')],
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
  console.log('跳過 check:retry：未裝 jsdom（npm i -D jsdom）')
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
console.log('G. 再試一次 bug 修復（check:retry）')
console.log('══════════════════════════════════════════════')

let fail = 0
const results = await mod.runRetryCheck()
for (const r of results) {
  if (!r.got) fail += 1
  console.log(`${r.got ? 'PASS' : 'FAIL'}  ${r.step}`)
  console.log(`        ${r.detail}`)
}

console.log('')
console.log(fail === 0 ? `全部 ${results.length} 項 check:retry 通過 ✓` : `有 ${fail} 項唔過 ✗`)
process.exit(fail === 0 ? 0 : 1)
