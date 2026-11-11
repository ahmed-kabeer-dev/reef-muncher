import { describe, it, expect } from "vitest";
import {
  getRisk, bigFishInterval, currentStrength, smallFishSpeedFactor,
  getTimeOfDay, timeMultiplier, lightRadius, speedBonus,
  safeFishScore, winBonuses, applyRescanPenalty, getRank, circularDistance,
} from "../lib/game/rules.js";

describe("sea state rules", () => {
  it("getRisk boundaries", () => {
    expect(getRisk(0.99)).toBe("Calm");
    expect(getRisk(1.0)).toBe("Choppy");
    expect(getRisk(2.5)).toBe("Choppy");
    expect(getRisk(2.51)).toBe("Rough");
  });
  it("bigFishInterval and currentStrength follow the risk", () => {
    expect(bigFishInterval(0.5)).toBe(12);
    expect(bigFishInterval(1.6)).toBe(9);
    expect(bigFishInterval(3.2)).toBe(6);
    expect(currentStrength(0.5)).toBe(6);
    expect(currentStrength(1.6)).toBe(14);
    expect(currentStrength(3.2)).toBe(26);
  });
  it("smallFishSpeedFactor by temperature", () => {
    expect(smallFishSpeedFactor(8)).toBe(0.7);
    expect(smallFishSpeedFactor(15)).toBe(1.0);
    expect(smallFishSpeedFactor(25)).toBe(1.0);
    expect(smallFishSpeedFactor(28)).toBe(1.25);
  });
});

describe("getTimeOfDay", () => {
  const sun = { sunrise: 360, sunset: 1080 }; // 06:00 and 18:00
  it("day, night and twilight", () => {
    expect(getTimeOfDay(sun, 720)).toBe("day");
    expect(getTimeOfDay(sun, 0)).toBe("night");
    expect(getTimeOfDay(sun, 380)).toBe("twilight");
    expect(getTimeOfDay(sun, 1115)).toBe("twilight");
  });
  it("handles sunset earlier than sunrise (wrap-around)", () => {
    const wrap = { sunrise: 1200, sunset: 300 }; // lit from 20:00 to 05:00 UTC
    expect(getTimeOfDay(wrap, 1380)).toBe("day");
    expect(getTimeOfDay(wrap, 60)).toBe("day");
    expect(getTimeOfDay(wrap, 720)).toBe("night");
  });
  it("circularDistance wraps at midnight", () => {
    expect(circularDistance(10, 1430)).toBe(20);
  });
  it("multiplier and light radius", () => {
    expect(timeMultiplier("day")).toBe(1.0);
    expect(timeMultiplier("twilight")).toBe(1.2);
    expect(timeMultiplier("night")).toBe(1.5);
    expect(lightRadius("day", 10)).toBeNull();
    expect(lightRadius("twilight", 10)).toBe(420);
    expect(lightRadius("night", 100)).toBe(290);
  });
});

describe("scoring", () => {
  it("speedBonus falls 100 to 0 over 10 seconds", () => {
    expect(speedBonus(0)).toBe(100);
    expect(speedBonus(5)).toBe(50);
    expect(speedBonus(10)).toBe(0);
    expect(speedBonus(20)).toBe(0);
  });
  it("safeFishScore applies combo, bonus and multiplier", () => {
    expect(safeFishScore(1, 100, 1.0)).toBe(200);
    expect(safeFishScore(3, 40, 1.5)).toBe(510);
  });
  it("win bonuses", () => {
    expect(winBonuses(2, 100)).toEqual({ hearts: 400, time: 700 });
    expect(winBonuses(3, 300).time).toBe(0);
  });
  it("rescan never makes score negative", () => {
    expect(applyRescanPenalty(100)).toBe(0);
    expect(applyRescanPenalty(500)).toBe(350);
  });
  it("ranks", () => {
    expect(getRank(0)).toBe("Plankton");
    expect(getRank(1500)).toBe("Minnow");
    expect(getRank(4000)).toBe("Reef Hunter");
    expect(getRank(8000)).toBe("Apex Predator");
  });
});