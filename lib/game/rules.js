// Reef Muncher: pure game rules (no React, no network, no DOM).
// Small pure functions are easy to test and easy to explain in the video.
// Values are simplified game numbers, not real marine science.

export const HABITATS = {
  reef:  { id: "reef",  name: "Coral Reef",   location: "Maldives",         lat: 3.2,  lon: 73.2,   stars: 1, mines: 1, fallback: { wave: 0.7, period: 8,  temp: 28.0 } },
  kelp:  { id: "kelp",  name: "Kelp Forest",  location: "California coast", lat: 33.5, lon: -119.5, stars: 2, mines: 2, fallback: { wave: 1.6, period: 11, temp: 15.5 } },
  ocean: { id: "ocean", name: "Open Ocean",   location: "Mid-Atlantic",     lat: 30.0, lon: -40.0,  stars: 3, mines: 2, fallback: { wave: 2.2, period: 10, temp: 23.0 } },
  north: { id: "north", name: "Cold North",   location: "North Atlantic",   lat: 60.0, lon: -25.0,  stars: 4, mines: 3, fallback: { wave: 3.2, period: 12, temp: 8.0 } },
};

// ---------- Sea state ----------

/** Calm below 1.0 m, Choppy 1.0 to 2.5 m, Rough above 2.5 m */
export function getRisk(waveHeight) {
  if (waveHeight < 1.0) return "Calm";
  if (waveHeight <= 2.5) return "Choppy";
  return "Rough";
}

/** Seconds between big fish: Calm 12, Choppy 9, Rough 6 */
export function bigFishInterval(waveHeight) {
  const risk = getRisk(waveHeight);
  if (risk === "Calm") return 12;
  if (risk === "Choppy") return 9;
  return 6;
}

/** Water current in px/s: Calm 6, Choppy 14, Rough 26 */
export function currentStrength(waveHeight) {
  const risk = getRisk(waveHeight);
  if (risk === "Calm") return 6;
  if (risk === "Choppy") return 14;
  return 26;
}

/** Small-fish speed factor from sea temperature (C) */
export function smallFishSpeedFactor(seaTemp) {
  if (seaTemp < 15) return 0.7;
  if (seaTemp <= 25) return 1.0;
  return 1.25;
}

export function smallFishSpeedLabel(seaTemp) {
  if (seaTemp < 15) return "Slow";
  if (seaTemp <= 25) return "Normal";
  return "Fast";
}

// ---------- Day and night ----------

const DAY_MINUTES = 1440;
const TWILIGHT_WINDOW = 40;

/** Smallest distance between two minute-of-day values, wrapping at midnight. */
export function circularDistance(a, b) {
  const d = Math.abs(a - b) % DAY_MINUTES;
  return Math.min(d, DAY_MINUTES - d);
}

/**
 * sunTimes = { sunrise, sunset } as UTC minutes of the day (0..1439).
 * Sunrise and sunset can fall on different UTC days, so we handle wrap-around.
 * Returns "day" | "twilight" | "night".
 */
export function getTimeOfDay(sunTimes, nowUtcMinutes) {
  const { sunrise, sunset } = sunTimes;
  const isDay =
    sunrise < sunset
      ? nowUtcMinutes >= sunrise && nowUtcMinutes < sunset
      : nowUtcMinutes >= sunrise || nowUtcMinutes < sunset;

  const nearSun =
    circularDistance(nowUtcMinutes, sunrise) <= TWILIGHT_WINDOW ||
    circularDistance(nowUtcMinutes, sunset) <= TWILIGHT_WINDOW;

  if (nearSun) return "twilight";
  return isDay ? "day" : "night";
}

/** Score multiplier by phase: day 1.0, twilight 1.2, night 1.5 */
export function timeMultiplier(phase) {
  if (phase === "night") return 1.5;
  if (phase === "twilight") return 1.2;
  return 1.0;
}

/** Darkness overlay strength: day 0, twilight 0.35, night 0.85 */
export function darkness(phase) {
  if (phase === "night") return 0.85;
  if (phase === "twilight") return 0.35;
  return 0;
}

/** Lamp radius in px. Day has no lamp (null). Night grows with fish size. */
export function lightRadius(phase, size = 10) {
  if (phase === "twilight") return 420;
  if (phase === "night") return 230 + 0.6 * size;
  return null;
}

// ---------- Player ----------

export function fishWidth(size) {
  return 36 + size * 0.9;
}

export function maxSpeed(size) {
  return 300 - size * 0.8;
}

// ---------- Scoring ----------

/** 100 at 0s, falling to 0 at 10s. Never negative. */
export function speedBonus(secondsSincePicture) {
  return Math.max(0, Math.round(100 - 10 * secondsSincePicture));
}

export function safeFishScore(combo, bonus, multiplier) {
  return Math.round((100 * combo + bonus) * multiplier);
}

export function bigFishScore(number, multiplier) {
  return Math.round(number * 5 * multiplier);
}

export function bigFishWidth(number) {
  return 120 + (number - 50) * 2.4;
}

/** Bonuses added on a win. Neither is multiplied. */
export function winBonuses(heartsLeft, seconds) {
  return {
    hearts: heartsLeft * 200,
    time: Math.max(0, 240 - seconds) * 5,
  };
}

export const RESCAN_COST = 150;
export const MAX_RESCANS = 3;

export function applyRescanPenalty(score) {
  return Math.max(0, score - RESCAN_COST);
}

// ---------- Ranks ----------

export function getRank(bestScore) {
  if (bestScore >= 8000) return "Apex Predator";
  if (bestScore >= 4000) return "Reef Hunter";
  if (bestScore >= 1500) return "Minnow";
  return "Plankton";
}