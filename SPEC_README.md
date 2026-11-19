# Parcel Pop Express — Web Demo 規格包 v1.0

**專案：**《轉轉物流局》Parcel Pop Express  
**目標：**先由 Claude Code 做出能在瀏覽器玩、能測試規則與手感的 Demo。**不是** Unity 行動遊戲正式版。

## 先做什麼

1. 把整個資料夾放入新的 Git repo，讓 Claude Code 先閱讀 `CLAUDE.md`。
2. 直接將 `CLAUDE_START_PROMPT.md` 的內容貼到 Claude Code。
3. 先完成 Milestone M0–M2：可操作棋盤 → 正確消除與掉落 → 10 關與可重播。
4. 逐一使用 `TEST_PLAN.md` 驗收；不要先接商店、廣告、雲端存檔。

## 文件導覽

| 文件 | 說明 |
|---|---|
| `GAME_PROPOSAL.md` | 遊戲定位、玩家價值、差異化、成功/淘汰準則 |
| `GAME_DESIGN.md` | 完整 Demo 遊戲循環、畫面、技能範圍、操作體驗 |
| `GAME_RULES.md` | **最高優先級**：盤面、操作、判定、重力、補箱的精確規則 |
| `LEVEL_DESIGN.md` | 關卡教學、10 關構成、障礙延後策略 |
| `LEVEL_SOLVER_SPEC.md` | 可解性、狀態快照、BFS、關卡驗證 |
| `TECH_ARCHITECTURE.md` | React/Vite/TS 結構、engine/UI 隔離與測試 |
| `MVP_ROADMAP.md` | 里程碑、驗收、風險和停損 |
| `CLAUDE.md` | Claude Code 必須遵守的專案規約 |
| `UI_UX_SPEC.md` | 直向棋盤布局、拖曳、動畫節奏、無障礙 |
| `LEVEL_DATA_SPEC.md` | `levels.json` 結構、規則版本、驗證 |
| `TEST_PLAN.md` | 測試矩陣、邊界測試、驗收流程 |
| `ART_DIRECTION.md` | Demo 色票、物件、回饋、避免 AI 視覺不一致 |
| `ASSET_LIST.md` | 需要的美術與音效資產，先用程式造型 |
| `ANALYTICS_PLAN.md` | 本地測試事件與玩家訪談 |
| `CLAUDE_START_PROMPT.md` | 可直接貼給 Claude Code 的首個指令 |
| `data/levels.v1.json` | 10 個示範關卡與可核對的解法見證 |

## MVP 範圍與刻意不做

- **做：** 6×6、4 色貨箱、整列左右循環位移 1 格、三連、同時消除、重力、Seed 決定性補箱、連鎖、局數/目標、10 關、音效與基礎動畫、手機瀏覽器操作、存檔、重播。
- **不做：** IAP、廣告、真實體力恢復、帳號、雲端資料庫、3D、動物角色、物流城市建設、4/5 連線特殊道具、障礙物。這些只留作後續擴展規格。

**重要：** 隨附的解題見證使用「首步即滿足指定消除目標」構造；不能把它誤稱為已驗證的完整難度曲線。正式遊戲須在 TS engine 跑過同樣 fixture 驗證再當作交付完成。
