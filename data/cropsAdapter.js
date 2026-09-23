/* Crop adapter over data/crops.json — keeps the UI decoupled from the
   master list's on-disk shape (id/name_en/name_hi/category), same
   pattern as locationAdapter.js. */

let raw = null;
let loadPromise = null;

function load() {
  if (loadPromise) return loadPromise;
  loadPromise = fetch("./data/crops.json")
    .then((r) => r.json())
    .then((json) => { raw = json; return json; })
    .catch((err) => { raw = null; throw err; });
  return loadPromise;
}

export function ready() { return load(); }
export function isReady() { return raw !== null; }

/** Flat list shaped { code, name, nameHi, category }, in crops.json's own order. */
export function getCrops() {
  if (!raw || !Array.isArray(raw.crops)) return [];
  return raw.crops.map((c) => ({ code: c.id, name: c.name_en, nameHi: c.name_hi, category: c.category || null }));
}

/** Same crops grouped by category, in first-seen category order — for a
 *  friendlier multi-select than one flat 45-item list. categoryHi comes
 *  from crops.json's own category_translations map (falls back to the
 *  English name if a category has no translation yet), so callers never
 *  need a second, hard-coded category list to show Hindi labels. */
export function getCropsByCategory() {
  const translations = (raw && raw.category_translations) || {};
  const groups = [];
  const index = new Map();
  for (const crop of getCrops()) {
    const key = crop.category || "";
    if (!index.has(key)) {
      index.set(key, groups.length);
      groups.push({ category: key, categoryHi: translations[key] || key, crops: [] });
    }
    groups[index.get(key)].crops.push(crop);
  }
  return groups;
}
