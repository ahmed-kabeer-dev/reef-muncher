import { describe, it, expect } from "vitest";
import { parseFishResponse, detectMime, makeFallbackPuzzle } from "../lib/services/fishClient.js";

const FAKE_PNG = "iVBORw0KGgo" + "A".repeat(200); // long enough to pass the length check

describe("parseFishResponse", () => {
  it("splits on the last comma and adds a data URI prefix", () => {
    const out = parseFishResponse(`${FAKE_PNG},7`);
    expect(out.digit).toBe(7);
    expect(out.image.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("keeps an existing data: prefix (which contains its own comma)", () => {
    const withPrefix = `data:image/png;base64,${FAKE_PNG}`;
    const out = parseFishResponse(`${withPrefix},3`);
    expect(out.digit).toBe(3);
    expect(out.image).toBe(withPrefix);
  });

  it("rejects a digit outside 0 to 9, a missing comma and bad Base64", () => {
    expect(() => parseFishResponse(`${FAKE_PNG},10`)).toThrow();
    expect(() => parseFishResponse(`${FAKE_PNG},x`)).toThrow();
    expect(() => parseFishResponse(FAKE_PNG)).toThrow();
    expect(() => parseFishResponse(`!!!not base64!!!${"!".repeat(200)},4`)).toThrow();
  });

  it("detects image types", () => {
    expect(detectMime("/9j/abc")).toBe("image/jpeg");
    expect(detectMime("iVBORabc")).toBe("image/png");
    expect(detectMime("R0lGODabc")).toBe("image/gif");
    expect(detectMime("UklGRabc")).toBe("image/webp");
    expect(detectMime("zzzz")).toBe("image/png");
  });
});

describe("makeFallbackPuzzle", () => {
  it("the digit always equals the number of fish drawn", () => {
    for (let i = 0; i < 50; i++) {
      const { image, digit } = makeFallbackPuzzle();
      const svg = Buffer.from(image.split(",")[1], "base64").toString("utf8");
      const fishDrawn = (svg.match(/class="fish"/g) ?? []).length;
      expect(digit).toBe(fishDrawn);
      expect(digit).toBeGreaterThanOrEqual(1);
      expect(digit).toBeLessThanOrEqual(9);
    }
  });
});