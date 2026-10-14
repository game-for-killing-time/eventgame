# 手機連線試玩

## 網址

- 觀眾：https://game-for-killing-time.github.io/eventgame/
- 主持：https://game-for-killing-time.github.io/eventgame/host.html
- OBS：https://game-for-killing-time.github.io/eventgame/display.html

正式多人試玩不要加 `?demo=1`。手機不需要與主持電腦連在同一個 Wi-Fi。

## Firebase Console：發布最新規則

1. 開啟 `hoho-event-game` 專案 → Realtime Database → 選擇 `hoho-event-game-default-rtdb` →「規則」。
2. 先複製現有規則到自己的文字檔保存。
3. 開啟本專案根目錄 `database.rules.json`（也可在 GitHub 開啟該檔案並選 Raw）。複製整份內容，取代規則編輯器全部內容，再按「發布」。不是貼到「資料」頁。
4. 不要自行改成 `.read: true`、`.write: true`。新規則包含私人 `hostOnly`、公開島民位置、截止時間、聊天限制及必要索引。
5. 規則發布不會刪除既有房間資料。指定主持人仍由資料頁 `/config/hostUid` 設定；若沒有換主持人，保留目前的值。

## Firebase Console：登入設定

Authentication → 設定 → 授權網域 → 新增 `game-for-killing-time.github.io`。只填網域，不含 `https://` 或 `/eventgame/`。

Authentication → 登入方式，確認「匿名」及「電子郵件／密碼」已啟用。主持人使用指定正式帳號；觀眾用匿名登入。若先前已開啟，不需重建使用者。

## 開始試玩

先完成規則和網域設定，再開線上主持頁登入。若已有房間，確認是要繼續的房間；需要新場時，先結束並在確認不需保留資料後清理，再建立。

把觀眾網址和主持頁顯示的房間碼交給朋友。在手機 Safari／Chrome 輸入暱稱加入，開始一題，提交後確認狀態，再截止及揭曉。也可直接分享主持頁「開啟觀眾網址」的連結，其中會帶入房間碼。

第一次建議兩部手機先試：重整恢復、截止後不可補答、兩題後默契分布、故事只有選取才出現在展示。真實手機和 OBS 仍需試播，雲端建置成功不等於這些已通過。

## 後續網站更新

這次使用 `codex/initial-backup` 的已備份版本，在 GitHub Actions 手動執行 `Test and deploy GitHub Pages`。此分支 push 不會自動部署；之後可在 Actions → 該工作流程 → Run workflow 選擇這個分支。現有流程只有 push 到 `main` 才自動部署。

GitHub Pages 更新網站不會發布 Firebase 規則；兩者分開操作。改版安排在活動結束後。

## 首次正式發布紀錄（2026-10-14）

GitHub Actions 工作 38536285315 已成功部署版本 b9bc68d。遊戲測試、Database Emulator 規則測試、Firebase 分支建置與正式建置全部通過。

三個公開頁面已在瀏覽器載入：觀眾頁顯示 Firebase 多人模式及已連線；主持頁顯示登入表單；展示頁讀到既有房間的公開結果。觀眾頁未捕捉到 console error。尚未使用正式主持人密碼登入或做手機跨網路作答；Firebase 規則仍需帳號持有人按上方步驟發布。

檢查時既有 YE24QJ 房間為已結束狀態。試新場前需主持登入，決定是否保留舊資料，再清理並建立新房間；不應繼續分享已結束的房間碼。

部署紀錄：https://github.com/game-for-killing-time/eventgame/actions/runs/38536285315
