/* ════════════════════════════════════════════════════════════
   mq4 — rng.js
   mulberry32 自己寫（十幾行），零外部依賴。
   Node 同 browser 都 import 同一個檔（純 JS，冇任何 DOM / Node API）。

   ❌ 全個檔唔准出現 Math.random()
     （Math.floor / Math.imul 係確定性運算，允許。）
   ════════════════════════════════════════════════════════════ */

/**
 * mulberry32 —— 32-bit 種子 PRNG。
 * @param {number} seed
 * @returns {() => number} next() → [0, 1)
 */
export function mulberry32(seed) {
  let a = seed >>> 0
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * makeRng(seed) → next() → [0, 1)
 * 就係 mulberry32 嘅別名；條 task 指定呢個名做主要入口。
 * @param {number} seed
 * @returns {() => number}
 */
export function makeRng(seed) {
  return mulberry32(seed)
}

/**
 * [lo, hi] 閉區間整數。
 * @param {() => number} rng
 * @param {number} lo
 * @param {number} hi
 */
export function randInt(rng, lo, hi) {
  if (hi < lo) throw new Error(`randInt: hi(${hi}) < lo(${lo})`)
  return lo + Math.floor(rng() * (hi - lo + 1))
}

/**
 * 隨機揀一個元素。
 * @param {() => number} rng
 * @param {any[]} arr
 */
export function pick(rng, arr) {
  if (!Array.isArray(arr) || arr.length === 0) throw new Error('pick: arr 空')
  return arr[randInt(rng, 0, arr.length - 1)]
}

/**
 * Fisher–Yates 原地洗牌（回傳新陣列，唔郁原陣列）。
 * @param {() => number} rng
 * @param {any[]} arr
 */
export function shuffle(rng, arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
