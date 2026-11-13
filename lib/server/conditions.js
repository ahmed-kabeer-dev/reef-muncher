// Reef Muncher: combines sea data and sun times for a habitat.
// This is the ONLY place where the two API clients meet. Each client stays unaware of
// the other, and the pure rules (getTimeOfDay etc.) stay unaware of both.

import { fetchConditions, MARINE_CREDIT } from "../services/marineClient.js";
import { fetchSunTimes, currentUtcMinutes, SUN_CREDIT } from "../services/sunClient.js";
import {
  HABITATS, getTimeOfDay, timeMultiplier, getRisk, bigFishInterval,
  currentStrength, smallFishSpeedFactor, smallFishSpeedLabel,
} from "../game/rules.js";

/** Everything the Habitat Select card needs for one habitat. Both calls run in parallel. */
export async function getHabitatConditions(habitatId, { now = new Date() } = {}) {
  const h = HABITATS[habitatId];
  const [sea, sun] = await Promise.all([fetchConditions(habitatId), fetchSunTimes(habitatId)]);

  const phase = getTimeOfDay(sun.data, currentUtcMinutes(now));

  return {
    id: h.id,
    name: h.name,
    location: h.location,
    stars: h.stars,
    mines: h.mines,
    sea: {
      wave: sea.data.wave,
      period: sea.data.period,
      temp: sea.data.temp,
      risk: getRisk(sea.data.wave),
      bigFishInterval: bigFishInterval(sea.data.wave),
      currentStrength: currentStrength(sea.data.wave),
      speedFactor: smallFishSpeedFactor(sea.data.temp),
      speedLabel: smallFishSpeedLabel(sea.data.temp),
      source: sea.source,
      ms: sea.ms,
      error: sea.error ?? null,
    },
    sun: {
      sunrise: sun.data.sunrise,
      sunset: sun.data.sunset,
      source: sun.source,
      label: sun.label ?? null,
      ms: sun.ms,
      error: sun.error ?? null,
    },
    timeOfDay: phase,
    multiplier: timeMultiplier(phase),
    credits: { sea: MARINE_CREDIT, sun: SUN_CREDIT },
  };
}

export async function getAllHabitats(options) {
  return Promise.all(Object.keys(HABITATS).map((id) => getHabitatConditions(id, options)));
}