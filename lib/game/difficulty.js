// Reef Muncher: turns a habitat + sea data + time of day into game difficulty
// (pure function, easy to test).

import {
  HABITATS, getRisk, bigFishInterval, currentStrength,
  smallFishSpeedFactor, smallFishSpeedLabel, timeMultiplier,
} from "./rules.js";

/**
 * sea = { wave, temp, source? } from the server, or null to use the habitat's fallback values.
 * rng is injectable so tests are repeatable.
 */
export function buildDifficulty(habitatId, sea = null, rng = Math.random, timeOfDay = "day") {
  const h = HABITATS[habitatId] ?? HABITATS.reef;
  const wave = sea?.wave ?? h.fallback.wave;
  const temp = sea?.temp ?? h.fallback.temp;
  const direction = rng() < 0.5 ? -1 : 1; // random current direction, chosen once per level

  return {
    habitat: h.id,
    wave,
    temp,
    risk: getRisk(wave),
    bigFishInterval: bigFishInterval(wave),
    current: direction * currentStrength(wave),
    speedFactor: smallFishSpeedFactor(temp),
    speedLabel: smallFishSpeedLabel(temp),
    mines: h.mines,
    timeOfDay,
    timeMultiplier: timeMultiplier(timeOfDay),
    source: sea ? (sea.source ?? "live") : "fallback",
  };
}