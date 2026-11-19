# TASKS — Web Demo v1.1 里程碑

狀態：✅ 完成並有測試／驗證　🟡 部分完成　⬜ 未開始　⛔ 未能驗證（需實機）

## M0 — Logic
- ✅ 純 TS engine：整列循環平移、批次消除（交叉只算一次）、重力、xorshift32 補箱、連鎖（64 輪上限 → `ENGINE_CASCADE_LIMIT`）、目標與勝敗（勝利優先）
- ✅ `TurnResult.events` 事件輸出（ROW_SHIFTED / MATCH_REMOVED / CELLS_FELL / CELLS_SPAWNED / OBJECTIVES_UPDATED / TURN_COMPLETED / LEVEL_WON / LEVEL_LOST）
- ✅ Level validator（schema、stable board、seed、ruleVersion、witness replay、決定性）＋ BFS solver（`solvable / unsolvable / unknown`）
- ✅ 10 關資料載入與驗證；`bun run validate:levels` 輸出最短解與隨機策略勝率
- ✅ Vitest：TEST_PLAN E01–E17 全部有對應測試

## M1 — Playable 3D Board
- ✅ R3F Canvas、正交相機（自動適配，不裁切外圈）、6×6 共用幾何貨箱、木製托盤
- ✅ Pointer Events + raycast 選列、28px 閾值、垂直/取消/離開畫布不扣步、一次最多一格
- ✅ DOM HUD：關卡、配送目標進度、剩餘步數、重新開始、音效、返回
- ✅ 左右輔助箭頭與鍵盤（↑↓ 選列、←→ 平移），與拖曳走同一條 `submitMove`

## M2 — Event Animation
- ✅ 依 events 播放：平移（含循環 wrap 視覺）、消除擠壓→膨脹→消失＋粒子、掉落彈跳、補箱從上方落入、連鎖 Combo 文字與衝擊波
- ✅ resolving 期間鎖輸入；重開/切關以 token 取消舊 timeline；畫質切換中途重建 Canvas 時直接同步到已提交狀態
- ✅ 動畫結束後比對 presenter 盤面與 `nextState.board`，不一致即強制同步（並有 2000 步隨機測試證明一致）
- ✅ Reduced Motion：時長縮為 12%、取消彈跳/傾斜/衝擊波，結果相同

## M3 — Visual Quality
- ✅ 圓角貨箱＋膠帶＋四種白色壓印（郵票/水滴/葉片/星星）＋正面標籤；DOM 圖示與 3D 貼圖共用同一組 SVG path
- ✅ 暖色主光（左上前）＋半球光、Neutral tone mapping
- ✅ Low / Medium / High 畫質（DPR、陰影方式、粒子上限），設定可即時切換並保存
- ✅ WebAudio 合成音效（首次互動才解鎖、可關閉、失敗不影響遊玩）
- ✅ WebGL 不支援 / context lost 的 fallback 畫面與重試
- 🟡 背景只有 CSS 天空/山丘，未做微縮物流站景物（P1）

## M4 — Test & Delivery
- ✅ `bun run test`、`bun run build`、`bun run validate:levels`
- ✅ Playwright：桌面滑鼠 + 模擬觸控（Pixel 7）各 6 項 E2E
- ⛔ Android Chrome / iOS Safari 實機測試、實機 FPS：**未測**（雲端環境無實機）
- ⬜ 5–10 位玩家訪談（TEST_PLAN §4）

## 後續最小工作項
1. 重新設計 10 關難度（目前全部 1 步可勝，屬技術 fixture），用 `validate:levels` 的 BFS/隨機勝率調整。
2. 實機量測 FPS / draw calls，必要時把貨箱改為 InstancedMesh。
3. Home/選關加入微縮物流站背景（P1）、勝利鏡頭（P1）。
4. 本地匿名事件紀錄（ANALYTICS_PLAN）。
