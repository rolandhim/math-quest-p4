/* ════════════════════════════════════════════════════════════
   check-abc.mjs —— npm run check:abc
   為簡報 §1.5 (A)/(B)/(C) 三個改動而新加嘅測試（唔郁原本四條 gate）。
   同 interact 一樣：esbuild 打包 → jsdom 開 DOM → 真係撳掣。
   ════════════════════════════════════════════════════════════ */

import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { importMetaGlobPlugin } from './glob-plugin.mjs'

const root = path.resolve(import.meta.dirname, '..')
const outfile = path.join(root, '.smoke', 'check-abc.bundle.mjs')
fs.mkdirSync(path.dirname(outfile), { recursive: true })

/* 只喺呢條 gate 入面，把 src/data/lessons.js 換成測試替身 ——
   替身加多一個 0 題嘅空課題（id = '__empty__'），用嚟驗「空題庫唔會死鎖」。
   正式 src/ 完全唔郁，另外四條 gate 亦唔受影響。 */
const lessonsShim = path.join(root, 'scripts', 'lessons-empty-shim.js')
const emptyLessonShim = {
  name: 'empty-lesson-shim',
  setup(buildApi) {
    buildApi.onResolve({ filter: /data[\\/]lessons\.js$/ }, (args) => {
      // 替身自己 import 原裝 module 嗰次唔可以再換（否則無限循環）
      if (path.resolve(args.importer) === lessonsShim) return null
      return { path: lessonsShim }
    })
  },
}

await build({
  entryPoints: [path.join(root, 'scripts', 'check-abc-entry.jsx')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  loader: { '.css': 'empty' },
  outfile,
  logLevel: 'warning',
  packages: 'external',
  plugins: [importMetaGlobPlugin(), emptyLessonShim],
})

let JSDOM
try {
  ;({ JSDOM } = await import('jsdom'))
} catch (err) {
  console.log('跳過 check:abc：未裝 jsdom')
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
globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement
globalThis.Event = dom.window.Event
globalThis.MouseEvent = dom.window.MouseEvent
globalThis.Blob = dom.window.Blob
globalThis.URL = dom.window.URL
globalThis.btoa = globalThis.btoa || dom.window.btoa
globalThis.atob = globalThis.atob || dom.window.atob
globalThis.IS_REACT_ACT_ENVIRONMENT = true
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
  writable: true,
})
globalThis.localStorage = dom.window.localStorage

const mod = await import(pathToFileURL(outfile).href)

console.log('══════════════════════════════════════════════')
console.log('D. 簡報 §1.5 (A)(B)(C) 新加嘅驗證')
console.log('══════════════════════════════════════════════')

let fail = 0
const results = await mod.runAbcCheck()
for (const r of results) {
  if (!r.got) fail += 1
  console.log(`${r.got ? 'PASS' : 'FAIL'}  ${r.step}`)
  console.log(`        ${r.detail}`)
}

console.log('')
console.log(fail === 0 ? `全部 ${results.length} 項 §1.5 測試通過 ✓` : `有 ${fail} 項唔過 ✗`)
process.exit(fail === 0 ? 0 : 1)
