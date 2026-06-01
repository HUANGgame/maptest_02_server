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

## 資料庫結構

正式資料表以 `backend/schema` 為準：

```sql
SOURCE backend/schema/001_initial_must_have.sql;
SOURCE backend/schema/002_seed_tamkang_demo.sql;
SOURCE backend/schema/003_navigation_feedback.sql;
SOURCE backend/schema/004_training_jobs.sql;
SOURCE backend/schema/005_dqn_policy.sql;
SOURCE backend/schema/006_history_saved_locations.sql;
SOURCE backend/schema/007_floor_transitions.sql;
SOURCE backend/schema/008_user_reports.sql;
```

目前 Node 後端使用 JSON 檔作為 Demo store，方便在沒有 MySQL 的環境展示。

## 測試

```powershell
node backend/scripts/smoke-test.js
```

smoke test 會檢查健康檢查、地圖、樓層、地點搜尋、Wi-Fi 指紋、模型、定位、路線、回饋、歷史紀錄與策略 API。
