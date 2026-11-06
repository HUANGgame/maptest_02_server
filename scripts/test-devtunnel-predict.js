const fs = require("fs");

const apiUrl = process.env.PREDICT_API_URL || "https://mxz0qz8w-8000.jpe1.devtunnels.ms/predict";

async function getIndoorLocation(wifiSignals) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  const signals = normalizePredictSignals(wifiSignals);
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signals }),
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

  return {
    "00:11:22:33:44:55": -55,
    "66:77:88:99:aa:bb": -72,
  };
}

function normalizePredictSignals(input) {
  if (Array.isArray(input)) {
    return input.reduce((signals, item) => {
      const bssid = String(item?.bssid || "").trim().toLowerCase();
      const rssi = Number(item?.rssi);
      if (bssid && Number.isFinite(rssi)) signals[bssid] = rssi;
      return signals;
    }, {});
  }
  if (input && typeof input === "object") {
    return Object.entries(input).reduce((signals, [bssid, rssi]) => {
      const key = String(bssid || "").trim().toLowerCase();
      const value = Number(rssi);
      if (key && Number.isFinite(value)) signals[key] = value;
      return signals;
    }, {});
  }
  return {};
}

getIndoorLocation(loadWifiSignals());
