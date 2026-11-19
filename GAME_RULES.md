# GAME_RULES — 邏輯引擎權威規格 v1

> **Highest priority.** 若任何文件衝突，核心操作與回合結算以本文件及通過的測試案例為準。初版無特殊方塊、木箱、冰凍或其他障礙。禁止憑視覺動畫推論規則。

## 1. 定義與座標

- 棋盤固定 6 行 × 6 列；行 `r`、列 `c` 皆從 0 起算，左上 `(0,0)`，向下 `r+1`，向右 `c+1`。
- `Cell = 'R' | 'B' | 'G' | 'Y' | null`。`null` 僅在消除及重力中暫時存在，盤面穩定時不應有空格。
- `Board = Cell[][]`，`board[r][c]`，內部不得直接修改 UI 共享物件。
- `GameState` 必須包含 board、remainingMoves、objective progress、rngState、comboCount/score、status（ready/resolving/won/lost）與 ruleVersion。分數只是回饋，勝負看關卡目標。

## 2. 玩家輸入：整列循環平移 1 格

- 玩家在一**橫排**上水平拖曳，達到閾值後朝左或右**循環位移恰好 1 格**；不依拖曳距離移動多格。
- `shift(row, LEFT)`：`[A,B,C,D,E,F] -> [B,C,D,E,F,A]`。
- `shift(row, RIGHT)`：`[A,B,C,D,E,F] -> [F,A,B,C,D,E]`。
- 一次有效拖曳必扣 1 Move，即使沒有消除。這讓策略有代價。剩餘 0 步、`status !== ready`、觸控取消或垂直拖動都不能提交移動。
- 相同顏色整排看似無視覺變化但仍是有效移動；可先做 UX 提示，MVP 不另設非法判定。
- 每回合只處理一次輸入；動畫播放中禁止再提交。取消/切頁必復原到已提交的邏輯盤面。

## 3. 消除判定

- **同一事件批次**掃描整個棋盤，找出所有水平或垂直長度 >= 3、相同且非 null 的連續區段。
- 交叉區、L 型、T 型允許；集合取聯集，每個格子本批只計一次。
- 同時移除全部命中方塊，計算本批收集數與分數，再下落補充。不能一列掃完就立刻更動棋盤，否則結果會依掃描順序不同。
- MVP 4 連、5 連**只計普通消除**，暫不產生火箭和彩虹方塊；special rules 在後續版本另訂。這一點刻意不同於完整商業提案。

## 4. 重力與補箱

- 消除後每一**縱列**獨立重力向下，保留非空方塊由上到下的相對順序。
- 同一縱列的空缺在頂端補滿。
- 補箱順序精確固定：依 `c = 0..5`，每欄的空缺從**該欄最上方到最下方**填入，依次從 PRNG 取得 `R/B/G/Y`。
- 同樣 initial board + seed + 操作序列必須得到一模一樣的全部局面。
- PRNG：32-bit unsigned `xorshift32`，初始化 seed 必須是非 0 的 uint32。每次取樣先更新 state，`colorIndex = state % 4`，對應 `[R,B,G,Y]`。使用 `>>>0` 保證 uint32。勿用 `Math.random`。

## 5. 連鎖

- 補完後再次掃描所有符合規則的 match。
- 若有 match → 重複「批次消除 → 重力 → 補箱」直到沒有 match；同一玩家回合內的第 2 次及以上稱連鎖。
- **保護上限**：每次玩家操作最多執行 64 輪消除，超出視為 `ENGINE_CASCADE_LIMIT` 錯誤，需顯示開發錯誤並保留可重現 Seed；不得靜默硬判為勝利。
- 初始局面必須無既存的三連線（stable board），避免玩家尚未操作就自行消除。

## 6. 目標與勝敗

- P0 關卡僅支援 `collectColor`，例如 `{type:'collectColor', color:'R', count:6}`。每次所有連鎖批次消除的該色方塊都算入進度。
- 多目標採 AND：全部達成才勝利。超額收集不扣回。
- **回合結算優先順序**：先完成全部消除/連鎖，再判斷目標；若已達成則 `won`，否則 `remainingMoves === 0` 則 `lost`，否則 `ready`。
- 玩家勝利後不能再操作；失敗提供「重新開始」與「選關」。重新開始會重設 board、seed、move、進度，不會沿用上一局 RNG。
- P0 沒有永久愛心、道具、付費續關或時間限制。

## 7. 關卡合法性

- 寬高都等於 6；只有合法色碼；每行長度 6；seed 為非零 uint32；moveLimit 1–99。
- 初始盤面穩定、不含 null；至少一個有效 collectColor 目標；count 為正整數。
- 初期關卡必須有完整且可重播的勝利見證；運行時不能依賴 JSON 裡的解法，解法僅供測試。

## 8. 一次玩家操作的事件輸出

`TurnResult = { nextState, events }`。事件至少支援：

1. `ROW_SHIFTED {row,direction}`
2. 對每一連鎖輪：`MATCH_REMOVED {cells,colors,cascadeIndex}`、`CELLS_FELL {from,to}`、`CELLS_SPAWNED {position,color}`
3. `OBJECTIVES_UPDATED {progress}`
4. `TURN_COMPLETED` / `LEVEL_WON` / `LEVEL_LOST`

邏輯引擎**一次同步算出結果**。Presenter 只依事件播放動畫，不能在動畫中呼叫隨機數或更動規則狀態。

## 9. 反例與邊界

- `R R R` 直線一次去除 3；`R R R R` 去除 4，不產生特殊道具。
- `R R R` 橫線與 `R` 縱線交叉，交叉格只計一次。
- 如果平移後沒有消除，扣一步但不觸發重力/補箱。
- 如果補箱再次形成連線，一定要自動結算，不能要玩家再滑一次才清。
- 遊戲重整或切關時不可同時落下上一局尚未播放的動畫。
