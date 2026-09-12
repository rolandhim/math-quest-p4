import { useState } from 'react'
import { exportAll, importAll } from '../lib/storage.js'

/* ════════════════════════════════════════════════════════════
   進度碼（簡報 §1.5 B）—— 因為佢會用平板 ＋ 電腦兩部機

   localStorage 係一部機一份。所以：
     · 「📋 複製進度碼」→ 一撳就 copy 落 clipboard，碼入面帶日期
     · 「📥 輸入進度碼」→ 貼上即還原（成功／失敗都有清楚講法）

   格式：MQ4v1-2026-09-12-<base64（壓縮過嘅 JSON）>
         —— 唔係 6 位短碼（裝唔落），日期就寫喺碼頭，爸爸一眼睇到係咪最新
   仲收貨：直接貼返 exportAll() 出嘅原始 JSON 都得（穩陣啲）。

   ⚠️ BroadcastChannel 只係同一部機唔同 tab，唔算跨裝置方案 —— 所以要有呢個。
   ⚠️ 爛碼／空碼一律唔准 crash，要出返一句清楚嘅廣東話。
   ════════════════════════════════════════════════════════════ */

const CODE_PREFIX = 'MQ4v1-'

function toB64(str) {
  const bytes = new TextEncoder().encode(String(str))
  let bin = ''
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

function fromB64(b64) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

/** 今日日期 YYYY-MM-DD（本機時區，香港用就係香港日期） */
export function todayStr(d) {
  const t = d instanceof Date ? d : new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`
}

/** JSON → 進度碼（碼頭有日期） */
export function encodeCode(json, dateStr) {
  return CODE_PREFIX + (dateStr || todayStr()) + '-' + toB64(json)
}

/** 進度碼（或者原始 JSON）→ 備份 JSON 字串；解唔到就 { error } */
export function decodeCode(raw) {
  const text = String(raw === null || raw === undefined ? '' : raw).trim()
  if (text === '') return { error: '仲未貼進度碼。' }
  const squeezed = text.replace(/\s+/g, '')
  const m = squeezed.match(/^MQ4v1-\d{4}-\d{2}-\d{2}-(.+)$/)
  const body = m ? m[1] : squeezed
  try {
    const json = fromB64(body)
    JSON.parse(json) // 確認真係 JSON
    return { json, date: m ? squeezed.slice(CODE_PREFIX.length, CODE_PREFIX.length + 10) : null }
  } catch (err) {
    /* 唔係 base64 —— 可能佢直接貼咗原始 JSON，再試 */
  }
  try {
    JSON.parse(text)
    return { json: text, date: null }
  } catch (err) {
    return { error: '呢個碼睇唔明，睇吓有冇複製漏咗字。' }
  }
}

async function copyText(t) {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(t)
      return true
    }
  } catch (err) {
    /* 唔係 secure context 會 throw → 跌落下面 */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = t
    ta.setAttribute('readonly', 'readonly')
    ta.style.position = 'fixed'
    ta.style.top = '-1000px'
    document.body.appendChild(ta)
    ta.select()
    const ok = !!(document.execCommand && document.execCommand('copy'))
    document.body.removeChild(ta)
    return ok
  } catch (err) {
    return false
  }
}

export default function ProgressCode() {
  const [msg, setMsg] = useState(null) // { kind: 'ok'|'bad', text }
  const [code, setCode] = useState('') // 顯示出嚟嘅碼（copy 唔到都可以自己揀）
  const [open, setOpen] = useState(false) // 輸入進度碼嘅抽屜
  const [paste, setPaste] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleCopy() {
    setBusy(true)
    try {
      const json = await exportAll()
      const date = todayStr()
      const c = encodeCode(json, date)
      setCode(c)
      const copied = await copyText(c)
      setMsg(
        copied
          ? { kind: 'ok', text: `已經複製咗（${date} 儲存）` }
          : { kind: 'bad', text: '複製唔到，唔緊要 —— 下面個格可以自己揀住複製。' },
      )
    } catch (err) {
      setMsg({ kind: 'bad', text: '整唔到進度碼，遲啲再試。' })
    }
    setBusy(false)
  }

  async function handleImport() {
    setBusy(true)
    try {
      const decoded = decodeCode(paste)
      if (decoded.error) {
        setMsg({ kind: 'bad', text: decoded.error })
      } else {
        const res = await importAll(decoded.json)
        setMsg(
          res && res.ok
            ? { kind: 'ok', text: `已經還原咗（${res.imported} 份紀錄）${decoded.date ? ` · 碼係 ${decoded.date} 嘅` : ''}` }
            : { kind: 'bad', text: `還原唔到：${(res && res.reason) || '唔知咩事'}` },
        )
        if (res && res.ok) setPaste('')
      }
    } catch (err) {
      setMsg({ kind: 'bad', text: '還原出咗事，唔緊要，再試一次。' })
    }
    setBusy(false)
  }

  return (
    <section className="progress-code">
      <h2 className="section-title">換機用嘅進度碼</h2>
      <p className="facts">
        平板做嘅，想喺電腦都有：撳「複製進度碼」，去另一部機撳「輸入進度碼」貼上就得。
      </p>

      <button type="button" className="btn btn-primary btn-wide" disabled={busy} onClick={handleCopy}>
        📋 複製進度碼
      </button>

      <button
        type="button"
        className="btn btn-ghost btn-wide"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        📥 輸入進度碼
      </button>

      {code ? (
        <textarea className="code-area" readOnly value={code} aria-label="進度碼" onFocus={(e) => e.target.select()} />
      ) : null}

      {open ? (
        <div className="code-import">
          <textarea
            className="code-area"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder="喺呢度貼上進度碼"
            aria-label="貼上進度碼"
          />
          <button
            type="button"
            className="btn btn-primary btn-wide"
            disabled={busy}
            onClick={handleImport}
          >
            還原進度
          </button>
        </div>
      ) : null}

      {msg ? <p className={'code-msg ' + (msg.kind === 'ok' ? 'code-msg-ok' : 'code-msg-bad')}>{msg.text}</p> : null}
    </section>
  )
}
