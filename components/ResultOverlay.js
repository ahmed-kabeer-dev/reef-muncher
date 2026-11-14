"use client";
// Reef Muncher: Level Complete / Game Over overlay with a counting-up score and save banners.

import { useEffect, useState } from "react";
import Link from "next/link";

const CAUSE_TEXT = {
  poisoned: "You ate a poisoned fish",
  bigfish: "A big fish got you",
  mine: "You hit a sea mine",
};

const TIPS = {
  poisoned: "Tip: count the fish in the sonar picture again. That number is the only safe tag.",
  bigfish: "Tip: watch the red arrows. A plate with a crown is edible, a warning plate is danger.",
  mine: "Tip: mines blink red. Keep your distance, they cannot be eaten.",
};

function useCountUp(target, ms = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setValue(target); return; }
    let raf, start;
    const step = (t) => {
      start ??= t;
      const k = Math.min(1, (t - start) / ms);
      setValue(Math.round(target * k));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

export default function ResultOverlay({ result, save, onAgain }) {
  const total = useCountUp(result?.finalScore ?? 0);
  if (!result) return null;
  const win = result.outcome === "win";
  const saved = save?.status === "saved";

  return (
    <div className="overlay">
      <div className="card overlay-card result-card" role="dialog" aria-modal="true">
        <h2>{win ? "🏆 Level complete!" : "💀 Game over"}</h2>
        {!win && <p className="result-cause">{CAUSE_TEXT[result.cause] ?? "Game over"}</p>}

        {saved && save.newBest && <div className="banner banner-best">🏅 New best score!</div>}
        {saved && save.rankBefore !== save.rankAfter && (
          <div className="banner banner-rank">⬆️ Rank up: {save.rankBefore} → {save.rankAfter}</div>
        )}

        <table className="result-table">
          <tbody>
            <tr><td>Fish score</td><td>{result.score}</td></tr>
            {win && <tr><td>Hearts bonus ({result.hearts} x 200)</td><td>+{result.heartsBonus}</td></tr>}
            {win && <tr><td>Time bonus</td><td>+{result.timeBonus}</td></tr>}
            <tr className="result-total"><td>Total</td><td>{total}</td></tr>
          </tbody>
        </table>
        <p className="hint">
          Safe fish eaten: {result.eaten} &middot; Poisoned: {result.poisoned} &middot; {result.seconds}s
        </p>
        {!win && <p className="hint">{TIPS[result.cause]}</p>}

        {save?.status === "saving" && <p className="hint">Saving your score...</p>}
        {saved && <p className="hint">Saved. Your best: {save.bestScore} ({save.rankAfter})</p>}
        {save?.status === "guest" && (
          <p className="hint">Playing as a guest, so this score is not saved. Create an account to keep it.</p>
        )}
        {save?.status === "error" && <p className="hint bad" role="alert">Could not save: {save.message}</p>}

        <button className="btn" onClick={onAgain}>Play again</button>
        <Link className="btn btn-secondary" href="/habitats">Change habitat</Link>
        <Link className="btn btn-secondary" href="/menu">Main menu</Link>
      </div>
    </div>
  );
}