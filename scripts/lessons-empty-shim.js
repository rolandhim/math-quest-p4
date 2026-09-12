/* ════════════════════════════════════════════════════════════
   lessons-empty-shim.js —— 只係 check:abc 用嘅測試替身（唔係 app 一部份）

   由 scripts/check-abc.mjs 個 esbuild plugin 喺打包嗰陣換入嚟，
   只影響 `.smoke/check-abc.bundle.mjs`。正式 build / verify / smoke /
   interact 完全唔會用到，src/data/lessons.js 一個字都冇改。

   點解要咁做：要驗「課題 0 題」嘅死鎖風險，就一定要有一個
   getLesson(id) 有課題、但 getQuestionsByLesson(id) 返 0 題嘅情況。
   呢個替身只係喺原裝 module 上面加一個 id = '__empty__' 嘅空課題，
   其餘（真實課題、真實題目、答案重算）全部原封不動轉出去。
   ════════════════════════════════════════════════════════════ */

import * as real from '../src/data/lessons.js'

export const BOOK = real.BOOK
export const LESSONS = real.LESSONS
export const QUESTIONS = real.QUESTIONS
export const computeAnswer = real.computeAnswer
export const getQuestionById = real.getQuestionById

export const EMPTY_LESSON_ID = '__empty__'

const EMPTY_LESSON = {
  id: EMPTY_LESSON_ID,
  unit: '1',
  name: '（測試）未有題目嘅課題',
  subtitle: '',
  pages: '',
  methods: [],
  summary: '',
  cards: [],
}

export function getLesson(id) {
  if (String(id) === EMPTY_LESSON_ID) return EMPTY_LESSON
  return real.getLesson(id)
}

export function getQuestionsByLesson(lessonId) {
  if (String(lessonId) === EMPTY_LESSON_ID) return []
  return real.getQuestionsByLesson(lessonId)
}
