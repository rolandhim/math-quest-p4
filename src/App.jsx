import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import ShelfPage from './pages/ShelfPage.jsx'
import LessonPage from './pages/LessonPage.jsx'
import ReviewPage from './pages/ReviewPage.jsx'
import PracticePage from './pages/PracticePage.jsx'
import MistakesPage from './pages/MistakesPage.jsx'
import ParentPage from './pages/ParentPage.jsx'
import { requestPersistence } from './lib/storage.js'
import { NavLockContext, useNavLocked } from './lib/navlock.jsx'

/* ════════════════════════════════════════════════════════════
   App —— 路由
     /                      ① 課文櫃
     /lesson/:id            課題頁（三個入口）
     /lesson/:id/review     ② 溫習卡
     /lesson/:id/practice   ③ 練習庫
     /lesson/:id/retry      ④ 再試一次（正式 path；舊 path /mistakes 轉向去 /retry）
     /parent                家長報告

   §1.5 (C)：練習庫未答完當前嗰題 → TopBar 個返回鍵收埋。
   由 PracticePage 用 useNavLock() 話返嚟（練習庫以外永遠唔鎖）。
   ════════════════════════════════════════════════════════════ */

export default function App() {
  useEffect(() => {
    // 開 app 時問瀏覽器盡量保住資料（唔支援就靜靜跳過）
    requestPersistence()
  }, [])

  const location = useLocation()
  const showBack = location.pathname !== '/'
  const [navLocked, setNavLocked] = useState(false)
  const lockValue = useMemo(
    () => ({ locked: navLocked, report: setNavLocked }),
    [navLocked],
  )

  return (
    <NavLockContext.Provider value={lockValue}>
      <div className="app">
        {showBack && <TopBar />}
        <Routes>
          <Route path="/" element={<ShelfPage />} />
          <Route path="/lesson/:id" element={<LessonPage />} />
          <Route path="/lesson/:id/review" element={<ReviewPage />} />
          <Route path="/lesson/:id/practice" element={<PracticePage />} />
          <Route path="/lesson/:id/retry" element={<MistakesPage />} />
          <Route path="/lesson/:id/mistakes" element={<LegacyMistakesRedirect />} />
          <Route path="/parent" element={<ParentPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </NavLockContext.Provider>
  )
}


/* 舊 path /lesson/:id/mistakes —— 收窄之後只做轉向，正式 path 係 /lesson/:id/retry */
function LegacyMistakesRedirect() {
  const { id } = useParams()
  return <Navigate to={`/lesson/${id}/retry`} replace />
}

function TopBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const locked = useNavLocked()
  const match = location.pathname.match(/^\/lesson\/([^/]+)/)
  const lessonId = match ? match[1] : null
  const isLessonHome = lessonId && location.pathname === `/lesson/${lessonId}`

  const backTo = isLessonHome || !lessonId ? '/' : `/lesson/${lessonId}`
  const label = isLessonHome || !lessonId ? '← 課文櫃' : '← 課題'

  return (
    <div className="topbar">
      {/* §1.5 (C)：練習做緊嘅時候唔出返回鍵 —— 逼佢面對當前嗰題 */}
      {locked ? (
        <span className="topbar-lock">答完呢題先可以走</span>
      ) : (
        <button type="button" className="btn btn-ghost btn-small" onClick={() => navigate(backTo)}>
          {label}
        </button>
      )}
      <Link className="topbar-title" to={locked ? location.pathname : '/'}>
        數學練習 · 小四
      </Link>
    </div>
  )
}

