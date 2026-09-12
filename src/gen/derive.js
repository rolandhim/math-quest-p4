/* ════════════════════════════════════════════════════════
   mq4 — derive.js
   課題 1 兩款「choice」題型（fastest / which-property）嘅正解推導。

   鐵律：正解 100% 由 operands／結構程式推導，絕對唔准手寫。
   呢度係「單一真源」——模板 generate 用佢嚟砌 correctIndex，
   verify.js 用佢嚟交叉驗證（兩邊用同一個純函式，冇得各說各話）。

   全部純函式、無副作用、無 rng。
   ════════════════════════════════════════════════════════ */

/**
 * 乘「因數 a」嘅成本（分開乘要乘 a 兩次）：
 *   - a ≤ 9     → 1：乘數表入面，直接背得出
 *   - a ≥ 10    → 2：兩位數，要拆位／直式
 */
export function multByA(a) {
  return a <= 9 ? 1 : 2
}

/**
 * 乘「和 b+c」嘅成本（先加埋要乘 sum 一次）：
 *   - sum 係整十       → 1：補個零就乘完，幾乎免費
 *   - sum 係 5 嘅倍數   → 2：×35 = ×7 再 ×5，幾順
 *   - 其他兩位數        → 3：要拆成「乘十位 + 乘個位」，最貴
 */
export function multBySum(sum) {
  if (sum % 10 === 0) return 1
  if (sum % 5 === 0) return 2
  return 3
}

/**
 * fastest：由 operands=[a,b,c]（算式 a×b + a×c）推導最快方法。
 *
 *   方法一「分開乘」：a×b 同 a×c 各乘一次（乘 a 兩次）＋ 加一次
 *     cost1 = 2 × multByA(a) + 1
 *   方法二「先加埋」：b+c 加一次 ＋ a×(b+c) 乘一次（乘 sum）
 *     cost2 = multBySum(b+c) + 1
 *
 *   最快 = 成本較細；平手 → method-2（乘少一次，概念上更簡潔）。
 *
 *   實際效果（成本為整數時）：
 *     - a ≤ 9 且 b+c 非整十  → 方法一（兩個乘數表 vs 一個拆位大乘，分開乘着數）
 *     - b+c 係整十，或 a ≥ 10 → 方法二（合埋乘少一次）
 *   兩個方法都會出現（唔會永遠 method-2）。
 */
export function deriveFastestMethod(o) {
  const [a, b, c] = o
  const sum = b + c
  const cost1 = 2 * multByA(a) + 1
  const cost2 = multBySum(sum) + 1
  return cost1 < cost2 ? 'method-1' : 'method-2'
}

/** 兩個方法嘅成本（畀驗證腳本確認「正解真係運算較少」） */
export function fastestCosts(o) {
  const [a, b, c] = o
  const sum = b + c
  return { method1: 2 * multByA(a) + 1, method2: multBySum(sum) + 1 }
}

/**
 * which-property：由題目形式（operation 結構）程式判定用邊個性質。
 *   - 'a*b*c'   連乘（可重整 pair）→ 'associative'（結合性質）
 *   - 'a*(b+c)' 乘加／共同因數     → 'distributive'（分配性質）
 */
export function deriveProperty(q) {
  switch (q.operation) {
    case 'a*b*c':
      return 'associative'
    case 'a*(b+c)':
      return 'distributive'
    default:
      throw new Error(`derive: 未知 property 形式「${q.operation}」`)
  }
}

/* ════════════════════════════════════════════════════════════
   課題 2（乘法的運算）兩款「choice」題型嘅正解推導：
     - fastest-order：三數連乘，揀邊個「先乘 pair」最快（成本準則）。
     - find-error-vertical：直式乘法，邊一步開始錯（陷阱值由 operands 重算）。
   全部純函式，正解／陷阱值 100% 由 operands 程式重推，唔准手寫。
   ════════════════════════════════════════════════════════════ */

/** 一個正整數嘅「尾零」個數（整十／整百…嘅「圓整度」）。 */
function trailingZeros(n) {
  let c = 0
  let x = n
  while (x > 0 && x % 10 === 0) {
    x /= 10
    c += 1
  }
  return c
}

/**
 * fastest-order：由 operands=[a,b,c] 推導最快次序（choice id）。
 *
 *   成本準則（自己定義，可解釋畀小朋友聽）：
 *   「先乘嗰一對」若果出到整十／整百（尾零多），第二步乘就幾乎免費
 *   （補零／乘一個圓整嘅數），所以快。
 *
 *   呢款題嘅 operands 由模板保證：a 係「魔數」之一（同另一個魔數相乘出整十），
 *   所以 (a×b) 同 (a×c) 兩個 pair 之中，啱啱有一個係整十、另一個唔係。
 *   正解 = 尾零較多嗰個 pair 先乘；平手（理論上唔會，因構造保證）→ 細者先。
 *
 *   回傳 'order-ab'（先 a×b 再 ×c）或 'order-ac'（先 a×c 再 ×b）。
 */
export function deriveFastestOrder(o) {
  const [a, b, c] = o.map(Number)
  const zab = trailingZeros(a * b)
  const zac = trailingZeros(a * c)
  if (zab !== zac) return zab > zac ? 'order-ab' : 'order-ac'
  return a * b <= a * c ? 'order-ab' : 'order-ac'
}

/**
 * find-error-vertical：直式乘法（a 兩位 × b 兩位）嘅錯誤資訊。
 * @param {number[]} o operands=[a, b]（a、b 都係兩位數，b 嘅個位非 0）
 * @param {string} kind 'miss-carry'（進位錯）| 'miss-shift'（漏補位）| 'miss-add'（漏加）
 * @returns {{ step:string, wrong:number, correct:number, s1:number, s2:number, s3:number }}
 *   step = 邊一步開始錯（'step-1' | 'step-2' | 'step-3'）
 *   wrong / correct = 嗰一步嘅錯值 / 正確值（供獨立重算確認「真錯」）
 *   s1 / s2 / s3 = 渲染用嘅三個步驟值（後續步驟會連鎖錯落去）
 */
export function findErrorVertical(o, kind) {
  const a = Number(o[0])
  const b = Number(o[1])
  const tb = Math.floor(b / 10)
  const ob = b % 10
  const oa = a % 10
  const p1 = a * ob // 步驟一（個位乘）正確值
  const p2 = a * tb // 步驟二（十位乘，未補位）
  const p2s = p2 * 10 // 補位後（正確）
  const total = a * b // 步驟三（相加）正確值
  const c0 = Math.floor((oa * ob) / 10) // 個位乘嗰步要進嘅位

  switch (kind) {
    case 'miss-carry': {
      const wrongP1 = p1 - c0 * 10 // 漏咗加返進位
      // ① 顯示假等式（刻意錯嗰步）；② 拆成「未補位積 + 補位後」兩段真等式；③ 真等式
      return {
        step: 'step-1', wrong: wrongP1, correct: p1, s1: wrongP1, s2: p2s, s3: wrongP1 + p2s,
        s2Text: `${a}×${tb}=${p2}，補位後=${p2s}`,
        s3Text: `相加 ${wrongP1}+${p2s}=${wrongP1 + p2s}`,
      }
    }
    case 'miss-shift': {
      // 十位乘嗰步漏咗「補一個 0」（位值錯）：② 只寫未補位積（唔准寫「補位」二字）
      return {
        step: 'step-2', wrong: p2, correct: p2s, s1: p1, s2: p2, s3: p1 + p2,
        s2Text: `${a}×${tb}=${p2}`,
        s3Text: `相加 ${p1}+${p2}=${p1 + p2}`,
      }
    }
    case 'miss-add': {
      // 相加嗰步漏咗加返十位乘嘅部分積：③ 改用描述句（唔係假加法式）
      return {
        step: 'step-3', wrong: p1, correct: total, s1: p1, s2: p2s, s3: p1,
        s2Text: `${a}×${tb}=${p2}，補位後=${p2s}`,
        s3Text: `相加：佢只寫咗 ${p1}，冇加到 ${p2s}`,
      }
    }
    default:
      throw new Error('derive: 未知直式錯誤 kind ' + kind)
  }
}

/**
 * find-error-vertical 嘅正解（choice id）推導 + 陷阱值交叉核對。
 * 回傳 step id；若 q.shownError.wrongValue 同重算唔一致就 throw（陷阱必須真錯）。
 */
export function deriveFindErrorStep(q) {
  const info = findErrorVertical(q.operands.map(Number), q.errorKind)
  if (q.shownError && String(q.shownError.wrongValue) !== String(info.wrong)) {
    throw new Error(`derive: find-error-vertical 陷阱值 ${q.shownError.wrongValue} ≠ 重算 ${info.wrong}`)
  }
  return info.step
}
