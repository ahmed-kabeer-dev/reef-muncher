// Reef Muncher: canvas game engine (plain class, NO React, NO network).
// Design notes (for the video):
// - Per-frame data lives HERE, not in React state. HUD values are pushed at most 10x/second.
// - The engine NEVER knows which fish is safe. It asks opts.resolveBite(digit), a function
//   injected by the page, which calls the server. The engine only gets back
//   "safe" | "poisoned" | "error".
// - ALL damage goes through ONE function: loseHeart(cause).
// - Status only moves forward: idle -> playing -> winning/dying -> won/lost.
// - One loop and one set of keyboard listeners. destroy() removes both (React StrictMode safe).

import { eventBus, EVENTS } from "../events/eventBus.js";
import {
  fishWidth, maxSpeed, safeFishScore, speedBonus, winBonuses, applyRescanPenalty, bigFishScore, darkness, lightRadius, badgeAlpha,
} from "./rules.js";
import { WORLD, INK, rand, clamp, drawFish, roundRect } from "./shared.js";
import { Hazards } from "./hazards.js";

export { WORLD };

const START_HEARTS = 3;
const INVULN_SECONDS = 1.2;
const SHAKE_SECONDS = 0.25;
const FLASH_SECONDS = 0.3;
const WIN_DELAY = 1.2;
const LOSE_DELAY = 1.0;
const KNOCKBACK_PX = 120;
const KNOCKBACK_SECONDS = 0.2;

const FISH_COLORS = [
  ["#FF8FA3", "#FF5C7A"], ["#FFB347", "#FF8C1A"], ["#9B8CFF", "#6B57F0"],
  ["#6EE7B7", "#2FCB7A"], ["#7DD3FC", "#38A9E8"], ["#F9A8D4", "#EC6FB1"],
  ["#FDE68A", "#F4B73F"], ["#A7F3D0", "#4CC9A0"], ["#C4B5FD", "#8B6FF0"],
  ["#FCA5A5", "#EF6B6B"],
];

function approach(value, target, maxDelta) {
  if (value < target) return Math.min(value + maxDelta, target);
  return Math.max(value - maxDelta, target);
}

export class GameEngine {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.opts = {
      speedFactor: 1,        // from sea temperature (Day 3)
      current: 0,            // px/s, signed (Day 3)
      timeMultiplier: 1,     // day 1.0, twilight 1.2, night 1.5 (Day 3)
            timeOfDay: "day",      // day | twilight | night (fixed for the whole run)
      mines: 1,              // from the habitat
      bigFishInterval: 12,   // seconds, from the sea state
      reduceMotion: false,   // skips screen shake
      onHud: null,           // (hud) => void
      resolveBite: null,     // (digit) => Promise<"safe" | "poisoned" | "error">
      onRescanRequest: null, // () => void, called when the player presses R
      ...options,
    };

    this.keys = new Set();
    this.running = false;
    this.destroyed = false;
    this.rafId = null;
    this.lastTime = 0;
    this.hudTimer = 0;

    this._frame = this._frame.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);

    this._setupCanvas();
    this.reset();
  }

  // ---------- Setup ----------

  _setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = WORLD.width * dpr;
    this.canvas.height = WORLD.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

    /** Change difficulty settings. The run controller calls this before reset(). */
  configure(partial) {
    Object.assign(this.opts, partial);
  }

  /** Back to the idle state (the background keeps animating, nothing is playable yet). */
  reset() {
    this.status = "idle"; // idle | playing | winning | dying | won | lost
    this.paused = false;
    this.elapsed = 0;     // animation clock
    this.playTime = 0;    // seconds of real play (the HUD timer)
    this.score = 0;
    this.combo = 1;
    this.hearts = START_HEARTS;
    this.eaten = 0;
    this.poisoned = 0;

    this.invulnTimer = 0;
    this.shakeTimer = 0;
    this.flashTimer = 0;
    this.shieldTimer = 0;  // Shield power-up arrives on Day 3
    this.knock = null;

    this.pictureClock = 0;   // seconds since the current sonar picture appeared
    this.pictureVersion = 0; // changes whenever the picture changes (ignores stale bite answers)
    this.endTimer = 0;
    this.loseCause = null;
    this.result = null;

    this.player = { x: 220, y: WORLD.height / 2, vx: 0, vy: 0, size: 10, facing: 1 };
        this.hazards = new Hazards(this);

    this.fish = [];
    for (let d = 0; d <= 9; d++) this.fish.push(this._makeFish(d, false));

    this.floaters = [];
    this.particles = [];
    this.bubbles = Array.from({ length: 26 }, () => this._makeBubble(true));
    this.seaweed = Array.from({ length: 9 }, (_, i) => ({
      x: 60 + i * 125 + rand(-20, 20), h: rand(60, 120), phase: rand(0, 6),
    }));
    this._pushHud();
  }

  /** Called by the page once the server has created the run. */
  beginRun() {
    this.status = "playing";
    this.lastTime = performance.now();
    eventBus.emit(EVENTS.GAME_STARTED, {});
    this._pushHud();
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
  }

  destroy() {
    this.destroyed = true;
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
    this.keys.clear();
    this.lastTime = performance.now();
    this._pushHud();
  }

  // ---------- Input (events) ----------

  _onKeyDown(e) {
    // Esc, P, R and movement do nothing before PLAYING (and never block button keys).
    if (this.status !== "playing") return;
    const k = e.key.toLowerCase();
    const gameKeys = ["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "w", "a", "s", "d"];
    if (gameKeys.includes(k)) e.preventDefault();

    if (k === "p" || k === "escape") {
      if (!e.repeat) this.togglePause();
      return;
    }
    if (k === "r") {
      if (!e.repeat && !this.paused) this.opts.onRescanRequest?.();
      return;
    }
    if (!this.paused) this.keys.add(k);
  }

  _onKeyUp(e) { this.keys.delete(e.key.toLowerCase()); }
  _onBlur() { this.keys.clear(); }

  // ---------- Main loop ----------

  _frame(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.lastTime) / 1000); // clamp dt
    this.lastTime = now;

    if (!this.paused) this._update(dt);
    this._render();

    this.hudTimer += dt;
    if (this.hudTimer >= 0.1) { // HUD at most 10 times per second
      this.hudTimer = 0;
      this._pushHud();
    }
    this.rafId = requestAnimationFrame(this._frame);
  }

  _pushHud() {
    if (!this.opts.onHud) return;
    this.opts.onHud({
      size: this.player.size,
      score: this.score,
      combo: this.combo,
      hearts: this.hearts,
      eaten: this.eaten,
      poisoned: this.poisoned,
      seconds: Math.floor(this.playTime),
      speedBonus: speedBonus(this.pictureClock),
      status: this.status,
      paused: this.paused,
      result: this.result,
    });
  }

  // ---------- Update ----------

  _update(dt) {
    this.elapsed += dt;
    const s = this.status;

    if (s === "playing") {
      this.playTime += dt;
      this.pictureClock += dt;
      this._updateTimers(dt);
      this._updatePlayer(dt);
    }
    if (s !== "won" && s !== "lost") this._updateFish(dt);
    if (s === "playing") this._checkEating();
    if (s === "playing") this.hazards.update(dt);
    if (s === "winning" || s === "dying") this._updateEnding(dt);
    this._updateEffects(dt);
  }

  _updateTimers(dt) {
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    this.flashTimer = Math.max(0, this.flashTimer - dt);
    this.shieldTimer = Math.max(0, this.shieldTimer - dt);
        this.lanternTimer = Math.max(0, this.lanternTimer - dt);
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
    const hasInput = dx !== 0 || dy !== 0;
    const rate = (hasInput ? 800 : 500) * dt;
    p.vx = approach(p.vx, (dx / len) * top, rate);
    p.vy = approach(p.vy, (dy / len) * top, rate);

    p.x += (p.vx + this.opts.current * 0.5) * dt;
    p.y += p.vy * dt;

    // knockback: a short push spread over KNOCKBACK_SECONDS
    if (this.knock) {
      const step = Math.min(dt, this.knock.t);
      const frac = step / KNOCKBACK_SECONDS;
      p.x += this.knock.dx * frac;
      p.y += this.knock.dy * frac;
      this.knock.t -= step;
      if (this.knock.t <= 0) this.knock = null;
    }

    if (dx !== 0) p.facing = Math.sign(dx);

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
      speed: 70 * this.opts.speedFactor * rand(0.8, 1.2),
      phase: rand(0, 6.28),
      pending: false,  // true while the server is deciding if this bite was safe
      cooldown: 0,     // seconds before this fish can be bitten again
    };
  }

  _respawn(f) {
    Object.assign(f, this._makeFish(f.digit, true)); // same digit, new edge and height
  }

  _updateFish(dt) {
    for (const f of this.fish) {
      f.x += (f.dir * f.speed + this.opts.current) * dt;
      f.y = f.baseY + Math.sin(this.elapsed * 1.5 + f.phase) * 14;
      if (f.cooldown > 0) f.cooldown -= dt;

      if (f.x > WORLD.width + f.w + 20) { f.x = -f.w; f.baseY = rand(WORLD.surface + 50, WORLD.height - WORLD.sand - 30); }
      else if (f.x < -f.w - 20) { f.x = WORLD.width + f.w; f.baseY = rand(WORLD.surface + 50, WORLD.height - WORLD.sand - 30); }
    }
  }

  // ---------- Eating: ask the server ----------

  _checkEating() {
    const p = this.player;
    const pw = fishWidth(p.size);
    const ph = pw * 0.55;
    const mx = p.x + p.facing * pw * 0.38; // the mouth is at the FRONT
    const my = p.y;

    for (const f of this.fish) {
      if (f.pending || f.cooldown > 0) continue;
      const fh = f.w * 0.55;
      const hit =
        Math.abs(mx - f.x) < f.w / 2 + 6 + ph * 0.1 &&
        Math.abs(my - f.y) < fh / 2 + ph * 0.3;
      if (hit) this._bite(f);
    }
  }

  /** The bite is "pending" for a fraction of a second while the server answers. */
  _bite(f) {
    f.pending = true;
    const version = this.pictureVersion;
    const ask = this.opts.resolveBite ? this.opts.resolveBite(f.digit) : Promise.resolve("error");

    Promise.resolve(ask)
      .catch(() => "error")
      .then((result) => {
        f.pending = false;
        // ignore late answers: engine gone, run ended, or the picture changed meanwhile
        if (this.destroyed || this.status !== "playing" || version !== this.pictureVersion) {
          f.cooldown = 0.3;
          return;
        }
        if (result === "safe") this._eatSafe(f);
        else if (result === "poisoned") this._eatPoisoned(f);
        else f.cooldown = 1; // network problem: try again in a second
      });
  }

  _eatSafe(f) {
    const bonus = speedBonus(this.pictureClock);
    const points = safeFishScore(this.combo, bonus, this.opts.timeMultiplier);
    this.score += points;
    this.eaten += 1;
    this._burst(f.x, f.y, "#ffffff", 10);
    this._floater(`Safe! +${points}`, f.x, f.y - 30, "#2FCB7A");
    if (bonus > 0) eventBus.emit(EVENTS.SPEED_BONUS_AWARDED, { bonus });
    if (this.opts.timeMultiplier > 1) {
      eventBus.emit(EVENTS.NIGHT_BONUS_AWARDED, {
        multiplier: this.opts.timeMultiplier, phase: this.opts.timeOfDay,
      });
    }

    const before = this.combo;
    this.combo = Math.min(5, this.combo + 1);
    if (this.combo !== before) eventBus.emit(EVENTS.COMBO_CHANGED, { combo: this.combo });

    this.player.size = Math.min(100, this.player.size + 10);
    eventBus.emit(EVENTS.SAFE_FISH_EATEN, { digit: f.digit, points });
    eventBus.emit(EVENTS.PLAYER_GREW, { size: this.player.size });

    this._respawn(f);
    this.pictureClock = 0; // the next picture's bonus clock starts now
    this.pictureVersion += 1;

    if (this.player.size >= 100) this._startWin();
    this._pushHud();
  }

  _eatPoisoned(f) {
    // While invulnerable a poisoned fish is NOT eaten: it just passes through.
    if (this.invulnTimer > 0) { f.cooldown = 0.8; return; }

    this._burst(f.x, f.y, "#7ED957", 12);
    this._floater("Poisoned!", f.x, f.y - 30, "#FF4D4D");
    this.poisoned += 1;
    eventBus.emit(EVENTS.POISONED_FISH_EATEN, { digit: f.digit });
    this._respawn(f);
    this.loseHeart("poisoned");
    this._pushHud();
  }

    /** Called by Hazards when the player touches a big fish that is small enough to eat. */
  eatBigFish(bf) {
    const points = bigFishScore(bf.number, this.opts.timeMultiplier);
    this.score += points;
    this.player.size = Math.min(100, this.player.size + 10);
    this._burst(bf.x, bf.y, "#FFD23F", 18);
    this._floater(`BIG BITE! +${points}`, this.player.x, this.player.y - 50, "#FFD23F");
    eventBus.emit(EVENTS.BIG_FISH_EATEN, { number: bf.number, points });
    eventBus.emit(EVENTS.PLAYER_GREW, { size: this.player.size });
    if (this.player.size >= 100) this._startWin();
    this._pushHud();
  }

  /** Developer drawer only. */
  debugWin() {
    if (this.status !== "playing") return;
    this.player.size = 100;
    this._startWin();
  }

  // ---------- The single penalty function ----------

  /**
   * Every source of damage goes through here. cause = "poisoned" | "bigfish" | "mine".
   * source = { x, y } of whatever hit us (used for the knockback). Returns true if a heart was lost.
   */
  loseHeart(cause, source = null) {
    if (this.status !== "playing") return false;

    // 1. invulnerable: nothing happens
    if (this.invulnTimer > 0) return false;

    // 2. an active Shield absorbs big fish and mines, but NOT poison
    if (this.shieldTimer > 0 && cause !== "poisoned") {
      this.shieldTimer = 0;
      eventBus.emit(EVENTS.SHIELD_ABSORBED, { cause });
      return false;
    }

    // 3. take the hit
    this.hearts -= 1;
    if (this.combo !== 1) {
      this.combo = 1;
      eventBus.emit(EVENTS.COMBO_CHANGED, { combo: 1 });
    }
    this.invulnTimer = INVULN_SECONDS;
    if (!this.opts.reduceMotion) this.shakeTimer = SHAKE_SECONDS;
    this.flashTimer = FLASH_SECONDS;
    eventBus.emit(EVENTS.PLAYER_HIT, { cause, hearts: this.hearts });

    // 4. big fish and mines also knock the player back about 120px
    if (source && (cause === "bigfish" || cause === "mine")) {
      const dx = this.player.x - source.x;
      const dy = this.player.y - source.y;
      const len = Math.hypot(dx, dy) || 1;
      this.knock = { dx: (dx / len) * KNOCKBACK_PX, dy: (dy / len) * KNOCKBACK_PX, t: KNOCKBACK_SECONDS };
    }

    // 5. out of hearts: the level ends
    if (this.hearts <= 0) this._startLose(cause);
    return true;
  }

  // ---------- Rescan (the server work happens in the page) ----------

  applyRescan() {
    this.score = applyRescanPenalty(this.score); // never below 0
    this.pictureClock = 0;
    this.pictureVersion += 1;
    this._floater("-150 Rescan", this.player.x, this.player.y - 50, "#FFD23F");
    eventBus.emit(EVENTS.RESCAN_USED, {});
    this._pushHud();
  }

  // ---------- Ending the level ----------

  _startWin() {
    this.status = "winning";
    this.endTimer = WIN_DELAY;
    this.keys.clear();
    for (let i = 0; i < 4; i++) this._burst(this.player.x, this.player.y, "#FFD23F", 14);
  }

  _startLose(cause) {
    this.status = "dying";
    this.endTimer = LOSE_DELAY;
    this.loseCause = cause;
    this.keys.clear();
    for (let i = 0; i < 3; i++) this._burst(this.player.x, this.player.y, "#FFD23F", 16); // pop
  }

  _updateEnding(dt) {
    if (this.status === "winning" && Math.random() < dt * 12) {
      this._burst(rand(100, WORLD.width - 100), rand(120, WORLD.height - 200),
        ["#FFD23F", "#FF6B5A", "#2FCB7A", "#7B5CFF", "#fff"][Math.floor(rand(0, 5))], 8);
    }
    this.endTimer -= dt;
    if (this.endTimer > 0) return;

    const seconds = Math.floor(this.playTime);
    if (this.status === "winning") {
      const b = winBonuses(this.hearts, seconds); // neither bonus is multiplied
      this.result = {
        outcome: "win", cause: null, seconds, hearts: this.hearts,
        score: this.score, heartsBonus: b.hearts, timeBonus: b.time,
        finalScore: this.score + b.hearts + b.time,
        eaten: this.eaten, poisoned: this.poisoned,
      };
      this.status = "won";
      eventBus.emit(EVENTS.LEVEL_COMPLETE, this.result);
    } else {
      this.result = {
        outcome: "lose", cause: this.loseCause, seconds, hearts: 0,
        score: this.score, heartsBonus: 0, timeBonus: 0, finalScore: this.score,
        eaten: this.eaten, poisoned: this.poisoned,
      };
      this.status = "lost";
      eventBus.emit(EVENTS.GAME_OVER, this.result);
    }
    this._pushHud();
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

    // ---------- Night: lamp, overlay, badges ----------

  /** Lamp radius in px, or null by day. The Lantern multiplies it by 1.6. */
  _lampRadius() {
    const base = lightRadius(this.opts.timeOfDay, this.player.size);
    if (base == null) return null;
    return base * (this.lanternTimer > 0 ? 1.6 : 1);
  }

  /** Dark water with a soft radial hole centred on the player (the lamp). */
  _drawDarkness(c) {
    const { width: W, height: H } = WORLD;
    const a = darkness(this.opts.timeOfDay);
    const R = this._lampRadius();
    const p = this.player;
    const g = c.createRadialGradient(p.x, p.y, R * 0.55, p.x, p.y, R);
    g.addColorStop(0, "rgba(3,24,38,0)"); // inside the lamp: fully clear
    g.addColorStop(1, `rgba(3,24,38,${a})`); // beyond the radius: full darkness
    c.fillStyle = g;
    c.fillRect(-10, -10, W + 20, H + 20);
  }

  _drawBadge(c, f, alpha) {
    const bx = f.x, by = f.y - (f.w * 0.55) / 2 - 24;
    c.globalAlpha = alpha;
    c.fillStyle = "#fff"; c.strokeStyle = INK; c.lineWidth = 3;
    roundRect(c, bx - 16, by - 16, 32, 32, 9); c.fill(); c.stroke();
    c.fillStyle = INK;
    c.font = "700 22px 'Trebuchet MS', Arial, sans-serif";
    c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(String(f.digit), bx, by + 1);
    c.textBaseline = "alphabetic";
    c.globalAlpha = 1;
  }

  _drawSmallFish(c, f, withBadge = true) {
    const [body, fin] = FISH_COLORS[f.digit];
    const facing = Math.sign(f.dir * f.speed + this.opts.current) || 1;
    drawFish(c, f.x, f.y, f.w, { body, fin, facing, t: this.elapsed + f.phase });
    if (withBadge) this._drawBadge(c, f, 1);
  }

  // ---------- Render ----------

  _render() {
    const c = this.ctx;
    const { width: W, height: H } = WORLD;
    const dark = darkness(this.opts.timeOfDay) > 0;

    c.save();
    if (this.shakeTimer > 0) c.translate(rand(-6, 6), rand(-6, 6)); // screen shake
    this._drawBackground(c);
    for (const b of this.bubbles) {
      c.fillStyle = "rgba(255,255,255,0.45)";
      c.beginPath(); c.arc(b.x, b.y, b.r, 0, Math.PI * 2); c.fill();
    }

    // By day badges are drawn with the fish. In the dark they are drawn AFTER the overlay.
    for (const f of this.fish) this._drawSmallFish(c, f, !dark);
    this.hazards.drawBelow(c);
    this._drawPlayer(c);
    for (const q of this.particles) {
      c.globalAlpha = clamp(q.life * 2, 0, 1);
      c.fillStyle = q.color;
      c.beginPath(); c.arc(q.x, q.y, q.r, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;

    if (dark) {
      this._drawDarkness(c);
      // Things that must stay readable in the dark, on top of the overlay:
      this.hazards.drawGlow(c); // mine lights, glowing big-fish eyes
      const R = this._lampRadius();
      for (const f of this.fish) {
        const d = Math.hypot(f.x - this.player.x, f.y - this.player.y);
        this._drawBadge(c, f, badgeAlpha(d, R)); // 100 percent inside the lamp, 35 percent outside
      }
    }
    this.hazards.drawAbove(c); // warning arrows are never darkened

    for (const f of this.floaters) {
      c.globalAlpha = clamp(f.life * 2, 0, 1);
      c.font = "700 26px 'Trebuchet MS', Arial, sans-serif";
      c.textAlign = "center";
      c.lineWidth = 5; c.strokeStyle = INK; c.strokeText(f.text, f.x, f.y);
      c.fillStyle = f.color; c.fillText(f.text, f.x, f.y);
    }
    c.globalAlpha = 1;
    c.restore();

    // red edge flash when hurt
    if (this.flashTimer > 0) {
      const a = clamp(this.flashTimer / FLASH_SECONDS, 0, 1) * 0.55;
      const g = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
      g.addColorStop(0, "rgba(255,77,77,0)");
      g.addColorStop(1, `rgba(255,77,77,${a})`);
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
    }
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
    c.fillRect(-10, -10, W + 20, H + 20);

    c.fillStyle = "rgba(255,255,255,0.07)";
    c.beginPath(); c.moveTo(150, surface); c.lineTo(260, surface); c.lineTo(520, H); c.lineTo(300, H); c.fill();
    c.beginPath(); c.moveTo(640, surface); c.lineTo(720, surface); c.lineTo(950, H); c.lineTo(760, H); c.fill();

    c.fillStyle = "#3FD0DC";
    c.beginPath(); c.moveTo(-10, -10);
    for (let x = -10; x <= W + 10; x += 20) c.lineTo(x, surface - 18 + Math.sin(x / 55 + this.elapsed * 1.5) * 7);
    c.lineTo(W + 10, -10); c.closePath(); c.fill();
    c.fillStyle = "rgba(255,255,255,0.75)";
    c.beginPath(); c.moveTo(-10, -10);
    for (let x = -10; x <= W + 10; x += 20) c.lineTo(x, surface - 32 + Math.sin(x / 45 + this.elapsed * 1.8 + 1) * 6);
    c.lineTo(W + 10, -10); c.closePath(); c.fill();

    const s = c.createLinearGradient(0, H - sand, 0, H);
    s.addColorStop(0, "#FFD45E"); s.addColorStop(1, "#F6A93B");
    c.fillStyle = s;
    c.beginPath(); c.moveTo(-10, H + 10);
    c.lineTo(-10, H - sand + 10);
    for (let x = 0; x <= W + 10; x += 40) c.lineTo(x, H - sand + Math.sin(x / 90) * 10);
    c.lineTo(W + 10, H + 10); c.closePath(); c.fill();
    for (let i = 0; i < 40; i++) {
      c.fillStyle = i % 2 ? "#FFF1B8" : "#D98A1F";
      c.fillRect((i * 97) % W, H - sand + 22 + ((i * 53) % (sand - 30)), 4, 3);
    }

    c.strokeStyle = "#2FCB7A"; c.lineWidth = 8; c.lineCap = "round";
    for (const w of this.seaweed) {
      const baseY = H - sand + 14;
      c.beginPath(); c.moveTo(w.x, baseY);
      const sway = Math.sin(this.elapsed * 1.2 + w.phase) * 14;
      c.quadraticCurveTo(w.x + sway, baseY - w.h * 0.5, w.x - sway * 0.5, baseY - w.h);
      c.stroke();
    }
  }

  _drawPlayer(c) {
    if (this.status === "dying" || this.status === "lost") return; // popped
    const p = this.player;
    // flicker while invulnerable
    const flicker = this.invulnTimer > 0 && Math.floor(this.elapsed * 14) % 2 === 0;
    if (flicker) c.globalAlpha = 0.3;
    drawFish(c, p.x, p.y, fishWidth(p.size), {
      body: "#FFD23F", fin: "#FF6B5A", facing: p.facing,
      t: this.elapsed * (Math.hypot(p.vx, p.vy) > 20 ? 1.6 : 0.7),
    });
    c.globalAlpha = 1;
  }
}
