/* ════════════════════════════════════════════════════════════
   mq4 — grading.js
   打字題評分：純白名單比對，唔用 AI、唔用外部 API、零密鑰。

   Layer 1 正規化（順序跟簡報 §6，唔准調亂）
     1. 去所有空格（半形 + 全形 U+3000）
     2. 全形數字 → 半形（７８２ → 782）
     3. 去千分位逗號（1,234 → 1234）
     4. 去尾隨 .0（782.0 → 782）
     5. 去前後空白
   Layer 2 比對：正規化後同 acceptedAnswers 逐個字串完全相等。

   ❌ 唔做：AI 判等價、中文數字（「七百八十二」）、「大約」範圍
   ════════════════════════════════════════════════════════════ */

/** 全形字元 → 半形（只處理 0-9、逗號、句點） */
function toHalfWidth(s) {
  return s
    .replace(/[\uFF10-\uFF19]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\uFF0C/g, ',')
    .replace(/\uFF0E/g, '.')
}

/**
 * 正規化使用者輸入（同答案）。
 * @param {string|number} input
 * @returns {string}
 */
export function normalize(input) {
  if (input === null || input === undefined) return ''
  let s = String(input)

  // 1. 去所有空格（半形 + 全形 U+3000）
  s = s.replace(/[ \u3000]/g, '')

  // 2. 全形數字 → 半形（平板好易打到全形）
  s = toHalfWidth(s)

  // 3. 去千分位逗號
  s = s.replace(/,/g, '')

  // 4. 去尾隨 .0（782.0 → 782；7.10 唔會動）
  s = s.replace(/\.0+$/, '')

  // 5. 去前後空白
  s = s.trim()

  return s
}

/**
 * 比對：正規化後字串完全相等。
 * @param {string|number} input 學生打嘅
 * @param {Array<string|number>} acceptedAnswers 白名單
 * @returns {boolean}
 */
export function isCorrect(input, acceptedAnswers) {
  const got = normalize(input)
  if (got === '') return false
  const list = Array.isArray(acceptedAnswers) ? acceptedAnswers : []
  return list.some((a) => normalize(a) === got)
}
