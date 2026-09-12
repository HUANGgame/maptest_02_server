const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { searchPlaces } = require("../lib/placeSearch");

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "navigation-place-test-"));
process.env.NAV_DATA_DIR = directory;
const { createPlace } = require("../lib/catalogStore");
const { updatePlaceStatus, readPlaces } = require("../lib/placeStore");
try {
  const place = { id: "test-shop", mapId: "test-map", floorId: "f1", name: "Tea House", x: 87, y: 43, keywords: "milk tea", description: "near elevator" };
  createPlace(place);
  updatePlaceStatus(place.id, "closed", "Mon-Fri 10:00-22:00");
  createPlace({ ...place, description: "beside elevator" });
  const saved = readPlaces().find(item => item.id === place.id);
  assert.equal(saved.businessStatus, "closed");
  assert.equal(saved.openingHours, "Mon-Fri 10:00-22:00");
  assert.equal(saved.x, 87);
  const other = { id: "other", name: "Tea", keywords: "", description: "" };
  assert.equal(searchPlaces([other, saved], "milk tea")[0].id, place.id);
  assert.equal(searchPlaces([saved], "elevator").length, 1);
  assert.equal(searchPlaces([saved], "電梯").length, 0);
  assert.equal(searchPlaces([{ name: "服務台", description: "中央廣場" }], "中廣").length, 1);

  const source = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
  const start = source.indexOf("function fingerprintRecencyWeight(");
  const end = source.indexOf("function rankKnnProfiles(", start);
  const context = vm.createContext({ Date, Math, Number });
  vm.runInContext(source.slice(start, end), context);
  const weight = context.fingerprintRecencyWeight;
  assert.ok(weight({ scannedAt: new Date().toISOString() }) > weight({ scannedAt: new Date(Date.now() - 90 * 86400000).toISOString() }));
  assert.equal(weight({ scannedAt: "invalid" }), 0.25);
  assert.ok(weight({ scannedAt: "2099-01-01" }) <= 1);
  const admin = fs.readFileSync(path.join(__dirname, "../public/admin.html"), "utf8");
  for (const match of admin.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
  console.log("PASS: status/hours survive editing, coordinates preserved, keyword/notes ranking, recency bounds, admin syntax");
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
