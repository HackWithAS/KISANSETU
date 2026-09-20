/* Location adapter over data/locations.json.
   ------------------------------------------------------------------
   This is the ONLY module that knows locations.json's shape. Every other
   part of the app (signup, Google first-time profile, center
   registration) talks to getStates/getDistricts/getBlocks/getVillages
   below and never touches the raw JSON, so the real source — the LGD
   import locations.json points at — can replace this file's internals
   later (a Firestore collection, an API call) without changing any UI.

   locations.json is explicitly a SOURCE_REFERENCE_ONLY contract file: it
   ships one clearly-labelled development sample (Uttar Pradesh →
   Bareilly → its blocks) and an empty village list, not a full India
   dataset. This adapter surfaces exactly that and nothing more — it does
   not invent additional states, districts, blocks or villages. Until a
   verified LGD import replaces development_sample with real coverage,
   Bareilly's blocks are the only selectable location below the state
   level, and villages are empty everywhere (see locations.json's own
   integration_notes).
*/

let raw = null;
let loadPromise = null;

function load() {
  if (loadPromise) return loadPromise;
  loadPromise = fetch("./data/locations.json")
    .then((r) => r.json())
    .then((json) => { raw = json; return json; })
    .catch((err) => { raw = null; throw err; });
  return loadPromise;
}

/** Resolves once locations.json has been fetched and parsed. Call and
 *  await/​.then this before relying on the getters below returning data. */
export function ready() { return load(); }
export function isReady() { return raw !== null; }

function sampleState() { return raw && raw.development_sample ? raw.development_sample.state : null; }

export function getStates() {
  const s = sampleState();
  if (!s) return [];
  return [{ code: s.code, name: s.name_en, nameHi: s.name_local || s.name_en }];
}

export function getDistricts(stateCode) {
  const s = sampleState();
  if (!s || !stateCode || s.code !== stateCode) return [];
  const d = s.district;
  return d ? [{ code: d.code, name: d.name_en, nameHi: d.name_local || d.name_en }] : [];
}

export function getBlocks(districtCode) {
  const d = sampleState() && sampleState().district;
  if (!d || !districtCode || d.code !== districtCode) return [];
  return (d.blocks || []).map((b) => ({ code: b.code, name: b.name_en, nameHi: b.name_local || b.name_en }));
}

export function getVillages(blockCode) {
  // Intentionally always empty: locations.json ships no village records
  // yet (see its integration_notes — "Village options should remain
  // empty until verified village-level data is imported").
  return [];
}
