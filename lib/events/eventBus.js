// Reef Muncher: tiny publish/subscribe event bus.
// Low coupling: the engine, HUD, sound and stats only know this bus,
// never each other.

const listeners = new Map(); // eventName -> Set<handler>

export const eventBus = {
  /** Subscribe. Returns an unsubscribe function (handy for React cleanup). */
  on(eventName, handler) {
    if (!listeners.has(eventName)) listeners.set(eventName, new Set());
    listeners.get(eventName).add(handler);
    return () => eventBus.off(eventName, handler);
  },

  off(eventName, handler) {
    const set = listeners.get(eventName);
    if (set) set.delete(handler);
  },

  /** Publish. One failing listener must not break the others. */
  emit(eventName, payload) {
    const set = listeners.get(eventName);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[eventBus] listener for ${eventName} failed:`, err);
      }
    }
  },

  /** Remove everything (used by tests and when a run is cancelled). */
  clear() {
    listeners.clear();
  },
};

export const EVENTS = Object.freeze({
  GAME_STARTED: "GAME_STARTED",
  CONDITIONS_LOADED: "CONDITIONS_LOADED",
  SUN_TIMES_LOADED: "SUN_TIMES_LOADED",
  TIME_OF_DAY_SET: "TIME_OF_DAY_SET",
  PUZZLE_PREFETCH_STARTED: "PUZZLE_PREFETCH_STARTED",
  PUZZLE_READY: "PUZZLE_READY",
  PUZZLE_WATCHDOG_FALLBACK: "PUZZLE_WATCHDOG_FALLBACK",
  SAFE_FISH_EATEN: "SAFE_FISH_EATEN",
  POISONED_FISH_EATEN: "POISONED_FISH_EATEN",
  PLAYER_GREW: "PLAYER_GREW",
  COMBO_CHANGED: "COMBO_CHANGED",
  PLAYER_HIT: "PLAYER_HIT",
  SHIELD_ABSORBED: "SHIELD_ABSORBED",
  BIG_FISH_WARNING: "BIG_FISH_WARNING",
  BIG_FISH_SPAWNED: "BIG_FISH_SPAWNED",
  BIG_FISH_EATEN: "BIG_FISH_EATEN",
  MINE_SPAWNED: "MINE_SPAWNED",
  MINE_EXPLODED: "MINE_EXPLODED",
  POWERUP_SPAWNED: "POWERUP_SPAWNED",
  POWERUP_COLLECTED: "POWERUP_COLLECTED",
  POWERUP_EXPIRED: "POWERUP_EXPIRED",
  HINT_USED: "HINT_USED",
  SPEED_BONUS_AWARDED: "SPEED_BONUS_AWARDED",
  NIGHT_BONUS_AWARDED: "NIGHT_BONUS_AWARDED",
  RESCAN_USED: "RESCAN_USED",
  LEVEL_COMPLETE: "LEVEL_COMPLETE",
  GAME_OVER: "GAME_OVER",
  API_FALLBACK_USED: "API_FALLBACK_USED",
});