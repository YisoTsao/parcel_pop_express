# LEVEL_SOLVER_SPEC — 可解性與可重播驗證

## 1. 必要前提

Solver 必須匯入**同一個** `@game/engine` 的 `applyMove(state,move)`，不得自行重寫消除規則；否則求解器和實際遊戲可能各自『正確』但判定不同。

## 2. 狀態與鍵值

必要完整狀態 = 6×6 board + remainingMoves + 收集目標進度（可上限截斷） + `rngState` + ruleVersion。若有 score 但不影響勝負，不必進入 BFS Key。狀態可 serialize 成穩定字串；不要把 UI 動畫或 DOM 狀態寫入 Key。

## 3. 操作空間與演算法

- 每個 `ready` 狀態最多 12 種合法操作：`6 rows × {L,R}`。
- BFS 從 initial state 開始；已勝利為成功、已失敗不擴展、已訪問 state 跳過。
- 可設 `maxNodes`/`maxMs`/`maxDepth` 以免爆炸；超限回 `unknown`，**不能回 `unsolvable`**。
- 結果：`solvable`（包含 witness）、`unsolvable`（完整窮盡搜索）、`unknown`（資源或限制不足）。
- 短期只需 verify 隨附 witness 能通關；M1/M2 再補 BFS。

## 4. PRNG、重播與公平

- 初始非 0 uint32；每次 spawn 使用 `xorshift32`；消除後依欄位左到右、空位頂到下取樣（詳 GAME_RULES）。
- 相同盤面/seed/行為序列，應有完全一樣的 event/log/終盤面；Unity 移植時拿相同 fixture 驗證語義。
- 若關卡補箱本質為運氣，『在某個 seed 有解』不等於普通玩家容易贏。需要多 seed 的模擬與玩家測試。
- 排序 `witnessMoves`、BFS 展開操作固定為 r=0..5、L 再 R，便於 debug 和最短路徑穩定性。

## 5. TypeScript API（設計約定）

```ts
type Move = { row: number; direction: 'left' | 'right' };
type SolveResult =
  | { status: 'solvable'; path: Move[]; visited: number }
  | { status: 'unsolvable'; visited: number }
  | { status: 'unknown'; reason: 'timeout' | 'nodeLimit' | 'depthLimit'; visited: number };

function applyMove(state: GameState, move: Move): TurnResult;
function solve(level: LevelDefinition, limits: SolveLimits): SolveResult;
function replay(level: LevelDefinition, witness: Move[]): GameState;
```

## 6. 關卡品質自動化

每次提交 `levels.v1.json` 必須依序檢查：JSON Schema、關卡 ID 唯一、6×6 僅合法色碼、無初始 Match、Move 合法、Seed 合法、witness 真實勝利、重播結果相同、不能超出 cascade cap。`unknown` 標示需人工復核，不可當作完成驗收。

## 7. 測試例

1. 交叉五格重疊匹配，實際收集 5 而非 6。
2. 一次移動使兩個區域同時消除，應同批移除。
3. 跨欄空缺時每欄順序一致，兩次重播盤面 bit-for-bit 相同。
4. 0 步且尚未通關 → lost；最後一步達成目標 → won。
5. 求解器超過 maxNodes → unknown，不准偽稱無解。
