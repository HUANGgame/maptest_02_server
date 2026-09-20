const { createHash, timingSafeEqual } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { hasPlaceCategory } = require("./placeCategories");

function httpError(status, message) { return Object.assign(new Error(message), { status }); }
function hash(value) { return createHash("sha256").update(value).digest("hex"); }
function publicId(bucket, owner) { return hash(`review-id:${bucket}:${owner}`); }
function configuredAdminHash() {
  if (process.env.REVIEW_MODERATION_KEY_HASH) return process.env.REVIEW_MODERATION_KEY_HASH;
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, "../config/review-moderation.json"), "utf8")).keyHash; }
  catch { return ""; }
}
const reasons = new Set(["advertising", "abuse", "misinformation", "privacy", "other"]);

function createPlaceReviews({ readPlaces, storage, readBody, sendJson, adminKeyHash = configuredAdminHash, networkLimit = 60 }) {
  const writes = new Map();
  function limit(key, maximum, interval = 60000) {
    const now = Date.now();
    for (const [id, entry] of writes) if (entry.until <= now) writes.delete(id);
    const entry = writes.get(key) || { count: 0, until: now + interval };
    if (entry.count >= maximum || writes.size >= 10000) throw httpError(429, "操作太頻繁，請稍後再試。");
    entry.count++;
    writes.set(key, entry);
  }
  function requireAdmin(request) {
    const expected = adminKeyHash();
    if (!/^[a-f0-9]{64}$/.test(expected || "")) throw httpError(503, "評論管理尚未設定管理金鑰。");
    const candidate = String(request.headers.authorization || "").replace(/^Bearer /, "");
    if (!/^[a-f0-9]{64}$/.test(candidate) || !timingSafeEqual(Buffer.from(hash(candidate), "hex"), Buffer.from(expected, "hex"))) {
      throw httpError(401, "管理金鑰不正確。");
    }
  }
  const publicReview = record => ({
    rating: record.rating, text: record.text, displayName: record.displayName,
    createdAt: record.createdAt, updatedAt: record.updatedAt,
  });

  return async function handle(request, response, url) {
    const reporting = url.pathname === "/api/place-reviews/reports";
    const moderating = url.pathname === "/api/place-reviews/moderation";
    if (url.pathname !== "/api/place-reviews" && !reporting && !moderating) return false;
    response.setHeader("Cache-Control", "no-store");
    try {
      const allowed = moderating ? ["GET", "POST"] : reporting ? ["POST"] : ["GET", "PUT", "DELETE"];
      if (!allowed.includes(request.method)) {
        response.setHeader("Allow", allowed.join(", "));
        throw httpError(405, "不支援此操作。");
      }
      const network = hash(request.socket?.remoteAddress || "unknown");
      if (moderating) {
        requireAdmin(request);
        limit(`admin:${network}`, 300);
      } else if (request.method !== "GET") limit(`network:${network}`, networkLimit);
      const mapId = url.searchParams.get("mapId") || "";
      const placeId = url.searchParams.get("placeId") || "";
      if (!mapId || !placeId) throw httpError(400, "缺少地圖或店家資料。");
      const place = readPlaces().find(item => item.mapId === mapId && item.id === placeId && item.searchable !== false);
      if (!place) throw httpError(404, "找不到這個地點，請更新店家資料。");
      if (!hasPlaceCategory(place, ["店家", "商家"])) throw httpError(403, "只有店家或商家提供星級與評論。");
      const bucket = hash(JSON.stringify([mapId, placeId]));
      const authorization = request.headers.authorization || "";
      const token = /^Bearer ([a-f0-9]{64})$/.exec(authorization)?.[1];
      if (authorization && !token) throw httpError(401, "評論識別資料無效。");
      const owner = token ? hash(`place-review:${token}`) : null;

      if (request.method === "GET") {
        const offset = Number(url.searchParams.get("offset") || 0);
        if (!Number.isSafeInteger(offset) || offset < 0) throw httpError(400, "頁碼不合法。");
        const records = await storage.read(bucket);
        const moderation = storage.readModeration ? await storage.readModeration(bucket) : {};
        const sorted = Object.entries(records || {})
          .filter(([id, value]) => Number.isInteger(value?.rating) && value.rating >= 1 && value.rating <= 5 && (moderating || !moderation[id]?.decision?.hidden))
          .sort((a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt) || a[0].localeCompare(b[0]));
        const count = sorted.length;
        const distribution = [0, 0, 0, 0, 0];
        sorted.forEach(([, record]) => distribution[record.rating - 1]++);
        sendJson(response, 200, {
          source: "app", count,
          average: count ? Math.round(sorted.reduce((sum, [, item]) => sum + item.rating, 0) / count * 10) / 10 : null,
          distribution,
          reviews: sorted.slice(offset, offset + 20).map(([id, record]) => ({
            ...publicReview(record), id: publicId(bucket, id), mine: id === owner,
            ...(moderating ? { decision: moderation[id]?.decision || null,
              reports: Object.values(moderation[id]?.reports || {}) } : {}),
          })),
          mine: owner && records?.[owner] ? { ...publicReview(records[owner]), hidden: !!moderation[owner]?.decision?.hidden } : null,
          nextOffset: offset + 20 < count ? offset + 20 : null,
        });
        return true;
      }
      if (!owner) throw httpError(401, "缺少評論識別資料。");
      limit(`owner:${owner}`, 12);
      if (request.method === "DELETE") {
        await storage.remove(bucket, owner);
        sendJson(response, 200, { success: true });
        return true;
      }
      const body = await readBody(request);
      if (!body || typeof body !== "object" || Array.isArray(body)) throw httpError(400, "評論格式不合法。");
      if (reporting || moderating) {
        const submittedId = String(body.reviewId || "");
        if (!/^[a-f0-9]{64}$/.test(submittedId)) throw httpError(400, "評論識別碼不合法。");
        const records = await storage.read(bucket);
        const id = Object.keys(records).find(key => publicId(bucket, key) === submittedId);
        if (!id) throw httpError(404, "評論已不存在。");
        if (reporting) {
          if (id === owner) throw httpError(400, "自己的評論請使用修改或刪除。");
          if (!reasons.has(body.reason) || typeof body.detail !== "string" || body.detail.length > 200) throw httpError(400, "請選擇檢舉原因，說明最多 200 字。");
          limit(`reports:${owner}`, 6, 3600000);
          await storage.report(bucket, id, owner, { reason: body.reason, detail: body.detail.trim(), createdAt: new Date().toISOString() });
        } else {
          if (typeof body.hidden !== "boolean" || typeof body.reason !== "string" || !body.reason.trim() || body.reason.length > 200) throw httpError(400, "請填寫處理原因（最多 200 字）。");
          await storage.moderate(bucket, id, { hidden: body.hidden, reason: body.reason.trim(), updatedAt: new Date().toISOString() });
        }
        sendJson(response, 200, { success: true });
        return true;
      }
      if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) throw httpError(400, "請選擇 1 到 5 星。");
      if (typeof body.text !== "string" || body.text.length > 1000) throw httpError(400, "評論最多 1000 字。");
      if (typeof body.displayName !== "string" || body.displayName.length > 30) throw httpError(400, "暱稱最多 30 字。");
      const records = await storage.read(bucket);
      const normalized = body.text.trim().replace(/\s+/g, " ").toLowerCase();
      if (normalized.length >= 12 && Object.entries(records).some(([id, item]) => id !== owner &&
          Date.now() - Date.parse(item.updatedAt) < 86400000 && String(item.text).trim().replace(/\s+/g, " ").toLowerCase() === normalized)) {
        throw httpError(409, "近期已有相同評論內容，請填寫自己的實際體驗。");
      }
      const record = {
        mapId, placeId, rating: body.rating, text: body.text.trim(),
        displayName: body.displayName.trim() || "訪客", updatedAt: new Date().toISOString(),
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
