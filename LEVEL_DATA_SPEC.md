# LEVEL_DATA_SPEC — 關卡資料協定 v1

## 1. 來源

`data/levels.v1.json` 是 Demo 初始關卡來源；前端 build 可將其複製至 `src/game/data/`。正式 runtime **不可**把 witnessMoves 當作讓玩家過關的作弊機制，僅供測試驗證。

## 2. JSON 範例

```json
{
  "ruleVersion": "1.0.0",
  "levels": [
    {
      "id": 1,
      "name": "第一個包裹",
      "width": 6,
      "height": 6,
      "moveLimit": 6,
      "seed": 123456,
      "board": ["RGBYRB", "GRBYRG", "BYRGBY", "RGBYRG", "GRBYRB", "BYRGBY"],
      "objectives": [{ "type": "collectColor", "color": "R", "count": 3 }],
      "witnessMoves": [{ "row": 0, "direction": "right" }]
    }
  ]
}
```

**注意：** 上述 board 只是 Schema 示範，不保證 witness 對其有效；請以實際 JSON 與驗證器為準。

## 3. 欄位約束

- `ruleVersion`: 固定 `1.0.0`；版本不符拒絕載入。
- `id`: 1–10 唯一整數。
- `name`: 1–40 字串。
- `width`, `height`: P0 固定 6。
- `moveLimit`: 1–99。
- `seed`: 1..4294967295 整數，作為 unsigned 32-bit RNG 初態。
- `board`: 6 行各 6 字元，僅 R/B/G/Y；初始不得三連。
- `objectives`: 1–2 個，type 僅 `collectColor`，同色目標不可重複；count 正整數。
- `witnessMoves`: `{row:0..5,direction:'left'|'right'}` 陣列，長度 ≤ moveLimit；必須由 engine replay 到 `won`。

## 4. 未來版本策略

- 特殊方塊/固定障礙不可偷偷塞入 `board` 字串。先增加結構化 `obstacles`、`specials` 並提升 ruleVersion。
- 若後續加入火箭、冰箱，需要在 parse、rules、solver、renderer 和 regression tests 同步擴充。
- 不允許客戶端根據未知的 ruleVersion 靜默使用舊規則，否則關卡可能變成無解。
