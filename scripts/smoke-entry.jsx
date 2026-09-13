import React from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import App from '../src/App.jsx'
import { getMistakes, logAnswer, clearMistake, recordAttempt, exportAll, importAll, SCHEMA_VERSION } from '../src/lib/storage.js'
import { QUESTIONS } from '../src/data/lessons.js'

/* ════════════════════════════════════════════════════════════
   smoke-entry.jsx —— 由 scripts/smoke.mjs 用 esbuild 打包之後跑
   1. 逐條 route 真係 render 一次（捉 runtime 爆／import 錯）
   2. storage 生命週期（記錄 → 再試清單 → 重做啱即走 → 備份還原）
   ════════════════════════════════════════════════════════════ */

export async function runRenderCheck() {
  // redirect: 舊 path 而家係 <Navigate replace> 落 /retry —— 只 render 個殼（SSR 唔跑 effect），
  //           所以要斷言佢「冇 render 到再試一次版頁」，而唔係斷言佢 render 到內容。
  const routes = [
    { path: '/', render: true },
    { path: '/lesson/1', render: true },
    { path: '/lesson/2', render: true },
    { path: '/lesson/1/review', render: true },
    { path: '/lesson/2/review', render: true },
    { path: '/lesson/1/practice', render: true },
    { path: '/lesson/2/practice', render: true },
    { path: '/lesson/1/retry', render: true },
    { path: '/lesson/2/retry', render: true },
    { path: '/lesson/2/mistakes', redirect: true },
    { path: '/parent', render: true },
    { path: '/亂咁打嘅路徑', render: true },
  ]
  const out = []
  for (const route of routes) {
    const { path } = route
    try {
      const html = renderToString(
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>,
      )
      const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      const ok = route.redirect ? html.length > 0 && !plain.includes('🔄 再試一次') : html.length > 80
      out.push({ path, ok, bytes: html.length, sample: plain.slice(0, 60) })
    } catch (err) {
      out.push({ path, ok: false, error: `${err.name}: ${err.message}` })
    }
  }
  return out
}

export async function runStorageCheck() {
  const steps = []
  const q = QUESTIONS.find((x) => x.id === 'N2-adv-003') // 70×34 → 2380
  const lessonId = q.lesson

  // ① 答錯一次 → 入再試清單
  await logAnswer({ lessonId, question: q, input: '530', correct: false, attemptNo: 1, hintLevel: 0 })
  let list = await getMistakes(lessonId)
  steps.push({
    step: '答錯 530 → 再試清單',
    got: list.length === 1 && list[0].questionId === q.id,
    detail: `清單長度=${list.length}, needsHint=${list[0] ? list[0].needsHint : '-'}`,
  })

  // ② 重做答啱（新一次作答，attemptNo 1）→ 即刻移走
  await logAnswer({ lessonId, question: q, input: '2380', correct: true, attemptNo: 1, hintLevel: 0 })
  list = await getMistakes(lessonId)
  steps.push({ step: '重做答啱 → 即刻移走', got: list.length === 0, detail: `清單長度=${list.length}` })

  // ③ 要用提示先答啱（第 3 次、hintLevel 2）→ 留喺清單但標明
  const q2 = QUESTIONS.find((x) => x.id === 'N2-adv-004')
  await recordAttempt({ lessonId, questionId: q2.id, input: '700', correct: false, attemptNo: 2, hintLevel: 2, errorSubcodes: ['carry'] })
  list = await getMistakes(lessonId)
  steps.push({ step: '第 2 次仲錯 → 喺清單', got: list.length === 1, detail: `清單長度=${list.length}` })

  await recordAttempt({ lessonId, questionId: q2.id, input: '782', correct: true, attemptNo: 3, hintLevel: 2, needsHint: true })
  list = await getMistakes(lessonId)
  steps.push({
    step: '要用提示先啱 → 留喺清單並標明',
    got: list.length === 1 && list[0].needsHint === true,
    detail: `清單長度=${list.length}, needsHint=${list[0] ? list[0].needsHint : '-'}`,
  })

  // ④ 重做答啱（唔使提示）→ 移走
  await recordAttempt({ lessonId, questionId: q2.id, input: '782', correct: true, attemptNo: 1, hintLevel: 0 })
  list = await getMistakes(lessonId)
  steps.push({ step: '再重做答啱 → 移走', got: list.length === 0, detail: `清單長度=${list.length}` })

  // ⑤ clearMistake 之後唔會再出現，但再答錯會重新出現
  await recordAttempt({ lessonId, questionId: q.id, input: '238', correct: false, attemptNo: 1, hintLevel: 0 })
  await clearMistake(q.id)
  const afterClear = (await getMistakes(lessonId)).length
  await recordAttempt({ lessonId, questionId: q.id, input: '2380', correct: true, attemptNo: 2, hintLevel: 0 })
  await recordAttempt({ lessonId, questionId: q.id, input: '238', correct: false, attemptNo: 1, hintLevel: 0 })
  const afterRedo = (await getMistakes(lessonId)).length
  steps.push({
    step: 'clearMistake 後再答錯 → 重新出現',
    got: afterClear === 0 && afterRedo === 1,
    detail: `清空後=${afterClear}, 再答錯後=${afterRedo}`,
  })

  // ⑥ 備份 export → import 還原
  const json = await exportAll()
  const parsed = JSON.parse(json)
  const imp = await importAll(json)
  const impBad = await importAll('{ 唔係 JSON')
  steps.push({
    step: 'exportAll / importAll',
    got: parsed.schemaVersion === SCHEMA_VERSION && parsed.data && imp.ok === true && impBad.ok === false,
    detail: `匯出 keys=${Object.keys(parsed.data).length}, importAll ok=${imp.ok}, 壞 JSON ok=${impBad.ok}(${impBad.reason})`,
  })

  return steps
}
