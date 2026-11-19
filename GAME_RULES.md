# GAME_RULES — 邏輯引擎權威規格 v2（ruleVersion 2.0.0）

> **Highest priority.** 若任何文件衝突，核心操作與回合結算以本文件及通過的測試案例為準。禁止憑視覺動畫推論規則。
>
> **v2 變更（2026-11-19，需求方選定「方案 A：橫直滑動＋特殊箱＋障礙」）**：新增直欄滑動（依關卡開放）、火箭/炸彈特殊箱、膠帶箱與冰凍箱障礙、`clearCrates` / `breakIce` 目標。v1 的「P0 不做特殊箱/障礙」限制由需求方明確解除，見 `DECISIONS.md` D17。仍**不做**體力、IAP、廣告、彩虹箱、第 5 色。

## 1. 定義與座標

- 棋盤固定 6 行 × 6 列；行 `r`、列 `c` 皆從 0 起算，左上 `(0,0)`，向下 `r+1`，向右 `c+1`。
- `Tile` 有兩種：
  - `ParcelTile {kind:'parcel', color: R|B|G|Y, special?: 'rocketRow'|'rocketCol'|'bomb', ice?: true}`
  - `CrateTile {kind:'crate', hp: 1|2}`（膠帶箱，沒有顏色）
- `Cell = Tile | null`。`null` 僅在消除及重力中暫時存在，穩定盤面不得有空格。
- `GameState` 包含 board、remainingMoves、progress（各色收集數、拆除膠帶箱數、解凍冰數）、rngState、allowColumnMoves、comboCount/score、status（ready/won/lost）與 ruleVersion。分數只是回饋，勝負看關卡目標。

## 2. 玩家輸入：整排或整欄循環位移 1 格

- `Move = {line:'row', index, direction:'left'|'right'} | {line:'col', index, direction:'up'|'down'}`。
- 橫排：`left [A,B,C,D,E,F] -> [B,C,D,E,F,A]`；`right -> [F,A,B,C,D,E]`。
- 直欄（由上到下讀）：`up [A..F] -> [B,C,D,E,F,A]`；`down -> [F,A,B,C,D,E]`。
- 直欄移動僅在關卡 `allowColumnMoves: true` 時合法；否則 `ENGINE_INVALID_MOVE`，不扣步。（第 1–5 關只開放橫排，第 6 關起開放直欄。）
- 膠帶箱、冰凍箱、特殊箱都**跟著整排/整欄一起移動**。
- 一次有效操作恰好移動 1 格，必扣 1 步（即使沒有消除）。不依拖曳距離移動多格。剩餘 0 步、`status !== ready`、取消手勢都不能提交。
- 每回合只處理一次輸入；動畫播放中禁止再提交。

## 3. 消除判定

- 只有**未冰凍的貨箱**可配對（膠帶箱與冰凍箱不參與連線，會截斷連線）。特殊箱以其顏色參與配對。
- 同一批次掃描整個棋盤，找出所有水平或垂直長度 ≥ 3 的同色連續區段。
- 共用格子的區段合併為一個「群組」（L/T/十字）。每格本批只計一次。
- 同時處理整批，不能掃一列就改一列。

## 4. 特殊箱

### 4.1 產生
| 群組形狀 | 產生 |
|---|---|
| 只有一條水平 4 連 | `rocketRow`（橫向火箭） |
| 只有一條垂直 4 連 | `rocketCol`（直向火箭） |
| 任一區段 ≥ 5，或同時含水平與垂直區段（L/T/十字） | `bomb`（炸彈） |
| 3 連 | 無 |

- 產生位置：在群組中**非特殊箱**的格子裡選。炸彈優先選水平與垂直區段的交叉格。第 1 輪（玩家直接造成的消除）優先選在玩家移動的那排/那欄上；之後依「最下方（r 最大）、再最左（c 最小）」決定。
- 被選中的格子**不被移除**，原地變成同色特殊箱；群組其餘格子正常移除。
- 本輪新產生的特殊箱不會被本輪爆炸波及。

### 4.2 啟動
- 特殊箱被移除時（被連線或被其他爆炸波及）啟動：
  - `rocketRow` 清除整排；`rocketCol` 清除整欄；`bomb` 清除以自身為中心的 3×3（超出邊界的部分忽略）。
- 爆炸範圍內：普通貨箱移除並計入收集；特殊箱移除並連鎖啟動（同批，佇列順序由 key 小到大）；膠帶箱受 1 點傷害；冰凍箱解凍但**不被移除**。

## 5. 障礙

- **膠帶箱 `CrateTile`**：不能配對。每一輪若有消除連線格與其上下左右相鄰，或在爆炸範圍內，受 1 點傷害（同一輪最多 1 點）。hp 歸 0 時移除，計入 `cratesCleared`。會隨排/欄移動，也會受重力下落；補箱永遠不會產生膠帶箱。
- **冰凍箱 `ice`**：有顏色但不能配對。同一輪若與連線格上下左右相鄰，或在爆炸範圍內，解凍為普通貨箱（保留顏色與特殊屬性），計入 `iceBroken`。解凍不移除貨箱，下一輪才能參與配對。

## 6. 重力、補箱與連鎖

- 消除後每一縱列獨立重力向下，保留非空格由上到下的相對順序（膠帶箱也會掉落）。
- 補箱順序精確固定：依 `c = 0..5`，每欄的空缺從**該欄最上方到最下方**填入，依次從 PRNG 取得 `R/B/G/Y`，補入的一律是普通貨箱。
- PRNG：32-bit unsigned `xorshift32`，seed 為非 0 uint32。每次取樣**先更新 state**，`colorIndex = state % 4`，對應 `[R,B,G,Y]`。使用 `>>>0`。勿用 `Math.random`。
- 補完後再掃描；有連線就重複「消除/特殊箱/障礙 → 重力 → 補箱」直到穩定。同一回合第 2 輪起為連鎖。
- **保護上限**：每次操作最多 64 輪，超出為 `ENGINE_CASCADE_LIMIT` 錯誤，保留可重現資訊；不得靜默判勝。
- 同樣 initial board + seed + 操作序列必得到一模一樣的局面。

## 7. 目標與勝敗

- 目標類型：
  - `{type:'collectColor', color, count}`：該色貨箱被移除的數量（連線與爆炸都算，產生特殊箱的那一格不算）。
  - `{type:'clearCrates', count}`：被拆除（hp 歸 0）的膠帶箱數。
  - `{type:'breakIce', count}`：被解凍的冰凍箱數。
- 每關 1–3 個目標，AND：全部達成才勝利。超額不扣回。
- **結算順序**：先完成全部連鎖，再判斷目標；已達成 → `won`；否則 `remainingMoves === 0` → `lost`；否則 `ready`。勝利優先於用完步數。
- 重新開始會重設 board、seed、步數、進度。

## 8. 關卡合法性

- 6×6；字元僅 `R/B/G/Y`（貨箱）、`r/b/g/y`（冰凍貨箱）、`1/2`（膠帶箱 hp）；seed 為非零 uint32；moveLimit 1–99。
- 初始盤面不得有任何可消除連線（冰凍箱與膠帶箱不構成連線）。
- `clearCrates` / `breakIce` 的 count 不得超過盤面上的膠帶箱 / 冰凍箱數量。
- 每關必須有可重播到 `won` 的 witness（只供測試，runtime 不使用）；witness 的直欄步只能出現在 `allowColumnMoves` 關卡。

## 9. 一次玩家操作的事件輸出

`TurnResult = { nextState, events }`：

1. `LINE_SHIFTED {move}`
2. 每一輪：`MATCH_REMOVED {cascadeIndex, cells, colors, matched, created[], blasts[], crateHits[], thawed[]}`、`CELLS_FELL {falls[]}`、`CELLS_SPAWNED {spawns[]}`
3. `OBJECTIVES_UPDATED {progress, objectives}`
4. `TURN_COMPLETED`，再視結果 `LEVEL_WON` / `LEVEL_LOST`

Engine 一次同步算完整回合。Presenter 只依事件播放，不能呼叫 RNG 或重算規則。

## 10. 反例與邊界

- `R R R R` 水平 → 移除 3 個，留下 1 個橫向火箭（計入收集 3）。
- `R R R` 橫線與 `R R R` 縱線共用一格 → 炸彈，產生在交叉格。
- 冰凍的 `r` 夾在 `R R _ R` 中間不會形成 4 連；與連線相鄰時解凍。
- 爆炸碰到冰凍箱：解凍但不移除、不計入收集。
- 平移後沒有消除：扣一步但不觸發重力/補箱。
- 直欄移動在 `allowColumnMoves:false` 的關卡被拒絕且不扣步。
