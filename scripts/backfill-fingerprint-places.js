const baseUrl = String(process.env.BACKEND_URL || "https://maptest-02-server.onrender.com").replace(/\/$/, "");
const mapId = process.env.MAP_ID || "k-area-airport";
const floorIds = (process.env.FLOOR_IDS || "k-area-airport-1f,k-area-airport-2f")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

async function requestJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json();
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status} ${JSON.stringify(body)}`);
  return body;
}

function nearest(items, point, maximumDistance = 4) {
  return items
    .map((item) => ({ item, distance: Math.hypot(Number(item.x) - point.x, Number(item.y) - point.y) }))
    .filter((candidate) => Number.isFinite(candidate.distance) && candidate.distance <= maximumDistance)
    .sort((left, right) => left.distance - right.distance)[0]?.item;
}

function categoryForNodeType(nodeType) {
  return ({
    store: "店家",
    stair: "樓梯",
    elevator: "電梯",
    restroom: "廁所",
    exit: "出口",
    escalator: "手扶梯",
  })[nodeType] || "定位點";
}

function legacyPlaceIdFor(pointId) {
  const token = String(pointId).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `fingerprint-place-${token}`;
}

function placeIdFor(floorId, pointId) {
  const floorToken = String(floorId).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const pointToken = String(pointId).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `fingerprint-place-${floorToken}-${pointToken}`;
}

async function backfillFloor(floorId) {
  const query = `mapId=${encodeURIComponent(mapId)}&floorId=${encodeURIComponent(floorId)}`;
  const [pointResponse, nodes, places] = await Promise.all([
    requestJson(`/api/wifi-scans/points?${query}`),
    requestJson(`/api/route-nodes?${query}`),
    requestJson(`/api/places?${query}`),
  ]);
  const points = Array.isArray(pointResponse.points) ? pointResponse.points : [];
  let saved = 0;

  for (const point of points) {
    const matchedNode = nearest(nodes, point);
    const matchedPlace = nearest(places, point);
    const floorName = floorId.endsWith("-2f") ? "2F" : "1F";
    const fallbackName = `${floorName} 採樣點 ${point.pointId}`;
    const name = matchedNode?.label || matchedPlace?.name || fallbackName;
    const inferredCategory = matchedNode ? categoryForNodeType(matchedNode.nodeType) : "定位點";
    const existingCategories = Array.isArray(matchedPlace?.categories) && matchedPlace.categories.length
      ? matchedPlace.categories
      : [matchedPlace?.category];
    const categories = Array.from(new Set(existingCategories.concat(inferredCategory).map((value) => String(value || "").trim()).filter(Boolean)));
    const category = categories[0] || inferredCategory;
    const legacyId = legacyPlaceIdFor(point.pointId);
    if (places.some((place) => place.id === legacyId)) {
      await requestJson(`/api/places?placeId=${encodeURIComponent(legacyId)}`, { method: "DELETE" });
    }
    await requestJson("/api/places", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: placeIdFor(floorId, point.pointId),
        mapId,
        floorId,
        name,
        category,
        categories,
        x: point.x,
        y: point.y,
        description: `既有 Wi-Fi 指紋定位點，共 ${point.scanCount || 0} 筆掃描資料。`,
        keywords: `${point.pointId},${floorName},指紋點,定位點,${name}`,
        searchable: true,
        businessStatus: "unset",
        routeNodeId: matchedNode?.id || "",
      }),
    });
    saved += 1;
  }

  return { floorId, fingerprintPoints: points.length, saved };
}

(async () => {
  const results = [];
  for (const floorId of floorIds) results.push(await backfillFloor(floorId));
  console.log(JSON.stringify({ success: true, mapId, results }, null, 2));
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
