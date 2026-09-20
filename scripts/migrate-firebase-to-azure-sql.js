const firebaseMirror = require("../lib/firebaseMirror");
const sqlServerStore = require("../lib/sqlServerStore");

async function main() {
  if (!sqlServerStore.isConfigured()) {
    throw new Error("AZURE_SQL_SERVER and AZURE_SQL_DATABASE are required");
  }
  await sqlServerStore.startStore();
  const firebaseEnabled = await firebaseMirror.startMirror({ skipCacheSync: true });
  if (!firebaseEnabled) {
    throw new Error("Firebase credentials and database URL are required for direct migration");
  }
  const records = await firebaseMirror.readAllWifiScans();
  await sqlServerStore.mirrorWifiScans(records);
  await sqlServerStore.mirrorJsonFiles();
  const status = await sqlServerStore.statusSummary();
  console.log(JSON.stringify({ migrated: records.length, status }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
