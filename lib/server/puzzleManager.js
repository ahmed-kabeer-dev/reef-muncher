// Reef Muncher: puzzle manager. Holds the SECRET safe tag for each run.
// Design notes (for the video):
// - The browser only receives the IMAGE. The digit stays in the database.
// - When the player eats a fish, the browser sends its digit and the server compares.
// - The next puzzle is prefetched in the background, so a safe bite gets the next
//   image instantly. fetchPuzzle() always resolves (it has a fallback), so a dead
//   API can never leave a run without a puzzle.
// - Single responsibility: puzzles and answers. No HTTP details, no game scoring.

import { fetchPuzzle } from "../services/fishClient.js";
import { HABITATS, MAX_RESCANS, timeMultiplier } from "../game/rules.js";
import { getHabitatConditions } from "./conditions.js";
import {
  createRun,
  getRun,
  setCurrentAndNext,
  setNextAnswer,
  useRescan,
} from "../db/index.js";

// runId -> Promise of the next puzzle (kept in memory because images are large)
const g = globalThis;
const prefetches = g.__reefPrefetch ?? (g.__reefPrefetch = new Map());

function prefetchNext(runId) {
  const promise = fetchPuzzle(); // always resolves
  prefetches.set(runId, promise);
  promise.then((r) => setNextAnswer(runId, r.data.digit)); // answer saved server-side only
}

async function takeNext(runId) {
  const pending = prefetches.get(runId);
  prefetches.delete(runId);
  return pending ? await pending : await fetchPuzzle(); // memory lost (restart)? fetch fresh
}

/** Returns the run only if it belongs to this session and is still being played. */
function loadOwnedRun(session, runId) {
  const id = Number(runId);
  if (!Number.isInteger(id)) return null;
  const run = getRun(id);
  if (!run) return null;
  if (run.session_id !== session.sessionId) return null; // somebody else's run
  if (run.outcome !== null) return null;                 // already finished
  return run;
}

export function forgetRun(runId) {
  prefetches.delete(Number(runId));
}

// ---------- Public functions ----------

const PHASES = ["day", "twilight", "night"];

export async function startRun({ session, habitat, timeOverride = null }) {
  if (!HABITATS[habitat]) return { error: "Unknown habitat.", status: 400 };

  // The first puzzle and the sea and sun data load IN PARALLEL.
  // Each has its own time limit and fallback, so none of them can block the run.
  const [puzzle, conditions] = await Promise.all([
    fetchPuzzle({ timeoutMs: 2500 }), // watchdog: fallback puzzle after 2.5 s
    getHabitatConditions(habitat),
  ]);

  // The time of day is decided ONCE here and fixed for the whole run.
  // The developer override is ignored in production builds.
  let timeOfDay = conditions.timeOfDay;
  let overridden = false;
  if (process.env.NODE_ENV !== "production" && PHASES.includes(timeOverride)) {
    timeOfDay = timeOverride;
    overridden = true;
  }

  const runId = createRun({
    sessionId: session.sessionId,
    userId: session.userId,
    habitat,
    timeOfDay,
    currentAnswer: puzzle.data.digit,
  });
  prefetchNext(runId);

  return {
    runId,
    image: puzzle.data.image, // NOTE: no digit in the response
    source: puzzle.source,
    ms: puzzle.ms,
    error: puzzle.error,
    rescansLeft: MAX_RESCANS,
    conditions: {
      sea: conditions.sea,
      sun: conditions.sun,
      timeOfDay,
      multiplier: timeMultiplier(timeOfDay),
      overridden,
      credits: conditions.credits,
    },
  };
}

export async function eatDigit({ session, runId, digit }) {
  const run = loadOwnedRun(session, runId);
  if (!run) return { error: "Run not found.", status: 404 };
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
    return { error: "Invalid digit.", status: 400 };
  }

  if (digit !== run.current_answer) {
    return { result: "poisoned" }; // the answer is NOT revealed
  }

  // Safe: promote the prefetched puzzle and start fetching another one.
  const next = await takeNext(run.id);
  setCurrentAndNext(run.id, next.data.digit, null);
  prefetchNext(run.id);

  return {
    result: "safe",
    image: next.data.image,
    source: next.source,
  };
}

export async function rescan({ session, runId }) {
  const run = loadOwnedRun(session, runId);
  if (!run) return { error: "Run not found.", status: 404 };
  if (run.rescans_used >= MAX_RESCANS) {
    return { error: "No rescans left.", status: 409 };
  }

  const puzzle = await fetchPuzzle();
  if (!useRescan(run.id, puzzle.data.digit, MAX_RESCANS)) {
    return { error: "No rescans left.", status: 409 };
  }

  return {
    image: puzzle.data.image,
    source: puzzle.source,
    rescansLeft: MAX_RESCANS - (run.rescans_used + 1),
  };
}