import { describe, it, expect, vi, afterEach } from "vitest";
import { parseMarineResponse, fetchConditions, buildMarineUrl } from "../lib/services/marineClient.js";
import {
  parseSunResponse, isoToUtcMinutes, estimateSunTimes, currentUtcMinutes, fetchSunTimes,
} from "../lib/services/sunClient.js";
import { getTimeOfDay } from "../lib/game/rules.js";

afterEach(() => vi.unstubAllGlobals());

describe("marine parser", () => {
  it("reads wave height, period and temperature", () => {
    const json = { current: { wave_height: 1.4, wave_period: 9.5, sea_surface_temperature: 27.1 } };
    expect(parseMarineResponse(json)).toEqual({ wave: 1.4, period: 9.5, temp: 27.1 });
  });
  it("rejects null, missing and wrongly typed values", () => {
    expect(() => parseMarineResponse({ current: { wave_height: null, wave_period: 8, sea_surface_temperature: 20 } })).toThrow();
    expect(() => parseMarineResponse({ current: { wave_height: 1, wave_period: 8 } })).toThrow();
    expect(() => parseMarineResponse({ current: { wave_height: "1", wave_period: 8, sea_surface_temperature: 20 } })).toThrow();
    expect(() => parseMarineResponse({})).toThrow();
  });
  it("builds the URL with the three variables", () => {
    const url = buildMarineUrl(3.2, 73.2);
    expect(url).toContain("latitude=3.2");
    expect(url).toContain("longitude=73.2");
    expect(url).toContain("wave_height,wave_period,sea_surface_temperature");
  });
});

describe("sun parser", () => {
  it("converts ISO UTC timestamps to minutes of the day", () => {
    expect(isoToUtcMinutes("2026-11-12T00:31:12+00:00")).toBe(31);
    expect(isoToUtcMinutes("2026-11-12T12:40:00+00:00")).toBe(760);
  });
  it("accepts results.* and top-level fields", () => {
    const a = { status: "OK", results: { sunrise: "2026-11-12T06:00:00+00:00", sunset: "2026-11-12T18:00:00+00:00" } };
    const b = { sunrise: "2026-11-12T06:00:00+00:00", sunset: "2026-11-12T18:00:00+00:00" };
    expect(parseSunResponse(a)).toEqual({ sunrise: 360, sunset: 1080 });
    expect(parseSunResponse(b)).toEqual({ sunrise: 360, sunset: 1080 });
  });
  it("rejects a bad status or invalid time", () => {
    expect(() => parseSunResponse({ status: "INVALID_REQUEST", results: "" })).toThrow();
    expect(() => parseSunResponse({ status: "OK", results: { sunrise: "nonsense", sunset: "x" } })).toThrow();
    expect(() => parseSunResponse(null)).toThrow();
  });
  it("handles sunset earlier than sunrise in UTC minutes (wrap-around input)", () => {
    const wrap = parseSunResponse({
      status: "OK",
      results: { sunrise: "2026-11-12T20:10:00+00:00", sunset: "2026-11-12T05:30:00+00:00" },
    });
    expect(wrap).toEqual({ sunrise: 1210, sunset: 330 });
    expect(getTimeOfDay(wrap, 60)).toBe("day");
    expect(getTimeOfDay(wrap, 720)).toBe("night");
  });
});

describe("offline sun estimate", () => {
  it("uses solar hour = UTC hour + lon/15", () => {
    expect(estimateSunTimes(0)).toEqual({ sunrise: 360, sunset: 1080 });
    expect(estimateSunTimes(73.2)).toEqual({ sunrise: 67, sunset: 787 });
  });
  it("wraps past midnight for western longitudes", () => {
    const s = estimateSunTimes(-119.5);
    expect(s.sunrise).toBeGreaterThanOrEqual(0);
    expect(s.sunrise).toBeLessThan(1440);
    expect(s.sunset).toBeLessThan(1440);
    expect(s.sunrise).toBeGreaterThan(s.sunset); // the wrap-around case
  });
  it("currentUtcMinutes", () => {
    expect(currentUtcMinutes(new Date("2026-11-12T13:45:00Z"))).toBe(825);
  });
});

describe("fetchConditions with mocked network", () => {
  it("falls back to the habitat values when fetch fails", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
    const r = await fetchConditions("north", { forceFallback: false });
    expect(r.source).toBe("fallback");
    expect(r.data).toEqual({ wave: 3.2, period: 12, temp: 8.0 });
    expect(r.error).toBeTruthy();
  });

  it("returns live data, then serves the second call from the cache", async () => {
    const body = { current: { wave_height: 1.1, wave_period: 7, sea_surface_temperature: 19 } };
    const spy = vi.fn(() => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(body)) }));
    vi.stubGlobal("fetch", spy);

    const first = await fetchConditions("kelp");
    const second = await fetchConditions("kelp");
    expect(first.source).toBe("live");
    expect(second.source).toBe("cached");
    expect(second.data).toEqual({ wave: 1.1, period: 7, temp: 19 });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("a land point (null values) triggers the fallback and is NOT cached", async () => {
    const body = { current: { wave_height: null, wave_period: null, sea_surface_temperature: null } };
    vi.stubGlobal("fetch", () => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(body)) }));
    const r = await fetchConditions("ocean");
    expect(r.source).toBe("fallback");
    const again = await fetchConditions("ocean");
    expect(again.source).toBe("fallback"); // still not cached
  });
});

describe("fetchSunTimes with mocked network", () => {
  it("uses the labelled offline estimate when the API fails", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
    const r = await fetchSunTimes("reef");
    expect(r.source).toBe("fallback");
    expect(r.label).toBe("Offline estimate");
    expect(r.data).toEqual({ sunrise: 67, sunset: 787 });
  });
});