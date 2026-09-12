import React, { act as reactAct } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import App from '../src/App.jsx'
import {
  setTestSeed,
  openLessonSource,
  createDrawQueue,
  flattenBank,
  operandKey,
  generatorVersionMatches,
  GENERATOR_CODE_HASH,
} from '../src/lib/practiceBank.js'
import { mulberry32 } from '../src/gen/rng.js'
import manifest from '../src/data/bank/manifest.json'
import fs from 'node:fs'
import path from 'node:path'

/* ════════════════════════════════════════════════════════════
   check-practice-entry.jsx —— 由 scripts/check-practice.mjs 打包後跑。
   驗 Stage D 接駁題庫嘅 10 項斷言（除咗 #10 主 bundle 喺 .mjs 度做）。
   ════════════════════════════════════════════════════════════ */

const act = reactAct || ((fn) => fn())
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const banks = import.meta.glob('../src/data/bank/lesson*.json')

async function loadBank(lid) {
  const mod = await banks['../src/data/bank/' + manifest.lessons[lid].file]()
  return flattenBank(mod.default || mod)
}

async function actAsync(fn) {
  await act(async () => {
    await fn()
  })
}

function textOf(el) {
  return (el || document.body).textContent.replace(/\s+/g, ' ')
}

function findButton(label, scope) {
  return Array.from((scope || document).querySelectorAll('button')).find((b) =>
    (b.textContent || '').includes(label),
  )
}

function typeInto(input, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(input, value)
  input.dispatchEvent(new window.Event('input', { bubbles: true }))
}

function pressEnter(target) {
  target.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
}

/* ── 斷言 #1–#8（純邏輯，唔使 DOM）────────────────────────── */
export async function runLogicChecks() {
  const out = []
  const push = (step, got, detail) => out.push({ step, got: !!got, detail })

  /* #1 練習頁題目全部嚟自題庫（id 喺 manifest 對應檔案搵到） */
  {
    const bank1 = await loadBank('1')
    const idSet = new Set(bank1.map((q) => q.id))
    const src = await openLessonSource('1')
    let ok = src.kind === 'bank'
    let n = 0
    if (ok) {
      for (let i = 0; i < 20; i += 1) {
        const q = src.next()
        if (!q || !idSet.has(q.id)) {
          ok = false
          break
        }
        n += 1
      }
    }
    push('#1 練習頁題目全部嚟自題庫（id 喺題庫檔搵到）', ok && n === 20, `${n}/20 題 id 全部命中題庫`)
  }

  /* #2 連續 50 題，冇任何 id 喺最近 30 條之內重複 */
  {
    const src = await openLessonSource('2')
    const ids = []
    let ok = true
    for (let i = 0; i < 50; i += 1) {
      const q = src.next()
      if (!q) {
        ok = false
        break
      }
      ids.push(q.id)
    }
    if (ok) {
      for (let i = 0; i < ids.length; i += 1) {
        const win = ids.slice(Math.max(0, i - 29), i)
        if (win.includes(ids[i])) {
          ok = false
          break
        }
      }
    }
    push('#2 連續 50 題，冇 id 喺最近 30 條重複', ok, ok ? '50 題 id 全部冇 30 窗內重複' : '有 id 喺 30 窗內重複')
  }

  /* #3 連續 50 題，冇 operands 同一組連續重複（最近 15 組） */
  {
    const src = await openLessonSource('2')
    const keys = []
    let ok = true
    for (let i = 0; i < 50; i += 1) {
      const q = src.next()
      if (!q) {
        ok = false
        break
      }
      const k = operandKey(q)
      const win = keys.slice(Math.max(0, keys.length - 14))
      if (win.includes(k)) {
        ok = false
        break
      }
      keys.push(k)
    }
    push('#3 連續 50 題，冇 operands 同一組喺最近 15 重複', ok, ok ? '50 題 operands 全部冇 15 窗內重複' : '有 operands 重複')
  }

  /* #4 隊列走完 → 重新 shuffle 繼續出（唔會斷、唔會空白） */
  {
    const small = [
      { id: 't-a', operands: [2, 3] },
      { id: 't-b', operands: [4, 5] },
      { id: 't-c', operands: [6, 7] },
      { id: 't-d', operands: [8, 9] },
      { id: 't-e', operands: [10, 11] },
    ]
    const q = createDrawQueue(small, { rng: mulberry32(7) })
    let ok = true
    let n = 0
    for (let i = 0; i < 12; i += 1) {
      const got = q.next()
      n += 1
      if (!got) {
        ok = false
        break
      }
    }
    push('#4 隊列走完重新 shuffle 繼續出（5 題抽 12 次唔斷）', ok && n === 12, `${n} 次全部有題（冇 null）`)
  }

  /* #5 題庫檔案唔存在 → 成功 fallback，唔會 crash */
  {
    let ok = false
    let detail = ''
    try {
      const src = await openLessonSource('1', {
        manifestOverride: {
          ...manifest,
          lessons: { '1': { file: 'lesson1.deadbeef.json', count: 0, sha256: 'x' } },
        },
      })
      const q = src.next()
      ok = src.kind === 'fallback' && !!q && typeof q.id === 'string'
      detail = `kind=${src.kind}，第一題 id=${q ? q.id : '（null）'}`
    } catch (err) {
      detail = 'throw: ' + err.message
    }
    push('#5 題庫檔唔存在 → 成功 fallback 唔 crash', ok, detail)
  }

  /* #6 後備生成器連續 10 次 fail → 唔出題（返 null，唔爆） */
  {
    let ok = false
    let detail = ''
    try {
      const src = await openLessonSource('1', {
        manifestOverride: {
          ...manifest,
          lessons: { '1': { file: 'lesson1.deadbeef.json', count: 0, sha256: 'x' } },
        },
        verifyFn: () => {
          throw new Error('模擬 verify fail')
        },
      })
      const q = src.next()
      ok = src.kind === 'fallback' && q === null
      detail = `kind=${src.kind}，next()=${q === null ? 'null（唔出題 → 顯示「暫時冇題」）' : q.id}`
    } catch (err) {
      detail = 'throw: ' + err.message
    }
    push('#6 後備生成器連續 10 次 fail → 唔出題（唔爆）', ok, detail)
  }

  /* #7 generatorCodeHash 對唔上 → 唔用後備生成器 */
  {
    let srcBad = null
    let srcGood = null
    try {
      srcBad = await openLessonSource('1', {
        manifestOverride: {
          ...manifest,
          generatorCodeHash: 'mismatched-deadbeef',
          lessons: { '1': { file: 'lesson1.deadbeef.json', count: 0, sha256: 'x' } },
        },
      })
      srcGood = await openLessonSource('1', { generatorHashOverride: 'mismatched-deadbeef' })
    } catch (err) {
      /* ignore */
    }
    const ok =
      generatorVersionMatches('mismatch') === false &&
      generatorVersionMatches(GENERATOR_CODE_HASH) === true &&
      !!srcBad &&
      srcBad.kind === 'none' &&
      !!srcGood &&
      srcGood.kind === 'bank'
    push('#7 hash 對唔上 → 停用後備生成器（題庫照用）', ok,
      `對唔上 fallback=${srcBad ? srcBad.kind : '?'}｜有題庫時=${srcGood ? srcGood.kind : '?'}`)
  }

  /* #8 首條題目 render < 300ms（G46）—— 真磁碟讀檔 + parse + flatten + 首抽 */
  {
    const t0 = performance.now()
    const fp = path.resolve(process.cwd(), 'src', 'data', 'bank', manifest.lessons['2'].file)
    const raw = fs.readFileSync(fp, 'utf8')
    const parsed = JSON.parse(raw)
    const flat = flattenBank(parsed)
    const q = createDrawQueue(flat, { rng: mulberry32(1) }).next()
    const ms = performance.now() - t0
    push('#8 首條題目 render < 300ms（磁碟讀檔 → 第一題）', ms < 300 && !!q, `${ms.toFixed(1)} ms（第一題 ${q ? q.id : 'null'}）`)
  }

  return out
}

/* ── 斷言 #9：打字題 Enter = 提交；再按 = 下一題（jsdom + React）── */
export async function runEnterCheck() {
  const out = []
  const push = (step, got, detail) => out.push({ step, got: !!got, detail })

  // 搵一個 seed，令課題 2 第一題係 type-answer（唔硬 code 具體題目）
  const bank2 = await loadBank('2')
  let seed = 1
  let firstQ = null
  for (; seed < 1000; seed += 1) {
    const q = createDrawQueue(bank2, { rng: mulberry32(seed) }).next()
    if (q && q.type === 'type-answer') {
      firstQ = q
      break
    }
  }
  setTestSeed(seed)

  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await actAsync(async () => {
    root.render(
      <MemoryRouter initialEntries={['/lesson/2/practice']}>
        <App />
      </MemoryRouter>,
    )
  })
  await actAsync(async () => {
    await sleep(80)
  })

  const input = container.querySelector('input.big-input')
  const shown = textOf(container)
  push(
    '#9a 打字題顯示出嚟（第一題係 type-answer）',
    !!firstQ && !!input && shown.includes(firstQ.question),
    firstQ ? firstQ.question.slice(0, 50) : '（搵唔到 type-answer seed）',
  )

  // 打正確答案 → 按 Enter = 提交
  await actAsync(async () => {
    typeInto(input, firstQ.acceptedAnswers[0] || firstQ.answer)
  })
  await actAsync(async () => {
    pressEnter(input)
  })
  await actAsync(async () => {
    await sleep(80)
  })
  const t1 = textOf(container)
  push(
    '#9b 按 Enter = 提交（出「答啱咗」、出「下一題」）',
    t1.includes('答啱咗') && !!findButton('下一題', container),
    t1.slice(0, 80),
  )

  // 再按 Enter = 下一題
  await actAsync(async () => {
    pressEnter(window)
  })
  await actAsync(async () => {
    await sleep(80)
  })
  const t2 = textOf(container)
  push(
    '#9c 已提交後再按 Enter = 下一題（顯示「第 2 題」）',
    t2.includes('第 2 題') && !!container.querySelector('.qcard'),
    (t2.match(/第 \d+ 題/) || ['（冇）'])[0] + ' ｜ ' + (container.querySelector('.qcard-question') || {}).textContent,
  )

  await actAsync(async () => {
    root.unmount()
  })
  container.remove()

  return out
}
