const fs = require("fs");
const path = require("path");

const sqlServerStore = require("../lib/sqlServerStore");

function readLocalScans() {
  const dataDir = process.env.NAV_DATA_DIR || path.join(__dirname, "..", "data");
  const filePath = path.join(dataDir, "wifi_scans.json");
  if (!fs.existsSync(filePath)) {
    throw new Error(`Local fingerprint file not found: ${filePath}`);
  }
  const records = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!Array.isArray(records)) {
    throw new Error("data/wifi_scans.json must contain an array");
  }
  return records;
}

async function main() {
  if (!sqlServerStore.isConfigured()) {
    throw new Error("AZURE_SQL_SERVER and AZURE_SQL_DATABASE are required");
  }

  const localRecords = readLocalScans();
  await sqlServerStore.startStore();
  await sqlServerStore.mirrorJsonFiles();
  await sqlServerStore.mirrorWifiScans(localRecords);

  const status = await sqlServerStore.statusSummary();
  const sqlCount = Number(status.counts?.wifi_scan_records || 0);
  if (sqlCount < localRecords.length) {
    throw new Error(`Verification failed: local=${localRecords.length}, azure=${sqlCount}`);
  }

  console.log(JSON.stringify({
    source: "local-cache",
    localRecords: localRecords.length,
    azureRecords: sqlCount,
    documents: Number(status.counts?.system_documents || 0),
    fingerprintScopes: status.fingerprintScopes,
    verified: true,
  }, null, 2));
  await sqlServerStore.closeStore();
}

main().catch(async (error) => {
  console.error(error?.stack || error);
  await sqlServerStore.closeStore().catch(() => {});
  process.exitCode = 1;
});
