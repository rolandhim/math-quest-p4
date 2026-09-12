/* ════════════════════════════════════════════════════════════
   smoke.mjs —— npm run smoke
   用 esbuild（vite 自己嘅 dependency，唔使額外裝嘢）打包
   scripts/smoke-entry.jsx，再喺 Node 入面真係 render 一次。
   捉嘅係：JSX 爆、import 錯路徑、runtime 直接 throw、
          storage 生命週期（再試清單／備份）邏輯錯。
   ════════════════════════════════════════════════════════════ */

import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const root = path.resolve(import.meta.dirname, '..')
const outfile = path.join(root, '.smoke', 'bundle.mjs')
fs.mkdirSync(path.dirname(outfile), { recursive: true })

await build({
  entryPoints: [path.join(root, 'scripts', 'smoke-entry.jsx')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  loader: { '.css': 'empty' },
  outfile,
  logLevel: 'warning',
  // react / react-router 由 Node 自己喺 node_modules 載入，
  // 唔好 bundle 佢哋（react-dom/server 喺包入面會撞到 require('stream')）
  packages: 'external',
})

const mod = await import(pathToFileURL(outfile).href)

let fail = 0

console.log('══════════════════════════════════════════════')
console.log('A. 每條 route 真係 render（renderToString）')
console.log('══════════════════════════════════════════════')
const renders = await mod.runRenderCheck()
for (const r of renders) {
  if (!r.ok) fail += 1
  console.log(
    `${r.ok ? 'PASS' : 'FAIL'}  ${r.path.padEnd(20)} ${r.ok ? `${r.bytes} bytes  「${r.sample}」` : r.error}`,
  )
}

console.log('')
console.log('══════════════════════════════════════════════')
console.log('B. storage 生命週期（答錯 → 再試 → 重做 → 備份）')
console.log('══════════════════════════════════════════════')
const steps = await mod.runStorageCheck()
for (const s of steps) {
  if (!s.got) fail += 1
  console.log(`${s.got ? 'PASS' : 'FAIL'}  ${s.step}  →  ${s.detail}`)
}

console.log('')
console.log(fail === 0 ? '全部 smoke check 通過 ✓' : `有 ${fail} 項唔過 ✗`)
process.exit(fail === 0 ? 0 : 1)
