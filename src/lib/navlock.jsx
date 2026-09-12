import { createContext, useContext, useEffect } from 'react'

/* ════════════════════════════════════════════════════════════
   navlock —— 「做緊唔准走，做完先出 Home 鍵」(簡報 §1.5 C)

   點解要一個 context：頂部嘅「← 課文櫃 / ← 課題」鍵係 App.jsx 個 TopBar
   畫嘅，但「答完未」只有 PracticePage 知。所以 PracticePage 用
   useNavLock(true/false) 話返畀 TopBar 知，TopBar 就收埋／出返個返回鍵。

   ⚠️ 只係 app 自己頁面上嘅掣。瀏覽器上一頁 / Android 返回手勢 / iOS 側滑
      攔唔到（階段 1 唔做 pushState／popstate 攔截）。
      所以仲有第二條防線：未答完就唔會寫入「做過」紀錄（見 progress.js）。
   ════════════════════════════════════════════════════════════ */

export const NavLockContext = createContext({ locked: false, report: () => {} })

/**
 * PracticePage 用：話返畀頂部有幾鎖。
 * @param {boolean} locked  true = 而家唔可以走（收埋返回鍵）
 */
export function useNavLock(locked) {
  const ctx = useContext(NavLockContext)
  const report = ctx && typeof ctx.report === 'function' ? ctx.report : () => {}

  useEffect(() => {
    report(!!locked)
    return () => report(false)
  }, [locked, report])
}

/** TopBar 用：讀返而家有冇鎖 */
export function useNavLocked() {
  const ctx = useContext(NavLockContext)
  return !!(ctx && ctx.locked)
}
