import React, { act as reactAct } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import App from '../src/App.jsx'
import QuestionCard from '../src/components/QuestionCard.jsx'
import { QUESTIONS } from '../src/data/lessons.js'

const act = reactAct || ((fn) => fn())

/* ════════════════════════════════════════════════════════════
   interact-entry.jsx —— 真正撳掣嘅測試（jsdom + React）
   由 scripts/interact.mjs 用 esbuild 打包之後跑。
   測嘅係 spec §5④ 三層遞進同「答完一定出正確步驟＋兩個方法」。
   ════════════════════════════════════════════════════════════ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function text() {
  return document.body.textContent.replace(/\s+/g, ' ')
}

function findButton(label) {
  return Array.from(document.querySelectorAll('button')).find((b) =>
    (b.textContent || '').includes(label),
  )
}

function click(el, label) {
  if (!el) {
    const seen = Array.from(document.querySelectorAll('button'))
      .map((b) => (b.textContent || '').trim())
      .filter(Boolean)
    throw new Error(
      '搵唔到要撳嘅掣：' +
        (label || '(冇傳 label，請補上)') +
        '\n  畫面上嘅掣：' +
        (seen.length ? seen.join(' ｜ ') : '（一個都冇）') +
        '\n  輸入框：' +
        (document.querySelector('input.big-input')
          ? `值=${document.querySelector('input.big-input').value} disabled=${document.querySelector('input.big-input').disabled}`
          : '（冇輸入框）') +
        '\n  文字：' +
        text().slice(0, 200),
    )
  }
  el.click()
}

function typeInto(input, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(input, value)
  input.dispatchEvent(new window.Event('input', { bubbles: true }))
}

async function actAsync(fn) {
  let result
  await act(async () => {
    result = await fn()
  })
  return result
}

/* 等一個條件成立 —— React 嘅 chained setTimeout 要靠 act 邊界 flush effect
   先會排下一個 tick，所以要用「多次短 act」推時間，唔可以一次 sleep 3 秒。 */
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

export async function runInteractive() {
  const results = []
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  // ── 1) 練習庫：答錯第 1 次（唔准講量級、鎖 3 秒）────
  const practiceQ = QUESTIONS.find((q) => q.id === 'N2-bas-001') // 16×20 = 320
  await actAsync(async () => {
    root.render(
      <MemoryRouter initialEntries={['/lesson/2/practice']}>
        <App />
      </MemoryRouter>,
    )
  })
  await actAsync(async () => {
    await sleep(30)
  })

  results.push({
    step: '練習庫第一題顯示出嚟',
    got: text().includes(practiceQ.question),
    detail: practiceQ.question,
  })

  const input = container.querySelector('input.big-input')
  await actAsync(async () => {
    typeInto(input, '32')
  })
  await actAsync(async () => {
    click(findButton('提交'), '提交')
  })
  await actAsync(async () => {
    await sleep(30)
  })

  const t1 = text()
  results.push({
    step: '第 1 次錯：原封不動顯示佢寫嘅答案 + 固定提示語',
    got: t1.includes('你寫咗「32」') && t1.includes('對一對題目嘅數字'),
    detail: t1.includes('你寫咗「32」') ? '「你寫咗「32」。對一對題目嘅數字…」' : t1.slice(0, 80),
  })
  results.push({
    step: '第 1 次錯：唔准講量級／唔准出答案（唔可以提 320／16×20）',
    got: !t1.includes('320') && !t1.includes('提示'),
    detail: t1.includes('320') ? '見到 320！' : '冇洩漏答案 ✓',
  })
  results.push({
    step: '第 1 次錯：輸入框鎖住，佢寫嘅答案原封不動留住',
    got:
      !!container.querySelector('input.big-input') &&
      container.querySelector('input.big-input').disabled === true &&
      container.querySelector('input.big-input').value === '32',
    detail: `值=${(container.querySelector('input.big-input') || {}).value} disabled=${(container.querySelector('input.big-input') || {}).disabled}`,
  })

  // 即刻檢查：鎖係真嘅（唔准即刻解鎖）
  const countdownNow = (text().match(/你可以 \d 秒後再試/) || [null])[0]
  results.push({
    step: '第 1 次錯即刻：未解鎖（見到倒數，唔係即刻出「再試一次」）',
    got: countdownNow === '你可以 3 秒後再試' && !findButton('再試一次'),
    detail: `倒數=${countdownNow} ｜ 即刻已有「再試一次」=${!!findButton('再試一次')}`,
  })

  // 等鎖完（真 3 秒，要逐個 act 邊界推時間）
  await waitFor(() => !!findButton('再試一次'), 8000)
  const lockedStill = container.querySelector('input.big-input')
  results.push({
    step: '3 秒後出「再試一次」（鎖係照 spec 3 秒，唔係即時）',
    got: !!findButton('再試一次') && !!lockedStill,
    detail:
      '再試一次掣=' +
      !!findButton('再試一次') +
      ' ｜ 倒數文字=' +
      (text().match(/你可以 \d 秒後再試/) || ['（冇倒數文字）'])[0] +
      ' ｜ 場面=' +
      text().slice(0, 120),
  })

  // ── 2) 第 2 次錯：出量級提示 ────────────────────────
  await actAsync(async () => {
    click(findButton('再試一次'), '再試一次')
  })
  await actAsync(async () => {
    typeInto(container.querySelector('input.big-input'), '160')
  })
  await actAsync(async () => {
    click(findButton('提交'), '提交')
  })
  await actAsync(async () => {
    await sleep(30)
  })
  const t2 = text()
  results.push({
    step: '第 2 次錯：出量級提示（由 question.estimate 拎）',
    got: t2.includes('16×2 = 32，補一個 0'),
    detail: t2.includes('16×2 = 32，補一個 0') ? '出到 estimate.note ✓' : t2.slice(0, 100),
  })

  // ── 3) 第 3 次錯：出答案 + 逐步拆解 + 撳「我明喇」──
  await actAsync(async () => {
    click(findButton('再試一次'), '再試一次')
  })
  await actAsync(async () => {
    typeInto(container.querySelector('input.big-input'), '1600')
  })
  await actAsync(async () => {
    click(findButton('提交'), '提交')
  })
  await actAsync(async () => {
    await sleep(30)
  })
  const t3 = text()
  results.push({
    step: '第 3 次錯：出正確答案',
    got: t3.includes('正確答案係') && t3.includes('320'),
    detail: t3.includes('正確答案係') ? '出咗正確答案 320 ✓' : t3.slice(0, 100),
  })
  results.push({
    step: '第 3 次錯：出逐步拆解',
    got: t3.includes('逐步睇一次') && t3.includes('16×10 = 160'),
    detail: '逐步拆解 + 方法 ✓',
  })
  results.push({
    step: '第 3 次錯：有「我明喇」掣',
    got: !!findButton('我明喇'),
    detail: '「我明喇」=' + !!findButton('我明喇'),
  })
  results.push({
    step: '每題都顯示兩個方法 +「兩條路，邊條快？」',
    got: t3.includes('兩條路，邊條快？') && t3.includes('方法一：補零法') && t3.includes('方法二：拆成兩個十'),
    detail: '兩個方法都出咗 ✓',
  })

  // ── 4) 答啱嘅路：mc 揀正確選項 ─────────────────────
  const mcQ = QUESTIONS.find((q) => q.id === 'N2-adv-003') // 70×34 → 2380 (mc)
  const container2 = document.createElement('div')
  document.body.appendChild(container2)
  const root2 = createRoot(container2)
  await actAsync(async () => {
    root2.render(<QuestionCard question={mcQ} onAnswered={() => {}} />)
  })
  await actAsync(async () => {
    await sleep(20)
  })
  const optionTexts = Array.from(container2.querySelectorAll('button.option')).map((b) => b.textContent)
  results.push({
    step: 'mc 題出 4 個大掣（含 530 同 2380）',
    got: optionTexts.length === 4 && optionTexts.includes('2380') && optionTexts.includes('530'),
    detail: '選項: ' + optionTexts.join(' / '),
  })

  await actAsync(async () => {
    click(
      Array.from(container2.querySelectorAll('button.option')).find((b) => b.textContent === '2380'),
      'mc 選項 2380',
    )
  })
  await actAsync(async () => {
    await sleep(20)
  })
  const okText = container2.textContent.replace(/\s+/g, ' ')
  results.push({
    step: '答啱：出「答啱咗！」＋正確步驟＋兩個方法',
    got: okText.includes('答啱咗') && okText.includes('逐步睇一次') && okText.includes('兩條路，邊條快？'),
    detail: okText.slice(0, 70),
  })

  // ── 5) 舊 path /lesson/:id/mistakes 要轉向去 /retry ────
  const container3 = document.createElement('div')
  document.body.appendChild(container3)
  const root3 = createRoot(container3)
  await actAsync(async () => {
    root3.render(
      <MemoryRouter initialEntries={['/lesson/2/mistakes']}>
        <App />
      </MemoryRouter>,
    )
  })
  await actAsync(async () => {
    await sleep(30)
  })
  const redirectText = container3.textContent.replace(/\s+/g, ' ')
  results.push({
    step: '舊 path /lesson/2/mistakes 轉向去 /lesson/2/retry',
    got: redirectText.includes('🔄 再試一次'),
    detail: '轉向後場面=' + redirectText.slice(0, 80),
  })
  await actAsync(async () => {
    root3.unmount()
  })
  container3.remove()

  await actAsync(async () => {
    root.unmount()
    root2.unmount()
  })
  container.remove()
  container2.remove()

  return results
}
