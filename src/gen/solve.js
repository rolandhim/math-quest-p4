/* ════════════════════════════════════════════════════════════
   mq4 — solve.js
   「符號填空」唯一解驗證器（G48）。

   方程表示：每一邊係一串 monomial（單項式）。
     monomial = { c: number, syms: string[] }
       c     —— 常數係數
       syms  —— 符號 id 陣列（每個符號喺一個 monomial 至多出現一次）
     例如 3×20 → { c: 60, syms: [] }
          3×□   → { c: 3, syms: ['□'] }
          ■×★   → { c: 1, syms: ['■', '★'] }

   鐵律：除目標符號外，其他符號（自由符號）必須喺兩邊同角色、
   會約掉。所以對固定目標值 v，每邊都可以化簡成
       constPart + Σ (自由符號係數 × 自由符號值)
   而每個 monomial 至多有一個自由符號（本題型保證），
   令「有冇自由符號賦值」可以 O(1) 判斷，唔使窮舉 200^F。
   ════════════════════════════════════════════════════════════ */

export const SYMBOL_LO = 1
export const SYMBOL_HI = 200 // 符號域 = 1..200 正整數，排除 0

/**
 * 代入 env（符號 → 數值）後計出呢一邊嘅數值。
 * @param {Array<{c:number, syms:string[]}>} side
 * @param {Record<string, number>} env
 */
export function evalSide(side, env) {
  let sum = 0
  for (const m of side) {
    let v = m.c
    for (const s of m.syms) {
      if (!(s in env)) throw new Error('solve: 符號未賦值：' + s)
      v *= env[s]
    }
    sum += v
  }
  return sum
}

/** 收集一邊出現過嘅所有符號 id */
export function collectSymbols(side) {
  const set = new Set()
  for (const m of side) for (const s of m.syms) set.add(s)
  return Array.from(set)
}

/**
 * 固定目標值 targetValue 後，自由符號 freeSym 喺呢一邊嘅係數。
 * （用嚟檢查鐵律：自由符號喺兩邊嘅係數要一致，先會約掉。）
 */
export function coefficientOf(side, targetSym, targetValue, freeSym) {
  let coef = 0
  for (const m of side) {
    if (m.syms.indexOf(freeSym) === -1) continue
    let val = m.c
    let targetCount = 0
    for (const s of m.syms) {
      if (s === targetSym) targetCount += 1
      else if (s !== freeSym) throw new Error('solve: 未預期嘅符號：' + s)
    }
    coef += val * Math.pow(targetValue, targetCount)
  }
  return coef
}

/**
 * 固定目標值 v 之後，呢一邊化簡做 { constPart, freeCoef }。
 * freeCoef 係「唯一自由符號」嘅係數（每個 monomial 至多一個自由符號）。
 */
function reduce(side, targetSym, v) {
  let constPart = 0
  let freeCoef = 0
  let freeSym = null
  for (const m of side) {
    let val = m.c
    let f = null
    for (const s of m.syms) {
      if (s === targetSym) {
        val *= v
      } else {
        if (f !== null && f !== s) {
          throw new Error('solve: 一個 monomial 有多過一個自由符號，超出支援範圍')
        }
        f = s
      }
    }
    if (f === null) constPart += val
    else {
      freeSym = f
      freeCoef += val
    }
  }
  return { constPart, freeCoef, freeSym }
}

/**
 * 對固定目標值 v，判斷有冇自由符號賦值（1..200，排除 0）令兩邊相等。
 */
function existsAssignment(lhs, rhs, targetSym, v) {
  const L = reduce(lhs, targetSym, v)
  const R = reduce(rhs, targetSym, v)

  // 兩邊都要用同一個自由符號（鐵律）。若各用各嘅符號 → 結構錯誤。
  if (L.freeSym !== null && R.freeSym !== null && L.freeSym !== R.freeSym) {
    throw new Error('solve: 兩邊自由符號唔一致，違反鐵律')
  }

  // L.constPart + L.freeCoef·f = R.constPart + R.freeCoef·f
  // (L.freeCoef - R.freeCoef)·f = R.constPart - L.constPart
  const A = L.freeCoef - R.freeCoef
  const B = R.constPart - L.constPart
  if (A === 0) return B === 0 // 任何 f 都得（f=1 一定喺域內）
  if (B % A !== 0) return false
  const f = B / A
  return Number.isInteger(f) && f >= SYMBOL_LO && f <= SYMBOL_HI
}

/**
 * 窮舉目標符號所有候選值 v ∈ 1..200，收集令等式成立（存在自由賦值）嘅 v。
 * 回傳：
 *   - 恰一個可行 v → 嗰個 v（number）
 *   - 0 個或 >1 個 → null（呢條題唔准入題庫）
 * @param {Array} lhs 左邊 monomials
 * @param {Array} rhs 右邊 monomials
 * @param {string} targetSym 目標符號 id
 * @returns {number|null}
 */
export function uniqueTargetValue(lhs, rhs, targetSym, { lo = SYMBOL_LO, hi = SYMBOL_HI } = {}) {
  const feasible = []
  for (let v = lo; v <= hi; v += 1) {
    if (existsAssignment(lhs, rhs, targetSym, v)) feasible.push(v)
  }
  return feasible.length === 1 ? feasible[0] : null
}
