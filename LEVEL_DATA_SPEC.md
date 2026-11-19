# LEVEL_DATA_SPEC — 關卡資料協定 v2（ruleVersion 2.0.0）

## 1. 來源

`src/game/data/levels.v2.json` 是唯一關卡來源（30 關），由 `scripts/generate-levels.ts` 產生並在載入時以 `validateLevelFile` 驗證。runtime **不可**把 witnessMoves 當作讓玩家過關的機制，僅供測試驗證。v1 的 `levels.v1.json` 已移除（規則版本不同，不得以新規則讀舊關卡）。

## 2. JSON 範例

```json
{
  "ruleVersion": "2.0.0",
  "levels": [
    {
      "id": 11,
      "name": "膠帶箱來了",
      "width": 6,
      "height": 6,
      "moveLimit": 12,
      "seed": 123457,
      "allowColumnMoves": true,
      "board": ["RGBY1G", "GRbYRG", "BYRG2Y", "RGBYRG", "GRBYRB", "BYRGBY"],
      "objectives": [{ "type": "clearCrates", "count": 2 }, { "type": "collectColor", "color": "R", "count": 30 }],
      "witnessMoves": [{ "line": "row", "index": 0, "direction": "right" }, { "line": "col", "index": 3, "direction": "up" }],
      "hint": "在膠帶箱旁邊消除就能拆開它。"
    }
  ]
}
```

（範例只示範 schema，不保證 witness 有效；以實際 JSON 與驗證器為準。）

## 3. 欄位約束

- `ruleVersion`: 固定 `2.0.0`；不符拒絕載入。
- `id`: 1–99 唯一整數。`name`: 1–40 字。`hint`: 選填，畫面下方提示。
- `width`, `height`: 固定 6。`moveLimit`: 1–99。`seed`: 1..4294967295。
- `allowColumnMoves`: boolean，是否開放上下滑動整欄。
- `board`: 6 行各 6 字元：`R/B/G/Y` 貨箱、`r/b/g/y` 冰凍貨箱、`1/2` 膠帶箱（hp）。特殊箱不能寫在初始盤面。初始不得有連線。
- `objectives`: 1–3 個；`collectColor`（同色不可重複）、`clearCrates`、`breakIce` 各最多一個；count 正整數，障礙目標不得超過盤面數量。
- `witnessMoves`: `Move[]`（見 GAME_RULES §2），長度 ≤ moveLimit，必須 replay 到 `won`。

## 4. 產生與校準

`bun run generate:levels` 依章節規格產生盤面（放置障礙、消去初始連線），用「一層貪婪玩家」（每步選當下收益最大的移動，看得到連鎖）模擬：目標數量取貪婪在 `moveLimit − slack` 步內收集量的 70%，slack 依章節為 4/3/2/1 步。貪婪路徑存成 witness。`bun run validate:levels` 另以窮舉證明第 2 關起無法在 3 步內過關，並輸出隨機策略勝率。
