# 台北車站地下街拍照定位導覽

這版不使用 QR code。使用者拍攝牆上的固定地圖後，系統用校正照片的影像指紋比對固定牆面地圖，更新樓層、座標與路線。管理員後台已和使用者介面分開，並加上登入保護。

## 啟動

PowerShell 可能會擋 `npm.ps1`，請用：

```powershell
cd C:\Users\金魚\Downloads\maptest_02_server\maptest_02_server
npm.cmd start
```

如果 3000 被占用，可用固定 3015：

```powershell
npm.cmd run start:3015
```

開啟：

```text
使用者頁：http://localhost:3000/
管理後台：http://localhost:3000/admin
```

若使用 3015，網址改成：

```text
http://localhost:3015/
http://localhost:3015/admin
```

## 管理員登入

開發預設密碼：

```text
TaipeiStationAdmin2026!
```

正式部署請改用環境變數：

```powershell
$env:ADMIN_PASSWORD="你的強密碼"
npm.cmd start
```

## 已完成

- `/` 是使用者介面，不顯示管理功能。
- `/admin` 是管理員後台，需要登入。
- `/api/admin/*` 全部需要管理員 cookie。
- 使用者介面支援中文 / English 切換。
- 後台可維護固定牆面地圖、校正照片影像指紋。
- 後台可維護 IP / Wi-Fi AP 位置資料。
- 後台可看使用者 session、client IP、目前定位、目的地、事件紀錄。
- 資料儲存在 `data/state.json`。

## 台北車站地下街資料

目前內建的是根據公開資料整理的 M 區原型圖資，重點放在 M1/M2、M3-M8、台北地下街 Y 區方向、站前地下街 Z 區方向。正式上線時請換成授權明確的站內平面圖或自行繪製圖資。

公開參考：

- 台北車站地下商場 / M 區說明：`https://zh.wikipedia.org/wiki/台北車站地下商場`
- 台北車站地下街配置圖：`https://commons.wikimedia.org/wiki/File:台北車站地下街配置圖.png`
- 台北車站 Y/Z/K/M/R 地下街互動地圖：`https://ju0520.github.io/Taipei_Station/`

## 關於 IP 位置

瀏覽器不能直接讀取使用者手機連到哪一台 Wi-Fi AP，也不能可靠用 IP 推出地下街精確位置。這版做法是：

- Server 會記錄請求看到的 client IP，讓後台可觀察。
- 管理員可建立 AP/IP 清冊，把 AP、SSID、IP、樓層、X/Y 座標輸入後台。
- 若你有現場網管資料或 Wi-Fi 掃描資料，可匯入後台作為輔助定位資料。

商用等級定位建議改接 Wi-Fi RTT、藍牙 beacon、UWB，或由現場網路控制器提供 AP association 資料。
