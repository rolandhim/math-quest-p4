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
