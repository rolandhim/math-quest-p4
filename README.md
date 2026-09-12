# math-quest-p4

小四數學溫習網站（香港．繁體廣東話介面）。
課本：《現代小學數學（第二版）》4上A（現代教育研究社）—— 單元一、二。

現階段 = **完整骨架**（課文櫃 + 課題頁 + 溫習卡 + 練習庫 + 再試一次 + 家長報告）
＋ 10 條已驗證嘅種子題目（課題 1 五題、課題 2 五題）。
題目之後用產生器大量入，唔會一次過塞晒。

## 本機啟動

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 出 dist/
npm run preview    # 睇 build 成品
npm run verify     # ★ 跑題目／評分／分類驗證（真實重算，唔係手寫答案）
```

## 技術棧

- Vite + React 18 + react-router-dom
- 純 JavaScript（唔用 TypeScript）、純 CSS（唔用 Tailwind／UI library）
- 資料存喺 **localStorage**（`src/lib/storage.js` 係 adapter，全部 function async，
  日後換 Firebase 只需改呢一個檔）
- ⚠️ 前端零 API key、唔用任何外部 API

## 檔案結構

```
src/
├── main.jsx              # 入口
├── App.jsx               # 路由
├── App.css               # design system（CSS variables + 元件 class）
├── lib/
│   ├── storage.js        # localStorage adapter（export/import、跨 tab 同步、PIN hash）
│   ├── grading.js        # 打字題正規化 + 白名單比對
│   └── classify.js       # 錯誤分類（內部記錄，唔顯示畀小朋友）
├── data/
│   └── lessons.js        # 課題 metadata + 溫習卡 + 種子題目（+ computeAnswer 重算）
├── components/
│   ├── QuestionCard.jsx  # 一版一題（練習庫／溫習卡／再試一次 共用）
│   └── MethodPicker.jsx  # 「兩條路，邊條快？」（方法文字一律由 data 拎）
└── pages/
    ├── ShelfPage.jsx     # 課文櫃（首頁）
    ├── LessonPage.jsx    # 課題頁（三個入口）
    ├── ReviewPage.jsx    # 溫習卡（重點 → 遮位自測 → 3 題）
    ├── PracticePage.jsx  # 練習庫（一組 5 題）
    ├── MistakesPage.jsx  # 再試一次（/retry，舊 /mistakes 一樣通）
    └── ParentPage.jsx    # 家長報告（PIN 保護）
```

## 答案唔准手寫

每條題目都有 `operands` + `operation`，`answer` 一定要等於
`computeAnswer(operation, operands)`。`npm run verify` 會用**兩個獨立實作**
（自己寫嘅算式 parser、同動態表達式）逐條重算，任何一條唔對就 exit 1。

## 設計原則（照 spec）

- 小朋友介面：冇計時器、冇排行榜、冇連勝；錯題唔叫「錯題」叫「🔄 再試一次」
- 答錯三層遞進（上限 3 次）：第 1 次唔准提示量級、第 2 次出量級提示、第 3 次出逐步拆解
- 家長報告只講事實同趨勢；❌ 唔顯示錯誤次數，❌ 唔用「落後／未掌握／大意」等字眼
- 家長 PIN 用 SHA-256 存 hash（預設 `1234`），撞 3 次要等一分鐘

## 部署

`vercel.json` 已寫好 SPA rewrites（否則直接開 `/lesson/1` 會 404）。
今次**未 deploy**，亦**未 commit** —— 等用戶睇完 diff 再決定。
