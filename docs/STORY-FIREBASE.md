# 潮汐島：Firebase 多人故事

正式入口：

- 玩家：https://game-for-killing-time.github.io/eventgame/story.html
- 主持：https://game-for-killing-time.github.io/eventgame/story.html?role=host
- 展示：https://game-for-killing-time.github.io/eventgame/story.html?role=display

正式頁沒有模擬玩家或自動填答。只有 `story.html?demo=1` 是獨立本機試玩，使用 localStorage，不能讓其他手機連線。兩種模式不共用房間或身分。

## 發布規則（先做這一步）

1. 打開 Firebase Console → hoho-event-game → Realtime Database → **規則**。
2. 開啟儲存庫 `codex/initial-backup` 分支的 `database.rules.json`，按 **Raw**，複製完整 JSON。
3. 取代規則編輯器的全部內容，按 **發布**。不要只貼 adventure 片段，也不要將根節點 read/write 改成 true。
4. 到「資料」確認 `/config/hostUid` 仍是正式主持帳號的 Firebase UID。這次不需要更換 UID、電子郵件或密碼。
5. 網站發布完成後重新整理故事主持頁，使用現有正式帳號登入。建立故事房間並複製邀請網址。

規則檔：https://github.com/game-for-killing-time/eventgame/blob/codex/initial-backup/database.rules.json

沿用現有 Anonymous 與 Email/Password 登入。Authentication → Settings → Authorized domains 應包含 `game-for-killing-time.github.io`（不含 https 或 /eventgame）。不需要 Storage、Cloud Functions 或升級帳單方案。Web app config 是公開連線資訊；不要將密碼、服務帳號金鑰放入專案。

## 主持流程

建立房間 → 玩家入座 → 開始冒險 → 選路（分流幕）→ 作答 → 截止 → 揭曉 → 聊故事 → 下一幕。

- 主持請保持主持頁開啟；它負責派發私人題目、更新已提交人數、自動截止與結算。可另外開「我要一起玩」，主持登入與玩家匿名身分分開保存。
- 主持離線期間，伺服器仍拒絕逾時答案。重開主持頁會恢復資料並繼續推進；沒有 Cloud Functions，不能在主持永久離線後自動推進全場。
- 截止前改答覆蓋自己的原答案；只有伺服器確認才顯示已提交。斷線時請重連後重新提交，不承諾離線交卷成功。
- 分流時未選路者按座位安排；漏答不增加性格或得分。第 8 幕潮洞選 A，第 9 幕會有被困專屬題，該幕揭曉必定歸隊。
- 第 16 幕同票有一次 30 秒決選；再次同票按固定 A–D 順序。第 18 幕揭曉產生私人結局卡，玩家自行分享或撤回。展示頁只接收公共故事與獲同意的卡片，不讀取個人答案或性格明細。
- 性格文字只是本場故事選擇的回顧，不是心理測驗或診斷。
- 清理前展開「結束與清理」並匯出備份，結束後勾選確認再清理。備份含私人資料，請妥善保存。聊天、答案、事件一直保留到清理，不會自動刪除。
- 約兩小時：開場 6 分鐘，六章各 17 分鐘，結局分享 12 分鐘；章末篝火討論由主持掌握，不強制倒數兩小時。

## 資料與權限

原有遊戲 `/room` 不變；故事使用獨立 `/adventure`：

| 節點 | 可讀／可寫 |
|---|---|
| public | 所有人讀；正式主持寫（公共故事、階段、期限、成員與分數） |
| hostOnly | 只有指定正式主持讀寫（完整引擎、性格、事件、結果、默契） |
| roster、seats | 自己原子建立一次身分與座位；20 個固定座位限制容量 |
| inbox/UID | 該玩家和主持讀；只有主持寫（自己的題目、回顧與結局卡） |
| inputs | 玩家只能讀寫自己的本輪輸入；伺服器 now 檢查期限與階段 |
| moderation/UID | 本人讀，主持寫；移除與禁言在規則層限制 |
| consent/UID | 本人控制是否分享，必須對應本場且已結束 |
| sharedCards/UID | 只在本人已同意時允許公開讀取；撤回立即拒絕新讀取 |
| chat/UID | 本人新增，主持管理；300 字、3 秒冷卻，按時間每人最多讀取最近 3 則，畫面最多 40 則 |

根交易一次發布公開故事、私人 inbox 與主持狀態。房間 ID、幕次、階段共同防止舊操作影響新輪次；結算結果保存後重試不再加分。動畫不逐幀寫入資料庫。

匿名登入無法保證一人一帳號。已分享卡片可能被觀眾截圖；撤回只能停止網站後續展示與讀取，不能收回他人的截圖。靜態故事包可從原始碼讀取，不承諾劇情防劇透；玩家實際私人資料以資料庫權限隔離。

## 驗證紀錄（2026-10-15）

- `npm test`：19 項通過（原有遊戲 9、故事引擎 10）。
- `npm run test:rules`：原有 16 項與故事 7 項。故事測試建立 10 個不同 auth context，以真 Firebase SDK 同時加入、監聽、交卷及覆蓋答案；不是同一 UID 重複分頁。
- 完整 18 幕在 Emulator 逐輪交易，涵蓋不同路線題目、第 9 幕被困、第 16 幕決選、個人卡、重試不重複計分。
- 直接存取測試：私人題目與答案、主持性格、未分享卡片、偽造角色／分數／時間、越界座位、逾時離線補送均被拒絕；禁言、移除、訊息長度、冷卻、刪改舊訊息與分享撤回亦測試。
- 瀏覽器使用 Auth + Database Emulator 實際登入主持，建立房間，以獨立匿名玩家加入、選擇、提交、揭曉得 1 分，再分流與重整恢復。未登入展示頁只有公共故事。正式主持 UI 無模擬玩家及填答工具。
- 玩家畫面以 360、390、430px 檢查寬度，截圖：`docs/screenshots/story-firebase-player-390.png`。
- 真實手機觸控、不同實體網路、OBS Browser Source 與兩小時長時間直播尚未實測；Emulator 通過不等於這些環境已通過。正式站也需要主持登入開一場實際試播。

開發 UI Emulator：啟動 `firebase emulators:start --only auth,database --project demo-hoho`，另設環境變數 `VITE_STORY_EMULATOR=1` 再執行 `npm run dev`。此開關只在 Vite development 模式生效，正式 build 不會連到 Emulator。測試帳號只建在 Auth Emulator；不要輸入正式密碼。

## 額度與維護

在 Firebase → Realtime Database →「用量」查看連線、儲存及下載；Authentication 查看匿名帳號用量。主持持續監聽私人房間，玩家只訂閱公共與自己的資料；仍應在試播後觀察實際流量。使用 Spark，未啟用付費服務。建議每場結束先匯出再清理故事房間。

官方依據：[交易與讀寫](https://firebase.google.com/docs/database/web/read-and-write)、[規則繼承](https://firebase.google.com/docs/database/security/core-syntax)。
