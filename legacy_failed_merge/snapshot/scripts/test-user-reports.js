const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'report-test-'));
process.env.NAV_DATA_DIR = dir;
const { appendReport, readReports } = require('../lib/reportStore');
const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const start = source.indexOf('  if (request.method === "POST" && url.pathname === "/api/user-reports")');
const end = source.indexOf('  if (request.method === "GET" && url.pathname === "/api/user-reports")', start);
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
const handler = new AsyncFunction('request', 'url', 'readJsonBody', 'appendReport', 'firebaseMirror', 'sendJson', 'response', source.slice(start, end));
async function run(mirror) {
  let result;
  await handler({ method: 'POST' }, { pathname: '/api/user-reports' }, async () => ({
    clientReportId: 'retry-1', anonymousUserId: 'test-user', mapId: 'm', floorId: 'f',
    reportType: 'obstacle', description: 'TEST ONLY', x: 12, y: 20
  }), appendReport, mirror, (_, code, body) => { result = { code, body }; }, {});
  return result;
}
(async () => {
  try {
    const failed = await run({ isEnabled: () => true, mirrorJsonFiles: async () => { throw new Error('offline'); } });
    assert.notEqual(failed.code, 201);
    assert.equal(readReports().length, 1);
    let complete = false;
    const result = await run({ isEnabled: () => true, mirrorJsonFiles: async () => {
      await new Promise(resolve => setTimeout(resolve, 10)); complete = true;
    } });
    assert(complete);
    assert.equal(result.body.persisted, true);
    assert.equal(result.code, 201);
    assert.equal(readReports().length, 1, 'retry cannot duplicate');
    const disabled = await run({ isEnabled: () => false });
    assert.notEqual(disabled.code, 201);
    appendReport({clientReportId: 'retry-1', userId: 'another-user'});
    assert.equal(readReports().length, 2);
    const html = fs.readFileSync(path.join(__dirname, '../public/admin.html'), 'utf8');
    for (const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
    assert(html.includes('id="reportsLink"'));
    assert(!html.includes('getJson(`/api/user-reports?mapId='));
    console.log('PASS: cloud failure, acknowledgement, retry deduplication, user isolation, admin script');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
