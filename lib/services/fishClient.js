// Reef Muncher: Fish Game API client (the lecturer's service).
// Request:  GET https://marcconrad.com/uob/fish/api.php?out=csv&base64=yes
// Response: one line "<base64 image>,<digit>". We split on the LAST comma.
//
// Single responsibility: talk to ONE API and return { image, digit }.
// It never decides game rules and never touches the database.

import { fetchText, runWithFallback } from "./http.js";

const FISH_URL = "https://marcconrad.com/uob/fish/api.php?out=csv&base64=yes";
const FISH_TIMEOUT_MS = 3000;

// ---------- Parsing (exported so it can be unit tested) ----------

/** Guess the image type from the first Base64 characters. */
export function detectMime(b64) {
  if (b64.startsWith("/9j/")) return "image/jpeg";
  if (b64.startsWith("iVBOR")) return "image/png";
  if (b64.startsWith("R0lGOD")) return "image/gif";
  if (b64.startsWith("UklGR")) return "image/webp";
  return "image/png"; // default
}

/** Turn the raw API text into { image: dataUri, digit }. Throws if anything looks wrong. */
export function parseFishResponse(text) {
  const line = String(text).trim();
  const cut = line.lastIndexOf(","); // LAST comma: a data: URI contains its own comma
  if (cut <= 0) throw new Error("Fish API: response has no comma");

  let image = line.slice(0, cut).trim();
  const digitText = line.slice(cut + 1).trim();

  if (!/^[0-9]$/.test(digitText)) {
    throw new Error(`Fish API: digit "${digitText.slice(0, 10)}" is not 0 to 9`);
  }
  const digit = Number(digitText);

  if (image.startsWith("data:image")) {
    if (image.length < 100) throw new Error("Fish API: image too short");
  } else {
    if (image.length < 100 || !/^[A-Za-z0-9+/=\s]+$/.test(image)) {
      throw new Error("Fish API: image is not valid Base64");
    }
    image = `data:${detectMime(image)};base64,${image}`;
  }
  return { image, digit };
}

// ---------- Fallback: generated SVG scene ----------

const FALLBACK_COLORS = [
  ["#FF8FA3", "#FF5C7A"], ["#FFB347", "#FF8C1A"], ["#9B8CFF", "#6B57F0"],
  ["#6EE7B7", "#2FCB7A"], ["#7DD3FC", "#38A9E8"], ["#F9A8D4", "#EC6FB1"],
];

/**
 * Draws 1 to 9 fish plus seaweed, rocks and bubbles that are clearly NOT fish.
 * The digit is the number of fish ACTUALLY drawn, so the answer always matches the image.
 * rng is injectable so tests can be repeatable.
 */
export function makeFallbackPuzzle(rng = Math.random) {
  const W = 480, H = 320;
  const wanted = 1 + Math.floor(rng() * 9);

  const fish = [];
  for (let tries = 0; fish.length < wanted && tries < 1000; tries++) {
    const x = 55 + rng() * (W - 110);
    const y = 45 + rng() * (H - 130);
    if (fish.every((f) => Math.hypot(f.x - x, f.y - y) > 72)) {
      fish.push({
        x, y,
        flip: rng() < 0.5 ? -1 : 1,
        c: FALLBACK_COLORS[Math.floor(rng() * FALLBACK_COLORS.length)],
      });
    }
  }

  const fishSvg = fish
    .map(
      (f) => `<g class="fish" transform="translate(${f.x.toFixed(1)} ${f.y.toFixed(1)}) scale(${f.flip} 1)">
<polygon points="-26,0 -48,-16 -48,16" fill="${f.c[1]}" stroke="#08334A" stroke-width="3" stroke-linejoin="round"/>
<ellipse rx="32" ry="19" fill="${f.c[0]}" stroke="#08334A" stroke-width="3"/>
<circle cx="16" cy="-5" r="5" fill="#fff" stroke="#08334A" stroke-width="2"/>
<circle cx="18" cy="-5" r="2.2" fill="#08334A"/>
</g>`
    )
    .join("\n");

  const bubbles = Array.from({ length: 7 }, () => {
    const cx = (10 + rng() * (W - 20)).toFixed(1);
    const cy = (10 + rng() * (H - 60)).toFixed(1);
    const r = (3 + rng() * 5).toFixed(1);
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#fff" stroke-opacity="0.8" stroke-width="2"/>`;
  }).join("\n");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs><linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C8F6FF"/><stop offset="1" stop-color="#11A5BC"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#w)"/>
${bubbles}
<rect y="${H - 38}" width="${W}" height="38" fill="#F6C760"/>
<g stroke="#2FCB7A" stroke-width="7" stroke-linecap="round" fill="none">
<path d="M40 ${H - 30} q-14 -30 0 -60 q14 -25 0 -50"/>
<path d="M${W - 60} ${H - 30} q14 -30 0 -55 q-12 -22 0 -45"/>
</g>
<ellipse cx="${W / 2}" cy="${H - 22}" rx="34" ry="16" fill="#7B8E98" stroke="#08334A" stroke-width="3"/>
${fishSvg}
</svg>`;

  const image = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return { image, digit: fish.length };
}

// ---------- Public API ----------

/**
 * Get a puzzle. Always resolves: { data: { image, digit }, source, ms, error? }.
 * forceFallback is only for testing the offline path.
 */
export function fetchPuzzle({ forceFallback = false, timeoutMs = FISH_TIMEOUT_MS } = {}) {
  return runWithFallback(
    async () => {
      if (forceFallback) throw new Error("fallback forced for testing");
      const text = await fetchText(FISH_URL, { timeoutMs });
      return parseFishResponse(text);
    },
    () => makeFallbackPuzzle()
  );
}