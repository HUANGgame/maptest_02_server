const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { randomBytes } = require("node:crypto");
const { createPlaceReviews } = require("../lib/placeReviews");

test("reviews persist by owner and place, aggregate, paginate, and fail honestly", async () => {
  const records = {};
  let unavailable = false;
  const storage = {
    async read(key) { if (unavailable) throw new Error("unavailable"); return records[key] || {}; },
    async save(key, owner, record) {
      if (unavailable) throw new Error("unavailable");
      records[key] ||= {};
      records[key][owner] = { ...record, createdAt: records[key][owner]?.createdAt || record.updatedAt };
    },
    async remove(key, owner) { if (unavailable) throw new Error("unavailable"); delete (records[key] || {})[owner]; },
  };
  const handle = createPlaceReviews({
    readPlaces: () => [{ mapId: "a", id: "shop" }, { mapId: "b", id: "shop" }], storage,
    async readBody(request) {
      let data = "";
      for await (const chunk of request) data += chunk;
      return JSON.parse(data);
    },
    sendJson(response, status, body) { response.writeHead(status, { "Content-Type": "application/json" }); response.end(JSON.stringify(body)); },
  });
  const server = http.createServer(async (request, response) => {
    if (!await handle(request, response, new URL(request.url, "http://localhost"))) response.writeHead(404).end();
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const token = randomBytes(32).toString("hex");
  const other = randomBytes(32).toString("hex");
  const input = { rating: 5, displayName: "A", text: "Good food" };
  async function call(method = "GET", body, auth = token, query = "mapId=a&placeId=shop") {
    const response = await fetch(`${origin}/api/place-reviews?${query}`, {
      method, headers: auth ? { Authorization: `Bearer ${auth}` } : {}, body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json(), cache: response.headers.get("cache-control") };
  }
  try {
    assert.equal((await call()).data.average, null);
    assert.equal((await call("PUT", input, "")).status, 401);
    for (const rating of [0, 6, 1.5, "5", null]) assert.equal((await call("PUT", { ...input, rating })).status, 400);
    assert.equal((await call("PUT", { ...input, text: "x".repeat(1001) })).status, 400);
    assert.equal((await call("PUT", input, token, "mapId=a&placeId=missing")).status, 404);
    assert.equal((await call("PUT", input)).status, 200);
    const first = await call();
    assert.equal(first.cache, "no-store");
    assert.equal(first.data.count, 1);
    assert.equal(first.data.average, 5);
    assert.equal(first.data.mine.text, input.text);
    assert.equal((await call("PUT", { ...input, rating: 3 })).status, 200);
    const updated = (await call()).data;
    assert.equal(updated.count, 1);
    assert.equal(updated.mine.createdAt, first.data.mine.createdAt);
    await call("PUT", { ...input, rating: 5 }, other);
    const average = (await call()).data;
    assert.equal(average.average, 4);
    assert.deepEqual(average.distribution, [0, 0, 1, 0, 1]);
    assert.equal(average.reviews.filter(item => item.mine).length, 1);
    assert.ok(!JSON.stringify(average).includes(token));
    assert.ok(!JSON.stringify(average).includes("owner"));
    assert.equal((await call("GET", undefined, "")).data.mine, null);
    assert.equal((await call("GET", undefined, token, "mapId=b&placeId=shop")).data.count, 0);
    await call("DELETE", undefined, other);
    assert.equal((await call()).data.count, 1);
    assert.equal((await call()).data.mine.rating, 3);
    await Promise.all(Array.from({ length: 23 }, (_, index) => call("PUT", { ...input, text: String(index) }, randomBytes(32).toString("hex"))));
    const page = (await call()).data;
    assert.equal(page.count, 24);
    assert.equal(page.reviews.length, 20);
    assert.equal(page.nextOffset, 20);
    const last = (await call("GET", undefined, token, "mapId=a&placeId=shop&offset=20")).data;
    assert.equal(last.reviews.length, 4);
    assert.equal(last.nextOffset, null);
    assert.equal((await call("GET", undefined, token, "mapId=a&placeId=shop&offset=-1")).status, 400);
    unavailable = true;
    assert.equal((await call("PUT", input, other)).status, 503);
    assert.equal((await call()).status, 503);
    unavailable = false;
    const rateToken = randomBytes(32).toString("hex");
    for (let index = 0; index < 12; index++) assert.equal((await call("PUT", input, rateToken)).status, 200);
    assert.equal((await call("PUT", input, rateToken)).status, 429);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
