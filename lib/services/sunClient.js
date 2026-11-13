// Reef Muncher: Sunrise-Sunset API client (real day and night).
// Request:  GET https://api.sunrise-sunset.org/json?lat=..&lng=..&formatted=0
// Response: { results: { sunrise, sunset, ... }, status: "OK" } with ISO 8601 UTC timestamps.
// Terms:    no key, attribution required -> show "Sun times: sunrise-sunset.org".
// Cache:    6 hours. Fallback: estimate from longitude, labelled "Offline estimate".

import { fetchJson, runWithFallback, cacheGet, cacheSet } from "./http.js";
import { HABITATS } from "../game/rules.js";

const SUN_TIMEOUT_MS = 3000;
const SUN_TTL_MS = 6 * 60 * 60 * 1000;

export const SUN_CREDIT = "Sun times: sunrise-sunset.org";
export const SUN_FALLBACK_LABEL = "Offline estimate";

export function buildSunUrl(lat, lon) {
  return `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&formatted=0`;
}

const mod = (n, m) => ((n % m) + m) % m;

/** "2026-11-12T00:31:12+00:00" -> minutes of the UTC day (0..1439). Throws if invalid. */
export function isoToUtcMinutes(iso) {
  if (typeof iso !== "string") throw new Error("Sun API: time is not a string");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`Sun API: invalid time "${iso.slice(0, 30)}"`);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** Pure parser (unit tested). Accepts results.sunrise or top-level sunrise. */
export function parseSunResponse(json) {
  if (!json || typeof json !== "object") throw new Error("Sun API: empty response");
  if ("status" in json && json.status !== "OK") throw new Error(`Sun API: status ${json.status}`);
  const src = json.results ?? json;
  return {
    sunrise: isoToUtcMinutes(src.sunrise),
    sunset: isoToUtcMinutes(src.sunset),
  };
}

/**
 * Offline estimate from longitude only.
 * Solar hour = (UTC hour + lon / 15 + 24) mod 24, sunrise at solar 06:00, sunset at 18:00,
 * converted back to UTC minutes.
 */
export function estimateSunTimes(lon) {
  const offsetMin = (lon / 15) * 60;
  return {
    sunrise: mod(Math.round(6 * 60 - offsetMin), 1440),
    sunset: mod(Math.round(18 * 60 - offsetMin), 1440),
  };
}

/** Minutes of the current UTC day. The date is injectable for tests. */
export function currentUtcMinutes(date = new Date()) {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

/**
 * Always resolves: { data: { sunrise, sunset }, source, ms, label?, error? }.
 * label is "Offline estimate" when the fallback was used.
 */
export async function fetchSunTimes(habitatId, { forceFallback = false } = {}) {
  const h = HABITATS[habitatId];
  if (!h) throw new Error(`Unknown habitat: ${habitatId}`);

  const key = `sun:${habitatId}`;
  if (!forceFallback) {
    const hit = cacheGet(key);
    if (hit) return { data: hit, source: "cached", ms: 0 };
  }

  const result = await runWithFallback(
    async () => {
      if (forceFallback) throw new Error("fallback forced for testing");
      const json = await fetchJson(buildSunUrl(h.lat, h.lon), { timeoutMs: SUN_TIMEOUT_MS });
      return parseSunResponse(json);
    },
    () => estimateSunTimes(h.lon)
  );

  if (result.source === "live") cacheSet(key, result.data, SUN_TTL_MS);
  else result.label = SUN_FALLBACK_LABEL;
  return result;
}