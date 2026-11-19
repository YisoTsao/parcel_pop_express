# ANALYTICS_PLAN — 先做本地可用的研究

## 1. 不先接第三方分析

P0 不需 GA4 / Firebase / Supabase。先做可下載的本地匿名事件 JSON，玩家須明白這是測試資訊，不包含帳號、IP、廣告識別碼。若要上線收集真實玩家事件，先備妥隱私告知、資料保存政策及必要同意流程。

## 2. 事件

- `level_start {levelId,startedAt}`
- `move_committed {levelId,row,direction,remainingMoves,turnId}`
- `match_resolved {turnId,removedCount,cascadeDepth}`
- `level_end {levelId,result,movesUsed,durationMs,maxCascade}`
- `restart_clicked {levelId}`
- `tutorial_hint_shown {levelId}`
- `settings_changed {soundEnabled,reducedMotion}`

不用收集每個指尖座標或精確身分資料。開發版可以以 DevTools/Export JSON 觀察，正式收集時再設限速、同意與匿名化。

## 3. 第一輪指標

- 第一次成功消除耗時。
- 第一關完成率。
- 每關平均有效消除率與 dry move 率。
- 每名玩家完成關卡數、主動重玩比率。
- 連鎖深度與玩家主觀評價的關聯。

設計目標：初次玩家 90 秒內成功消除比例 80%，10 名玩家中至少 6 人願意進下一關。**沒有實測前只能寫設計目標**。
