# Firebase 與 GitHub Pages 設定

專案已填入你提供的 Firebase 網頁設定。可用 ?demo=1 明確進入本機模擬；本機網址不能分享給不同網路的觀眾，GitHub Pages 的正式部署仍需完成。

## 1. 建立 Firebase（帳號持有人操作）

1. 在 Firebase Console 建立專案，維持 **Spark**；不需要綁信用卡，不建立 Cloud Functions、Cloud Storage 或 App Hosting。
2. 加入一個 Web app，複製公開的 `firebaseConfig`。只需 `apiKey`、`authDomain`、`databaseURL`、`projectId`、`appId`；不需要 Analytics。
3. Authentication → Sign-in method 啟用 **Anonymous** 和 **Email/Password**（密碼登入，不是 email link）。
4. 在 Authentication → Users 新增主持人電子郵件密碼帳號。密碼由你自己設定，**不用傳給開發者或寫进專案**。複製該帳號的 UID。
5. 建立 Realtime Database，選合適地區；先選鎖定模式。複製精確的資料庫 URL（不同地區可能是 `firebasedatabase.app`，不要猜網址）。
6. 在資料頁以 Firebase Console 寫入 `/config/hostUid`，值為上一步 UID 字串。這是管理者透過 Console 設定，不是前端自報角色；網頁規則禁止改寫。
7. 規則頁完整貼上專案的 `database.rules.json` 並發布。它已包含索引。請勿留下測試模式或根節點 `.read/.write: true`。

也可在已登入且明確指定專案的本機使用：

```sh
npx firebase deploy --only database --project YOUR_PROJECT_ID
```

這條命令會更新該專案的規則；請核對專案。不要用 `demo-hoho` 發布正式規則。

## 2. 放入非機密設定

編輯 `config.js`，參照 `config.example.js`：

```js
export const config = {
  firebase: {
    apiKey: '你的網頁 API key',
    authDomain: '你的專案.firebaseapp.com',
    databaseURL: 'Console 提供的完整 URL',
    projectId: '你的專案 ID',
    appId: '你的 Web app ID'
  },
  twitchUrl: 'https://www.twitch.tv/你的頻道',
  emulators: false
};
```

Firebase Web config 必須送到觀眾瀏覽器，是公開識別資訊，不是管理員憑證。實際資料保護靠 Authentication 和資料庫規則。**服務帳號 JSON、private_key、Admin SDK 憑證、密碼、登入 token 都不能放進設定、Git 或對話。** 可參考 [Firebase API key 官方說明](https://firebase.google.com/docs/projects/api-keys)。如 API key 有 HTTP referrer 限制，將正式 GitHub Pages 網域及允許的開發網址加入，避免阻擋 Authentication API。

## 3. 登入授權網域

Authentication → Settings → Authorized domains 加上 `game-for-killing-time.github.io`，自訂網域則加該 hostname；不要填 `https://`、路徑或 `/eventgame/`。本機測試時確認 `localhost`／`127.0.0.1` 的設定，新的專案不應假設已自動允許 localhost。正式主持登入和匿名登入都需在上線環境再實測一次。

## 4. 發布至 GitHub Pages

目標 GitHub 儲存庫已由持有人提供：`https://github.com/game-for-killing-time/eventgame.git`。尚未確認儲存庫內容、推送或啟用 Pages；待 Firebase 設定完成及取得發布授權後執行。

1. 將原始碼與 `package-lock.json` 放入目標儲存庫；不要上傳 node_modules、暫存資料、日誌或機密。
2. 確認 `config.js` 是正式公開設定，`emulators: false`。設定變更後必須重新建置。
3. GitHub 儲存庫 Settings → Pages → Source 選 **GitHub Actions**。
4. 現有 `.github/workflows/pages.yml` 在 `main` push 或手動執行時，安裝依賴、跑遊戲及 Emulator 測試、建置並發布 `dist/`。如果你的預設分支不是 main，調整 workflow 的 branches。
5. 等 workflow 完成，使用它輸出的 Pages URL，不猜測已上線。

目標網址形式：

- 觀眾：`https://game-for-killing-time.github.io/eventgame/index.html`
- 主持：`https://game-for-killing-time.github.io/eventgame/host.html`
- OBS：`https://game-for-killing-time.github.io/eventgame/display.html`

以上為未設定自訂網域時的預期網址，尚未發布或驗證。

資源使用 `base=./`，內部連結也使用相對路徑，支援儲存庫子路徑。只有 `dist/` 發布至 Pages，測試、規則與文件不必作為網站資源發布。GitHub Pages 免費可用範圍與儲存庫可見性／帳號方案相關；若目標私人庫不支援 Pages，先與持有人確認方案，不能自行付費升級。[GitHub Pages 建立說明](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)

## 5. 上線後驗收

用至少兩個獨立瀏覽器身分測觀眾、指定正式帳號測主持、未登入視窗測展示；確認網址不是 `demo=1`、頂部不是本機模擬。再跑 HOST.md 的 15 分鐘試播，查看 Console Usage。把實際線上網址和日期記入 TESTING.md；尚未測就不勾選。

## 現在需要你提供的資料（一次集中）

- Firebase Web config（上面五項公開欄位）。
- 已建立主持人帳號的 UID，並確認已在 Console 指定它；不用提供密碼。
- Twitch 頻道網址。
- 是否授權推送至已提供的 eventgame 儲存庫並啟用 Pages 發布。

## 清理與停止使用

主持頁先按「結束房間」，再「清理資料」並確認；刪除 `/room` 下的所有本場資料，保留 `/config/hostUid`。清理不可回復，若要保留結果應先自行匯出。刪房不會刪 Authentication 使用者，匿名帳號可在 Console 另行管理；不要隨意刪除主持人帳號。不存在自動清理承諾。
# 手機與島民默契版的更新順序

本版不增加 Firebase 服務，不需要 Cloud Functions 或升級方案。請等正在進行的活動結束，再依序：

1. 在 Realtime Database 的「規則」頁發布專案最新 `database.rules.json`（或使用既有 Firebase CLI 部署流程）。不要改成公開讀寫。
2. 建置並部署最新網站至 GitHub Pages。仍使用相對資源路徑。
3. 重整主持頁，讓舊房間的已揭曉紀錄自動補建私人默契；確認沒有權限錯誤，再開始新活動。
4. 玩家更新頁面後可使用手機分頁與散步區；OBS 仍使用原 `display.html`。

本機已準備新版規則與網站；不代表雲端已發布。指定主持人方式仍是 `/config/hostUid`，其餘人不可讀寫 `/room/hostOnly`。


