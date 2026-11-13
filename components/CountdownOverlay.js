"use client";
// Reef Muncher: Get Ready overlay. Renders ONLY during PREPARING and COUNTDOWN, covers only
// the play area, is keyed by runId, and reads its value from the controller.
// Because the HUD never changes controller state, HUD updates cannot restart it.

export default function CountdownOverlay({ phase, runId, count }) {
  if (phase !== "PREPARING" && phase !== "COUNTDOWN") return null;

  return (
    <div className="overlay" key={runId} role="status" aria-live="assertive">
      {phase === "PREPARING" ? (
        <div className="card overlay-card">
          <h2>Get ready</h2>
          <p>Scanning the reef...</p>
        </div>
      ) : (
        <div key={count} className="count-num">{count}</div>
      )}
    </div>
  );
}