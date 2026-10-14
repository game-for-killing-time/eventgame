# 資料結構與信任邊界

全專案只用一個 `/room`。建立房間採 transaction；已有房間時不得覆蓋，必須結束並清理後才開下一場。

| 路徑 | 內容 | 讀取 | 寫入 |
|---|---|---|---|
| `/config/hostUid` | 唯一可信主持人的 UID | 已登入身分 | 只用 Firebase Console 管理，網頁無權寫入 |
| `/room/public/state` | 房間碼、鎖房、聊天開關、題目、輪次、階段、截止時間 | 所有人，含無登入展示頁 | 指定正式主持人 |
| `/room/public/members/{uid}` | 暱稱、入場時間、座位、房間碼 | 所有人 | 自己一次性加入；主持人可移除 |
| `/room/public/seats/{0..19}` | 20 個座位 UID | 所有人 | 與自己名單資料原子寫入；主持人釋放 |
| `/room/answers/{round}/{uid}` | 個人選項、預測、伺服器提交時間 | 自己與主持人 | 本人於開放且伺服器 `now < deadline` 時覆寫 |
| `/room/public/results/{round}` | 四項票數、贏家、總作答人數、各 UID 本輪得分 | 所有人 | 主持人 |
| `/room/moderation/{uid}` | 禁言及移除狀態 | 本人與主持人 | 主持人 |
| `/room/chat/{uid}/messages/{seq}` | 純文字訊息、伺服器時間 | 成員每人最近 3 則的限制查詢；主持人 | 本人依序新增；主持人刪除 |
| `/room/chat/{uid}/seq,lastSent` | 發言序號、冷卻時間 | 本人與主持人 | 本人依規則遞增；主持人 |
| `/room/stories/{round}/{uid}` | 私人投稿 | 本人與主持人 | 揭曉後本人，禁言／移除者不可投稿 |
| `/room/public/story` | 選中的暱稱、故事、輪次 | 所有人 | 主持人 |

沒有在 `/room` 給一般觀眾讀取權；Realtime Database 規則不是過濾器。展示頁監聽 `/room/public`，並在主持開啟時讀取 `/room/effects/chat` 與 `/room/effects/submissions`；不讀私人聊天室歷史、答案、私人故事或管理資料。三頁分別使用 Firebase app 名稱，展示頁只用記憶體中的未登入身分，不沿用主持人登入。

## 身分及容量

主持人必須同時符合 `auth.uid == /config/hostUid` 與非匿名登入。房間碼不是密碼，也不是私人觀看的存取屏障：題目、暱稱、結果與選中故事本來就是公開展示資料。觀眾不能寫角色，也不能指定 hostUid。

加入時同時建立名單和一個 0–19 座位；規則互相檢查兩者相符，既有座位不能覆蓋，UID 不能重複加入／改座位。爭用同一座位會重試。移除會留下禁用記錄並釋放座位，因此同一 UID 不能再加入。匿名登入只代表一個瀏覽器身分，不保证一個真人只有一個帳號；換裝置、無痕或清除儲存可取得新 UID，不能當作防作弊或永久封鎖。

## 時間、同步與結算

倒數以 `.info/serverTimeOffset` 修正；真正截止由資料規則的伺服器 `now` 驗證。到期即使主持人斷線、狀態尚未切到 closed，資料庫也拒絕作答。主持人連線時會自動把到期題目切為 closed，仍需按揭曉。答案只有 `(round, uid)` 一個位置，兩項一起寫入，修改覆蓋。

Firebase SDK 可能先送出本機事件；「已提交」只在寫入 Promise 完成後顯示。恢復身分時另標「已恢復儲存的答案」。已知離線時 UI 呼叫會直接拒絕；送出後才斷線的佇列仍可能等待，重連後由規則決定是否拒絕，不把本機預測寫入當成功。

結算在 `/room` transaction 中驗證房間碼和輪次，原子發布結果、revealed 狀態、私人默契與公開位置。只有 closed → revealed 能產生新結果；同輪重試保留既有結果。排行榜由每輪 points 加總，不使用累加寫入。零票無贏家，同票皆得分，不比手速。主持人是可信結算方，規則不證明主持人是否誠實計分。

## 島民默契

`/room/hostOnly/affinity` 只有指定正式主持人可讀寫，保存版本、已結算輪次及以 UID 為鍵的兩人 shared／same 計數。`/room/public/island` 只發布版本、輪次、場地寬度及各 UID 的目標位置；所有人可讀，只有主持人可寫。不可把 hostOnly 移入 public，父節點的讀取授權會向下繼承。

只比較共同回答且已揭曉的個人答案，預測不參與；共同至少 2 題且相同率至少 70% 才能靠攏。小群合併要求每一對跨群成員都達門檻，優先最低相似率最高的合併，同值依座位順序。公開位置是群聚提示，玩家可以推測相似關係，無法直接讀取精確計數。

舊房間由主持首次登入新版時在交易中重建一次，只使用已有公開結果的已揭曉輪次。漏答不扣分；零票不新增配對計數。移除者的位置立即刪除，私人歷史留至清理；重用座位的新 UID 不繼承舊人的計數。交易會讀取整個房間，活動後應清理，以控制歷史資料量。

動畫全部本機執行，沒有逐幀資料庫寫入；作答期間沿用上次分布，離開畫面／分頁隱藏時暫停散步，減少動態時直接到位。模擬與正式模式各自保存入場房間碼。

## 文字、聊天與保留

暱稱最多 20 字元，訊息 240、故事 500；以 JavaScript／Firebase 字串長度衡量（部分 emoji 佔多個字元）。所有插入 HTML 的使用者文字都跳脫，沒有執行使用者 HTML。聊天室每人 3 秒一次：lastSent、seq 與該序號訊息需同批更新，訊息不能自行覆寫或刪除，不能省略冷卻欄位。索引為 messages 的 `at`。

每名現有成員只訂閱最新 3 則，畫面合併顯示最多 50 則；這不是完整聊天室封存瀏覽器。較舊與已移除成員的訊息仍保留資料庫至主持清理（主持人刪除單則除外）。聊天、答案與故事沒有 TTL、排程、自動保留期限。主持人一般畫面只讀本輪答案、投稿與管理狀態；清理房間時會讀房間以 transaction 確認已結束。

## 官方依據

- [Realtime Database 規則](https://firebase.google.com/docs/database/security)
- [規則條件、auth 與 now](https://firebase.google.com/docs/database/security/rules-conditions)
- [JavaScript 離線行為](https://firebase.google.com/docs/database/web/offline-capabilities)
- [匿名驗證](https://firebase.google.com/docs/auth/web/anonymous-auth)
- [Emulator 連接與測試](https://firebase.google.com/docs/emulator-suite/connect_rtdb)

## 自動彈幕（2026-10-14）

`/room/effects/chat/{uid}` 只有每人最新一則的 seq、text、at；`/room/effects/submissions` 只有輪次與各 UID 的交卷時間。主持使用房間交易從已儲存資料建立副本，不包含答案、預測或私人默契。觀眾不可寫入；未登入展示頁只在相應開關開啟且房間未結束時可讀子節點，不能讀 effects 父節點或私人資料。

單次交易可能讀取整個房間，長場次累積的聊天與答案會增加流量；活動結束後清理房間。動畫只在本機執行，不逐幀寫入。轉送依賴主持頁持續運作，沒有 Cloud Functions。展示副本最多每人一則聊天／一份交卷提示；不是自動刪除聊天室歷史或資料保留期限。
