import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LESSONS } from '../data/lessons.js'
import { getAttempts, getMistakes, subscribe } from '../lib/storage.js'
import { countDone } from '../lib/progress.js'
import ProgressCode from '../components/ProgressCode.jsx'

/* ════════════════════════════════════════════════════════════
   ① 課文櫃（首頁 /）
   · 每張卡：課本嘅名 + 頁碼 + 直接「開始練習」掣（唔使入兩層）
   · ❌ 唔寫「課題一／課題二」、冇進度百分比、冇完成度、冇等級、冇星
   · 卡面只寫事實：做過幾題、有幾題可以再試
   · 「今日做咩」大掣：一撳直接入練習庫
   ════════════════════════════════════════════════════════════ */

export default function ShelfPage() {
  const [rows, setRows] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    let alive = true
    async function load() {
      const data = await Promise.all(
        LESSONS.map(async (l) => {
          const attempts = await getAttempts(l.id)
          const retry = await getMistakes(l.id)
          return {
            id: l.id,
            // §1.5 C：未答完嘅題唔算「做過」（答錯一次就走甩 → 唔計）
            done: countDone(attempts),
            retry: retry.length,
          }
        }),
      )
      if (alive) setRows(data)
    }
    load()
    const unsubscribe = subscribe(load)
    return () => {
      alive = false
      unsubscribe()
    }
  }, [])

  // 「今日做咩」：揀做過最少嗰個課題（並列就揀細 id）
  const pick = (rows || []).slice().sort((a, b) => a.done - b.done || Number(a.id) - Number(b.id))[0]
  const targetId = pick ? pick.id : LESSONS[0].id

  const stat = (id) => {
    if (!rows) return null
    return rows.find((r) => r.id === id) || null
  }

  return (
    <div className="page">
      <h1 className="page-title">數學練習 · 小四</h1>
      <p className="page-sub">每日少少，攞上手就做。</p>

      <button
        type="button"
        className="btn btn-hero"
        onClick={() => navigate(`/lesson/${targetId}/practice`)}
      >
        <span className="hero-emoji">✏️</span>
        <span className="hero-text">
          今日做咩
          <small>一撳就開始練習</small>
        </span>
      </button>

      <h2 className="section-title">課文櫃</h2>

      {LESSONS.map((l) => {
        const s = stat(l.id)
        return (
          <section key={l.id} className="shelf-card">
            <div className="shelf-top">
              <h3 className="shelf-name">{l.name}</h3>
              <span className="shelf-pages">p{l.pages}</span>
            </div>
            <p className="shelf-sub">{l.subtitle}</p>
            <p className="shelf-fact">
              {s ? `做過 ${s.done} 題` : '做過 0 題'}
              {s && s.retry > 0 ? ` · 有 ${s.retry} 題可以再試` : ''}
            </p>
            <div className="shelf-actions">
              <button
                type="button"
                className="btn btn-primary btn-wide"
                onClick={() => navigate(`/lesson/${l.id}/practice`)}
              >
                開始練習
              </button>
              <Link className="btn btn-ghost" to={`/lesson/${l.id}`}>
                睇吓有咩
              </Link>
            </div>
          </section>
        )
      })}

      <ProgressCode />

      <div className="footer-links">
        <Link className="btn btn-ghost btn-small" to="/parent">
          家長報告
        </Link>
      </div>
    </div>
  )
}
