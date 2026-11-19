# DECISIONS — Web Demo v1.1 實作取捨紀錄

依 `CLAUDE.md` §2：文件衝突或重大取捨記錄於此。核心規則一律以 `GAME_RULES.md` 為準，未修改任何規則。

| # | 項目 | 文件差異 / 問題 | 決定 | 理由 |
|---|---|---|---|---|
| D1 | Package manager | `CLAUDE.md` 寫 `npm run …`；需求方要求 `bun install` / `bun run dev` | 使用 **bun**（`bun.lock`），scripts 與 npm 相容 | 需求方明確指定；CLAUDE.md 允許「沿用 repo 的 package manager」 |
| D2 | 狀態管理 | `CLAUDE.md` 建議先用 reducer、必要才加 Zustand；需求方明確指定 Zustand | 只用 **一個** Zustand store（`game/state/gameStore.ts`），另一個極小 store 只放棋盤列的螢幕座標 | 需求方指定；未同時導入多套狀態來源 |
| D3 | 文件位置 | 規格包原本在 repo 外 | 規格 `.md` 放在 repo 根目錄；規格包原 README 改名 `SPEC_README.md`；`README.md` 改為實際啟動說明 | `CLAUDE.md` 要求從根目錄閱讀 |
| D4 | 關卡資料位置 | `LEVEL_DATA_SPEC` 寫 `data/levels.v1.json`，`TECH_ARCHITECTURE` 寫 `src/game/data/` | 單一來源 `src/game/data/levels.v1.json` | 避免兩份副本不同步 |
| D5 | 第 3 關名稱 | 名稱「收集紅箱」但目標是 `B×3`，witness 也只收藍箱 | **只改名稱**為「目標追蹤」，目標/seed/盤面/witness 不變 | 名稱是顯示文字，目標是規則資料；改目標會讓 witness 失效 |
| D6 | 關卡可解性 | 10 關皆為「一步可勝」的技術驗證 fixture（`LEVEL_DESIGN` §2 已註明） | 保留原資料；全部通過 schema、stable board、witness replay、BFS（最短解 1 步） | 無無解關卡，不需修正；難度曲線需後續重新設計（見 TASKS 待辦） |
| D7 | 事件形狀 | `GAME_RULES` §8 寫 `CELLS_FELL {from,to}`、`CELLS_SPAWNED {position,color}` | 每一連鎖輪各發 **一個** 事件，內含陣列 `falls[]` / `spawns[]`；所有事件帶 `turn` | 同一輪的掉落/補箱需同時播放；資訊與規格相同 |
| D8 | 回合狀態 `resolving` | `GAME_RULES` 的 status 含 `resolving` | Engine 同步算完整回合，只輸出 `ready/won/lost`；`resolving` 由 store 的 `phase` 表示並鎖輸入 | Engine 不得依賴動畫時間 |
| D9 | 滑動閾值 | `UI_UX_SPEC`：28px 且 `|dx|>|dy|×1.25`；`TECH_ARCHITECTURE`：`×1.3` | 28px 且 `×1.3` | 技術以 `TECH_ARCHITECTURE` 為準 |
| D10 | 動畫時長 | `UI_UX_SPEC` 與 `ART_DIRECTION` 數值略不同 | 採 `ART_DIRECTION` / `TECH_ARCHITECTURE`（平移 200ms、消除 180ms、掉落 180–280ms、補箱 ~220ms） | 視覺以 `ART_DIRECTION` 為準 |
| D11 | 畫質分級陰影 | 表格：Medium「少量接觸陰影」、High「有限 shadow map」 | Low＝貨箱下方假陰影貼片；Medium＝drei `ContactShadows`；High＝2048 shadow map | 對應 `TECH_ARCHITECTURE` §7 |
| D12 | Tone mapping | 需固定 | `NeutralToneMapping` + sRGB | 色相最接近 HUD 色票，不把黃箱沖白 |
| D13 | 粒子隨機 | 規則禁止動畫使用 RNG | 粒子噴散方向用 `Math.random`（只在 render3d，純視覺），規則 RNG 只在 engine 的 xorshift32 | 不影響任何盤面或結果 |
| D14 | StrictMode | React StrictMode 開發期會重複 mount，導致 `useMemo` 建立的 GPU 資源被提前 dispose | 不使用 `<StrictMode>` | 避免開發模式下貼圖失效 |
| D15 | 參考圖 | 參考圖含紫色箱、火箭、炸彈、木箱、愛心/鑽石、角色 | 只取「圓角膠帶貨箱、木製托盤、奶油色面板」風格；**不加入**第 5 色、特殊箱、障礙、經濟系統 | P0 範圍禁止（`GAME_RULES`、`ART_DIRECTION` §9） |
| D16 | E2E 偵錯掛鉤 | E2E 需要讀取狀態 | 開發模式或 `?e2e=1` 時提供唯讀 `window.__ppe`（狀態快照、列座標、關卡清單） | 遊戲本身從不使用 witness 幫助玩家 |
