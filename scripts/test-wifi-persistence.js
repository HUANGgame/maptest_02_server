const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wifi-persistence-'));
process.env.NAV_DATA_DIR = dir;
const {appendScans, readScans} = require('../lib/jsonStore');
const src = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const begin = src.indexOf('  if (request.method === "POST" && url.pathname === "/api/wifi-scans")');
const end = src.indexOf('  if (request.method === "GET" && url.pathname === "/api/wifi-scans/summary")', begin);
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
const handler = new AsyncFunction('request','url','readJsonBody','normalizeWifiScanPayload','validateWifiScanRecords','appendScans','firebaseMirror','mysqlMirror','sendJson','response',src.slice(begin,end));
const records = [{sampleId:'s1', pointId:'p1', mapId:'test', floorId:'f1', x:12, y:13, bssid:'ab:cd', rssi:-55, scannedAt:'2026-09-13T00:00:00Z'}];
async function run(firebase) {
  let result;
  await handler({method:'POST'},{pathname:'/api/wifi-scans'},async()=>records,x=>x,()=>[],appendScans,firebase,
    {mirrorWifiScans:async()=>{}},(_,code,body)=>{result={code,body}},{});
  return result;
}
(async()=>{
  try {
    let response = await run({isEnabled:()=>false});
    assert.equal(response.body.accepted,false);
    response = await run({isEnabled:()=>true,mirrorWifiScans:async()=>{throw Error('offline')}});
    assert.equal(response.body.accepted,false);
    assert.equal(readScans().length,1);
    const stableId = readScans()[0].id;
    let mirrored;
    response = await run({isEnabled:()=>true,mirrorWifiScans:async rows=>{
      await new Promise(resolve=>setTimeout(resolve,10)); mirrored=rows;
    }});
    assert.equal(mirrored.length,1,'cached retry must still be mirrored');
    assert.equal(mirrored[0].id,stableId);
    assert.equal(response.body.persisted,true);
    assert.equal(response.body.persistedCount,1);
    assert.equal(readScans().length,1,'retry must not duplicate');
    assert.equal(mirrored[0].x,12);
    assert.equal(mirrored[0].floorId,'f1');
    console.log('PASS: cloud failure, retry repair, stable ID, no duplicates, scope/coordinates, acknowledgement');
  } finally {
    assert(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(dir,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1});
