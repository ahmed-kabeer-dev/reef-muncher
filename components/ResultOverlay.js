"use client";
// Reef Muncher: Level Complete / Game Over overlay.

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

export default function ResultOverlay({ result, onAgain }) {
  if (!result) return null;
  const win = result.outcome === "win";

  return (
    <div className="overlay">
      <div className="card overlay-card result-card" role="dialog" aria-modal="true">
        <h2>{win ? "🏆 Level complete!" : "💀 Game over"}</h2>
        {!win && <p className="result-cause">{CAUSE_TEXT[result.cause] ?? "Game over"}</p>}

        <table className="result-table">
          <tbody>
            <tr><td>Fish score</td><td>{result.score}</td></tr>
            {win && <tr><td>Hearts bonus ({result.hearts} x 200)</td><td>+{result.heartsBonus}</td></tr>}
            {win && <tr><td>Time bonus</td><td>+{result.timeBonus}</td></tr>}
            <tr className="result-total"><td>Total</td><td>{result.finalScore}</td></tr>
          </tbody>
        </table>
        <p className="hint">
          Safe fish eaten: {result.eaten} &middot; Poisoned: {result.poisoned} &middot; {result.seconds}s
        </p>
        {!win && <p className="hint">{TIPS[result.cause]}</p>}

        <button className="btn" onClick={onAgain}>Play again</button>
        <Link className="btn btn-secondary" href="/menu">Main menu</Link>
      </div>
    </div>
  );
}