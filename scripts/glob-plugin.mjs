/* ════════════════════════════════════════════════════════════
   mq4 — scripts/glob-plugin.mjs
   esbuild plugin：喺打包嗰陣展開 Vite 嘅 import.meta.glob()。

   正式 app（vite dev / vite build）由 Vite 自己處理 import.meta.glob；
   但所有測試 gate（smoke / check:abc / interact / check:practice）都係用
   esbuild 打包，esbuild 唔識 import.meta.glob —— 呢個 plugin 喺 onLoad
   時把 `import.meta.glob('PATTERN')` 展開成：

     ({ '../data/bank/lesson1.xxx.json': () => import('../data/bank/lesson1.xxx.json'),
        '../data/bank/lesson2.yyy.json': () => import('../data/bank/lesson2.yyy.json') })

   key 同 import specifier 一致（相對 importing 檔），同 Vite 一致。
   只支援單一 `*`（唔使 `**`，題庫 pattern 係 lesson*.json）。
   ════════════════════════════════════════════════════════════ */

import fs from 'node:fs'
import path from 'node:path'

function expandGlob(fromDir, pattern) {
  const starIdx = pattern.indexOf('*')
  if (starIdx === -1) {
    const abs = path.resolve(fromDir, pattern)
    if (!fs.existsSync(abs)) return []
    return [{ key: pattern }]
  }
  const prefix = pattern.slice(0, starIdx)
  const suffix = pattern.slice(starIdx + 1)
  const slashIdx = prefix.lastIndexOf('/')
  const dirPart = slashIdx === -1 ? '' : prefix.slice(0, slashIdx + 1)
  const basePart = slashIdx === -1 ? prefix : prefix.slice(slashIdx + 1)
  const absDir = path.resolve(fromDir, dirPart || '.')
  let names = []
  try {
    names = fs.readdirSync(absDir)
  } catch (err) {
    return []
  }
  return names
    .filter((f) => f.startsWith(basePart) && f.endsWith(suffix))
    .sort()
    .map((f) => ({ key: dirPart + f }))
}

export function importMetaGlobPlugin() {
  return {
    name: 'import-meta-glob',
    setup(build) {
      build.onLoad({ filter: /\.(js|jsx|mjs)$/ }, async (args) => {
        let source = await fs.promises.readFile(args.path, 'utf8')
        if (!source.includes('import.meta.glob')) return null
        const regex = /import\.meta\.glob\(\s*(['"])([^'"]+)\1\s*\)/g
        let match
        let changed = false
        source = source.replace(regex, (_m, _q, pattern) => {
          const fromDir = path.dirname(args.path)
          const entries = expandGlob(fromDir, pattern)
          const body = entries
            .map((e) => `    ${JSON.stringify(e.key)}: () => import(${JSON.stringify(e.key)})`)
            .join(',\n')
          changed = true
          return `({\n${body}\n  })`
        })
        if (!changed) return null
        return { contents: source, loader: 'jsx' }
      })
    },
  }
}

export default importMetaGlobPlugin
