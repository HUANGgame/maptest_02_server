const fs = require("fs");

const apiUrl = process.env.PREDICT_API_URL || "https://mxz0qz8w-8000.jpe1.devtunnels.ms/predict";

async function getIndoorLocation(wifiSignals) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signals: wifiSignals }),
      signal: controller.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
    }

    const data = JSON.parse(text);
    const location = data.location;
    console.log("模型預測的目前位置 [Y, X]：", location);
    return location;
  } catch (error) {
    console.error("呼叫模型失敗：", error.name === "AbortError" ? "連線逾時" : error.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function loadWifiSignals() {
  const filePath = process.argv[2];
  if (filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  }

  return [
    { bssid: "00:11:22:33:44:55", ssid: "demo-ap", rssi: -55 },
    { bssid: "66:77:88:99:aa:bb", ssid: "demo-ap-2", rssi: -72 },
  ];
}

getIndoorLocation(loadWifiSignals());
