const {test} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {randomBytes, createHash} = require('node:crypto');
const {createPlaceReviews} = require('../lib/placeReviews');
const token = () => randomBytes(32).toString('hex');
async function fixture(t, networkLimit=500) {
  const records={}, moderation={};const admin=token();let configured=true;
  const storage={
    async read(b){return records[b]||{};},
    async save(b,id,value){records[b]||={};records[b][id]={...value,createdAt:records[b][id]?.createdAt||value.updatedAt};},
    async remove(b,id){delete (records[b]||{})[id];},
    async readModeration(b){return moderation[b]||{};},
    async report(b,id,reporter,report){moderation[b]||={};moderation[b][id]||={};moderation[b][id].reports||={};moderation[b][id].reports[reporter]||=report;},
    async moderate(b,id,decision){moderation[b]||={};moderation[b][id]||={};moderation[b][id].decision=decision;}
  };
  const handler=createPlaceReviews({readPlaces:()=>[{id:'s',mapId:'m',category:'店家'}],storage,networkLimit,
    adminKeyHash:()=>configured?createHash('sha256').update(admin).digest('hex'):'',
    async readBody(req){let s='';for await(const c of req)s+=c;return JSON.parse(s);},
    sendJson(res,status,data){res.writeHead(status,{'Content-Type':'application/json'}).end(JSON.stringify(data));}
  });
  const server=http.createServer((req,res)=>handler(req,res,new URL(req.url,'http://localhost')));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  async function call(method='GET',key,body,suffix=''){
    const r=await fetch(`http://127.0.0.1:${server.address().port}/api/place-reviews${suffix}?mapId=m&placeId=s`,{
      method,headers:key?{Authorization:'Bearer '+key}:{},body:body===undefined?undefined:JSON.stringify(body)
    });return {status:r.status,data:await r.json()};
  }
  return {call,admin,disable:()=>configured=false};
}
test('reports are deduplicated; moderation is authorized and hidden ratings stay excluded after edits',async t=>{
  const {call,admin,disable}=await fixture(t);const owner=token(), reporter=token();
  const review={rating:5,text:'餐點與服務都符合期待',displayName:'客人'};
  assert.equal((await call('PUT',owner,review)).status,200);
  const id=(await call()).data.reviews[0].id;
  assert.equal((await call('GET',undefined,undefined,'/moderation')).status,401);
  assert.equal((await call('POST',reporter,{reviewId:id,hidden:true,reason:'x'},'/moderation')).status,401);
  const report={reviewId:id,reason:'advertising',detail:'內容疑似廣告'};
  assert.equal((await call('POST',owner,report,'/reports')).status,400);
  assert.equal((await call('POST',reporter,report,'/reports')).status,200);
  assert.equal((await call('POST',reporter,report,'/reports')).status,200);
  const managed=(await call('GET',admin,undefined,'/moderation')).data;
  assert.equal(managed.reviews[0].reports.length,1);
  assert.ok(!(await call()).data.reviews[0].reports);
  assert.equal((await call('POST',admin,{reviewId:id,hidden:true,reason:'廣告'},'/moderation')).status,200);
  let result=(await call('GET',owner)).data;
  assert.equal(result.count,0);assert.equal(result.average,null);assert.equal(result.mine.hidden,true);
  assert.equal((await call('PUT',owner,{...review,text:'修改後的內容'})).status,200);
  assert.equal((await call()).data.count,0);
  assert.equal((await call('POST',admin,{reviewId:id,hidden:false,reason:'重新確認後恢復'},'/moderation')).status,200);
  assert.equal((await call()).data.average,5);
  assert.equal((await call('POST',reporter,{...report,reviewId:'bad'},'/reports')).status,400);
  assert.equal((await call('POST',reporter,{...report,reason:'invalid'},'/reports')).status,400);
  disable();assert.equal((await call('GET',admin,undefined,'/moderation')).status,503);
});
test('rotating reviewer tokens cannot bypass connection write limit',async t=>{
  const {call}=await fixture(t,3);
  for(let i=0;i<3;i++)assert.equal((await call('PUT',token(),{rating:3,text:String(i),displayName:'a'})).status,200);
  assert.equal((await call('PUT',token(),{rating:3,text:'new',displayName:'a'})).status,429);
  assert.equal((await call()).status,200);
});
test('copied long reviews are rejected, but owners can edit and delete',async t=>{
  const {call}=await fixture(t);const owner=token();
  const review={rating:4,text:'這是一則重複貼上的廣告測試文字',displayName:'a'};
  assert.equal((await call('PUT',owner,review)).status,200);
  assert.equal((await call('PUT',token(),review)).status,409);
  assert.equal((await call('PUT',owner,review)).status,200);
  assert.equal((await call('DELETE',owner)).status,200);
  assert.equal((await call()).data.count,0);
});
