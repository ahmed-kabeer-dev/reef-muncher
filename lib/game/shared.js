// Reef Muncher: shared constants and drawing helpers for the engine and hazards.
export const WORLD = { width: 1100, height: 860, surface: 60, sand: 90 };
export const INK = "#08334a";

export const rand = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** A cartoon fish drawn with paths. w = visual width in px. facing: 1 right, -1 left. */
export function drawFish(c, x, y, w, { body, fin, facing = 1, t = 0 }) {
  const h = w * 0.55;
  const wag = Math.sin(t * 10) * w * 0.05;

  c.save();
  c.translate(x, y);
  c.scale(facing, 1);
  c.lineWidth = Math.max(2, w * 0.045);
  c.strokeStyle = INK;
  c.lineJoin = "round";

  c.fillStyle = fin;
  c.beginPath();
  c.moveTo(-w * 0.3, 0);
  c.lineTo(-w * 0.52, -h * 0.4 + wag);
  c.lineTo(-w * 0.52, h * 0.4 + wag);
  c.closePath(); c.fill(); c.stroke();

  c.beginPath();
  c.moveTo(-w * 0.12, -h * 0.4);
  c.quadraticCurveTo(w * 0.04, -h * 0.85, w * 0.18, -h * 0.4);
  c.closePath(); c.fill(); c.stroke();

  c.fillStyle = body;
  c.beginPath(); c.ellipse(0, 0, w * 0.38, h * 0.5, 0, 0, Math.PI * 2);
  c.fill(); c.stroke();

  c.fillStyle = "#fff";
  c.beginPath(); c.arc(w * 0.19, -h * 0.1, w * 0.085, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = INK;
  c.beginPath(); c.arc(w * 0.21, -h * 0.1, w * 0.035, 0, Math.PI * 2); c.fill();

  c.beginPath();
  c.arc(w * 0.3, h * 0.12, w * 0.06, 0.2, Math.PI * 0.8);
  c.stroke();

  c.restore();
}