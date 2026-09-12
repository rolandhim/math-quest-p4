import { useState } from 'react'

/* ════════════════════════════════════════════════════════════
   MethodPicker —— 「兩條路，邊條快？」
   獨立可重用元件：方法文字一律由 data 入面嘅 question.methods 拎，
   頁面唔准 hardcode 方法文字，亦唔好每頁抄一次。

   question.methods 格式（至少 2 個）：
     [{ id: 'N1-bas-001-m1', label: '方法一：正向展開', steps: ['...', '...'] }]

   冇「對／錯」判定 —— 兩條路都得，只係問佢自己覺得邊條順手。
   ════════════════════════════════════════════════════════════ */

export default function MethodPicker({ methods, title = '兩條路，邊條快？' }) {
  const list = Array.isArray(methods) ? methods.filter((m) => m && m.steps) : []
  const [picked, setPicked] = useState(null)

  if (list.length < 2) return null

  return (
    <section className="methods">
      <h3 className="methods-title">{title}</h3>
      <div className="methods-grid">
        {list.map((m, idx) => (
          <div key={m.id || idx} className={'method-card' + (picked === m.id ? ' picked' : '')}>
            <button
              type="button"
              className="method-label"
              onClick={() => setPicked(picked === m.id ? null : m.id)}
            >
              {m.label}
            </button>
            <ol className="method-steps">
              {(m.steps || []).map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <p className="methods-note">
        {picked ? '兩條路都得，你自己計得順手就可以。' : '撳一下你覺得快啲嗰條。'}
      </p>
    </section>
  )
}
