// Reef Muncher: hazards = big fish, their warning arrows, and sea mines.
//
// Design notes (for the video):
// - One module, one job: things that can hurt (or feed) the player.
// - It never subtracts hearts itself. Damage ALWAYS goes through engine.loseHeart(cause, source).
// - It only runs while the engine is PLAYING, so pause stops every hazard timer for free.
// - It talks to the engine through a few methods (loseHeart, eatBigFish, _burst, _floater).

import { eventBus, EVENTS } from "../events/eventBus.js";
import { fishWidth, bigFishWidth } from "./rules.js";
import { WORLD, INK, rand, drawFish, roundRect } from "./shared.js";

const WARNING_SECONDS = 1.5;                    // arrow shows this long before the fish enters
const FIRST_BIG_FISH_AT = 6;                    // the first big fish ENTERS 6 s after play starts
const MAX_BIG_FISH = 2;                         // on screen at once (warnings count too)
const MINE_FIRST_AT = 3;                        // never a mine in the first 3 seconds
const MINE_RESPAWN = 8;                         // seconds until a new mine drifts in
const MINE_RADIUS = 26;                         // about 52 px wide
const MIN_MINE_DISTANCE = 250;                  // mines spawn at least this far from the player

export class Hazards {
  constructor(engine) {
    this.e = engine;
    this.bigFish = [];
    this.warnings = [];
    this.mines = [];
    this.bigTimer = FIRST_BIG_FISH_AT - WARNING_SECONDS;
    // one countdown per mine that still has to appear
    this.mineQueue = Array.from({ length: engine.opts.mines }, () => MINE_FIRST_AT);
  }

  update(dt) {
    this._updateBigFish(dt);
    if (this.e.status === "playing") this._updateMines(dt);
  }

  // ---------- Big fish ----------

  /** Start a warning arrow. The fish enters after WARNING_SECONDS. */
  queueBigFish(number = Math.floor(rand(50, 101))) {
    const dir = Math.random() < 0.5 ? 1 : -1; // 1 = enters from the left
    this.warnings.push({
      number, dir, left: WARNING_SECONDS,
      y: rand(WORLD.surface + 130, WORLD.height - WORLD.sand - 100),
    });
    eventBus.emit(EVENTS.BIG_FISH_WARNING, { number, side: dir > 0 ? "left" : "right" });
  }

  _spawnBigFish(w) {
    const width = bigFishWidth(w.number);
    this.bigFish.push({
      number: w.number, dir: w.dir, w: width, h: width * 0.55,
      x: w.dir > 0 ? -width : WORLD.width + width,
      baseY: w.y, y: w.y,
      speed: rand(120, 180),
      phase: rand(0, 6), hitCooldown: 0,
    });
    eventBus.emit(EVENTS.BIG_FISH_SPAWNED, { number: w.number });
  }

  _updateBigFish(dt) {
    const e = this.e, p = e.player;

    // schedule the next one (calm sea = rarer, rough sea = more frequent)
    this.bigTimer -= dt;
    if (this.bigTimer <= 0) {
      if (this.bigFish.length + this.warnings.length < MAX_BIG_FISH) {
        this.queueBigFish();
        this.bigTimer = e.opts.bigFishInterval * rand(0.8, 1.2);
      } else {
        this.bigTimer = 1; // two already out: look again in a second
      }
    }

    // warnings turn into fish
    for (const w of this.warnings) w.left -= dt;
    const ready = this.warnings.filter((w) => w.left <= 0);
    if (ready.length) {
      this.warnings = this.warnings.filter((w) => w.left > 0);
      ready.forEach((w) => this._spawnBigFish(w));
    }

    const pw = fishWidth(p.size);
    const ph = pw * 0.55;

    for (const bf of [...this.bigFish]) {
      bf.x += (bf.dir * bf.speed + e.opts.current) * dt;
      bf.y = bf.baseY + Math.sin(e.elapsed * 1.2 + bf.phase) * 10;
      if (bf.hitCooldown > 0) bf.hitCooldown -= dt;

      const gone = (bf.dir > 0 && bf.x > WORLD.width + bf.w) || (bf.dir < 0 && bf.x < -bf.w);
      if (gone) { this.bigFish = this.bigFish.filter((b) => b !== bf); continue; }
      if (bf.hitCooldown > 0) continue;

      const hit =
        Math.abs(p.x - bf.x) < pw * 0.4 + bf.w * 0.4 &&
        Math.abs(p.y - bf.y) < ph * 0.5 + bf.h * 0.4;
      if (!hit) continue;

      if (p.size >= bf.number) {
        // edible: size is at least its number
        this.bigFish = this.bigFish.filter((b) => b !== bf);
        e.eatBigFish(bf);
      } else {
        // danger: the same fish cannot hit again for 1.5 s (important after a Shield pop)
        bf.hitCooldown = 1.5;
        e.loseHeart("bigfish", bf);
      }
      if (e.status !== "playing") break;
    }
  }

  // ---------- Mines ----------

  spawnMine() {
    const e = this.e, p = e.player;
    let x = 0, y = 0;
    for (let i = 0; i < 30; i++) {
      x = rand(60, WORLD.width - 60);
      y = rand(WORLD.surface + 80, WORLD.height - WORLD.sand - 60);
      if (Math.hypot(x - p.x, y - p.y) >= MIN_MINE_DISTANCE) break;
    }
    this.mines.push({
      x, y, baseY: y,
      dir: Math.random() < 0.5 ? -1 : 1,
      speed: rand(30, 50), phase: rand(0, 6),
    });
    eventBus.emit(EVENTS.MINE_SPAWNED, {});
  }

  _explode(m) {
    this.mines = this.mines.filter((x) => x !== m);
    this.e._burst(m.x, m.y, "#FF9A3C", 18);
    this.e._burst(m.x, m.y, "#FF4D4D", 10);
    this.mineQueue.push(MINE_RESPAWN);
    eventBus.emit(EVENTS.MINE_EXPLODED, {});
  }

  _updateMines(dt) {
    const e = this.e, p = e.player;

    this.mineQueue = this.mineQueue.map((t) => t - dt);
    const due = this.mineQueue.filter((t) => t <= 0).length;
    if (due) {
      this.mineQueue = this.mineQueue.filter((t) => t > 0);
      for (let i = 0; i < due; i++) this.spawnMine();
    }

    const pw = fishWidth(p.size);
    for (const m of [...this.mines]) {
      m.x += (m.dir * m.speed + e.opts.current) * dt;
      m.y = m.baseY + Math.sin(e.elapsed * 1.6 + m.phase) * 8;
      if (m.x > WORLD.width + 40) m.x = -40;       // re-enter from the opposite edge
      else if (m.x < -40) m.x = WORLD.width + 40;

      if (e.invulnTimer > 0) continue;             // invulnerable: mines do nothing
      if (Math.hypot(p.x - m.x, p.y - m.y) < MINE_RADIUS + pw * 0.3) {
        this._explode(m);                          // the mine is removed even if a Shield absorbs it
        e.loseHeart("mine", m);
        if (e.status !== "playing") break;
      }
    }
  }

  // ---------- Drawing ----------

  drawBelow(c) {
    for (const m of this.mines) this._drawMine(c, m);
    for (const bf of this.bigFish) this._drawBigFish(c, bf);
  }

  /** Warning arrows are drawn last, so nothing can cover them. */
  drawAbove(c) {
    for (const w of this.warnings) this._drawWarning(c, w);
  }

  _drawMine(c, m) {
    const on = this.e.elapsed % 1 < 0.5; // red light blinks once per second
    c.save();
    c.translate(m.x, m.y);
    c.strokeStyle = INK; c.lineWidth = 5; c.lineCap = "round";
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      c.beginPath();
      c.moveTo(Math.cos(a) * 18, Math.sin(a) * 18);
      c.lineTo(Math.cos(a) * 26, Math.sin(a) * 26);
      c.stroke();
    }
    c.fillStyle = "#26333D"; c.lineWidth = 3;
    c.beginPath(); c.arc(0, 0, 20, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = "rgba(255,255,255,0.22)";
    c.beginPath(); c.arc(-7, -8, 5, 0, Math.PI * 2); c.fill();
    c.fillStyle = on ? "#FF4D4D" : "#6B1F1F";
    c.beginPath(); c.arc(0, -2, 6, 0, Math.PI * 2); c.fill(); c.stroke();
    c.restore();
  }

  _drawBigFish(c, bf) {
    const e = this.e;
    const edible = e.player.size >= bf.number; // checked live: it changes as you grow
    drawFish(c, bf.x, bf.y, bf.w, { body: "#6C7FB8", fin: "#3F4E87", facing: bf.dir, t: e.elapsed + bf.phase });

    // Plate: colour AND icon (crown = edible, warning triangle = danger)
    const pw = 96, ph = 38, px = bf.x, py = bf.y - bf.h / 2 - 32;
    c.fillStyle = edible ? "#2FCB7A" : "#D93636";
    c.strokeStyle = INK; c.lineWidth = 3;
    roundRect(c, px - pw / 2, py - ph / 2, pw, ph, 12); c.fill(); c.stroke();
    if (edible) drawCrown(c, px - 30, py, 11); else drawWarning(c, px - 30, py, 11);
    c.fillStyle = edible ? INK : "#fff";
    c.font = "700 24px 'Trebuchet MS', Arial, sans-serif";
    c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(String(bf.number), px + 16, py + 1);
    c.textBaseline = "alphabetic";
  }

  _drawWarning(c, w) {
    const on = Math.floor(this.e.elapsed * 6) % 2 === 0; // flashing
    const x = w.dir > 0 ? 54 : WORLD.width - 54;
    const d = w.dir;
    c.save();
    c.translate(x, w.y);
    c.fillStyle = on ? "#FF4D4D" : "#B02A2A";
    c.strokeStyle = "#fff"; c.lineWidth = 4; c.lineJoin = "round";
    c.beginPath();
    const pts = [[-44, -24], [6, -24], [6, -42], [44, 0], [6, 42], [6, 24], [-44, 24]];
    pts.forEach(([px, py], i) => (i ? c.lineTo(px * d, py) : c.moveTo(px * d, py)));
    c.closePath(); c.fill(); c.stroke();
    c.fillStyle = "#fff";
    c.font = "700 24px 'Trebuchet MS', Arial, sans-serif";
    c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(String(w.number), -19 * d, 1);
    c.restore();
  }
}

// ---------- Plate icons (drawn with paths, no images) ----------

function drawCrown(c, x, y, s) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = "#FFD23F"; c.strokeStyle = INK; c.lineWidth = 2.5 / s; c.lineJoin = "round";
  const pts = [[-1, 0.6], [-1, -0.5], [-0.5, 0], [0, -0.8], [0.5, 0], [1, -0.5], [1, 0.6]];
  c.beginPath();
  pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py)));
  c.closePath(); c.fill(); c.stroke();
  c.restore();
}

function drawWarning(c, x, y, s) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = "#FFD23F"; c.strokeStyle = INK; c.lineWidth = 2.5 / s; c.lineJoin = "round";
  c.beginPath(); c.moveTo(0, -1); c.lineTo(1, 0.8); c.lineTo(-1, 0.8); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = INK;
  c.fillRect(-0.1, -0.35, 0.2, 0.55);
  c.beginPath(); c.arc(0, 0.48, 0.12, 0, Math.PI * 2); c.fill();
  c.restore();
}