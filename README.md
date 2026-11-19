# 轉轉物流局 Parcel Pop Express — Web Demo v1.1

可在瀏覽器實際遊玩的 6×6 整排／整欄平移消除遊戲（規則 v2：火箭、炸彈、膠帶箱、冰凍箱，共 30 關）。Three.js / React Three Fiber 的 Premium Stylized 2.5D 棋盤，React DOM HUD，純 TypeScript 規則引擎。

## 啟動

```bash
bun install
bun run dev          # http://localhost:5173 ，手機可用同網段 IP 連入
```

其他指令：

| 指令 | 說明 |
|---|---|
| `bun run test` | Vitest：規則引擎、關卡驗證、presenter 一致性、store 流程 |
| `bun run build` | TypeScript strict 型別檢查 + Vite production build |
| `bun run validate:levels` | 30 關 schema / stable board / witness replay / 窮舉 3 步內不可勝 / 隨機策略勝率 |
| `bun run generate:levels` | 重新產生 `levels.v2.json`（可加關卡 id 只重產一關） |
| `bun run e2e` | Playwright 桌面滑鼠 + 模擬觸控 E2E（會先 build 並啟動 preview） |

若 Playwright 找不到瀏覽器，可用 `PW_CHROMIUM_PATH=/path/to/chrome bun run e2e` 指定。

## 怎麼玩

- 在任一**橫排**左右拖曳，整排循環移動**一格**；第 6 關起也能在**直欄**上下拖曳。每次移動消耗 1 步。
- 也可以用棋盤旁的 ◀ ▶ ▲ ▼ 按鈕；鍵盤 ←→ 移動選取的排、↑↓ 移動選取的欄（只能橫移的關卡為選排），W/A/S/D 移動選取格。
- 3 個以上同色即消除，貨箱下落補充，新連線會自動連鎖。
- **特殊箱**：連 4 個做出火箭（清整排或整欄），連 5 個或 L/T 形做出炸彈（清 3×3）。特殊箱被消除時啟動，可互相連鎖。
- **障礙**：膠帶箱（1 或 2 層）要在旁邊消除或用爆炸拆開；冰凍箱不能配對，旁邊消除就會解凍。
- 在步數內完成全部「配送目標」（收集顏色、拆膠帶箱、解凍）即勝利。

| 第 1–5 關 | 第 6–10 關 | 第 11–15 關 | 第 16–20 關 | 第 21–30 關 |
|---|---|---|---|---|
| 只能橫移，學火箭、炸彈 | 開放直欄 | 膠帶箱 | 冰凍箱 | 混合與最終挑戰 |

## 架構

```
src/game/engine/     純 TS 規則（不 import React/Three/DOM）：shift、findMatches、gravity、rng(xorshift32)、resolve、applyMove、validateLevel、solver
src/game/data/       levels.v2.json（30 關，載入時驗證）
scripts/             generate-levels.ts（產生＋校準）、validate-levels.ts（QA 報表）
src/game/state/      Zustand store：每次輸入呼叫一次 applyMove、輸入鎖、HUD 由事件推進
src/game/render3d/   R3F Canvas、正交相機、BoardView（依 events 播放動畫）、timelineModel（純 TS，可測）
src/game/ui/         DOM HUD、結算、選關、設定
tests/engine/        Vitest
tests/e2e/           Playwright
```

規則權威：`GAME_RULES.md`。技術：`TECH_ARCHITECTURE.md`。視覺：`ART_DIRECTION.md`。實作取捨見 `DECISIONS.md`，里程碑與測試紀錄見 `TASKS.md`、`TEST_REPORT.md`。
