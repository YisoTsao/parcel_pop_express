# TEST_REPORT — Web Demo v1.1

執行日期：2026-11-19　環境：雲端 Linux 容器、Bun 1.4.4、Node 22、Chromium（Playwright，SwiftShader 軟體 WebGL）

| 指令 | 結果 | 內容 |
|---|---|---|
| `bun run test` | **PASS** 65/65 | 規則 E01–E17、PRNG 參考值、連鎖、勝敗優先、Seed 重現、關卡驗證/BFS、presenter timeline 2000 步一致性、boardToWorld、滑動判定、store 輸入鎖/重開取消 |
| `bun run build` | **PASS** | `tsc -b`（strict）＋ Vite build，無錯誤 |
| `bun run validate:levels` | **PASS** | 10 關 schema / stable board / witness replay / 決定性皆通過 |
| `bun run e2e` | **PASS** 12/12 | 桌面滑鼠 ×6、模擬觸控 Pixel 7 ×6（見下） |

## E2E 項目（desktop-mouse 與 mobile-touch 各一次）
- U01 水平拖曳（拖 160px 仍只移一格）扣 1 步、盤面正確
- U02 垂直拖曳與 12px 小拖曳不扣步、盤面不變
- 勝利流程：第 1 關 → 結算 → 下一關 → 重新開始還原初始盤面與步數
- U09 鍵盤 / 側邊箭頭走同一路徑；resolving 中第二次輸入被忽略（U03）
- 失敗流程：第 9 關非勝利步 → 失敗畫面 → 重新開始
- 10 關 witness 皆以鍵盤操作到達勝利畫面

## 關卡 QA（`bun run validate:levels`）
| 關 | 步數 | 目標 | BFS 最短 | 隨機策略勝率 |
|---|---|---|---|---|
| 1 | 5 | R×3 | 1 | 81.4% |
| 2 | 5 | B×3 | 1 | 81.4% |
| 3 | 5 | B×3 | 1 | 81.8% |
| 4 | 5 | B×3 | 1 | 94.0% |
| 5 | 6 | R×3+G×3 | 1 | 50.0% |
| 6 | 6 | Y×3+R×3 | 1 | 96.6% |
| 7 | 5 | R×3 | 1 | 86.0% |
| 8 | 4 | R×3 | 1 | 88.2% |
| 9 | 1 | Y×3+B×3 | 1 | 10.6% |
| 10 | 5 | G×3+B×3 | 1 | 67.8% |

無無解關卡。全部為一步可勝的技術 fixture（符合 `LEVEL_DESIGN` §2 註記），難度需後續重新設計。

## 未執行 / 未能驗證（NOT RUN）
- Android Chrome、iOS Safari **實機**：NOT RUN（無實機）。
- 實機 FPS / frame time / 記憶體 / draw calls：NOT RUN。容器內為軟體 WebGL，數字不具代表性，因此不記錄。
- 玩家訪談（TEST_PLAN §4）：NOT RUN。

## 截圖
`docs/screenshots/`：首頁、棋盤（Medium）、連鎖中粒子、棋盤（Low）、勝利結算、選關。手機直向 390×844。
