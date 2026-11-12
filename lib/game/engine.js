// Reef Muncher: canvas game engine (plain class, NO React, NO network).
// Design notes (for the video):
// - Per-frame data (positions, velocities) lives HERE, not in React state.
// - The engine only emits events on the event bus and calls an optional onHud
//   callback (max 10 times per second). It never touches the UI or any API.
// - One animation loop and one set of keyboard listeners. destroy() removes both,
//   so React StrictMode (which mounts twice in dev) cannot create duplicates.

import { eventBus, EVENTS } from "../events/eventBus.js";
import { fishWidth, maxSpeed, safeFishScore } from "./rules.js";

export const WORLD = { width: 1100, height: 860, surface: 60, sand: 90 };

const INK = "#08334a";
const FISH_COLORS = [
  ["#FF8FA3", "#FF5C7A"], ["#FFB347", "#FF8C1A"], ["#9B8CFF", "#6B57F0"],
  ["#6EE7B7", "#2FCB7A"], ["#7DD3FC", "#38A9E8"], ["#F9A8D4", "#EC6FB1"],
  ["#FDE68A", "#F4B73F"], ["#A7F3D0", "#4CC9A0"], ["#C4B5FD", "#8B6FF0"],
  ["#FCA5A5", "#EF6B6B"],
];

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function approach(value, target, maxDelta) {
  if (value < target) return Math.min(value + maxDelta, target);
  return Math.max(value - maxDelta, target);
}

export class GameEngine {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.opts = {
      speedFactor: 1,   // from sea temperature (later)
      current: 0,       // px/s, signed (later from wave height)
      onHud: null,      // (hud) => void
      ...options,
    };

    this.keys = new Set();
    this.running = false;
    this.paused = false;
    this.rafId = null;
    this.lastTime = 0;
    this.hudTimer = 0;
    this.safeTag = 0;

    this._frame = this._frame.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);

    this._setupCanvas();
    this.reset();
  }

  // ---------- Setup ----------

  _setupCanvas() {
    const dpr = window.devicePixelRatio || 1; // sharp on high-density screens
    this.canvas.width = WORLD.width * dpr;
    this.canvas.height = WORLD.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  reset() {
    this.elapsed = 0;
    this.score = 0;
    this.combo = 1;
    this.eaten = 0;
    this.poisoned = 0;
    this.status = "playing"; // playing | won
    this.paused = false;

    this.player = {
      x: 220, y: WORLD.height / 2,
      vx: 0, vy: 0,
      size: 10, facing: 1,
    };

    this.fish = [];
    for (let d = 0; d <= 9; d++) this.fish.push(this._makeFish(d, false));

    this.floaters = [];
    this.particles = [];
    this.bubbles = Array.from({ length: 26 }, () => this._makeBubble(true));
    this.seaweed = Array.from({ length: 9 }, (_, i) => ({
      x: 60 + i * 125 + rand(-20, 20), h: rand(60, 120), phase: rand(0, 6),
    }));
    this._pushHud(true);
  }

  setSafeTag(n) {
    this.safeTag = n;
    this._pushHud(true);
  }

  // ---------- Lifecycle ----------

  start() {
    if (this.running) return; // never start a second loop
    this.running = true;
    this.lastTime = performance.now();
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    window.addEventListener("blur", this._onBlur);
    this.rafId = requestAnimationFrame(this._frame);
    eventBus.emit(EVENTS.GAME_STARTED, {});
  }

  destroy() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    window.removeEventListener("blur", this._onBlur);
    this.keys.clear();
  }

  togglePause() {
    if (this.status !== "playing") return;
    this.paused = !this.paused;
    this.keys.clear(); // stop "stuck" movement keys
    this.lastTime = performance.now();
    this._pushHud(true);
  }

  // ---------- Input (events) ----------

  _onKeyDown(e) {
    const k = e.key.toLowerCase();
    const gameKeys = ["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "w", "a", "s", "d"];
    if (gameKeys.includes(k)) e.preventDefault(); // stop the page scrolling
    if (k === "p" || k === "escape") {
      if (!e.repeat) this.togglePause();
      return;
    }
    if (!this.paused) this.keys.add(k);
  }

  _onKeyUp(e) {
    this.keys.delete(e.key.toLowerCase());
  }

  _onBlur() {
    this.keys.clear(); // losing focus must not leave a key "held"
  }

  // ---------- Main loop ----------

  _frame(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.lastTime) / 1000); // clamp dt
    this.lastTime = now;

    if (!this.paused && this.status === "playing") this._update(dt);
    this._render();

    this.hudTimer += dt;
    if (this.hudTimer >= 0.1) {          // push HUD at most 10 times per second
      this.hudTimer = 0;
      this._pushHud(false);
    }
    this.rafId = requestAnimationFrame(this._frame);
  }

  _pushHud() {
    if (!this.opts.onHud) return;
    this.opts.onHud({
      size: this.player.size,
      score: this.score,
      combo: this.combo,
      eaten: this.eaten,
      poisoned: this.poisoned,
      seconds: Math.floor(this.elapsed),
      safeTag: this.safeTag, // TEMPORARY: the real tag will never reach the browser
      status: this.status,
      paused: this.paused,
    });
  }

  // ---------- Update ----------

  _update(dt) {
    this.elapsed += dt;
    this._updatePlayer(dt);
    this._updateFish(dt);
    this._checkEating();
    this._updateEffects(dt);
  }

  _updatePlayer(dt) {
    const p = this.player;
    const k = this.keys;
    let dx = 0, dy = 0;
    if (k.has("arrowleft") || k.has("a")) dx -= 1;
    if (k.has("arrowright") || k.has("d")) dx += 1;
    if (k.has("arrowup") || k.has("w")) dy -= 1;
    if (k.has("arrowdown") || k.has("s")) dy += 1;

    const top = maxSpeed(p.size);
    const len = Math.hypot(dx, dy) || 1;
    const targetVx = (dx / len) * top;
    const targetVy = (dy / len) * top;

    // smooth acceleration while steering, smooth braking when released
    const hasInput = dx !== 0 || dy !== 0;
    const rate = (hasInput ? 800 : 500) * dt;
    p.vx = approach(p.vx, targetVx, rate);
    p.vy = approach(p.vy, targetVy, rate);

    // the water current pushes the player at 50 percent of its strength
    p.x += (p.vx + this.opts.current * 0.5) * dt;
    p.y += p.vy * dt;

    if (dx !== 0) p.facing = Math.sign(dx);

    // stay inside the swimmable area
    const w = fishWidth(p.size);
    const h = w * 0.55;
    p.x = clamp(p.x, w / 2, WORLD.width - w / 2);
    p.y = clamp(p.y, WORLD.surface + h / 2, WORLD.height - WORLD.sand + 25 - h / 2);
  }

  _makeFish(digit, fromEdge) {
    const w = rand(34, 42);
    const dir = Math.random() < 0.5 ? -1 : 1;
    return {
      digit, w, dir,
      x: fromEdge ? (dir > 0 ? -w : WORLD.width + w) : rand(0, WORLD.width),
      baseY: rand(WORLD.surface + 50, WORLD.height - WORLD.sand - 30),
      y: 0,
      speed: 70 * this.opts.speedFactor * rand(0.8, 1.2), // +-20 percent
      phase: rand(0, 6.28),
    };
  }

  _respawn(f) {
    // same digit, new edge, new random height
    const fresh = this._makeFish(f.digit, true);
    Object.assign(f, fresh);
  }

  _updateFish(dt) {
    for (const f of this.fish) {
      f.x += (f.dir * f.speed + this.opts.current) * dt;
      f.y = f.baseY + Math.sin(this.elapsed * 1.5 + f.phase) * 14;

      // leave one edge, re-enter from the opposite one at a new height
      if (f.x > WORLD.width + f.w + 20) { f.x = -f.w; f.baseY = rand(WORLD.surface + 50, WORLD.height - WORLD.sand - 30); }
      else if (f.x < -f.w - 20) { f.x = WORLD.width + f.w; f.baseY = rand(WORLD.surface + 50, WORLD.height - WORLD.sand - 30); }
    }
  }

  _checkEating() {
    const p = this.player;
    const pw = fishWidth(p.size);
    const ph = pw * 0.55;
    // the mouth is at the FRONT of the fish
    const mx = p.x + p.facing * pw * 0.38;
    const my = p.y;

    for (const f of this.fish) {
      const fh = f.w * 0.55;
      const hit =
        Math.abs(mx - f.x) < f.w / 2 + 6 + ph * 0.1 &&
        Math.abs(my - f.y) < fh / 2 + ph * 0.3;
      if (!hit) continue;

      if (f.digit === this.safeTag) this._eatSafe(f);
      else this._eatPoisoned(f);
      if (this.status !== "playing") break;
    }
  }

  _eatSafe(f) {
    this._burst(f.x, f.y, "#ffffff", 10);
    this._floater("Safe!", f.x, f.y - 30, "#2FCB7A");

    this.score += safeFishScore(this.combo, 0, 1); // speed bonus and multiplier come later
    this.eaten += 1;
    const before = this.combo;
    this.combo = Math.min(5, this.combo + 1);
    if (this.combo !== before) eventBus.emit(EVENTS.COMBO_CHANGED, { combo: this.combo });

    this.player.size = Math.min(100, this.player.size + 10);
    eventBus.emit(EVENTS.SAFE_FISH_EATEN, { digit: f.digit });
    eventBus.emit(EVENTS.PLAYER_GREW, { size: this.player.size });

    this._respawn(f);

    // TEMPORARY fake "next puzzle": pick a new random tag (Day 2 replaces this with the server)
    let next;
    do { next = Math.floor(Math.random() * 10); } while (next === this.safeTag);
    this.safeTag = next;

    if (this.player.size >= 100) {
      this.status = "won";
      eventBus.emit(EVENTS.LEVEL_COMPLETE, { score: this.score, seconds: Math.floor(this.elapsed) });
    }
    this._pushHud(true);
  }

  _eatPoisoned(f) {
    // Day 2 will route this through loseHeart("poisoned")
    this._burst(f.x, f.y, "#7ED957", 10);
    this._floater("Poisoned!", f.x, f.y - 30, "#FF4D4D");
    this.poisoned += 1;
    this.combo = 1;
    eventBus.emit(EVENTS.POISONED_FISH_EATEN, { digit: f.digit });
    this._respawn(f);
    this._pushHud(true);
  }

  // ---------- Effects ----------

  _floater(text, x, y, color) {
    this.floaters.push({ text, x, y, color, life: 1 });
  }

  _burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x, y, color,
        vx: rand(-90, 90), vy: rand(-120, -20),
        r: rand(3, 7), life: rand(0.4, 0.8),
      });
    }
  }

  _makeBubble(anywhere) {
    return {
      x: rand(0, WORLD.width),
      y: anywhere ? rand(WORLD.surface, WORLD.height) : WORLD.height - WORLD.sand,
      r: rand(2, 7), speed: rand(20, 50), phase: rand(0, 6),
    };
  }

  _updateEffects(dt) {
    for (const b of this.bubbles) {
      b.y -= b.speed * dt;
      b.x += Math.sin(this.elapsed + b.phase) * 8 * dt;
      if (b.y < WORLD.surface) Object.assign(b, this._makeBubble(false));
    }
    for (const f of this.floaters) { f.y -= 40 * dt; f.life -= dt; }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    for (const q of this.particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; }
    this.particles = this.particles.filter((q) => q.life > 0);
  }

  // ---------- Render ----------

  _render() {
    const c = this.ctx;
    this._drawBackground(c);
    for (const b of this.bubbles) {
      c.fillStyle = "rgba(255,255,255,0.45)";
      c.beginPath(); c.arc(b.x, b.y, b.r, 0, Math.PI * 2); c.fill();
    }
    for (const f of this.fish) this._drawSmallFish(c, f);
    this._drawPlayer(c);
    for (const q of this.particles) {
      c.globalAlpha = clamp(q.life * 2, 0, 1);
      c.fillStyle = q.color;
      c.beginPath(); c.arc(q.x, q.y, q.r, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
    for (const f of this.floaters) {
      c.globalAlpha = clamp(f.life * 2, 0, 1);
      c.font = "700 26px 'Trebuchet MS', Arial, sans-serif";
      c.textAlign = "center";
      c.lineWidth = 5; c.strokeStyle = INK; c.strokeText(f.text, f.x, f.y);
      c.fillStyle = f.color; c.fillText(f.text, f.x, f.y);
    }
    c.globalAlpha = 1;
  }

  _drawBackground(c) {
    const { width: W, height: H, surface, sand } = WORLD;
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#C8F6FF");
    g.addColorStop(0.25, "#3FD0DC");
    g.addColorStop(0.55, "#11A5BC");
    g.addColorStop(0.8, "#0A6C80");
    g.addColorStop(1, "#053B4D");
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);

    // light rays
    c.fillStyle = "rgba(255,255,255,0.07)";
    c.beginPath(); c.moveTo(150, surface); c.lineTo(260, surface); c.lineTo(520, H); c.lineTo(300, H); c.fill();
    c.beginPath(); c.moveTo(640, surface); c.lineTo(720, surface); c.lineTo(950, H); c.lineTo(760, H); c.fill();

    // wave crests at the top
    c.fillStyle = "#3FD0DC";
    c.beginPath(); c.moveTo(0, 0);
    for (let x = 0; x <= W; x += 20) c.lineTo(x, surface - 18 + Math.sin(x / 55 + this.elapsed * 1.5) * 7);
    c.lineTo(W, 0); c.closePath(); c.fill();
    c.fillStyle = "rgba(255,255,255,0.75)";
    c.beginPath(); c.moveTo(0, 0);
    for (let x = 0; x <= W; x += 20) c.lineTo(x, surface - 32 + Math.sin(x / 45 + this.elapsed * 1.8 + 1) * 6);
    c.lineTo(W, 0); c.closePath(); c.fill();

    // sand
    const s = c.createLinearGradient(0, H - sand, 0, H);
    s.addColorStop(0, "#FFD45E"); s.addColorStop(1, "#F6A93B");
    c.fillStyle = s;
    c.beginPath(); c.moveTo(0, H);
    c.lineTo(0, H - sand + 10);
    for (let x = 0; x <= W; x += 40) c.lineTo(x, H - sand + Math.sin(x / 90) * 10);
    c.lineTo(W, H); c.closePath(); c.fill();
    // speckles (deterministic so they do not flicker)
    for (let i = 0; i < 40; i++) {
      c.fillStyle = i % 2 ? "#FFF1B8" : "#D98A1F";
      c.fillRect((i * 97) % W, H - sand + 22 + ((i * 53) % (sand - 30)), 4, 3);
    }

    // seaweed
    c.strokeStyle = "#2FCB7A"; c.lineWidth = 8; c.lineCap = "round";
    for (const w of this.seaweed) {
      const baseY = H - sand + 14;
      c.beginPath(); c.moveTo(w.x, baseY);
      const sway = Math.sin(this.elapsed * 1.2 + w.phase) * 14;
      c.quadraticCurveTo(w.x + sway, baseY - w.h * 0.5, w.x - sway * 0.5, baseY - w.h);
      c.stroke();
    }
  }

  _drawSmallFish(c, f) {
    const [body, fin] = FISH_COLORS[f.digit];
    const facing = f.dir === 0 ? 1 : Math.sign(f.dir * f.speed + this.opts.current) || 1;
    drawFish(c, f.x, f.y, f.w, { body, fin, facing, t: this.elapsed + f.phase });

    // white number badge above the fish (at least 18px, bold)
    const bx = f.x, by = f.y - f.w * 0.55 / 2 - 24;
    c.fillStyle = "#fff"; c.strokeStyle = INK; c.lineWidth = 3;
    roundRect(c, bx - 16, by - 16, 32, 32, 9); c.fill(); c.stroke();
    c.fillStyle = INK;
    c.font = "700 22px 'Trebuchet MS', Arial, sans-serif";
    c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(String(f.digit), bx, by + 1);
    c.textBaseline = "alphabetic";
  }

  _drawPlayer(c) {
    const p = this.player;
    drawFish(c, p.x, p.y, fishWidth(p.size), {
      body: "#FFD23F", fin: "#FF6B5A", facing: p.facing,
      t: this.elapsed * (Math.hypot(p.vx, p.vy) > 20 ? 1.6 : 0.7),
    });
  }
}

// ---------- Drawing helpers ----------

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** A cartoon fish drawn with paths. w = visual width in px. facing: 1 right, -1 left. */
function drawFish(c, x, y, w, { body, fin, facing = 1, t = 0 }) {
  const h = w * 0.55;
  const wag = Math.sin(t * 10) * w * 0.05;

  c.save();
  c.translate(x, y);
  c.scale(facing, 1);
  c.lineWidth = Math.max(2, w * 0.045);
  c.strokeStyle = INK;
  c.lineJoin = "round";

  // tail
  c.fillStyle = fin;
  c.beginPath();
  c.moveTo(-w * 0.3, 0);
  c.lineTo(-w * 0.52, -h * 0.4 + wag);
  c.lineTo(-w * 0.52, h * 0.4 + wag);
  c.closePath(); c.fill(); c.stroke();

  // top fin
  c.beginPath();
  c.moveTo(-w * 0.12, -h * 0.4);
  c.quadraticCurveTo(w * 0.04, -h * 0.85, w * 0.18, -h * 0.4);
  c.closePath(); c.fill(); c.stroke();

  // body
  c.fillStyle = body;
  c.beginPath(); c.ellipse(0, 0, w * 0.38, h * 0.5, 0, 0, Math.PI * 2);
  c.fill(); c.stroke();

  // eye
  c.fillStyle = "#fff";
  c.beginPath(); c.arc(w * 0.19, -h * 0.1, w * 0.085, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = INK;
  c.beginPath(); c.arc(w * 0.21, -h * 0.1, w * 0.035, 0, Math.PI * 2); c.fill();

  // mouth
  c.beginPath();
  c.arc(w * 0.3, h * 0.12, w * 0.06, 0.2, Math.PI * 0.8);
  c.stroke();

  c.restore();
}