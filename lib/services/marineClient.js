// Reef Muncher: Open-Meteo Marine API client (live sea conditions).
// Request:  GET https://marine-api.open-meteo.com/v1/marine?latitude=..&longitude=..
//           &current=wave_height,wave_period,sea_surface_temperature
// Response: JSON. Any null or missing value counts as a failure (e.g. a land point).
// Terms:    free for non-commercial use, no key, CC BY 4.0 -> show "Weather data: Open-Meteo".
// Cache:    30 minutes (successful live results only).

import { fetchJson, runWithFallback, cacheGet, cacheSet } from "./http.js";
import { HABITATS } from "../game/rules.js";

const MARINE_TIMEOUT_MS = 3000;
const MARINE_TTL_MS = 30 * 60 * 1000;

export const MARINE_CREDIT = "Weather data: Open-Meteo";

export function buildMarineUrl(lat, lon) {
  return (
    "https://marine-api.open-meteo.com/v1/marine" +
    `?latitude=${lat}&longitude=${lon}` +
    "&current=wave_height,wave_period,sea_surface_temperature"
  );
}

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/** Pure parser (unit tested). Returns { wave, period, temp } or throws. */
export function parseMarineResponse(json) {
  const cur = json?.current;
  if (!cur) throw new Error("Marine API: no current data");
  const { wave_height: wave, wave_period: period, sea_surface_temperature: temp } = cur;
  if (!isNum(wave) || !isNum(period) || !isNum(temp)) {
    throw new Error("Marine API: missing or null value (land point?)");
  }
  return { wave, period, temp };
}

/**
 * Always resolves: { data: { wave, period, temp }, source: "live"|"cached"|"fallback", ms, error? }.
 * forceFallback is only for testing the offline path.
 */
export async function fetchConditions(habitatId, { forceFallback = false } = {}) {
  const h = HABITATS[habitatId];
  if (!h) throw new Error(`Unknown habitat: ${habitatId}`); // programmer error, not a network error

  const key = `marine:${habitatId}`;
  if (!forceFallback) {
    const hit = cacheGet(key);
    if (hit) return { data: hit, source: "cached", ms: 0 };
  }

  const result = await runWithFallback(
    async () => {
      if (forceFallback) throw new Error("fallback forced for testing");
      const json = await fetchJson(buildMarineUrl(h.lat, h.lon), { timeoutMs: MARINE_TIMEOUT_MS });
      return parseMarineResponse(json);
    },
    () => ({ wave: h.fallback.wave, period: h.fallback.period, temp: h.fallback.temp })
  );

  if (result.source === "live") cacheSet(key, result.data, MARINE_TTL_MS); // never cache fallbacks
  return result;
}