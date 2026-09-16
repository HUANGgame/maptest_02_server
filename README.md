# 台北車站室內導航系統

本專案為台北車站室內導航系統，整合 Wi-Fi 定位、步行輔助定位、跨樓層導航、管理後台與 Android App。

## 線上系統

https://taipei-station-indoor-navigation.onrender.com

## 主要功能

- Wi-Fi 室內定位
- 步行輔助定位
- Wi-Fi 與步行資訊整合
- 跨樓層路徑導航
- Android WebView App
- SOS 功能
- 店家星級與文字評論

## 店家評論

只有分類為「店家」或「商家」的地點提供星級、評論及導航後的評論邀請；後端依已儲存的分類檢查資格。
評論使用現有 Firebase Realtime Database，存於 `place_reviews`，不需 Google Places API。
`GET /api/place-reviews?mapId=...&placeId=...` 提供平均分數、評分筆數及最新評論，每頁 20 筆。
`PUT` 與 `DELETE` 使用手機產生的隨機識別金鑰，更新或刪除該安裝實例自己的評論。這不是實名帳號或到訪認證；重新安裝可能產生新的識別。
Firebase 無法使用時回傳錯誤，不會將未完成的儲存標為成功。

原生導航 App 的評論頁開啟時讀取最新資料，停留前景時每 30 秒更新。導航滿一分鐘後結束，可略過的評論邀請才會出現，同一地點七天內不重複提醒。
外部網站星級不會混入 App 評分，也不會預填評論。Firebase 用量仍計入既有方案。

測試：`node --test scripts/place-reviews.test.js`

## Android 原始碼

android/IndoorNavigation/

主要程式：

android/IndoorNavigation/app/src/main/java/com/example/indoornavigation/MainActivity.kt

## APK

public/TaipeiStation_IndoorNavigation_FINAL.apk

## GitHub

https://github.com/HUANGgame/maptest_02_server
