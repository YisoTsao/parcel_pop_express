# 直接貼給 Claude Code — 第一個執行 Prompt

請先閱讀這個 repo 的 `CLAUDE.md`、`README.md`、`GAME_RULES.md`、`LEVEL_DATA_SPEC.md`、`TECH_ARCHITECTURE.md`、`TEST_PLAN.md`，並參考其他設計文件。

我的目標是**真的能在瀏覽器遊玩的《轉轉物流局》Web Demo**，而非 Unity、靜態設計稿或一次性視覺演示。

請你直接執行以下工作：

1. 檢查現有 repo，建立 Vite + React + TypeScript 專案。若已有基底請沿用而非覆蓋。
2. 實作可獨立測試的純 TypeScript 遊戲引擎：整排左右循環平移 1 格、水平/垂直 >=3 批次消除、重力、xorshift32 固定 Seed 補箱、連鎖、通關、失敗。
3. 用 Vitest 建立測試；嚴格遵照 GAME_RULES 和 TEST_PLAN。請優先跑單元測試，修正所有失敗。
4. 載入 `data/levels.v1.json` 十關，建立 validator 與 witness replay，確認每個示範關卡能在遊戲引擎中依 witness 通關。若資料格式不符合規格，記錄差異並修正，不得默默改變遊戲規則。
5. 用 React/CSS 做出漂亮且清楚的直向棋盤。手機手指可拖曳，電腦滑鼠可拖曳，還要提供左/右輔助操作；要有目標、剩餘步數、消除動畫、連鎖、勝敗、重玩和選關。
6. 完成 `npm run dev`、`npm run build`、`npm test` 與一個 Playwright e2e smoke test；如果環境無法跑，回報原因。
7. 將工作拆成 Tasks，完成各里程碑時更新 `TASKS.md`；最後回報可玩的入口網址/本機指令、完成清單、測試結果和已知限制。

嚴禁提前加入登入、資料庫、IAP、廣告、體力、正式城鎮建設、3D 場景或未經規格定義的特殊貨箱。以**核心玩法可玩、視覺清楚、操作有爽感且規則可重現**為最高優先級。
