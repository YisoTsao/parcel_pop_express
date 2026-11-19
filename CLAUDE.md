# CLAUDE.md — Parcel Pop Express Web Demo 工作規範 v1.1

> 2026-11-19：**已改成 Three.js / React Three Fiber 的 Premium Stylized 2.5D 棋盤**。要求交付瀏覽器可玩原型，不是靜態渲染圖。`GAME_RULES.md` 仍為規則最高權威。

## 1. 角色與目的

你是熟悉 React/TypeScript、Three.js/R3F、遊戲互動及 Vitest 的資深 Web 遊戲工程師。先把《轉轉物流局》做成真能玩的 **6×6 Premium 2.5D Puzzle Web Demo**。漂亮畫面是加分項，但**規則正確、操作順暢、易理解**的優先級更高。

## 2. 必讀文件（依序）

1. `README.md`（專案概況；若其 3D 描述與新版衝突，以以下三份為準）
2. `GAME_RULES.md`（規則最高優先權）
3. `LEVEL_DATA_SPEC.md`、`LEVEL_SOLVER_SPEC.md`
4. `TECH_ARCHITECTURE.md`（v1.1 技術與 3D 邊界）
5. `ART_DIRECTION.md`（v1.1 3D 美術規格）
6. `TEST_PLAN.md`
7. `GAME_DESIGN.md`、`UI_UX_SPEC.md`、`LEVEL_DESIGN.md`
8. `MVP_ROADMAP.md`、`ASSET_LIST.md`、其他文件

**衝突處理：** 核心規則以 `GAME_RULES.md` 為準；技術/渲染以新版 `TECH_ARCHITECTURE.md` 為準；美術以新版 `ART_DIRECTION.md` 為準。舊 README/ROADMAP/ASSET_LIST 中「不做 3D」僅指不做大型 3D 城市和角色，**不適用新版 P0 的 3D 棋盤**。若存在其他衝突，記入 `DECISIONS.md` 再執行。

## 3. 強制技術方案

- Vite + React + TypeScript strict。
- Three.js + React Three Fiber + Drei，**只有棋盤、貨箱、背景和粒子使用 Canvas**。
- 目標、步數、按鈕、關卡選擇、勝敗、設定使用 React DOM/CSS；不可把 HUD 烘焙成 3D Mesh 文字。
- 核心 `game/engine/` 必須純 TypeScript；禁止 import React/Three/DOM、使用動畫時間推進規則或在元件中使用 `Math.random` 補箱。
- 先以 React reducer 管理流程；如真有跨多層 UI 的需要才引入 Zustand。不要無理由增加狀態套件。
- Vitest + React Testing Library + Playwright。不得為測試而更改 Seed/witness/規則以掩蓋邏輯缺陷。
- 手機直向為主要體驗，滑鼠與觸控均可玩。

## 4. P0 遊戲規則：不得自行變更

- 固定 6×6、4 色 R/B/G/Y，初版無障礙與特殊消除道具。
- 一次左右滑動只把**一整橫列**循環位移**一格**，無消除也扣一步。
- 相同色水平或垂直 >= 3 連線同時移除；交叉重疊格只計一次。
- 重力依縱列、補箱順序 c 由左至右、欄內由上往下；xorshift32 的 state 推進和 modulo 4 一律依 `GAME_RULES.md`。
- 補箱連鎖直到盤面穩定，單回合最高 64 輪防止無窮迴圈。
- 成功目標 `collectColor`，勝利判定優先於用完步數造成的失敗。
- 不得把 P1 四連/五連特殊箱、木箱、體力、IAP、廣告偷加進 P0。

## 5. 3D 呈現與互動準則

- 使用正交相機（微俯視）與固定 world coordinate mapping。`board[r][c]` -> mesh x/z 必須具備明確轉換函式。
- 使用共享模型/材質，四種貨箱除了色碼有不同壓印符號；統一光照、粗糙度、圓角及陰影。
- Pointer Events + raycast 確定起始 row；以水平滑動閾值判定一次左/右操作；防止垂直捲動誤觸。**永遠不依拖曳距離移動兩格以上**。
- Game engine 的 `TurnResult.events` 是動畫唯一來源。動畫不得重新計算消除/重力/補箱。
- 全部輸入在 resolving 狀態鎖定；切關/重開時取消舊 timeline，防止 stale callback。
- 相機不可讓外圈貨箱被裁切；DOM HUD 不可覆蓋可操作棋盤；手機 safe-area 必須處理。
- 3D 視覺建置先從基本標準材質、方向光、柔和陰影、scale/position tween 開始；再逐步改善。不要先打造 3D 場景而沒有玩法。

## 6. 畫質與可用性規定

- Low、Medium、High 三檔畫質可選，Medium 手機預設，Low 無高成本 postprocessing。
- P0 使用簡化光影；Bloom、DOF、SSAO、SSR、體積光、全屏粒子都不是 P0 必需。Bloom 可作 P1 測試但不可強制手機使用。
- 預設手機 DPR 不超過 1.5（High 可另行調整）；限制粒子；避免每幀 React setState / 重新建立 geometry。
- 支援 reduced-motion、聲音開關、低配裝置、色覺辨識；不以閃光/震動作為必要遊戲資訊。
- WebGL context lost、顯示卡能力不足時顯示清楚 fallback，而不是空白頁。

## 7. 開發順序（務必實作，不要只寫建議）

1. **Inspect**：先盤點 repo，讀上述文件，保留現有專案檔案；確認 package manager / lockfile。
2. **Plan**：建立 `TASKS.md`，標示 M0～M4 和每項可測驗收；重大取捨記入 `DECISIONS.md`。
3. **M0 — Logic**：先完成純 TS engine、level validation、10 關資料與 witness replay、單元測試。
4. **M1 — Playable 3D Board**：建置 R3F Canvas、正交相機、6×6 mesh、raycast row selection、滑動、DOM HUD。此階段必須可玩。
5. **M2 — Event Animation**：使用 events 播放平移、消除、掉落、補箱、連鎖；加入中止與 reduced-motion；驗證最終棋盤一致。
6. **M3 — Visual Quality**：實作統一圓角貨箱、壓印、燈光、接觸陰影、聲音及 Low/Medium/High；按 `ART_DIRECTION.md` 截圖檢查。
7. **M4 — Test & Delivery**：Playwright 桌面/觸控 E2E、build、效能記錄、README 實際啟動與測試步驟。

如已有可運作 engine，不要重寫它；先補相容的 R3F Presenter。性能優化不准引入非必要的架構複雜度。

## 8. 測試與驗收（Definition of Done）

- `npm run dev` 可於瀏覽器操作；`npm run build`、`npm run test` 成功；若 repo 用其他 package manager 就沿用。
- 10 關 JSON 驗證通過且 witness 可重播；相同 Seed + 同操作必有相同結果。
- 手機 touch、桌面 mouse：左右移列與重玩正常，取消/垂直手勢不誤扣步。
- 3D 棋盤、柔和光照、統一貨箱、四類印記、DOM HUD 實際存在；不是 2D 截圖假裝 3D。
- 動畫前後邏輯最終狀態相同；Reduced Motion 和三種畫質不改勝負與收集結果。
- 行動直向版面可用、沒有棋盤裁切；至少提供 Android Chrome/iOS Safari 實測項目（未取得裝置須標記未測，禁止宣稱通過）。
- 產出最終測試紀錄（執行命令、PASS/FAIL、已知問題、裝置/瀏覽器/畫質設定與 FPS 測量）。

## 9. 禁止事項

- 不得把遊戲改為普通 swap Match-3、Tap Blast、物理自由滑箱或一次拖多格。
- 不得修改權威規則、seed、level witness 讓測試變綠而不說明。
- 不得在 React components / R3F useFrame 中加入匹配規則或 RNG。
- 不做大型 3D 世界、會員/支付/伺服器、強制廣告、體力倒數、季票。
- 不聲稱已完成未運行的測試、不聲稱已在手機測過未實測的效能。
- 不要只輸出程式碼範例、設計稿或截圖而不落地到 repo。

## 10. 首次回覆與交付格式

首次執行請簡要列出 repo 現況、既存檔案與技術選擇，然後直接完成 M0 與 M1；不要重複問已寫清楚的設定。

每次回報包含：已完成檔案、可執行功能、測試命令與結果、未完成/風險及接下來的最小工作項。若有無法執行的命令，明確寫出原因與手動驗證替代方式。
