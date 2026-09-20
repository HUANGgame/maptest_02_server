function normalizeCategories(value, fallback = "未分類") {
  const source = Array.isArray(value) ? value : [value];
  const categories = [];
  for (const item of source) {
    const text = String(item || "").trim();
    if (text && !categories.includes(text)) categories.push(text);
  }
  if (categories.length === 0 && fallback) categories.push(String(fallback).trim());
  return categories;
}

function placeCategories(place, fallback = "未分類") {
  const values = Array.isArray(place?.categories) && place.categories.length > 0
    ? place.categories
    : [place?.category];
  return normalizeCategories(values, fallback);
}

function normalizePlaceCategoryFields(place, fallback = "未分類") {
  const categories = normalizeCategories(
    Array.isArray(place?.categories) && place.categories.length > 0
      ? place.categories
      : [place?.category],
    fallback,
  );
  return { ...place, category: categories[0], categories };
}

function hasPlaceCategory(place, allowed) {
  const accepted = new Set(normalizeCategories(allowed, ""));
  return placeCategories(place, "").some((category) => accepted.has(category));
}

module.exports = {
  hasPlaceCategory,
  normalizeCategories,
  normalizePlaceCategoryFields,
  placeCategories,
};
