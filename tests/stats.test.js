import { describe, it, expect } from "vitest";
import { checkFinish, rankProgress, MAX_FINAL_SCORE, MAX_FISH_SCORE } from "../lib/game/rules.js";

describe("checkFinish (plausibility)", () => {
  const ok = { outcome: "win", score: 3000, seconds: 90, bestCombo: 5 };

  it("accepts a believable result", () => {
    expect(checkFinish(ok, 100)).toBeNull();
  });
  it("rejects bad outcome, negative, huge and non-integer values", () => {
    expect(checkFinish({ ...ok, outcome: "cheat" }, 100)).toBeTruthy();
    expect(checkFinish({ ...ok, score: -1 }, 100)).toBeTruthy();
    expect(checkFinish({ ...ok, score: MAX_FINAL_SCORE + 1 }, 100)).toBeTruthy();
    expect(checkFinish({ ...ok, score: 12.5 }, 100)).toBeTruthy();
    expect(checkFinish(null, 100)).toBeTruthy();
  });
  it("a loss cannot claim the win bonuses", () => {
    expect(checkFinish({ ...ok, outcome: "lose", score: MAX_FISH_SCORE + 1 }, 100)).toBeTruthy();
    expect(checkFinish({ ...ok, outcome: "lose", score: 1200 }, 100)).toBeNull();
  });
  it("cannot claim more time than the server saw", () => {
    expect(checkFinish({ ...ok, seconds: 500 }, 100)).toBeTruthy();
  });
  it("combo must be 1 to 5", () => {
    expect(checkFinish({ ...ok, bestCombo: 6 }, 100)).toBeTruthy();
    expect(checkFinish({ ...ok, bestCombo: 0 }, 100)).toBeTruthy();
  });
  it("strict mode rejects a win in 5 s, non-strict allows it (developer drawer)", () => {
    const fast = { outcome: "win", score: 100, seconds: 5, bestCombo: 1 };
    expect(checkFinish(fast, 10)).toBeTruthy();
    expect(checkFinish(fast, 10, { strict: false })).toBeNull();
  });
});

describe("rankProgress", () => {
  it("progress inside a rank", () => {
    expect(rankProgress(0)).toEqual({ rank: "Plankton", next: "Minnow", nextAt: 1500, pct: 0 });
    expect(rankProgress(750).pct).toBe(50);
    expect(rankProgress(4000).rank).toBe("Reef Hunter");
  });
  it("top rank has no next", () => {
    expect(rankProgress(9000)).toEqual({ rank: "Apex Predator", next: null, nextAt: null, pct: 100 });
  });
});