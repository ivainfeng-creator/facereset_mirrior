# Face Reset Overview v3 — 單檔離線版說明

`Face Reset Overview v3.html`：v3 主稿打包後的單檔離線版，約 1.2 MB，雙擊即開、不需連網。字體、mascot 圖片、runtime 全部內嵌。

---

## 1. 打包來源與重建流程

```
Face Reset - Overview v3.dc.html            主稿（設計來源，樣式全部 inline）
  ↓ 加 ext-resource-dependency meta + bundler 縮圖
Face Reset - Overview v3 -standalone-src-.html   打包用來源檔
  ↓ 打包（內嵌字體 / 圖片 / runtime）
Face Reset Overview v3.html                  交付檔
```

- 內容要改一律改主稿，再同步到 `-standalone-src-` 檔重新打包；**不要直接編輯交付檔**。
- 打包檔一開始會先顯示一張黃底笑臉 SVG 縮圖當載入畫面，資產解開後才換成真實頁面；關閉 JavaScript 時也會停在這張圖。
- 三張在 JS 字串裡引用的 mascot 圖（`mascot-step1a/2/3.png`）透過 `ext-resource-dependency` meta 提升成 `window.__resources`，打包後以 blob URL 取用——新增這類「只出現在程式碼字串裡」的圖片時，要記得補一組 meta。

已內嵌的資產：Luckiest Guy + Instrument Sans（Google Fonts）、`assets/` 內用到的 mascot 與 star-accent、Result 頁的插圖、DC runtime、`image-slot.js`。

---

## 2. 畫面與流程

單一 Design Component，一個 `class Component extends DCLogic` 管全部流程，畫面以 `state.step` 當索引切換圖層。

| step | 畫面 |
|---|---|
| 0 | Welcome — 貼紙式 mascot 拼貼 + START |
| 1 | 今日計畫；三場都完成後同一頁展開雙欄 Result |
| 6 | 相機權限對話框，以 overlay 形式 (`state.permOverlay`) 疊在 How to play 之上 |
| 8 | Align — 臉部偵測，50 段刻度環隨進度轉綠；以 overlay 形式 (`state.scanOverlay`) 疊在 How to play 之上（`holdScan` debug 時才會當成獨立 step） |
| 10 | How to play → 遊戲中 — Score / 倒數 / Quit modal（Scenes DC） |

目前的 session 流程：計畫卡片 →（卡片頭像轉圈的 preparing 狀態，約 1 秒）→ paper 紙張飛入 How to play →（未授權時自動跳相機權限 overlay）→ 允許後接臉部偵測 overlay → Continue 後淡出關閉 → 使用者自行按 START 開始遊戲。已授權時省略權限彈窗，直接自動開掃描。

每個 step 是一個 `<sc-if value="{{lXxx.show}}">` 圖層；`layer(idx)` 同時處理進場與退場圖層的定位、z-index 與轉場樣式。

### 轉場

`navigate(step, type)` 驅動：

- `paper` — 新頁自右下角旋轉縮小飛入、底層變暗（`paperin` / `paperunder`），用於進 Result
- `quiet` — 同底色時只 cross-fade 內容
- `slide-fwd` / `slide-back` — 水平推移
- `zoom-welcome` / `zoom-intro` / `zoom-step`(+`-back`) — 分部件錯開的縮放轉場，由 `zoomSub(key)`、`stepSub(idx, part)` 對 text / nav / char / mascot 各自算 delay 與位移
- 預設 fade + `scale(.94→1)`

### 狀態要點

- `doneSessions` / `sessionScores` — 今日三場的完成與分數；`stampedSession` 觸發紅色 DONE 印章（`stampdown`）+ 卡片 `cardthump`
- 第三場完成時：CONTINUE 按鈕 squash 消失（`btnswapout`），DAY COMPLETE 橫幅爆入（`bannerburst` / `bannerring` / `bannersheen`），延遲 1.24s 才展開 Result
- `state.saved` — 每天各自保存進度，切換日期不互相覆蓋（`setDay()` 先淡出、換資料、再淡入）
- `maybeAskName()` — 進前 10 名才延遲彈暱稱 modal，輸入為空時 Join 按鈕變灰停用
- Result 雷達圖以 `requestAnimationFrame` 常駐重繪：每 2.6s 轉 72°，五角星 `morphClip` clip-path 讓中央照片跟著換位

### Tweaks props（Debug 用）

`day2`（切到第 2 天）、`showResult`（直接展開結果頁）、`holdScan`（停在 Align 畫面）。打包版仍可從程式碼改預設值，但沒有 Tweaks 面板。

---

## 3. 設計 token

```
字體    標題 Luckiest Guy（.frtitle）／內文 Instrument Sans
主色    黃 #f7d734（主要 CTA）
強調    藍 #067abb（進度、數值、連結）
成功    綠 #009d41（Align 刻度）／#0f9d58（完成勾）
印章    紅 #d5453a
文字    #1a1a1a 主／#8a8a8a 次／#9a9895 標籤
背景    #f7f7f7 一般頁／#f6f1e7 + 點陣 Welcome／#0a0a0a 相機流程
卡片    #fff、radius 22px、shadow 0 14px 40px rgba(0,0,0,.08)
按鈕    膠囊 radius 999px、font-weight 700–900
標籤字  11px / letter-spacing 1.4px / 大寫 / #9a9895
獎牌    金 #d9a417 / 銀 #a8adb5 / 銅 #c08457
```

`@keyframes` 全部集中在 `<helmet><style>`：stickerin、popin、stampdown、cardthump、paperin / paperunder、bannerburst / ring / sheen / text / stamp、btnswapout、hintpop / nudge / pulse / ring / arrow、scansweep、dotpulse 等。

---

## 4. 限制

- 照片位置用 `<image-slot>`（`result-photo`、`align-photo`、`practice-photo`、`task-photo`），是可拖放的佔位框；拖進去的圖存在瀏覽器本機，**不會隨檔案帶走**，換一台電腦開就是空的佔位。
- 沒有真實相機、landmark 偵測或計分——分數與排行榜都是示意假資料。
- 響應式已處理：窄螢幕 Result 自動疊成單欄。
