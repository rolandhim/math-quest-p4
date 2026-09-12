import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LESSONS, getQuestionById } from '../data/lessons.js'
import {
  changePin,
  exportAll,
  getAttempts,
  getMistakes,
  getReviewState,
  importAll,
  isValidPin,
  verifyPin,
} from '../lib/storage.js'

/* ════════════════════════════════════════════════════════════
   ⑥ 家長報告（/parent）
   · 入頁要 4 位 PIN（預設 1234；存 SHA-256 hash，唔存明文）
   · 撞 3 次 → 短暫 lockout
   · 顯示全部係事實：做過幾題、答對率
   · 邊類題型重複出錯 → 「可以留意」（唔係判定），標明「參考」
   · ❌ 唔顯示錯誤次數（「進位錯 20 次」對 9 歲係正常）
   · ❌ 唔准「落後」「要追」「未掌握」「唔小心」「大意」「粗心」
   · ✅ 用「需要重溫」／「下次檢查」
   ════════════════════════════════════════════════════════════ */

/** 內部 subcode → 家長睇得明嘅講法（只講趨勢，唔講次數） */
const SUBCODE_LABEL = {
  drop_zero: { name: '乘以整十數（補零）', check: '可以同佢一齊數吓「尾巴嘅 0」' },
  place_value: { name: '數嘅量級／位值', check: '計之前先估一估，睇量級合唔合理' },
  carry: { name: '直式進位', check: '直式入面進咗位嘅數，可以寫細細粒喺旁邊' },
  add_sub: { name: '加減步驟', check: '最後相加嗰一步，可以再對一次' },
  align: { name: '直式位數對齊', check: '寫直式時，個位同個位對齊' },
  copy: { name: '抄數字', check: '開始前先讀一次題目嘅數字' },
  skip: { name: '跳咗冇做', check: '留咗空白嘅題，可以下次再試' },
  method: { name: '方法選擇', check: '試吓用另一個方法（溫習卡有兩個方法）' },
  step: { name: '中途漏步', check: '習慣把中間步驟寫出嚟' },
}

export default function ParentPage() {
  const [unlocked, setUnlocked] = useState(false)
  const [pin, setPin] = useState('')
  const [gateMsg, setGateMsg] = useState('')
  const [lockLeft, setLockLeft] = useState(0)
  const [data, setData] = useState(null)
  const [backup, setBackup] = useState('')
  const [importMsg, setImportMsg] = useState('')
  const [newPin, setNewPin] = useState('')
  const [pinMsg, setPinMsg] = useState('')

  useEffect(() => {
    if (lockLeft <= 0) return undefined
    const id = setTimeout(() => setLockLeft((n) => Math.max(0, n - 1)), 1000)
    return () => clearTimeout(id)
  }, [lockLeft])

  useEffect(() => {
    let alive = true
    async function load() {
      const rows = []
      for (const l of LESSONS) {
        const attempts = await getAttempts(l.id)
        const retry = await getMistakes(l.id)
        const review = await getReviewState(l.id)
        rows.push({
          lesson: l,
          attempts,
          retry,
          reviewKnown: Object.values(review).filter((v) => v && v.known).length,
        })
      }
      if (alive) setData(rows)
    }
    if (unlocked) load()
    return () => {
      alive = false
    }
  }, [unlocked])

  const report = useMemo(() => {
    if (!data) return null
    return data.map((row) => {
      const doneIds = new Set(row.attempts.map((a) => a.questionId))
      const total = row.attempts.length
      const correct = row.attempts.filter((a) => a.correct).length
      const rate = total ? Math.round((correct / total) * 100) : null

      // 邊類題型重複出錯：同一個 subcode 出現喺 2 條或以上不同題目 → 可以留意
      const byCode = new Map()
      for (const a of row.attempts) {
        if (a.correct) continue
        for (const code of a.errorSubcodes || []) {
          if (!byCode.has(code)) byCode.set(code, new Set())
          byCode.get(code).add(a.questionId)
        }
      }
      const watch = Array.from(byCode.entries())
        .filter(([, set]) => set.size >= 2)
        .map(([code]) => SUBCODE_LABEL[code] || { name: code, check: '下次檢查' })

      const needsReview = row.retry.filter((r) => !r.correct)
      const needsHint = row.retry.filter((r) => r.needsHint)

      return { ...row, doneCount: doneIds.size, totalAttempts: total, rate, watch, needsReview, needsHint }
    })
  }, [data])

  async function tryUnlock() {
    const res = await verifyPin(pin)
    if (res.ok) {
      setUnlocked(true)
      setGateMsg('')
      setPin('')
      return
    }
    if (res.locked) {
      setLockLeft(Math.ceil(res.remainMs / 1000))
      setGateMsg('試咗幾次，休息一分鐘再入。')
      return
    }
    setGateMsg(`PIN 唔啱，可以再試 ${res.remainTries} 次。`)
    setPin('')
  }

  async function doExport() {
    const json = await exportAll()
    setBackup(json)
    try {
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `math-quest-p4-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      /* 下載唔到都冇所謂，下面有得複製 */
    }
  }

  async function doImport() {
    const res = await importAll(backup)
    setImportMsg(res.ok ? `匯入完成（${res.imported} 項）。` : `匯入唔成功：${res.reason}`)
    if (res.ok) setData(null)
  }

  async function doChangePin() {
    if (!isValidPin(newPin)) {
      setPinMsg('PIN 要 4 位數字。')
      return
    }
    const res = await changePin(newPin)
    setPinMsg(res.ok ? '改好咗。' : `改唔到：${res.reason}`)
    setNewPin('')
  }

  /* ── PIN 閘 ───────────────────────────────── */
  if (!unlocked) {
    return (
      <div className="page">
        <h1 className="page-title">家長報告</h1>
        <p className="page-sub">要 4 位 PIN 先入得。（預設 1234）</p>
        <div className="pin-box">
          <input
            className="big-input pin-input"
            type="password"
            inputMode="numeric"
            maxLength={4}
            autoComplete="off"
            value={pin}
            disabled={lockLeft > 0}
            onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && pin.length === 4) tryUnlock()
            }}
            placeholder="••••"
            aria-label="家長 PIN"
          />
          <button
            type="button"
            className="btn btn-primary btn-wide"
            disabled={pin.length !== 4 || lockLeft > 0}
            onClick={tryUnlock}
          >
            入去睇
          </button>
        </div>
        {lockLeft > 0 && <p className="tier-lock">仲要等 {lockLeft} 秒。</p>}
        {gateMsg && <p className="facts">{gateMsg}</p>}
        <div className="footer-links">
          <Link className="btn btn-ghost btn-small" to="/">
            返課文櫃
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <h1 className="page-title">家長報告</h1>
      <p className="page-sub">全部係做過嘅事實。評語部分係參考，唔係判定。</p>

      {!report && <p className="empty">睇緊…</p>}

      {report &&
        report.map((row) => (
          <section key={row.lesson.id} className="parent-card">
            <h2 className="shelf-name">
              {row.lesson.name} <small className="facts">p{row.lesson.pages}</small>
            </h2>
            <ul className="parent-facts">
              <li>做過 {row.doneCount} 題（累計作答 {row.totalAttempts} 次）</li>
              <li>
                答對率：{row.rate === null ? '仲未有紀錄' : `${row.rate}%`}
              </li>
              <li>睇過重點卡 {row.reviewKnown} 張</li>
              <li>
                需要重溫：{row.needsReview.length} 題
                {row.needsHint.length > 0 ? `（其中 ${row.needsHint.length} 題要用提示先啱）` : ''}
              </li>
            </ul>

            <h3 className="parent-sub">可以留意</h3>
            {row.watch.length === 0 ? (
              <p className="facts">暫時未見到重複出現嘅模式。</p>
            ) : (
              <ul className="parent-watch">
                {row.watch.map((w) => (
                  <li key={w.name}>
                    <strong>{w.name}</strong>
                    <span className="facts"> · 下次檢查：{w.check}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="parent-note">以上係參考，唔係判定。小朋友嘅步伐唔同，係正常嘅。</p>
          </section>
        ))}

      <section className="parent-card">
        <h2 className="shelf-name">備份</h2>
        <p className="facts">資料只存喺呢部機嘅瀏覽器。換機或者清瀏覽器之前，記得備份。</p>
        <button type="button" className="btn btn-soft btn-wide" onClick={doExport}>
          匯出備份
        </button>
        <textarea
          className="backup-area"
          value={backup}
          onChange={(e) => setBackup(e.target.value)}
          placeholder="備份內容會喺呢度；要還原就貼上備份 JSON 再撳匯入。"
          rows={5}
        />
        <button type="button" className="btn btn-ghost btn-wide" onClick={doImport}>
          匯入備份
        </button>
        {importMsg && <p className="facts">{importMsg}</p>}
      </section>

      <section className="parent-card">
        <h2 className="shelf-name">改 PIN</h2>
        <input
          className="big-input pin-input"
          type="password"
          inputMode="numeric"
          maxLength={4}
          autoComplete="off"
          value={newPin}
          onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="新 4 位 PIN"
          aria-label="新 PIN"
        />
        <button
          type="button"
          className="btn btn-ghost btn-wide"
          disabled={newPin.length !== 4}
          onClick={doChangePin}
        >
          儲存新 PIN
        </button>
        {pinMsg && <p className="facts">{pinMsg}</p>}
      </section>

      <div className="footer-links">
        <Link className="btn btn-ghost btn-small" to="/">
          返課文櫃
        </Link>
      </div>
    </div>
  )
}
