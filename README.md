# 轉轉物流局 Parcel Pop Express — Web Demo v1.1

可在瀏覽器實際遊玩的 6×6 整列平移消除遊戲。Three.js / React Three Fiber 的 Premium Stylized 2.5D 棋盤，React DOM HUD，純 TypeScript 規則引擎。

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
| `bun run validate:levels` | 10 關 schema / stable board / witness replay / BFS 最短解 / 隨機策略勝率 |
| `bun run e2e` | Playwright 桌面滑鼠 + 模擬觸控 E2E（會先 build 並啟動 preview） |

若 Playwright 找不到瀏覽器，可用 `PW_CHROMIUM_PATH=/path/to/chrome bun run e2e` 指定。

## 怎麼玩

- 在任一**橫排**上左右拖曳（滑鼠或手指），放開後整排循環移動**一格**，消耗 1 步。
- 也可以用棋盤兩側的 ◀ ▶ 按鈕，或鍵盤 ↑↓ 選排、←→ 移動。
- 直排或橫排 3 個以上同色即消除，貨箱下落補充，新連線會自動連鎖。
- 在步數內完成「配送目標」即勝利；步數用完未完成則失敗。

## 架構

```
src/game/engine/     純 TS 規則（不 import React/Three/DOM）：shift、findMatches、gravity、rng(xorshift32)、resolve、applyMove、validateLevel、solver
src/game/data/       levels.v1.json（載入時驗證）
src/game/state/      Zustand store：每次輸入呼叫一次 applyMove、輸入鎖、HUD 由事件推進
src/game/render3d/   R3F Canvas、正交相機、BoardView（依 events 播放動畫）、timelineModel（純 TS，可測）
src/game/ui/         DOM HUD、結算、選關、設定
tests/engine/        Vitest
tests/e2e/           Playwright
```

規則權威：`GAME_RULES.md`。技術：`TECH_ARCHITECTURE.md`。視覺：`ART_DIRECTION.md`。實作取捨見 `DECISIONS.md`，里程碑與測試紀錄見 `TASKS.md`、`TEST_REPORT.md`。
