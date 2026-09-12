import React, { act as reactAct } from 'react'
import { createRoot } from 'react-dom/client'
import QuestionCard from '../src/components/QuestionCard.jsx'

/* ════════════════════════════════════════════════════════════
   check-ui-compat-entry.jsx —— 由 scripts/check-ui-compat.mjs 打包後跑。
   驗嘅係 QuestionCard 對 MC options 兩種形狀 + answerDisplay 嘅兼容性：
     ① 舊 seed 形狀：options 係字串陣列（["69","690"]）→ 顯示字串、提交字串
     ② 新形狀：options 係 {id,label} 物件 → 顯示 label、提交 id
     ③ answerDisplay：出答案嗰句顯示 label，唔會漏出 raw id
   全程唔郁 src/（production code），純粹用真 jsdom 撳掣驗證。
   ════════════════════════════════════════════════════════════ */

const act = reactAct || ((fn) => fn())
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function textOf(el) {
  return (el || document.body).textContent.replace(/\s+/g, ' ')
}

function findButton(label, scope) {
  return Array.from((scope || document).querySelectorAll('button')).find((b) =>
    (b.textContent || '').includes(label),
  )
}

/** 用「完全相等」揀 option 掣（避免 "69" 誤中 "690"、"方法一" 誤中其他） */
function optionByText(scope, text) {
  return Array.from(scope.querySelectorAll('button.option')).find(
    (b) => (b.textContent || '').trim() === text,
  )
}

function click(el) {
  if (!el) throw new Error('搵唔到要撳嘅掣')
  el.click()
}

async function actAsync(fn) {
  await act(async () => {
    await fn()
  })
}

/* 等鎖到期（第 1 次錯鎖 3 秒）：用多次短 act 推時間，唔好一次 sleep 3 秒 */
async function waitFor(predicate, timeoutMs = 8000, stepMs = 250) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true
    await actAsync(async () => {
      await sleep(stepMs)
    })
  }
  return predicate()
}

async function mount(container, question, onAnswered) {
  const root = createRoot(container)
  await actAsync(async () => {
    root.render(<QuestionCard question={question} onAnswered={onAnswered} />)
  })
  await actAsync(async () => {
    await sleep(20)
  })
  return root
}

export async function runUiCompatCheck() {
  const out = []
  const push = (step, got, detail) => out.push({ step, got: !!got, detail })

  /* ── ① 舊 seed 形狀：字串 options ────────────────────── */
  const c1 = document.createElement('div')
  document.body.appendChild(c1)
  let answered1 = null
  let renderError1 = null
  try {
    await mount(
      c1,
      {
        id: 'compat-old',
        type: 'mc',
        question: '9 × 8 等於幾多？（舊 seed 形狀）',
        options: ['69', '690'],
        answer: '69',
        acceptedAnswers: ['69'],
        difficulty: 'basic',
        explanationSteps: [],
        methods: [],
      },
      (r) => {
        answered1 = r
      },
    )
  } catch (err) {
    renderError1 = err
  }
  push('舊 seed 形狀：字串 options 唔會令 React throw', !renderError1, renderError1 ? String(renderError1) : 'render 正常')

  const opts1 = Array.from(c1.querySelectorAll('button.option')).map((b) => b.textContent.trim())
  push(
    '舊 seed 形狀：出兩個掣、文字係 "69" / "690"',
    opts1.length === 2 && opts1[0] === '69' && opts1[1] === '690',
    '選項: ' + JSON.stringify(opts1),
  )

  await actAsync(async () => {
    click(optionByText(c1, '69'))
  })
  await actAsync(async () => {
    await sleep(20)
  })
  push(
    '舊 seed 形狀：撳「69」提交嘅值係 "69"（對得上 acceptedAnswers）',
    !!answered1 && answered1.input === '69' && answered1.correct === true,
    JSON.stringify(answered1),
  )
  push('舊 seed 形狀：撳「69」之後出「答啱咗」', textOf(c1).includes('答啱咗'), textOf(c1).slice(0, 40))

  /* ── ② 新形狀：{id,label} options ────────────────────── */
  const c2 = document.createElement('div')
  document.body.appendChild(c2)
  let answered2 = null
  let renderError2 = null
  try {
    await mount(
      c2,
      {
        id: 'compat-new',
        type: 'mc',
        question: '邊個方法快啲？（新形狀）',
        options: [
          { id: 'method-1', label: '方法一：分開乘' },
          { id: 'method-2', label: '方法二：先加埋' },
        ],
        answer: 'method-1',
        acceptedAnswers: ['method-1'],
        difficulty: 'basic',
        explanationSteps: [],
        methods: [],
      },
      (r) => {
        answered2 = r
      },
    )
  } catch (err) {
    renderError2 = err
  }
  push('新形狀：{id,label} options 唔會令 React throw（物件唔會被當 child）', !renderError2, renderError2 ? String(renderError2) : 'render 正常')

  const opts2 = Array.from(c2.querySelectorAll('button.option')).map((b) => b.textContent.trim())
  push(
    '新形狀：掣上顯示 label（唔係 raw id）',
    opts2.length === 2 && opts2[0] === '方法一：分開乘' && opts2[1] === '方法二：先加埋',
    '選項: ' + JSON.stringify(opts2),
  )
  push(
    '新形狀：raw id 冇直接當文字顯示',
    !opts2.includes('method-1') && !opts2.includes('method-2'),
    'raw id 冇滲出 ✓',
  )

  await actAsync(async () => {
    click(optionByText(c2, '方法一：分開乘'))
  })
  await actAsync(async () => {
    await sleep(20)
  })
  push(
    '新形狀：撳「方法一：分開乘」提交嘅值係 "method-1"',
    !!answered2 && answered2.input === 'method-1' && answered2.correct === true,
    JSON.stringify(answered2),
  )
  push('新形狀：撳啱之後出「答啱咗」', textOf(c2).includes('答啱咗'), textOf(c2).slice(0, 40))

  /* ── ③ answerDisplay：出答案顯示 label，唔漏 raw id ──── */
  const c3 = document.createElement('div')
  document.body.appendChild(c3)
  const q3 = {
    id: 'compat-display',
    type: 'mc',
    question: '邊個方法快啲？（answerDisplay）',
    answerKind: 'choice',
    answer: 'method-2',
    answerDisplay: '方法二：先加埋',
    acceptedAnswers: ['method-2'],
    options: [
      { id: 'method-1', label: '方法一：分開乘' },
      { id: 'method-2', label: '方法二：先加埋' },
    ],
    difficulty: 'basic',
    explanationSteps: [],
    methods: [],
  }
  const root3 = await mount(c3, q3, () => {})

  // 答錯三次（每次都撳錯嗰個「方法一」）→ 行到第三層出答案
  for (let i = 0; i < 3; i += 1) {
    await actAsync(async () => {
      click(optionByText(c3, '方法一：分開乘'))
    })
    await actAsync(async () => {
      await sleep(20)
    })
    if (i < 2) {
      // 第 1 次錯有 3 秒鎖，等「再試一次」出嚟先撳
      await waitFor(() => !!findButton('再試一次', c3), 8000)
      await actAsync(async () => {
        click(findButton('再試一次', c3))
      })
      await actAsync(async () => {
        await sleep(20)
      })
    }
  }

  const answerLine = c3.querySelector('.answer-line')
  const answerLineText = answerLine ? answerLine.textContent.replace(/\s+/g, ' ') : ''
  push(
    'answerDisplay：第三層出答案顯示 label（唔係 raw id）',
    answerLineText.includes('正確答案係') && answerLineText.includes('方法二：先加埋'),
    'answer-line = ' + answerLineText,
  )
  push(
    'answerDisplay：「正確答案係 …」嗰句冇出現 raw id "method-2"',
    !answerLineText.includes('method-2'),
    'answer-line = ' + answerLineText,
  )

  /* 清場 */
  await actAsync(async () => {
    root3.unmount()
  })
  c1.remove()
  c2.remove()
  c3.remove()

  return out
}
