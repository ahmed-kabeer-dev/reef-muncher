// Reef Muncher: finishing a run (validate, save, report new best and rank-up).
// Honest limitation: the game logic runs in the browser, so the score is CLAIMED by the
// browser. The server checks that the run is yours, still open, and that the numbers are
// plausible (checkFinish). It is not a fully server-authoritative game.

import { getRun, finishRun, getBestScore } from "../db/index.js";
import { checkFinish, getRank } from "../game/rules.js";
import { forgetRun } from "./puzzleManager.js";

export function finishRunFor({ session, runId, result }) {
  const id = Number(runId);
  const run = Number.isInteger(id) ? getRun(id) : null;
  if (!run || run.session_id !== session.sessionId) return { error: "Run not found.", status: 404 };
  if (run.outcome !== null) return { error: "Run already finished.", status: 409 };

  const elapsed = (Date.now() - run.created_at) / 1000;
  const problem = checkFinish(result, elapsed, { strict: process.env.NODE_ENV === "production" });
  if (problem) return { error: problem, status: 400 };

  const previousBest = session.userId ? getBestScore(session.userId) : 0;

  const saved = finishRun({
    runId: id,
    outcome: result.outcome,
    score: result.score,
    seconds: result.seconds,
    bestCombo: result.bestCombo,
  });
  if (!saved) return { error: "Run already finished.", status: 409 }; // two requests raced

  forgetRun(id); // free the prefetched puzzle from memory

  // Guests: the run is closed (so it cannot be reused) but nothing goes to a profile.
  if (!session.userId) return { saved: false, guest: true };

  const bestScore = Math.max(previousBest, result.score);
  return {
    saved: true,
    guest: false,
    score: result.score,
    previousBest,
    bestScore,
    newBest: result.score > previousBest,
    rankBefore: getRank(previousBest),
    rankAfter: getRank(bestScore),
  };
}