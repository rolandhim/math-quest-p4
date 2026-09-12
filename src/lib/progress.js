/* ════════════════════════════════════════════════════════════
   progress.js —— 「做過」點樣計（簡報 §1.5 C 第二條防線）

   之前：attempts 入面出現過嘅 questionId 就當「做過」。
   問題：一個小朋友答錯第 1 次，就即刻用瀏覽器手勢走甩 →
         storage 已經寫咗一次錯，卡面就會當佢「做過 1 題」。
         §1.5 C 明確唔准：「未答完嘅題目進度唔會當『做過』」。

   而家：只有「真正完成」嘅一次作答才算。
     · 答啱（correct === true），或者
     · 行到第 3 層（hintLevel >= 3，即係系統已經出咗正確答案）
   ════════════════════════════════════════════════════════════ */

/** 呢一次作答算唔算「完成咗嗰題」 */
export function isResolvedAttempt(a) {
  if (!a || typeof a !== 'object') return false
  if (a.correct === true) return true
  return Number(a.hintLevel) >= 3
}

/** 有幾多題真正做過（去重） */
export function countDone(attempts) {
  const done = new Set()
  const list = Array.isArray(attempts) ? attempts : []
  for (const a of list) {
    if (isResolvedAttempt(a)) done.add(String(a.questionId))
  }
  return done.size
}
