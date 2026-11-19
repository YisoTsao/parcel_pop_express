# MVP_ROADMAP — Web Demo 兩週驗證計畫

> 這是 1 人 + Claude Code 的排程**估算**；非交付保證。第一目標不是付費功能，而是遊戲手感與規則可信度。

## M0 — 專案基底（0.5–1 天）

- Vite React TypeScript + lint + formatter + Vitest + Playwright。
- 匯入規格、設定 code review 規則、建立 `engine/` 和 2 個 smoke tests。
- 驗收：`npm install`、`npm run dev`、`npm test`、`npm run build` 可執行。

## M1 — 預設規則引擎（2–3 天）

- 行位移、batch match、gravity、spawn PRNG、cascade、目標勝敗。
- 用表格測試涵蓋交叉重疊、最後一手通關、無 match 仍扣步、相同 Seed 重播。
- 驗收：無 UI 環境可以用 move sequence 得到 deterministic 狀態；與 `GAME_RULES.md` 完全一致。

## M2 — 可玩棋盤（2–3 天）

- 滑鼠／觸控拖曳，明確一格預覽、animator 和輸入鎖、10 關 JSON、結算／重玩。
- 驗收：手機與桌面能連玩十關；沒有卡動畫；witness replay 通過。

## M3 — 視覺打磨及測試（2–3 天）

- 非 AI 拼貼的 2D Sprite 或 CSS 方塊、音效、連鎖震動（支援時）、成功/失敗 UI、Responsive、Reduced Motion。
- 驗收：操作辨識度高；360px 寬不裁切；連續 10 局無 UI 堆疊問題。

## M4 — 外部測試（2–3 天）

- 公開靜態預覽（例如 Vercel / GitHub Pages，選一個即可）、招募 5–10 位玩家。
- 觀察首次完成消除時間、無效操作比率、重玩率、主觀爽感與混淆點。
- 驗收：形成量化紀錄與修改清單，決定是否進入 30 關版本。

## 發布門檻

- 100% 規則單元測試通過；全部 10 關 JSON schema 和 witness 驗證通過。
- 本機 build 成功，端到端操作可完成至少一關。
- 新使用者在 90 秒內第一次成功消除比例目標 ≥ 80%（≥ 10 位測試者才當指標）。
- 不出現扣步錯誤、收集數 double count、RNG 不能重播、最後一步被誤判失敗。

## 排除事項

正式 UI 插畫、美術角色、完整商店、體力、雲端服務、特殊箱、木箱、付費功能都不影響本階段驗收。若兩週時間不足，優先刪音效/特效，保留正確規則與操作。
