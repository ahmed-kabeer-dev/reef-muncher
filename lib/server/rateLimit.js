// Reef Muncher: simple in-memory login rate limiter.
// Limitation to discuss: memory is lost on restart and not shared between servers.

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILURES = 5;

const g = globalThis;
const failures = g.__reefFailures ?? (g.__reefFailures = new Map()); // key -> { count, resetAt }

export function isBlocked(key) {
  const entry = failures.get(key);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    failures.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

export function recordFailure(key) {
  const entry = failures.get(key);
  if (!entry || Date.now() > entry.resetAt) {
    failures.set(key, { count: 1, resetAt: Date.now() + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export function clearFailures(key) {
  failures.delete(key);
}