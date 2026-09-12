/* ════════════════════════════════════════════════════════════
   mq4 — storage.js
   localStorage adapter（全部 function 都係 async，回傳 Promise）

   點解要 async：日後換 Firebase／雲端只要改呢一個檔，頁面唔使郁。
   點解要 try/catch：private 模式／瀏覽器封鎖 storage 會 throw。
                   出錯唔可以 crash app，會靜靜地跌落 in-memory。
   為何唔會斷：所有讀寫都經 rawGet / rawSet / rawRemove 三個閘口。

   P0 補充（dev_panel 7 位審查）：
     · 每條 record 帶 schemaVersion
     · exportAll() / importAll() 做備份還原
     · 開 app 時 navigator.storage.persist()（try/catch，唔支援就跳過）
     · BroadcastChannel 跨 tab 同步（防兩個 tab 互相覆蓋）
     · recordAttempt 記 hintLevel（0–3，即用咗幾多層提示）
     · 家長 PIN 唔准 plaintext：SHA-256（Web Crypto，冇就用純 JS 實作）
     · PIN 撞 3 次 → 短暫 lockout
   ════════════════════════════════════════════════════════════ */

import { classify } from './classify.js'

const PREFIX = 'mq4:'

/** 資料格式版本（每條 record 都會帶） */
export const SCHEMA_VERSION = 1

/** 家長頁預設 PIN */
export const DEFAULT_PIN = '1234'

/** PIN 連續錯幾多次就鎖 */
export const PIN_MAX_FAILS = 3

/** 鎖幾耐（毫秒）——「短暫 lockout」 */
export const PIN_LOCKOUT_MS = 60 * 1000

/** localStorage 唔可用時嘅 fallback（今次 session 有效） */
const memory = new Map()

/** null = 未試過；true = 用得；false = 唔用得 */
let storageOk = null

/* ── 低層讀寫閘口 ─────────────────────────────────────── */

function getStore() {
  if (storageOk === false) return null
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      storageOk = false
      return null
    }
    if (storageOk === null) {
      const probe = PREFIX + '__probe__'
      window.localStorage.setItem(probe, '1')
      window.localStorage.removeItem(probe)
      storageOk = true
    }
    return window.localStorage
  } catch (err) {
    // private mode / quota / 被政策封鎖
    storageOk = false
    return null
  }
}

function rawGet(key) {
  const k = PREFIX + key
  try {
    const store = getStore()
    if (store) return store.getItem(k)
  } catch (err) {
    storageOk = false
  }
  return memory.has(k) ? memory.get(k) : null
}

function rawSet(key, value) {
  const k = PREFIX + key
  let persisted = false
  try {
    const store = getStore()
    if (store) {
      store.setItem(k, value)
      persisted = true
    }
  } catch (err) {
    storageOk = false
  }
  // 無論寫唔寫得入 localStorage，都留一份喺 memory，
  // 令同一個 session 內嘅 UI 行為一致（唔會一時有一時冇）。
  memory.set(k, value)
  broadcast(key)
  return persisted
}

function rawRemove(key) {
  const k = PREFIX + key
  try {
    const store = getStore()
    if (store) store.removeItem(k)
  } catch (err) {
    storageOk = false
  }
  memory.delete(k)
  broadcast(key)
  return true
}

function readJSON(key, fallback) {
  try {
    const s = rawGet(key)
    if (s === null || s === undefined) return fallback
    const v = JSON.parse(s)
    if (v === null || v === undefined) return fallback
    return v
  } catch (err) {
    // 壞 JSON → 當冇，唔好拋出去
    return fallback
  }
}

function writeJSON(key, value) {
  try {
    return rawSet(key, JSON.stringify(value))
  } catch (err) {
    return false
  }
}

/* ── 跨 tab 同步（BroadcastChannel）───────────────────── */

const CHANNEL_NAME = 'mq4:sync'
let channel = null
const listeners = new Set()

function getChannel() {
  if (channel) return channel
  try {
    if (typeof BroadcastChannel === 'undefined') return null
    channel = new BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = () => {
      // 另一個 tab 改咗資料 → 通知訂閱者重新讀
      listeners.forEach((fn) => {
        try {
          fn()
        } catch (err) {
          /* 一個訂閱者爆唔應該影響其他 */
        }
      })
    }
  } catch (err) {
    channel = null
  }
  return channel
}

function broadcast(key) {
  try {
    const ch = getChannel()
    if (ch) ch.postMessage({ type: 'write', key, ts: Date.now() })
  } catch (err) {
    /* 冇 BroadcastChannel 就靜靜跳過 */
  }
}

/** 訂閱跨 tab 變動；回傳 unsubscribe */
export function subscribe(fn) {
  if (typeof fn !== 'function') return () => {}
  getChannel()
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** 開 app 時叫：問瀏覽器盡量保住資料（唔支援就跳過） */
export async function requestPersistence() {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.persist) {
      return { supported: false, persisted: false }
    }
    const already = navigator.storage.persisted ? await navigator.storage.persisted() : false
    if (already) return { supported: true, persisted: true }
    const persisted = await navigator.storage.persist()
    return { supported: true, persisted: !!persisted }
  } catch (err) {
    return { supported: false, persisted: false }
  }
}

/* ── SHA-256（PIN 唔准 plaintext 存）───────────────────── */

const K256 = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]

function rotr(x, n) {
  return (x >>> n) | (x << (32 - n))
}

function utf8Bytes(str) {
  const out = []
  for (let i = 0; i < str.length; i += 1) {
    const c = str.codePointAt(i)
    if (c > 0xffff) i += 1
    if (c < 0x80) out.push(c)
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63))
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
    else {
      out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
    }
  }
  return out
}

/**
 * 純 JS SHA-256 → hex。唔靠 crypto.subtle，所以喺 http（非 secure context）
 * 嘅地區網絡都一樣計得出一致結果。同 Web Crypto 嘅 SHA-256 結果相同。
 */
export function sha256Hex(message) {
  const bytes = utf8Bytes(String(message))
  const len = bytes.length
  bytes.push(0x80)
  while (bytes.length % 64 !== 56) bytes.push(0)
  const bits = len * 8
  const hi = Math.floor(bits / 4294967296)
  const lo = bits >>> 0
  bytes.push((hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff)
  bytes.push((lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff)

  let h0 = 0x6a09e667
  let h1 = 0xbb67ae85
  let h2 = 0x3c6ef372
  let h3 = 0xa54ff53a
  let h4 = 0x510e527f
  let h5 = 0x9b05688c
  let h6 = 0x1f83d9ab
  let h7 = 0x5be0cd19

  const w = new Array(64)
  for (let i = 0; i < bytes.length; i += 64) {
    for (let t = 0; t < 16; t += 1) {
      w[t] =
        (bytes[i + t * 4] << 24) |
        (bytes[i + t * 4 + 1] << 16) |
        (bytes[i + t * 4 + 2] << 8) |
        bytes[i + t * 4 + 3]
    }
    for (let t = 16; t < 64; t += 1) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3)
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10)
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0
    }
    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4
    let f = h5
    let g = h6
    let h = h7
    for (let t = 0; t < 64; t += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (h + S1 + ch + K256[t] + w[t]) | 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (S0 + maj) | 0
      h = g
      g = f
      f = e
      e = (d + temp1) | 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) | 0
    }
    h0 = (h0 + a) | 0
    h1 = (h1 + b) | 0
    h2 = (h2 + c) | 0
    h3 = (h3 + d) | 0
    h4 = (h4 + e) | 0
    h5 = (h5 + f) | 0
    h6 = (h6 + g) | 0
    h7 = (h7 + h) | 0
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((x) => (x >>> 0).toString(16).padStart(8, '0'))
    .join('')
}

const PIN_SALT = 'mq4:pin:'

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.substr(i * 2, 2), 16)
  return out
}

function bytesToHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** PIN → hash（有 Web Crypto 就用，冇就純 JS；兩者結果一致） */
export async function hashPin(pin) {
  const text = PIN_SALT + String(pin === null || pin === undefined ? '' : pin)
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
      return bytesToHex(buf)
    }
  } catch (err) {
    /* 跌落純 JS */
  }
  return sha256Hex(text)
}

/** 驗證（測試用） */
export function hashPinPure(pin) {
  return sha256Hex(PIN_SALT + String(pin === null || pin === undefined ? '' : pin))
}

/** '1234' 可唔可以當 PIN（4 位數字） */
export function isValidPin(pin) {
  return /^[0-9]{4}$/.test(String(pin || ''))
}

/* ── Profile ─────────────────────────────────────────── */

export async function loadProfile() {
  try {
    const p = readJSON('profile', null)
    if (!p || typeof p !== 'object' || Array.isArray(p)) {
      return { nickname: '', createdAt: null, schemaVersion: SCHEMA_VERSION }
    }
    return {
      nickname: typeof p.nickname === 'string' ? p.nickname : '',
      createdAt: p.createdAt || null,
      schemaVersion: p.schemaVersion || SCHEMA_VERSION,
    }
  } catch (err) {
    return { nickname: '', createdAt: null, schemaVersion: SCHEMA_VERSION }
  }
}

export async function saveProfile(p) {
  try {
    const prev = readJSON('profile', {}) || {}
    const next = {
      schemaVersion: SCHEMA_VERSION,
      nickname: String((p && p.nickname) || ''),
      createdAt: (p && p.createdAt) || prev.createdAt || new Date().toISOString(),
    }
    writeJSON('profile', next)
    return next
  } catch (err) {
    return { nickname: '', createdAt: null, schemaVersion: SCHEMA_VERSION }
  }
}

/* ── Attempts（每次作答紀錄）──────────────────────────── */

/**
 * @param {{lessonId:string, questionId:string, input:string, correct:boolean,
 *          attemptNo:number, hintLevel?:number, ts?:string, errorSubcodes?:string[]}} a
 */
export async function recordAttempt(a) {
  try {
    const attempt = {
      schemaVersion: SCHEMA_VERSION,
      lessonId: String((a && a.lessonId) || ''),
      questionId: String((a && a.questionId) || ''),
      input: String((a && a.input) ?? ''),
      correct: !!(a && a.correct),
      attemptNo: Number(a && a.attemptNo) || 1,
      hintLevel: Math.max(0, Math.min(3, Number(a && a.hintLevel) || 0)),
      ts: (a && a.ts) || new Date().toISOString(),
      errorSubcodes: Array.isArray(a && a.errorSubcodes) ? a.errorSubcodes.slice() : [],
    }
    const key = 'attempts:' + attempt.lessonId
    const list = readJSON(key, [])
    const next = Array.isArray(list) ? list.concat([attempt]) : [attempt]
    writeJSON(key, next)

    // 有新一次作答 → 之前「清空咗」嘅標記唔再適用，
    // 俾佢重新自然判斷（再錯就會重新出現喺再試清單）。
    const cleared = readJSON('cleared', [])
    if (Array.isArray(cleared) && cleared.indexOf(attempt.questionId) !== -1) {
      writeJSON('cleared', cleared.filter((id) => id !== attempt.questionId))
    }
    return attempt
  } catch (err) {
    return null
  }
}

/**
 * 一次作答：寫入紀錄，並順手做 classify。
 * 分類只入 storage，小朋友介面完全唔顯示。
 */
export async function logAnswer({ lessonId, question, input, correct, attemptNo, hintLevel }) {
  let subcodes = []
  try {
    if (!correct && question) {
      subcodes = classify({ question, input, answer: question.answer }).subcodes
    }
  } catch (err) {
    subcodes = []
  }
  return recordAttempt({
    lessonId: lessonId || (question && question.lesson),
    questionId: question && question.id,
    input,
    correct,
    attemptNo,
    hintLevel,
    errorSubcodes: subcodes,
  })
}

export async function getAttempts(lessonId) {
  try {
    const list = readJSON('attempts:' + String(lessonId), [])
    return Array.isArray(list) ? list : []
  } catch (err) {
    return []
  }
}

/**
 * 「再試一次」清單（唔叫錯題簿）
 *   · 最後一次係錯 → 入清單
 *   · 最後一次答啱但係要第 3 層提示先得 → 都入清單，標明 needsHint
 *   · 之後重做答啱（唔使第 3 層提示）→ 即刻移走
 * 最多 20 題，新到舊。
 */
export async function getMistakes(lessonId) {
  try {
    const attempts = await getAttempts(lessonId)
    const cleared = readJSON('cleared', [])
    const clearedSet = new Set(Array.isArray(cleared) ? cleared : [])

    const latest = new Map()
    for (const a of attempts) {
      const prev = latest.get(a.questionId)
      if (!prev || String(a.ts) >= String(prev.ts)) latest.set(a.questionId, a)
    }

    return Array.from(latest.values())
      .filter(
        (a) =>
          !clearedSet.has(a.questionId) &&
          (!a.correct || (Number(a.hintLevel) >= 2 && Number(a.attemptNo) >= 3) || Number(a.hintLevel) >= 3),
      )
      .map((a) => ({
        questionId: a.questionId,
        lessonId: a.lessonId,
        input: a.input,
        correct: a.correct,
        hintLevel: Number(a.hintLevel) || 0,
        needsHint: !!a.correct,
        attemptNo: a.attemptNo,
        errorSubcodes: a.errorSubcodes || [],
        ts: a.ts,
      }))
      .sort((x, y) => String(y.ts).localeCompare(String(x.ts)))
      .slice(0, 20)
  } catch (err) {
    return []
  }
}

/** 由清單移走一題（qid 傳 '*' 就全部移走） */
export async function clearMistake(qid) {
  try {
    const id = String(qid)
    const cleared = readJSON('cleared', [])
    const set = new Set(Array.isArray(cleared) ? cleared : [])

    if (id === '*') {
      const keys = allKeysWithPrefix('attempts:')
      for (const key of keys) {
        const attempts = readJSON(key, [])
        if (Array.isArray(attempts)) {
          for (const a of attempts) if (!a.correct) set.add(a.questionId)
        }
      }
      writeJSON('cleared', Array.from(set))
      return true
    }

    set.add(id)
    writeJSON('cleared', Array.from(set))
    return true
  } catch (err) {
    return false
  }
}

/* ── Review state（溫習卡狀態）────────────────────────── */

export async function getReviewState(lessonId) {
  try {
    const s = readJSON('review:' + String(lessonId), {})
    if (!s || typeof s !== 'object' || Array.isArray(s)) return {}
    return s
  } catch (err) {
    return {}
  }
}

export async function saveReviewState(lessonId, s) {
  try {
    const next = s && typeof s === 'object' && !Array.isArray(s) ? s : {}
    writeJSON('review:' + String(lessonId), { schemaVersion: SCHEMA_VERSION, ...next })
    return true
  } catch (err) {
    return false
  }
}

/* ── Settings / PIN ──────────────────────────────────── */

function readSettings() {
  const s = readJSON('settings', {})
  if (!s || typeof s !== 'object' || Array.isArray(s)) return {}
  return s
}

/** @returns {{parentPin:string}} —— parentPin 係 SHA-256 hash，唔係明文 */
export async function getSettings() {
  try {
    const s = readSettings()
    const pin = s.parentPin ? String(s.parentPin) : ''
    return { parentPin: pin || hashPinPure(DEFAULT_PIN) }
  } catch (err) {
    return { parentPin: hashPinPure(DEFAULT_PIN) }
  }
}

/** 傳 { parentPin } —— 可以係明文（會自動 hash）或已 hash 嘅值 */
export async function saveSettings(s) {
  try {
    const raw = s && s.parentPin ? String(s.parentPin) : DEFAULT_PIN
    const hashed = /^[0-9a-f]{64}$/.test(raw) ? raw : await hashPin(raw === DEFAULT_PIN ? DEFAULT_PIN : raw)
    const prev = readSettings()
    const next = {
      schemaVersion: SCHEMA_VERSION,
      ...prev,
      parentPin: hashed,
    }
    writeJSON('settings', next)
    return { parentPin: next.parentPin }
  } catch (err) {
    return { parentPin: hashPinPure(DEFAULT_PIN) }
  }
}

/** 改 PIN（要 4 位數字） */
export async function changePin(newPin) {
  try {
    if (!isValidPin(newPin)) return { ok: false, reason: 'PIN 要 4 位數字' }
    const hashed = await hashPin(String(newPin))
    const prev = readSettings()
    writeJSON('settings', {
      schemaVersion: SCHEMA_VERSION,
      ...prev,
      parentPin: hashed,
      pinFail: { count: 0, lockedUntil: 0 },
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: '寫唔入' }
  }
}

/**
 * 驗 PIN（連 lockout 處理）
 * @returns {{ok:boolean, locked:boolean, lockedUntil:number, remainMs:number,
 *            failCount:number, remainTries:number}}
 */
export async function verifyPin(pin) {
  try {
    const s = readSettings()
    const now = Date.now()
    const fail = s.pinFail && typeof s.pinFail === 'object' ? s.pinFail : { count: 0, lockedUntil: 0 }
    const lockedUntil = Number(fail.lockedUntil) || 0

    if (lockedUntil > now) {
      return {
        ok: false,
        locked: true,
        lockedUntil,
        remainMs: lockedUntil - now,
        failCount: Number(fail.count) || 0,
        remainTries: 0,
      }
    }

    const stored = s.parentPin ? String(s.parentPin) : hashPinPure(DEFAULT_PIN)
    const attempt = await hashPin(String(pin === null || pin === undefined ? '' : pin))

    if (attempt === stored) {
      writeJSON('settings', { schemaVersion: SCHEMA_VERSION, ...s, pinFail: { count: 0, lockedUntil: 0 } })
      return { ok: true, locked: false, lockedUntil: 0, remainMs: 0, failCount: 0, remainTries: PIN_MAX_FAILS }
    }

    const count = (Number(fail.count) || 0) + 1
    if (count >= PIN_MAX_FAILS) {
      const until = now + PIN_LOCKOUT_MS
      writeJSON('settings', { schemaVersion: SCHEMA_VERSION, ...s, pinFail: { count: 0, lockedUntil: until } })
      return { ok: false, locked: true, lockedUntil: until, remainMs: PIN_LOCKOUT_MS, failCount: count, remainTries: 0 }
    }

    writeJSON('settings', { schemaVersion: SCHEMA_VERSION, ...s, pinFail: { count, lockedUntil: 0 } })
    return {
      ok: false,
      locked: false,
      lockedUntil: 0,
      remainMs: 0,
      failCount: count,
      remainTries: PIN_MAX_FAILS - count,
    }
  } catch (err) {
    return { ok: false, locked: false, lockedUntil: 0, remainMs: 0, failCount: 0, remainTries: 1 }
  }
}

/* ── 備份：exportAll / importAll ─────────────────────── */

function allKeysWithPrefix(prefix) {
  const keys = new Set()
  try {
    const store = getStore()
    if (store) {
      for (let i = 0; i < store.length; i += 1) {
        const k = store.key(i)
        if (k && k.startsWith(PREFIX)) {
          const short = k.slice(PREFIX.length)
          if (short.startsWith(prefix)) keys.add(short)
        }
      }
    }
  } catch (err) {
    storageOk = false
  }
  for (const k of memory.keys()) {
    const short = k.startsWith(PREFIX) ? k.slice(PREFIX.length) : k
    if (short.startsWith(prefix)) keys.add(short)
  }
  return Array.from(keys)
}

function allKeys() {
  const keys = new Set()
  try {
    const store = getStore()
    if (store) {
      for (let i = 0; i < store.length; i += 1) {
        const k = store.key(i)
        if (k && k.startsWith(PREFIX) && !k.includes('__probe__')) keys.add(k.slice(PREFIX.length))
      }
    }
  } catch (err) {
    storageOk = false
  }
  for (const k of memory.keys()) {
    const short = k.startsWith(PREFIX) ? k.slice(PREFIX.length) : k
    if (short !== '__probe__') keys.add(short)
  }
  return Array.from(keys)
}

/** 匯出成一個 JSON 字串（家長可以自己收埋） */
export async function exportAll() {
  try {
    const data = {}
    for (const key of allKeys()) data[key] = readJSON(key, null)
    return JSON.stringify(
      {
        app: 'math-quest-p4',
        schemaVersion: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        data,
      },
      null,
      2,
    )
  } catch (err) {
    return JSON.stringify({ app: 'math-quest-p4', schemaVersion: SCHEMA_VERSION, error: '匯出失敗', data: {} })
  }
}

/** 合併 logic：作答紀錄會 merge（唔會刪），設定／溫習狀態只補缺失 */
export async function importAll(jsonString) {
  try {
    if (typeof jsonString !== 'string' || jsonString.trim() === '') {
      return { ok: false, reason: '冇內容', imported: 0 }
    }
    let parsed
    try {
      parsed = JSON.parse(jsonString)
    } catch (err) {
      return { ok: false, reason: 'JSON 格式唔啱', imported: 0 }
    }
    if (!parsed || typeof parsed !== 'object' || !parsed.data || typeof parsed.data !== 'object') {
      return { ok: false, reason: '唔似係本 app 嘅備份檔', imported: 0 }
    }
    if (Number(parsed.schemaVersion) > SCHEMA_VERSION) {
      return { ok: false, reason: '備份版本太新', imported: 0 }
    }

    let imported = 0
    for (const [key, value] of Object.entries(parsed.data)) {
      if (typeof key !== 'string' || key.includes('__probe__')) continue

      if (key.startsWith('attempts:')) {
        const current = readJSON(key, [])
        const incoming = Array.isArray(value) ? value : []
        const seen = new Set(
          (Array.isArray(current) ? current : []).map((a) => `${a.questionId}|${a.ts}|${a.attemptNo}`),
        )
        const merged = (Array.isArray(current) ? current : []).slice()
        for (const a of incoming) {
          const sig = `${a.questionId}|${a.ts}|${a.attemptNo}`
          if (!seen.has(sig)) {
            seen.add(sig)
            merged.push({ schemaVersion: SCHEMA_VERSION, ...a })
          }
        }
        writeJSON(key, merged)
        imported += 1
        continue
      }

      if (key === 'profile') {
        const current = readJSON('profile', {}) || {}
        const incoming = value && typeof value === 'object' ? value : {}
        writeJSON('profile', {
          schemaVersion: SCHEMA_VERSION,
          nickname: incoming.nickname || current.nickname || '',
          createdAt: current.createdAt || incoming.createdAt || new Date().toISOString(),
        })
        imported += 1
        continue
      }

      // settings / review / cleared：只補缺失，唔覆蓋現有（防舊備份蓋返個 PIN）
      const current = readJSON(key, null)
      if (current === null || current === undefined) {
        writeJSON(key, value)
        imported += 1
      }
    }
    return { ok: true, imported, schemaVersion: Number(parsed.schemaVersion) || 1 }
  } catch (err) {
    return { ok: false, reason: '匯入出錯', imported: 0 }
  }
}
