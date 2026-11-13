// Reef Muncher: RunController = the single source of truth for the run phase.
// Rules from the spec (for the video):
// - Phases only move forward: IDLE -> PREPARING -> COUNTDOWN -> PLAYING <-> PAUSED -> ENDED.
// - start() is called from a BUTTON CLICK, never from a mount effect.
// - Every timer and every async result checks that its runId is still current,
//   so a cancelled or replaced run can never touch the game.
// - Countdown uses plain timers: "3" at 0 ms, "2" at 800, "1" at 1600, "GO!" at 2400 (sets PLAYING).
// - No React, no fetch: the page injects loadRun / onPuzzle.

import { withTimeout } from "../services/http.js";
import { buildDifficulty } from "./difficulty.js";
import { eventBus, EVENTS } from "../events/eventBus.js";

export const PHASE = Object.freeze({
  IDLE: "IDLE",
  PREPARING: "PREPARING",
  COUNTDOWN: "COUNTDOWN",
  PLAYING: "PLAYING",
  PAUSED: "PAUSED",
  ENDED: "ENDED",
});

// The server loads puzzle (2.5 s watchdog), sea (3 s) and sun (3 s) IN PARALLEL,
// so the worst case is about 3 s. This is the outer safety net.
const RUN_LIMIT_MS = 4000;

export class RunController {
  constructor({ engine, loadRun, onPuzzle, onChange }) {
    this.engine = engine;
    this.loadRun = loadRun;
    this.onPuzzle = onPuzzle;
    this.onChange = onChange ?? (() => {});

    this.phase = PHASE.IDLE;
    this.runId = 0;
    this.count = "";
    this.error = "";
    this.difficulty = null;
    this.conditions = null;
    this.timers = [];
  }

  snapshot() {
    return {
      phase: this.phase, runId: this.runId, count: this.count, error: this.error,
      difficulty: this.difficulty, conditions: this.conditions,
    };
  }

  _set(patch) {
    const changed = Object.keys(patch).some((k) => this[k] !== patch[k]);
    Object.assign(this, patch);
    if (changed) this.onChange(this.snapshot()); // HUD ticks never reach here, so overlays never restart
  }

  _later(runId, ms, fn) {
    const id = setTimeout(() => {
      if (runId !== this.runId) return; // stale timer from an old run: ignore
      fn();
    }, ms);
    this.timers.push(id);
  }

  _clearTimers() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  // ---------- Start ----------

  async start(habitat) {
    if (this.phase === PHASE.PREPARING || this.phase === PHASE.COUNTDOWN) return; // double click
    this._clearTimers();
    const myRun = ++this.runId;
    this._set({ phase: PHASE.PREPARING, count: "", error: "" });

    let run;
    try {
      run = await withTimeout(this.loadRun(habitat), RUN_LIMIT_MS, "run");
    } catch (err) {
      if (myRun !== this.runId) return;
      this._set({
        phase: PHASE.IDLE,
        error: err.message === "Not logged in." ? "Please log in first." : "Could not start the run. Please try again.",
      });
      return;
    }
    if (myRun !== this.runId) return; // a late result from an old start: ignore

    // If the server sent no conditions, buildDifficulty falls back to the habitat values.
    const c = run.conditions ?? null;
    const difficulty = buildDifficulty(
      habitat,
      c ? { wave: c.sea.wave, temp: c.sea.temp, source: c.sea.source } : null,
      Math.random,
      c?.timeOfDay ?? "day"
    );

    this.onPuzzle(run);
    this.engine.configure({
      speedFactor: difficulty.speedFactor,
      current: difficulty.current,
      mines: difficulty.mines,
      bigFishInterval: difficulty.bigFishInterval,
      timeMultiplier: difficulty.timeMultiplier,
      timeOfDay: difficulty.timeOfDay, // fixed for the whole run
    });
    this.engine.reset();

    eventBus.emit(EVENTS.CONDITIONS_LOADED, difficulty);
    eventBus.emit(EVENTS.SUN_TIMES_LOADED, { source: c?.sun?.source ?? "fallback" });
    eventBus.emit(EVENTS.TIME_OF_DAY_SET, {
      timeOfDay: difficulty.timeOfDay, multiplier: difficulty.timeMultiplier,
    });

    this._set({ phase: PHASE.COUNTDOWN, count: "3", difficulty, conditions: c });
    this._later(myRun, 800, () => this._set({ count: "2" }));
    this._later(myRun, 1600, () => this._set({ count: "1" }));
    this._later(myRun, 2400, () => {
      this._set({ phase: PHASE.PLAYING, count: "GO!" });
      this.engine.beginRun(); // only now do the loop timers, hazards and keyboard input start
    });
  }

  // ---------- Following the engine ----------

  /** The page calls this with every HUD update (max 10 per second). Only real changes matter. */
  syncHud(hud) {
    if (this.phase === PHASE.PLAYING && hud.paused) this._set({ phase: PHASE.PAUSED });
    else if (this.phase === PHASE.PAUSED && !hud.paused) this._set({ phase: PHASE.PLAYING });

    const over = hud.status === "won" || hud.status === "lost";
    if (over && (this.phase === PHASE.PLAYING || this.phase === PHASE.PAUSED)) {
      this._set({ phase: PHASE.ENDED });
    }
  }

  // ---------- Stop ----------

  cancel() {
    this._clearTimers();
    this.runId += 1; // every pending timer and request is now stale
    this.engine.reset();
    this._set({ phase: PHASE.IDLE, count: "", error: "" });
  }

  dispose() {
    this._clearTimers();
    this.runId += 1;
  }
}