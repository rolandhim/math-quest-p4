import React, { act as reactAct } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import App from '../src/App.jsx'
import { setTestSeed, openLessonSource } from '../src/lib/practiceBank.js'
import { EMPTY_LESSON_ID } from './lessons-empty-shim.js'
import { countDone, isResolvedAttempt } from '../src/lib/progress.js'
import { encodeCode, decodeCode, todayStr } from '../src/components/ProgressCode.jsx'

/* ════════════════════════════════════════════════════════════
   check-abc（新加嘅，唔郁原有四條 gate）
   驗嘅係簡報 §1.5 三件事真係做咗：
     (A) 練習唔限題數、冇分母、題庫走完重洗牌、有佢自己揀嘅停
     (B) 進度碼：複製（帶日期）／輸入（好碼還原、爛碼唔 crash）
     (C) 未答完唔准走（頂部返回鍵收埋）；答完出 Home 鍵
     (C2) 未答完走甩 → 唔會當「做過」
     (D) 空題庫（0 題）唔會死鎖、一定有出路
   ════════════════════════════════════════════════════════════ */

const act = reactAct || ((fn) => fn())
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 有冇 Home 個屋 emoji（用 codepoint 比較，唔靠原始碼入面嘅字面值） */
const hasHouse = (s) => [...String(s || '')].some((c) => c.codePointAt(0) === 0x1f3e0)

function textOf(el) {
  return (el || document.body).textContent.replace(/\s+/g, ' ')
}

function findButton(label, scope) {
  // 有啲掣係 <button>（e.g. 提交），有啲係 react-router 嘅 <Link> → <a>，兩樣都要搵
  return Array.from((scope || document).querySelectorAll('button, a')).find((b) =>
    (b.textContent || '').includes(label),
  )
}

function click(el) {
  if (!el) throw new Error('搵唔到要撳嘅掣')
  el.click()
}

function setValue(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
  el.dispatchEvent(new window.Event('input', { bubbles: true }))
}

async function actAsync(fn) {
  await act(async () => {
    await fn()
  })
}

async function mount(container, path) {
  const root = createRoot(container)
  await actAsync(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    )
  })
  await actAsync(async () => {
    await sleep(40)
  })
  return root
}

export async function runAbcCheck() {
  const out = []
  const push = (step, got, detail) => out.push({ step, got: !!got, detail })

  /* ── (C2) 未答完唔算「做過」───────────────────── */
  push(
    '未答完（只答錯過一次）唔算做過',
    isResolvedAttempt({ correct: false, hintLevel: 0 }) === false && countDone([{ correct: false, hintLevel: 0 }]) === 0,
    `答錯一次 → countDone=${countDone([{ correct: false, hintLevel: 0 }])}`,
  )
  push(
    '答啱／行到第 3 層才算做過',
    isResolvedAttempt({ correct: true, hintLevel: 0 }) === true && isResolvedAttempt({ correct: false, hintLevel: 3 }) === true,
    'correct=true ✓ · hintLevel=3 ✓',
  )

  /* ── (B) 進度碼純邏輯：encode / decode ────────── */
  const today = todayStr()
  const code = encodeCode('{"a":1}', '2026-09-12')
  const dec = decodeCode(code)
  push('進度碼帶日期（MQ4v1-YYYY-MM-DD-…）', code.startsWith('MQ4v1-2026-09-12-'), code.slice(0, 30) + '…')
  push('自己出嘅碼解返得到', !dec.error && dec.date === '2026-09-12' && JSON.parse(dec.json).a === 1, JSON.stringify(dec).slice(0, 90))
  push('爛碼唔會 crash、有清楚講法', !!decodeCode('呢個係亂咁打嘅嘢').error, decodeCode('呢個係亂咁打嘅嘢').error)
  push('空碼唔會 crash', !!decodeCode('').error, decodeCode('').error)
  push('原始 JSON 都收貨', !decodeCode('{"app":"math-quest-p4","data":{}}').error, 'raw JSON ok')
  push('今日日期格式', /^\d{4}-\d{2}-\d{2}$/.test(today), today)

  /* ── (B) 進度碼 UI（課文櫃）────────────────────── */
  const c1 = document.createElement('div')
  document.body.appendChild(c1)
  const r1 = await mount(c1, '/')
  push('首頁有「複製進度碼」掣', !!findButton('複製進度碼', c1), textOf(c1).slice(0, 40))
  await actAsync(async () => {
    click(findButton('複製進度碼', c1))
  })
  await actAsync(async () => {
    await sleep(40)
  })
  const shown = c1.querySelector('textarea.code-area')
  const shownVal = shown ? shown.value : ''
  push('一撳就有碼（碼頭帶今日日期）', shownVal.startsWith('MQ4v1-' + today + '-'), '碼頭=' + shownVal.slice(0, 30))

  await actAsync(async () => {
    click(findButton('輸入進度碼', c1))
  })
  await actAsync(async () => {
    await sleep(20)
  })
  const areas = Array.from(c1.querySelectorAll('textarea.code-area'))
  const pasteBox = areas[areas.length - 1]
  await actAsync(async () => {
    setValue(pasteBox, '亂咁貼嘅嘢')
  })
  await actAsync(async () => {
    click(findButton('還原進度', c1))
  })
  await actAsync(async () => {
    await sleep(40)
  })
  const badMsg = c1.querySelector('.code-msg-bad')
  push('貼爛碼 → 有清楚嘅唔得訊息（唔 crash）', !!badMsg, badMsg ? badMsg.textContent : '（冇訊息）')

  await actAsync(async () => {
    const boxes = Array.from(c1.querySelectorAll('textarea.code-area'))
    setValue(boxes[boxes.length - 1], shownVal)
  })
  await actAsync(async () => {
    click(findButton('還原進度', c1))
  })
  await actAsync(async () => {
    await sleep(60)
  })
  const okMsg = c1.querySelector('.code-msg-ok')
  push('貼好碼 → 還原成功訊息', !!okMsg && /還原/.test(okMsg.textContent), okMsg ? okMsg.textContent : '（冇訊息）')
  await actAsync(async () => {
    r1.unmount()
  })
  c1.remove()

  /* ── (A) + (C) 練習庫：未答完鎖住、答完出 Home、冇分母、走完重洗牌 ──
     Stage D：練習頁讀題庫（唔再係 5 條種子）。用 setTestSeed() 固定抽題順序，
     由題庫決定性地攞頭 5 題，再逐題答啱。 */
  setTestSeed(20260912)
  const src = await openLessonSource('2')
  const qs = [src.next(), src.next(), src.next(), src.next(), src.next()]
  const c2 = document.createElement('div')
  document.body.appendChild(c2)
  const r2 = await mount(c2, '/lesson/2/practice')

  const t0 = textOf(c2)
  push('(A) 顯示「第 1 題」而冇分母', t0.includes('第 1 題') && !/第 1 \/ \d+ 題/.test(t0), t0.slice(0, 46))
  push('(C) 未答完：頂部冇「← 課題 / ← 課文櫃」返回鍵', !findButton('← 課題', c2) && !findButton('← 課文櫃', c2), 'lock 文字=' + (t0.match(/答完呢題先可以走/) || ['（冇）'])[0])
  push('(C) 未答完：冇 Home 鍵、冇停嘅掣', !hasHouse(t0) && !findButton('今日夠喇', c2), '🏠=' + hasHouse(t0))

  // 「完全鎖住」嘅最強講法：場內冇任何走去另一版嘅 Link（2026-09-12 Checker 🟡）
  const lockedHrefs = Array.from(c2.querySelectorAll('a')).map((a) => a.getAttribute('href') || '')
  const escapes = lockedHrefs.filter(
    (h) => h === '/' || h === '/parent' || (h.startsWith('/lesson/') && h !== '/lesson/2/practice'),
  )
  push(
    '(C) 未答完：DOM 內冇任何可逃走嘅 Link（冇 /、/lesson/:id、/parent）',
    escapes.length === 0,
    '場內 Link = ' + (lockedHrefs.length ? lockedHrefs.join(' , ') : '（一個都冇）'),
  )

  // 逐題答啱，行到題庫尾再加一題（證明冇終點）
  for (let i = 0; i < qs.length; i += 1) {
    const q = qs[i]
    await actAsync(async () => {
      const input = c2.querySelector('input.big-input')
      if (input) {
        setValue(input, q.acceptedAnswers[0] || q.answer)
        await sleep(10)
        const submit = findButton('提交', c2)
        if (submit) click(submit)
      } else {
        const label = q.options[q.correctIndex].label
        const opt = Array.from(c2.querySelectorAll('button.option')).find((b) => b.textContent === label)
        if (opt) click(opt)
      }
    })
    await actAsync(async () => {
      await sleep(40)
    })
    if (i === 0) {
      const tAfter = textOf(c2)
      const leaveBtn = findButton('返課文櫃', c2)
      push(
        '(C) 答完之後：出一個顯眼嘅 Home 鍵（🏠 返課文櫃）',
        !!leaveBtn && hasHouse(leaveBtn.textContent),
        '掣文字=' + (leaveBtn ? JSON.stringify(leaveBtn.textContent) : '（冇）'),
      )
      push('(C) 答完之後：頂部返回鍵出返', !!findButton('← 課題', c2), '← 課題=' + !!findButton('← 課題', c2))
    }
    const next = findButton('下一題', c2)
    if (!next || next.disabled) {
      push(`(A) 第 ${i + 2} 題出得嚟`, false, '「下一題」撳唔到')
      break
    }
    await actAsync(async () => {
      click(next)
    })
    await actAsync(async () => {
      await sleep(30)
    })
  }
  const tEnd = textOf(c2)
  push(
    `(A) 題庫（${qs.length} 題抽完呢輪）之後仲有題出、冇「做晒」`,
    !tEnd.includes('做晒') && !tEnd.includes('今日做好喇') && /第 \d+ 題/.test(tEnd) && !!c2.querySelector('.qcard'),
    (tEnd.match(/第 \d+ 題/) || ['（搵唔到）'])[0] + ' ｜ 題目=' + (c2.querySelector('.qcard-question') || {}).textContent,
  )
  push(
    '(A) 顯示「第 6 題」而唔係跌返「第 1 題」（冇分母）',
    tEnd.includes('第 6 題') && !/第 6 \/ \d+ 題/.test(tEnd),
    (tEnd.match(/第 \d+ 題/) || ['（搵唔到）'])[0],
  )
  await actAsync(async () => {
    r2.unmount()
  })
  c2.remove()

  /* ── (D) 空題庫（0 題）唔會死鎖、一定有出路 ─────────
     模擬一個 getLesson() 有課題、但 getQuestionsByLesson() 返 0 題嘅情況
     （見 scripts/lessons-empty-shim.js：只喺呢條 gate 換入，src/ 冇改）。 */
  const c3 = document.createElement('div')
  document.body.appendChild(c3)
  const r3 = await mount(c3, `/lesson/${EMPTY_LESSON_ID}/practice`)
  const t4 = textOf(c3)
  const lockedEmpty = !!c3.querySelector('.topbar-lock')
  const backEmpty = findButton('← 課題', c3) || findButton('← 課文櫃', c3)
  push(
    '(D) 空題庫：唔會死鎖（唔會話「答完呢題先可以走」，頂部返回鍵照出）',
    !lockedEmpty && !!backEmpty,
    `鎖住=${lockedEmpty} ｜ 頂部返回鍵=${backEmpty ? JSON.stringify(backEmpty.textContent) : '（冇）'} ｜ 場面=${t4.slice(0, 40)}`,
  )
  const outEmpty = findButton('返課文櫃', c3)
  push(
    '(D) 空題庫：頁面有一條清楚嘅出路（返課文櫃 Link → /）',
    !!outEmpty && outEmpty.tagName === 'A' && outEmpty.getAttribute('href') === '/',
    '出路 = ' + (outEmpty ? `${outEmpty.tagName} href=${outEmpty.getAttribute('href')}` : '（冇）'),
  )
  push(
    '(D) 空題庫：唔係一片空白（有講清楚冇題目）',
    /未有題目|冇題目/.test(t4),
    t4.slice(0, 60),
  )
  await actAsync(async () => {
    r3.unmount()
  })
  c3.remove()

  return out
}
