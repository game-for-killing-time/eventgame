# 墜機之後：荒島逃生 × 秘密狼人

正式後端使用 Cloudflare Workers Free + SQLite Durable Objects；Firebase Spark 只負責現有登入，GitHub Pages 提供網站。沒有啟用 Blaze 或 Workers 付費方案。免費用量耗盡可能暫停服務，不會自動升級。

## 使用入口

- 主持：`host.html?mode=voyage` 或 `story.html?role=host`
- 玩家：`story.html?role=player`（主持畫面提供附房間碼的連結）
- Display：`story.html?role=display`

原有 story.html、demo=1、voyage=1 及故事主持入口均進入新版。舊版只保留於明確的 archive=voyage 或 archive=story 網址。新版房間獨立於原有選邊站；請使用新版主持頁提供的玩家與 display 連結。

主持使用原有電郵與密碼登入，建立房間，至少三位玩家加入後按「抽選身份並開始」。三位玩家需要三個獨立瀏覽器身份（例如三部手機）；同一瀏覽器的普通分頁共享身份。主持帳號不能加入成為玩家。

## 規則

六幕：墜機海灘 → 穿過森林 → 廢棄營地 → 發出求救 → 趕往碼頭 → 最後登船。最後一幕未成功撤離便繼續補救，直到總時限到期。

每輪先選路與探索（40 秒），再公布小變化、確認最後路線與行動（40 秒）。狼人由伺服器秘密抽選；本人收到提示與自己可見的星號，主持與 display 無法讀取身份。

狼人第一輪起每輪最多襲擊一位最終同路的玩家，可選擇不下手。目標改道則襲擊落空。被殺者本輪所有行動無效。未提交最後決定不產生探索成果，也不能襲擊，但仍可能遇襲。

首次命案當輪及後續每輪有討論（60 秒）及秘密投票（30 秒）。唯一最高票出局；同票重投一次，仍同票則無人出局。死者不能作答或投票。

投中狼人或完成求救並讓普通玩家登船，生還者立即勝利。一狼一人時立即進入玩家反殺結局，不再投票。因此三人測試首宗成功襲擊後便會結束；要測完整投票流程，建議五人。總時限到期則狼人勝利。主持暫停會同時暫停兩個倒數。

Display 顯示故事、探索結果、倒數、生還者名單、公開路線與揭曉後的票數。死亡文字只有「阿樂遭人殺害！」，沒有兇手同行提示。結局才揭曉狼人。

## 後端與部署

`worker/index.js` 是唯一部署入口。Firebase ID token 經 Google 簽章、到期、issuer、audience 驗證；主持權限以設定的 HOST_UID 判定。伺服器忽略客戶端自稱的 UID 或主持權限。遊戲與秘密資料存於 SQLite Durable Object，每個操作依序結算，只回傳公開投影與呼叫者本人的私人資料。內建 alarm 處理無人在線時的期限。基礎設施帳號擁有者仍能管理後端，秘密身份保護針對遊戲內主持介面。

- 後端：`https://hoho-escape.hoho-events.workers.dev`
- 安裝：`npm ci --prefix worker`
- 測試：`node --test worker/integration.test.js`
- 部署：`npm run deploy --prefix worker`
- 前端：`npm ci`、`npm test`、`npm run build`；main 推送後由 GitHub Actions 發布。

`worker/test-room.js` 僅供本機測試，包含測試用推進時間功能，絕不部署。正式入口只載入 index.js；不暴露測試操作。Functions 目錄中的 escape-engine.js 與 escape-story.js 是共用純邏輯，免費正式部署不需要 Firebase Functions。

2026-10-23 驗證：流程與路由測試、本機 Cloudflare SQLite 整合（並發加入、隱私、投票、三人反殺、期限）、七個瀏覽器畫面與手機寬度測試通過。正式後端已驗證真實 Firebase 匿名 token、偽造主持遭拒、來源限制及秘密資料隔離。完整真人跨裝置局留待主持開房測試。
