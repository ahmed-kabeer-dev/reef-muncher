import { describe, it, expect } from "vitest";
import { buildDifficulty } from "../lib/game/difficulty.js";

describe("buildDifficulty", () => {
  it("uses fallback values when there is no live data", () => {
    const d = buildDifficulty("north", null, () => 0.9); // rng 0.9 -> direction +1
    expect(d.risk).toBe("Rough");
    expect(d.bigFishInterval).toBe(6);
    expect(d.current).toBe(26);
    expect(d.speedFactor).toBe(0.7);
    expect(d.mines).toBe(3);
    expect(d.source).toBe("fallback");
  });
  it("live data overrides the fallback, and direction can be negative", () => {
    const d = buildDifficulty("reef", { wave: 1.6, temp: 28 }, () => 0.1);
    expect(d.risk).toBe("Choppy");
    expect(d.current).toBe(-14);
    expect(d.speedFactor).toBe(1.25);
    expect(d.mines).toBe(1);
    expect(d.source).toBe("live");
  });
  it("unknown habitat falls back to the reef", () => {
    expect(buildDifficulty("nope").habitat).toBe("reef");
  });
});