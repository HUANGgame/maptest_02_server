function placeSearchScore(place, query) {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) return 0;
  const fields = [place.name, place.keywords, place.description, place.category]
    .map(value => String(value || "").toLowerCase());
  const chars = [...new Set([...normalized].filter(char => !/\s/.test(char)))];
  const matches = chars.filter(char => fields.some(field => field.includes(char))).length;
  if (!matches) return 0;
  const phrases = fields.filter(field => field.includes(normalized)).length;
  const tokens = normalized.split(/\s+/).filter(token => fields.some(field => field.includes(token))).length;
  return matches * 100 + phrases * 200 + tokens * 50 + (fields[0] === normalized ? 1000 : 0);
}

function searchPlaces(places, query) {
  if (!String(query || "").trim()) return places;
  return places.map(place => ({ ...place, searchScore: placeSearchScore(place, query) }))
    .filter(place => place.searchScore > 0)
    .sort((a, b) => b.searchScore - a.searchScore);
}

module.exports = { placeSearchScore, searchPlaces };
