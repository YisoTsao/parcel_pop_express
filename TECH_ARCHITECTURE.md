# TECH_ARCHITECTURE — Premium 2.5D Web Demo v1.1

> 狀態：2026-11-19 更新。取代 v1.0「禁止 Three.js」的選型。本檔只改**呈現技術**，不修改 `GAME_RULES.md` 的權威消除規則。目標是可玩 Web 遊戲，而非靜態 3D 模型展示。

## 1. 產品範圍與選型

- **Runtime：** Vite + React + TypeScript（`strict: true`）；手機直向及桌面瀏覽器。
- **3D：** `three` + `@react-three/fiber`（R3F）+ `@react-three/drei`，以正交相機呈現 6×6 立體貨箱與棋盤。
- **HUD：** React DOM / CSS（可採 Tailwind，但非必要）。數字、目標、步數、選關、勝敗、設定不得烘焙進 WebGL 畫布。
- **狀態：** game engine 純 TypeScript；遊戲流程用 reducer / 小型 store（可選 Zustand，避免同時導入多套狀態來源）。動畫呈現狀態獨立管理。
- **測試：** Vitest（規則）、React Testing Library（HUD）、Playwright（桌面及觸控端到端）；WebGL 的端到端測試必須有 deterministic 測試模式。
- **P0 非目標：** 物理引擎、多人、後端、IAP、廣告、登入、城市自由探索、即時全域光照、完整 Tripo 資產管線。

**選型理由：** 只有 36 個棋盤貨箱，不需要大型 3D 引擎；立體材質、透視深度、光照、粒子與微縮場景可以提升操作回饋。**保留 2D 邏輯和 DOM HUD**，使日後更換 2D renderer 或移植 Unity 成本可控。

依賴版本遵守目前 repo 的相容範圍，新增時查閱官方版本相容性；不要在文件裡盲目固定未安裝的版本。

## 2. 建議專案結構

```text
src/
  app/App.tsx
  app/GameShell.tsx            # DOM layout / WebGL Canvas 容器
  game/engine/                 # 完全不 import React / Three
    types.ts rng.ts shift.ts findMatches.ts gravity.ts
    applyMove.ts objectives.ts solver.ts index.ts
  game/data/levels.v1.json
  game/data/parseLevel.ts
  game/state/gameReducer.ts    # ready / resolving / won / lost
  game/render3d/
    GameCanvas.tsx             # <Canvas> / DPR / GPU 降級
    CameraRig.tsx             # orthographic / fit board
    LightingRig.tsx           # 主要光與環境光
    BoardScene.tsx            # board group、格子座標
    ParcelMesh.tsx            # 共用幾何與材質；壓印圖標
    BoardInteraction.tsx      # raycasting / pointer to row
    TurnTimeline.ts           # engine events -> scene animation
    ParticlePool.tsx          # capped VFX
    Effects.tsx               # optional bloom, high quality only
    quality.ts                # low / medium / high
  game/ui/
    ObjectiveBar.tsx MoveCounter.tsx LevelResults.tsx
    LevelSelect.tsx SettingsPanel.tsx QualitySelector.tsx
  shared/storage.ts
  shared/audio.ts
  styles/tokens.css
  styles/game.css
scripts/validate-levels.ts
tests/engine/*.test.ts
tests/e2e/game.spec.ts
```

## 3. 核心邏輯與 3D Presenter 邊界（強制）

| 層 | 可以做 | 絕對不可做 |
|---|---|---|
| `game/engine` | 規則、PRNG、消除、下落、收集、勝負、TurnResult events | 引用 React/Three/DOM、讀時間、執行動畫 |
| `game/state` | 接收輸入、呼叫一次 `applyMove`、記錄 nextState、控制 input lock、關卡切換 | 自行判定匹配或生成貨箱 |
| `game/render3d` | 將格子映射為 3D 座標、操作射線、動畫、粒子、光影 | 修改棋盤邏輯、重新擲隨機數、修改關卡步數 |
| `game/ui` | 顯示 HUD、選關、勝敗、設定 | 依 3D Mesh 畫面推算規則狀態 |

**狀態同步契約：** `applyMove(state, action)` 同步回傳 `{ nextState, events }`。邏輯先 commit；Presenter 按 events 製作 timeline。渲染對象應有 `cellId` / 動畫期內的穩定識別，避免以陣列 index 當 mesh identity 導致掉落串位。最終 presenter 視圖需嚴格對齊 `nextState.board`。

## 4. 3D 棋盤座標、相機與互動

- 純邏輯座標：`(r,c)`，左上 `(0,0)`；不改 `GAME_RULES.md`。
- 顯示座標：每格 `1 world unit`；棋盤中心原點，`x = c - 2.5`、`z = r - 2.5`；貨箱中心 `y ≈ 0.25`。請在 `boardToWorld` 建立唯一轉換函式與測試。
- 正交相機固定從棋盤略上方觀看（例如 `(0, 8.5, 8.5)` 朝向 `(0,0,0)`）；正交視角不要讓行列辨識困難，允許先採近乎俯視。相機依 viewport 比例適配整塊 6×6，絕不可裁切最外圈可操作區域。
- 桌面滑鼠與手機 touch 都使用 Pointer Events；pointer down 射線投射找到起始 row，pointer up 算 `deltaX`、`deltaY`，必須 `abs(deltaX) >= threshold` 且 `abs(deltaX) > abs(deltaY)*1.3` 才提交恰好一格。閾值依 CSS pixel，不用 3D world units。
- 僅在棋盤區的觸控啟用 `touch-action: none`（或等效限制），其他 UI 保留可捲動及點擊。
- 先鎖方向再結算，取消/跨出容器不扣步；事件播放、贏、輸期間不收輸入。
- R3F raycast 只負責辨識點到哪一列，不得引入 3D 物理來判定消除。

## 5. 回合事件動畫

**引擎一口氣算完回合；動畫不推進 RNG。** UI 切成 `resolving` 並立即鎖定下一次輸入，Presenter 按序處理：

1. `ROW_SHIFTED`：貨箱整列平移 140–220ms，邊界循環貨箱需有明確 wrap 視覺（或淡出→另一端淡入）。
2. `MATCH_REMOVED`：命中貨箱擠壓、縮放消失約 140–200ms；粒子從實際格位產生。
3. `CELLS_FELL`：從原 world position 動畫到 target position 180–280ms；同時避免殘影。
4. `CELLS_SPAWNED`：從棋盤上方短距離落入 180–260ms。
5. 連鎖：同一回合增加 Combo 文案、柔和脈衝與音效，切勿讓畫面不可讀。
6. `OBJECTIVES_UPDATED`、`LEVEL_WON` / `LEVEL_LOST`：HUD 更新，最後解除鎖定或切換畫面。

事件具一致 `turnId`；重啟、切關、卸載需取消整個 timeline（例如 AbortController / generation token），舊動畫不得覆寫新關卡。跳過動畫、Reduced Motion 和低畫質仍應到相同最終邏輯結果。避免 `setTimeout` 散落在個別 Cell component。

## 6. 模型、材質與光影

- P0 每色 1 個共享圓角方盒 `BoxGeometry`/經簡化的 bevel 模型；不要一個格子一個獨立 GLB 下載。**四種顏色加四種不同壓印符號**，不只靠顏色。
- 材質採 `MeshStandardMaterial`（粗糙度偏高、輕微高光），共用 mesh geometry / material / texture atlas；避免鏡面強反光改變顏色辨識。
- 主光 1 個 Directional Light + Ambient/Hemisphere；陰影先用廉價接觸陰影貼片或少量 shadow map；P0 不依賴即時陰影才能看懂物件。
- Tone mapping / color management 必須固定，確保 HUD 色與 3D 實際視覺色接近。
- Bloom、光圈、特殊 shader 屬 P1 enhancement，必須可關閉。**P0 不上 DOF、SSAO、SSR、volumetric lighting、動態全域照明、物理模擬。**
- 資產流程：設計圖 → 一套 Blender 主模型 → GLB/GLTF（若需要）→ 壓縮與驗證 → Three.js。圖像生成與 Tripo 只做概念或特別物件，不是量產貨箱來源。

## 7. 手機效能與畫質分級

| 配置 | Low | Medium（手機預設） | High（桌面） |
|---|---|---|---|
| DPR 上限 | 1 | 1.5 | 2（硬體允許） |
| 陰影 | 關閉或假陰影 | 少量接觸陰影 | 有限制的 shadow map |
| 粒子數上限 | 每次 12 | 每次 32 | 每次 64 |
| Bloom / PostFX | 關 | 預設關，手動啟用 | 可選，僅高亮特殊效果 |
| 背景場景 | 靜態低面 | 簡單低面層次 | 低面景深分層，不必 DOF |

- 目標桌面 60FPS、手機力求 60FPS；實機持續低於目標則降低 DPR/粒子/陰影。這些是 **設計目標，不是已測結果**。
- 使用 `useFrame` 時避免每幀 React state 更新、臨時建立 geometry/material/vector；渲染工作應使用 ref / 物件池。
- 停止/背景頁應暫停非必要渲染與音效；瀏覽器失去 WebGL context 必須有友善降級與重試提示。
- 開發中至少量測 Android Chrome、iOS Safari，以及低階配置；執行滑動時檢查 pointer 延遲、記憶體、過熱、瀏覽器縮放。
- 手機直向 9:16；安全區（safe-area-inset）、HUD/Canvas 不重疊；畫面較矮時寧可縮小背景而非裁切棋盤。

## 8. 測試矩陣與驗收

- **Engine tests：** 全面沿用 `GAME_RULES.md` 和 `TEST_PLAN.md`，包括 seed、witness、連鎖上限與勝負優先序。
- **Presenter tests：** 同一 `events` 在 Low/High、Reduced Motion/正常模式下呈現相同 `nextState`；切關中止舊 timeline；掉落動畫對應來源/目標座標；不產生重複提交。
- **E2E：** 在桌面滑鼠及模擬 touch 執行左右滑列、垂直手勢無效、取消手勢不扣步、勝敗、重開、十關解法。
- **Visual acceptance：** 4 色在亮/暗不同背景清楚區分、3D 圓角與壓印一致、無誤裁切、畫質設定生效、關閉 PostFX 不影響遊玩。
- **性能：** 以實測 FPS、frame time、memory 與渲染 draw calls 記錄裝置、瀏覽器及設定；不可臆測已達標。

## 9. 本地存檔與未來 Unity

`localStorage` P0 保存 schemaVersion、completedLevelIds、lastLevelId、soundEnabled、reducedMotion、graphicsQuality；資料讀取錯誤使用安全預設。遊玩中重新整理可重啟當關，不需中途回合還原。無付費資料或 API keys。

純 TS 核心不可直接移植 C#，但 JSON fixture、種子、操作清單及每回合事件結果可以作為 Unity 重寫版的跨引擎合約。Three.js/R3F 只是 renderer，不應被視作 Unity 資產或 C# 可直接重用代碼。

## 10. 依據文件與衝突規則

`GAME_RULES.md` > `LEVEL_DATA_SPEC.md` > 本檔（技術/渲染） > `ART_DIRECTION.md`（視覺） > 其他文件。若 `README.md`、`MVP_ROADMAP.md`、`ASSET_LIST.md` 等仍寫「不做 3D」，以本 v1.1 更新的 **P0 立體棋盤** 為準；其餘不在 P0 的城市建設、角色、付費等仍延後。任何引擎規則修改都必須另外修訂 `GAME_RULES.md`，不能藉動畫改規則。
