# 來吧！我們互相傷害！

繁體中文 Twitch 觀眾同樂網站：選邊站、猜最多人的答案、分享故事。純 HTML / CSS / JavaScript，Firebase Authentication + Realtime Database，GitHub Pages 靜態部署；沒有 PHP、Cloud Functions、Twitch API 或付費服務。

正式網址與 Firebase 更新步驟：[手機連線試玩](docs/ONLINE-TRIAL.md)。

## 快速試玩

需要 Node.js 22（建議）及 npm。

```sh
npm ci
npm run dev
```

開啟終端顯示的本機網址：

- `host.html`：建立模擬房間，房間碼 `PARTY1`。
- `index.html`：另一分頁輸入 `PARTY1` 與暱稱，加入。
- 主持頁開始一題；觀眾選答案及預測、提交；主持頁截止並揭曉。
- 觀眾投稿故事；主持頁選取；`display.html` 顯示已選故事。

`config.example.js` 的 `firebase: null` 範例使用 **localStorage 本機模擬**，不是跨裝置多人連線。同一瀏覽器分頁共用一名模擬觀眾；換瀏覽器不會共享房間。資料會留在該瀏覽器，直到主持頁結束、清理，或手動清除網站儲存。正式設定後可用 `?demo=1` 單頁進入模擬；跨頁試玩需各頁都加這個參數。不要把模擬測試當成 Firebase 權限測試。

## 文件與交付

本版已加入手機作答／聊天／排行榜切換、十種透明角色與島民散步。主持人可查看私人兩人默契；角色只在揭曉後依共同回答分群，公開預測計分不變。圖片來源與重建方法見 [素材說明](docs/ASSETS.md)。

- [Firebase、GitHub Pages 設定](docs/SETUP.md)
- [主持操作及 15 分鐘試播](docs/HOST.md)
- [資料結構與權限](docs/ARCHITECTURE.md)
- [測試結果與限制](docs/TESTING.md)
- `database.rules.json`：可直接發布的 Realtime Database 規則及聊天索引。
- `config.example.js`：公開網頁設定範本；`config.js` 是網站實際讀取的設定。
- `src/questions.js`：12 道四選一生活題，可自行改字。

## 驗證與建置

```sh
npm test
npm run test:rules
npm run build
```

資料規則測試需要 Java 17+（新環境建議 21）及首次下載 Emulator 的網路。使用 `demo-hoho` 假專案，不讀寫正式資料。正式輸出在 `dist/`，三個入口和資源全部使用相對路徑，支援 `https://使用者.github.io/儲存庫/`。

Windows 若 Java 顯示 `Unable to establish loopback connection`，可能是桌面沙箱的暫存路徑過長。本次以專案內短暫存路徑成功測試：

```powershell
New-Item -ItemType Directory -Force .tmp | Out-Null
$env:JAVA_HOME = 'C:/Program Files/Java/jdk-17' # 改成自己的 JDK
$env:Path = $env:JAVA_HOME + '/bin;' + $env:Path
$env:TEMP = (Resolve-Path .tmp).Path
$env:TMP = $env:TEMP
$env:JAVA_TOOL_OPTIONS = '-Djava.io.tmpdir=' + $env:TEMP
npm.cmd run test:rules
```

## 免費方案

依 2026-10-14 查核的 [Firebase 官方價格](https://firebase.google.com/pricing)，Spark Realtime Database 為 100 同時連線、1 GB 儲存、每月 10 GB 下載。每個瀏覽器分頁／OBS 來源都可能佔連線；網站限制 20 名參加者，不等於限制 20 個連線。Authentication 使用匿名與電子郵件密碼，不用電話驗證。匿名帳號建立另有同 IP 短期限制，請不要在同一網路瘋狂清除身分測試。

在 Firebase Console 的 Realtime Database → Usage 檢查連線、儲存和下載；Authentication → Usage（介面依專案設定略有不同）查看使用量。Spark 額度不足可能拒絕服務，並非無限免費。本網站不會升級方案，也沒有自動刪除資料；每場由主持人清理。

視覺與玩法設計：[海島派對設計說明](docs/DESIGN.md)。本場角色容許重複，重整保留；角色不影響分數。


