import React, { act as reactAct } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import App from '../src/App.jsx'
import QuestionCard from '../src/components/QuestionCard.jsx'
import {
  logAnswer,
  recordAttempt,
  getMistakes,
  getAttempts,
  buildSnapshot,
  SCHEMA_VERSION,
  getSnapshotSkippedCount,
} from '../src/lib/storage.js'
import { resolveQuestionForAttempt } from '../src/lib/resolveQuestion.js'
import manifest from '../src/data/bank/manifest.json'

/* ════════════════════════════════════════════════════════════
   check-retry-entry.jsx —— 由 scripts/check-retry.mjs 打包後跑。
   驗「再試一次」bug 修復（D1 + D2）嘅 7 個必要 cases：

     a  logAnswer 後 attempt 帶 snapshot（題目文字／答案／步驟）
     b  bank id + 有 snapshot → MistakesPage render 到 1 條
     c  bank id + 冇 snapshot → resolver 查到 → render + backfill
     d  完全搵唔到嘅 id → 顯示明確訊息（唔係空白）
     e  答啱 + needsHint:true → 出現喺清單並標明
     f  舊格式（v1／冇 schemaVersion）record 讀得返、唔 crash
     g  20 條大 snapshot → 總 JSON < 200KB（容量 guard）
     h  D2 wiring：真 QuestionCard 錯→錯→啱 → 計出 needsHint:true + logAnswer 入 storage

   亦支援 tamper：RETRY_INJECT_BAD=<case> 會故意反轉指定 case 嘅斷言，
   用嚟驗證呢條 gate 真係識 fail（exit != 0）。
   ════════════════════════════════════════════════════════════ */

const act = reactAct || ((fn) => fn())
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ── tamper：指定 case 反轉斷言（證明 gate 識 fail）── */
const tamper = process.env.RETRY_INJECT_BAD || null
if (tamper) {
  console.log(`⚠️  TAMPER 生效：RETRY_INJECT_BAD=${tamper} —— 指定 case「${tamper}」嘅斷言會被故意反轉，用嚟驗證呢條 gate 真係識 fail`)
}

const banks = import.meta.glob('../src/data/bank/lesson*.json')

async function loadBankQuestion(lid, id) {
  const entry = manifest.lessons[lid]
  if (!entry) return null
  const loader = banks['../src/data/bank/' + entry.file]
  if (!loader) return null
  const mod = await loader()
  const parsed = mod && mod.default ? mod.default : mod
  for (const topic of Object.values((parsed && parsed.byTopic) || {})) {
    for (const diff of Object.values(topic || {})) {
      for (const arr of Object.values(diff || {})) {
        for (const q of arr || []) if (q && q.id === id) return q
      }
    }
  }
  return null
}

async function actAsync(fn) {
  await act(async () => {
    await fn()
  })
}

/* 等鎖到期（第 1 次錯鎖 3 秒）：用多次短 act 推時間，唔好一次 sleep 3 秒
   （jsdom + React 18 之下，act() 裡一個長 sleep 只會推進一格 chained setTimeout）。 */
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

function resetStorage() {
  try {
    if (globalThis.localStorage) globalThis.localStorage.clear()
  } catch (err) {
    /* 唔理 */
  }
}

async function renderRetry(lessonId, waitMs = 180) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await actAsync(async () => {
    root.render(
      <MemoryRouter initialEntries={[`/lesson/${lessonId}/retry`]}>
        <App />
      </MemoryRouter>,
    )
  })
  await actAsync(async () => {
    await sleep(waitMs)
  })
  return { container, root }
}

async function unmount(root, container) {
  await actAsync(async () => {
    root.unmount()
  })
  container.remove()
}

export async function runRetryCheck() {
  const out = []
  const push = (caseId, step, got, detail) => {
    let finalGot = !!got
    if (tamper === caseId) {
      finalGot = !finalGot
      console.log(`   ↳ [TAMPER] 反轉 case「${caseId}」斷言：原本 ${!!got} → ${finalGot}（證明呢條分支真係行咗）`)
    }
    out.push({ step: `[${caseId}] ${step}`, got: finalGot, detail })
  }

  /* ── a. logAnswer 後 attempt 帶 snapshot ────────────── */
  resetStorage()
  {
    const q = await loadBankQuestion('1', 'l1-decompose-00000')
    const attempt = await logAnswer({ lessonId: '1', question: q, input: '40', correct: true, attemptNo: 1, hintLevel: 0, needsHint: false })
    const snap = attempt && attempt.snapshot
    const ok =
      !!q &&
      !!attempt &&
      attempt.schemaVersion === SCHEMA_VERSION &&
      !!snap &&
      typeof snap.question === 'string' &&
      snap.question.length > 0 &&
      typeof snap.answer === 'string' &&
      Array.isArray(snap.explanationSteps) &&
      snap.explanationSteps.length > 0
    push(
      'a',
      'logAnswer 後 attempt 帶 snapshot（題目文字／答案／步驟）',
      ok,
      snap
        ? `schema=${attempt.schemaVersion}, question=${snap.question.slice(0, 22)}…, answer=${snap.answer}, steps=${snap.explanationSteps.length}`
        : `schema=${attempt && attempt.schemaVersion}, snapshot=冇`,
    )
  }

  /* ── b. bank id + snapshot → render 到 1 條 ────────── */
  resetStorage()
  {
    await recordAttempt({
      lessonId: '1',
      questionId: 'l1-decompose-00000',
      input: '37',
      correct: false,
      attemptNo: 1,
      hintLevel: 0,
      needsHint: false,
      snapshot: {
        question: '37 × 4 = (□ − 3) × 4',
        answer: '40',
        answerDisplay: '40',
        explanationSteps: ['第一步：搵最接近嘅整十數', '第二步：驗算 40 − 3 = 37'],
      },
    })
    const { container, root } = await renderRetry('1', 180)
    const t = textOf(container)
    const ok =
      t.includes('37 × 4') &&
      t.includes('正確答案') &&
      t.includes('40') &&
      t.includes('第一步：搵最接近嘅整十數')
    push('b', 'bank id + 有 snapshot → render 到 1 條（題目／答案／步驟）', ok, t.slice(0, 100))
    await unmount(root, container)
  }

  /* ── c. bank id + 冇 snapshot → resolver 查到 + backfill ── */
  resetStorage()
  {
    await recordAttempt({ lessonId: '1', questionId: 'l1-decompose-00000', input: '37', correct: false, attemptNo: 1, hintLevel: 0, needsHint: false })
    const target = (await getAttempts('1')).find((a) => a.questionId === 'l1-decompose-00000')
    const r = await resolveQuestionForAttempt(target)
    const backfilled = (await getAttempts('1')).find((a) => a.questionId === 'l1-decompose-00000')
    const okBackfill = r.status === 'bank' && !!r.question && !!r.question.question && !!backfilled && !!backfilled.snapshot && !!backfilled.snapshot.question
    const { container, root } = await renderRetry('1', 300)
    const t = textOf(container)
    const ok = okBackfill && t.includes('37 × 4') && t.includes('40')
    push('c', 'bank id + 冇 snapshot → resolver 查到 → render + backfill', ok,
      `status=${r.status}, backfill=${backfilled ? (backfilled.snapshot ? '✓ 有 snapshot' : '✗ 冇') : '冇 record'} ｜ ${t.slice(0, 60)}`)
    await unmount(root, container)
  }

  /* ── d. 完全搵唔到嘅 id → 明確訊息 ───────────────── */
  resetStorage()
  {
    await recordAttempt({ lessonId: '1', questionId: 'l1-nonexistent-99999', input: '12', correct: false, attemptNo: 1, hintLevel: 0, needsHint: false })
    const { container, root } = await renderRetry('1', 300)
    const t = textOf(container)
    const ok = t.includes('呢條題目已經更新') && t.includes('移除') && !t.includes('正確答案')
    push('d', '搵唔到嘅 id → 顯示明確訊息（唔係空白）', ok, t.slice(0, 80))
    await unmount(root, container)
  }

  /* ── e. 答啱 + needsHint:true → 出現喺清單 ────────── */
  resetStorage()
  {
    await recordAttempt({
      lessonId: '2',
      questionId: 'l2-est-00000',
      input: '2380',
      correct: true,
      attemptNo: 3,
      hintLevel: 0,
      needsHint: true,
      snapshot: { question: '70 × 34 = ?', answer: '2380', answerDisplay: '2380', explanationSteps: ['70×30=2100', '70×4=280', '2100+280=2380'] },
    })
    const list = await getMistakes('2')
    const ok = list.length === 1 && list[0].questionId === 'l2-est-00000' && list[0].needsHint === true
    push('e', '答啱 + needsHint:true → 出現喺清單並標明', ok,
      `清單長度=${list.length}, needsHint=${list[0] ? list[0].needsHint : '-'}`)
  }

  /* ── f. 舊格式 record 讀得返、唔 crash ────────────── */
  resetStorage()
  {
    // 直接寫一條 v1 舊格式 record（冇 schemaVersion、冇 needsHint、冇 snapshot）
    globalThis.localStorage.setItem(
      'mq4:attempts:1',
      JSON.stringify([{ questionId: 'N1-adv-005', lessonId: '1', input: '10', correct: false, attemptNo: 1, hintLevel: 0, ts: '2026-09-10T00:00:00.000Z' }]),
    )
    const list = await getMistakes('1')
    const ok =
      list.length === 1 &&
      list[0].questionId === 'N1-adv-005' &&
      list[0].snapshot === null &&
      list[0].needsHint === false
    push('f', '舊格式（v1／冇 schemaVersion）record 讀得返、唔 crash', ok,
      `清單長度=${list.length}, needsHint=${list[0] ? list[0].needsHint : '-'}, snapshot=${list[0] ? list[0].snapshot : '-'}`)
  }

  /* ── g. 20 條大 snapshot → 總 JSON < 200KB ────────── */
  resetStorage()
  {
    const beforeCounter = getSnapshotSkippedCount()
    // (g1) 20 條正常大 snapshot（每條約 2KB，未過單條 10KB cap）
    const bigSnap = {
      question: '測試題目'.repeat(20),
      answer: '1234567890',
      answerDisplay: '1234567890',
      explanationSteps: Array.from({ length: 40 }, (_, i) => `步驟 ${i}: ` + 'x'.repeat(40)),
    }
    for (let i = 0; i < 20; i += 1) {
      await recordAttempt({
        lessonId: '2',
        questionId: `l2-big-${i}`,
        input: 'x',
        correct: false,
        attemptNo: 1,
        hintLevel: 0,
        needsHint: false,
        snapshot: { ...bigSnap },
      })
    }
    const attempts = await getAttempts('2')
    const totalBytes = JSON.stringify(attempts).length
    // (g2) 超大 snapshot（> 10KB）→ 唔存快照 + counter +1
    const huge = {
      id: 'l2-huge-00000',
      question: '題',
      answer: '1',
      explanationSteps: Array.from({ length: 600 }, (_, i) => `步驟 ${i}: ` + 'x'.repeat(40)),
    }
    const hugeSize = JSON.stringify(buildSnapshot(huge)).length
    await logAnswer({ lessonId: '2', question: huge, input: '1', correct: false, attemptNo: 1, hintLevel: 0, needsHint: false })
    const afterCounter = getSnapshotSkippedCount()
    const hugeAttempt = (await getAttempts('2')).find((a) => a.questionId === 'l2-huge-00000')
    const oversizeSkipped = !!hugeAttempt && !hugeAttempt.snapshot && hugeAttempt.snapshotSkipped === true
    const ok = totalBytes < 200 * 1024 && oversizeSkipped && afterCounter === beforeCounter + 1
    push('g', '20 條大 snapshot 總 JSON < 200KB + 超大 snapshot 被 skip（容量 guard）', ok,
      `單條大 snapshot=${(JSON.stringify(bigSnap).length / 1024).toFixed(1)}KB × 20 = ${(totalBytes / 1024).toFixed(1)}KB ｜ 超大=${(hugeSize / 1024).toFixed(1)}KB → skip=${oversizeSkipped}, counter ${beforeCounter}→${afterCounter}`)
  }

  /* ── h. D2 wiring：真 render QuestionCard 錯→錯→啱，needsHint 由元件計出 ── */
  resetStorage()
  {
    const q = await loadBankQuestion('1', 'l1-decompose-00000')
    let payload = null
    let lockedEarly = false
    let inList = false
    let rowNeedsHint = '-'
    let err = null
    try {
      const container = document.createElement('div')
      document.body.appendChild(container)
      const root = createRoot(container)
      const answered = []
      await actAsync(async () => {
        root.render(<QuestionCard question={q} onAnswered={(r) => answered.push(r)} />)
      })
      await actAsync(async () => { await sleep(20) })

      // 第 1 次答錯（30 ≠ 40）
      await actAsync(async () => { typeInto(container.querySelector('input.big-input'), '30') })
      await actAsync(async () => { findButton('提交', container).click() })
      await actAsync(async () => { await sleep(20) })

      // 鎖未提早解除：即刻應該鎖住、仲未有「再試一次」
      lockedEarly = container.querySelector('input.big-input').disabled === true && !findButton('再試一次', container)

      // 等鎖完（真 3 秒，逐個 act 邊界推）→ 撳「再試一次」
      await waitFor(() => !!findButton('再試一次', container), 8000)
      await actAsync(async () => { findButton('再試一次', container).click() })
      await actAsync(async () => { await sleep(20) })

      // 第 2 次答錯
      await actAsync(async () => { typeInto(container.querySelector('input.big-input'), '30') })
      await actAsync(async () => { findButton('提交', container).click() })
      await actAsync(async () => { await sleep(20) })
      await waitFor(() => !!findButton('再試一次', container), 8000)
      await actAsync(async () => { findButton('再試一次', container).click() })
      await actAsync(async () => { await sleep(20) })

      // 第 3 次答啱（40）
      await actAsync(async () => { typeInto(container.querySelector('input.big-input'), '40') })
      await actAsync(async () => { findButton('提交', container).click() })
      await actAsync(async () => { await sleep(20) })

      payload = answered.length ? answered[answered.length - 1] : null

      await actAsync(async () => { root.unmount() })
      container.remove()

      // 經 logAnswer 寫入 storage（照 PracticePage／ReviewPage 嘅接駁）
      if (payload) {
        await logAnswer({
          lessonId: '1',
          question: q,
          input: payload.input,
          correct: payload.correct,
          attemptNo: payload.attemptNo,
          hintLevel: payload.hintLevel,
          needsHint: !!payload.needsHint,
        })
        const list = await getMistakes('1')
        const row = list.find((m) => m.questionId === q.id)
        rowNeedsHint = row ? String(row.needsHint) : '-'
        inList = !!row && row.needsHint === true
      }
    } catch (e) {
      err = String((e && e.message) || e)
    }

    const payloadOk = !!payload && payload.correct === true && payload.attemptNo === 3 && payload.needsHint === true
    push('h', 'D2 wiring：真 QuestionCard 錯→錯→啱 計出 needsHint:true 並經 logAnswer 入 storage', !err && payloadOk && inList && lockedEarly,
      err
        ? 'throw: ' + err
        : `payload=${payload ? JSON.stringify({ correct: payload.correct, attemptNo: payload.attemptNo, needsHint: payload.needsHint }) : '（冇 onAnswered）'} ｜ 鎖未提早解除=${lockedEarly} ｜ getMistakes needsHint=${rowNeedsHint}`)
  }

  return out
}
