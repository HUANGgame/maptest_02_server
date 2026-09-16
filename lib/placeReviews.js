const { createHash } = require("node:crypto");

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function createPlaceReviews({ readPlaces, storage, readBody, sendJson }) {
  const writes = new Map();
  const publicReview = (record) => ({
    rating: record.rating, text: record.text, displayName: record.displayName,
    createdAt: record.createdAt, updatedAt: record.updatedAt,
  });

  return async function handle(request, response, url) {
    if (url.pathname !== "/api/place-reviews") return false;
    response.setHeader("Cache-Control", "no-store");
    try {
      if (!["GET", "PUT", "DELETE"].includes(request.method)) {
        response.setHeader("Allow", "GET, PUT, DELETE");
        throw httpError(405, "不支援此操作。");
      }
      const mapId = url.searchParams.get("mapId") || "";
      const placeId = url.searchParams.get("placeId") || "";
      if (!mapId || !placeId) throw httpError(400, "缺少地圖或店家資料。");
      const place = readPlaces().find(item => item.mapId === mapId && item.id === placeId && item.searchable !== false);
      if (!place) throw httpError(404, "找不到這個地點，請更新店家資料。");
      const bucket = hash(JSON.stringify([mapId, placeId]));
      const authorization = request.headers.authorization || "";
      const token = /^Bearer ([a-f0-9]{64})$/.exec(authorization)?.[1];
      if (authorization && !token) throw httpError(401, "評論識別資料無效。");
      const owner = token ? hash(`place-review:${token}`) : null;

      if (request.method === "GET") {
        const offset = Number(url.searchParams.get("offset") || 0);
        if (!Number.isSafeInteger(offset) || offset < 0) throw httpError(400, "頁碼不合法。");
        const records = await storage.read(bucket);
        const sorted = Object.entries(records || {})
          .filter(([, value]) => Number.isInteger(value?.rating) && value.rating >= 1 && value.rating <= 5)
          .sort((a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt) || a[0].localeCompare(b[0]));
        const count = sorted.length;
        const distribution = [0, 0, 0, 0, 0];
        sorted.forEach(([, record]) => distribution[record.rating - 1]++);
        sendJson(response, 200, {
          source: "app", count,
          average: count ? Math.round(sorted.reduce((sum, [, item]) => sum + item.rating, 0) / count * 10) / 10 : null,
          distribution,
          reviews: sorted.slice(offset, offset + 20).map(([id, record]) => ({ ...publicReview(record), mine: id === owner })),
          mine: owner && records?.[owner] ? publicReview(records[owner]) : null,
          nextOffset: offset + 20 < count ? offset + 20 : null,
        });
        return true;
      }

      if (!owner) throw httpError(401, "缺少評論識別資料。");
      const now = Date.now();
      for (const [key, entry] of writes) if (entry.until <= now) writes.delete(key);
      const rate = writes.get(owner) || { count: 0, until: now + 60000 };
      if (rate.count >= 12 || writes.size > 10000) throw httpError(429, "操作太頻繁，請稍後再試。");
      rate.count++;
      writes.set(owner, rate);
      if (request.method === "DELETE") {
        await storage.remove(bucket, owner);
        sendJson(response, 200, { success: true });
        return true;
      }
      const body = await readBody(request);
      if (!body || typeof body !== "object" || Array.isArray(body)) throw httpError(400, "評論格式不合法。");
      if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) throw httpError(400, "請選擇 1 到 5 星。");
      if (typeof body.text !== "string" || body.text.length > 1000) throw httpError(400, "評論最多 1000 字。");
      if (typeof body.displayName !== "string" || body.displayName.length > 30) throw httpError(400, "暱稱最多 30 字。");
      const record = {
        mapId, placeId, rating: body.rating, text: body.text.trim(),
        displayName: body.displayName.trim() || "訪客", updatedAt: new Date(now).toISOString(),
      };
      await storage.save(bucket, owner, record);
      sendJson(response, 200, { success: true });
    } catch (error) {
      if (error instanceof SyntaxError) error = httpError(400, "評論格式不合法。");
      if (!error.status) console.error("Place reviews:", error.message);
      sendJson(response, error.status || 503, {
        success: false, message: error.status ? error.message : "評論服務暫時無法使用，請稍後再試。",
      });
    }
    return true;
  };
}

module.exports = { createPlaceReviews };
