# 地下街室內導航系統後端

本後端支援「地下街室內導航系統」第一階段展示。正式題目仍是地下街室內導航系統；目前以淡江大學淡水校園資料模擬地下街常見情境，例如找建築、找設施、找路線、找停車位、回到原位置、障礙物回報與歷史導航。

目前狀態是 Demo 階段，不代表已正式部署在地下街或校園。

## 固定網址

之後統一使用 Render 免費網址：

```text
https://maptest-02-server.onrender.com
```

用戶端正式介面：

```text
https://maptest-02-server.onrender.com/
https://maptest-02-server.onrender.com/app
https://maptest-02-server.onrender.com/navigation
```

Web 管理後台：

```text
https://maptest-02-server.onrender.com/admin
```

Android 採樣工具預設後端也使用：

```text
https://maptest-02-server.onrender.com
```

不要再使用 Cloudflare Tunnel 或 localtunnel 的臨時網址作為預設值。

## 本機開發

```powershell
node backend/server.js
```

本機用戶端：

```text
http://localhost:3015/
```

本機後台：

```text
http://localhost:3015/admin
```

## 正式資料庫

正式資料統一放 Firebase Realtime Database。JSON 檔只作為 Render 執行中的本機快取，不作為正式保存來源。

Render 必須設定：

```text
FIREBASE_DATABASE_URL=https://wifi-f-default-rtdb.firebaseio.com
FIREBASE_SERVICE_ACCOUNT_JSON=<Firebase service account JSON>
FIREBASE_ROOT_PATH=indoor_navigation
```

也可以改用 `FIREBASE_SERVICE_ACCOUNT_BASE64` 放 base64 後的 service account JSON。

伺服器啟動時會先讀 Firebase：

```text
Firebase 有資料：覆蓋本機 JSON 快取，避免部署後資料消失。
Firebase 沒資料：把目前本機 JSON 種進 Firebase，避免第一次接資料庫時遺失舊資料。
```

手動同步目前資料到 Firebase：

```powershell
Invoke-WebRequest -Method POST https://maptest-02-server.onrender.com/api/storage/sync
```

檢查目前是否真的使用 Firebase：

```text
https://maptest-02-server.onrender.com/api/storage/status
```

需要看到 `storage` 是 `firebase-rtdb`，且 `firebase.enabled` 是 `true`。

## 測試

```powershell
node backend/scripts/smoke-test.js
```

smoke test 會檢查健康檢查、地圖、樓層、地點搜尋、Wi-Fi 指紋、模型、定位、路線、回饋、歷史紀錄與策略 API。
