// Reef Muncher: shared HTTP helpers used by ALL external API clients.
// Design notes (for the video):
// - One place for timeouts, caching and the result shape, so each API client
//   stays tiny and only knows its own URL and parsing (high cohesion).
// - Every call uses BOTH an AbortController and Promise.race with a timer.
// - runWithFallback ALWAYS resolves. It never throws, so a dead API can
//   never freeze the game. Result shape: { data, source, ms, error? }.

// ---------- Timeout ----------

/** Reject if the promise takes longer than ms. The timer is always cleared. */
export function withTimeout(promise, ms, label = "request") {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ---------- Fetch ----------

/** GET a URL and return the body as text. Throws on timeout, network error or non-2xx. */
export async function fetchText(url, { timeoutMs = 3000, headers } = {}) {
  const controller = new AbortController();
  const label = new URL(url).hostname;
  try {
    return await withTimeout(
      (async () => {
        const res = await fetch(url, { signal: controller.signal, cache: "no-store", headers });
        if (!res.ok) throw new Error(`HTTP ${res.status} from ${label}`);
        return res.text();
      })(),
      timeoutMs,
      label
    );
  } finally {
    controller.abort(); // cancel the request if the timer won the race
  }
}

/** GET a URL and parse JSON. */
export async function fetchJson(url, options = {}) {
  const text = await fetchText(url, options);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from ${new URL(url).hostname}`);
  }
}

// ---------- Cache (used by Open-Meteo and Sunrise-Sunset on Day 3) ----------

const g = globalThis;
const cache = g.__reefCache ?? (g.__reefCache = new Map()); // key -> { value, expiresAt }

export function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

export function cacheSet(key, value, ttlMs) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// ---------- Standard result ----------

/**
 * Run a live call; on ANY failure use the fallback instead.
 * Always resolves with { data, source: "live" | "fallback", ms, error? }.
 */
export async function runWithFallback(liveFn, fallbackFn) {
  const start = Date.now();
  try {
    const data = await liveFn();
    return { data, source: "live", ms: Date.now() - start };
  } catch (err) {
    return {
      data: fallbackFn(),
      source: "fallback",
      ms: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}