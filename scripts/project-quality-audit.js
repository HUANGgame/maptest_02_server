const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function requireFile(relativePath) {
  assert(fs.existsSync(path.join(root, relativePath)), `missing required file: ${relativePath}`);
}

function main() {
  [
    "server.js",
    "lib/sqlServerStore.js",
    "schema/azure-sql.sql",
    "android/IndoorNavigation/app/src/main/res/layout/activity_main.xml",
  ].forEach(requireFile);

  const server = read("server.js");
  const sqlStore = read("lib/sqlServerStore.js");
  const packageJson = JSON.parse(read("package.json"));
  const collectorLayout = read("android/IndoorNavigation/app/src/main/res/layout/activity_main.xml");

  assert.equal(packageJson.dependencies.mssql.startsWith("^11."), true, "mssql dependency must be pinned to major 11");
  assert(server.includes("activeStorageName()"), "server must expose the active storage backend");
  assert(server.includes("sqlServerStore.mirrorWifiScans"), "fingerprint uploads must support Azure SQL");
  assert(sqlStore.includes("ix_wifi_scope"), "scope index is required for positioning queries");
  assert(sqlStore.includes("ix_wifi_bssid"), "BSSID index is required for fingerprint matching");
  assert(collectorLayout.includes("buttonFieldReadinessCheck"), "collector needs a field readiness check");

  const secretPatterns = [
    /-----BEGIN PRIVATE KEY-----/,
    /AccountKey=[A-Za-z0-9+/=]{20,}/,
    /password\s*[:=]\s*["'][^"']{8,}["']/i,
  ];
  for (const relativePath of ["server.js", "lib/sqlServerStore.js", "schema/azure-sql.sql"]) {
    const source = read(relativePath);
    for (const pattern of secretPatterns) {
      assert(!pattern.test(source), `possible credential found in ${relativePath}`);
    }
  }

  const scansPath = path.join(root, "data", "wifi_scans.json");
  const scans = fs.existsSync(scansPath) ? JSON.parse(fs.readFileSync(scansPath, "utf8")) : [];
  const scopes = new Set(scans.map((row) => `${row.mapId}/${row.floorId}`));
  console.log(`PASS: storage contract, indexes, collector workflow, credential scan; local fingerprints=${scans.length}, scopes=${scopes.size}`);
}

main();
