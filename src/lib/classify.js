/* ════════════════════════════════════════════════════════════
   mq4 — classify.js
   錯誤分類（內部記錄用，唔准顯示畀小朋友）

   subcode：drop_zero / align / carry / add_sub / copy
            skip / place_value / method / step

   一個錯可以屬多個 subcode，所以回傳陣列。
   ════════════════════════════════════════════════════════════ */

import { normalize } from './grading.js'
import { computeAnswer } from '../data/lessons.js'

/**
 * 數字字元多重集（判斷抄錯／數字調位）
 */
function digitBag(s) {
  return s.split('').sort().join('')
}

function stripTrailingZeros(s) {
  return s.replace(/0+$/, '')
}

/** 兩個值相差 10/100/0.1/0.01 倍？ */
function powerOfTenAway(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0 || b === 0) return false
  const r = Math.abs(a / b)
  for (const p of [10, 100, 1000, 0.1, 0.01, 0.001]) {
    if (Math.abs(r - p) < 1e-9) return true
  }
  return false
}

/** 由 question 嘅 operation + operands 算出所有部分積（用嚟捉「跳步／方法錯」） */
function partialProducts(question) {
  const out = []
  try {
    if (!question || !Array.isArray(question.operands) || !question.operation) return out
    const op = String(question.operation)
    const ops = question.operands.map(Number)
    if (op.indexOf('*') === -1) return out

    // a*b / a*b*c 呢類純連乘：所有兩兩組合
    // a*b+c*d / a*b-c*d / a*b+c*d+e*f：每組兩個一齊乘
    let pairs = []
    if (op.indexOf('+') === -1 && op.indexOf('-') === -1) {
      const nums = ops.slice()
      pairs = []
      for (let i = 0; i < nums.length; i += 1) {
        for (let j = i + 1; j < nums.length; j += 1) pairs.push([nums[i], nums[j]])
      }
      if (nums.length >= 2) pairs.push([nums[0], nums.slice(1).reduce((x, y) => x * y, 1)])
    } else {
      const groups = op.split(/[+-]/)
      let idx = 0
      for (const g of groups) {
        const cnt = (g.match(/[a-f]/g) || []).length || 0
        const take = ops.slice(idx + 0, idx + cnt)
        idx += cnt
        if (take.length >= 2) pairs.push(take)
      }
    }

    for (const p of pairs) {
      const v = p.reduce((x, y) => x * y, 1)
      if (Number.isFinite(v)) out.push(v)
    }
    // 展開式中「同一個乘數 × 括號入面其中一個加數」
    if (question.operation.indexOf('*(') !== -1 && ops.length === 3) {
      out.push(ops[0] * ops[1], ops[0] * ops[2], ops[1] + ops[2])
    }
  } catch (err) {
    return out
  }
  return out
}

/**
 * @param {{question?:object, input:string|number, answer:string|number}} p
 * @returns {{subcodes: string[]}}
 */
export function classify({ question, input, answer } = {}) {
  const subcodes = new Set()
  const raw = String(input === null || input === undefined ? '' : input)
  const got = normalize(raw)
  const want = normalize(answer)

  // 空答案 → 跳過咗冇做
  if (got === '') {
    subcodes.add('skip')
    return { subcodes: Array.from(subcodes) }
  }

  const gotNum = Number(got)
  const wantNum = Number(want)
  const numeric = Number.isFinite(gotNum) && Number.isFinite(wantNum)

  // 答案啱就唔算錯
  if (numeric && gotNum === wantNum) return { subcodes: [] }

  if (!numeric) {
    if (want && got.indexOf(want) !== -1) subcodes.add('copy')
    subcodes.add('method')
    return { subcodes: Array.from(subcodes) }
  }

  // ① copy：數字一樣但次序／位置唔同（抄錯）
  if (want.length === got.length && digitBag(got) === digitBag(want) && got !== want) {
    subcodes.add('copy')
  }

  // ② drop_zero：量級差 10 倍，或者答案嘅尾隨 0 唔見咗
  if (powerOfTenAway(gotNum, wantNum)) {
    subcodes.add('drop_zero')
  } else if (
    /0/.test(want) &&
    stripTrailingZeros(got) === stripTrailingZeros(want) &&
    got.length !== want.length
  ) {
    subcodes.add('drop_zero')
  }

  // ③ place_value：量級明顯唔對（例如 530 vs 2380）
  const ratio = wantNum === 0 ? 1 : gotNum / wantNum
  let magnitudeWrong = false
  if (wantNum !== 0 && (ratio <= 0 || Math.abs(Math.log10(Math.abs(ratio))) > 0.4)) {
    subcodes.add('place_value')
    magnitudeWrong = true
  }

  // ④ 同量級：位數 / 進位 / 加減
  if (!magnitudeWrong) {
    const diff = gotNum - wantNum
    if (got.length !== want.length) {
      subcodes.add('align')
    } else if (diff !== 0 && diff % 10 === 0) {
      subcodes.add('carry')
    } else {
      subcodes.add('add_sub')
    }
  }

  // ⑤ 用題目嘅結構捉「跳步 / 方法錯」
  if (question) {
    const partials = partialProducts(question)
    let positive = false
    try {
      if (question.operation) positive = computeAnswer(question.operation, question.operands) === wantNum
    } catch (err) {
      positive = false
    }
    for (const v of partials) {
      if (Math.abs(gotNum) !== 0 && Math.abs(gotNum) === Math.abs(v)) {
        subcodes.add('step')
        subcodes.add('method')
        break
      }
    }
    // 明顯同題目類型有關嘅錯法
    const tags = Array.isArray(question.difficultyTags) ? question.difficultyTags : []
    if (subcodes.has('place_value') && tags.some((t) => t === 'zero-padding' || t === 'estimate-first')) {
      subcodes.add('drop_zero')
    }
    if (subcodes.has('add_sub') && tags.indexOf('carry') !== -1) subcodes.add('carry')
    if (!positive && subcodes.size === 0) subcodes.add('method')
  }

  // ⑥ 兜底：唔可以由空白落地（唔准 fall through 變 generic）
  if (subcodes.size === 0) {
    if (wantNum === 0) subcodes.add('method')
    else if (Math.abs(gotNum - wantNum) % 10 === 0) subcodes.add('carry')
    else subcodes.add('add_sub')
  }

  return { subcodes: Array.from(subcodes) }
}

export default classify
