"use client";
// Reef Muncher: top HUD bar (React UI only, reads values pushed by the engine).

function formatTime(s) {
  const m = String(Math.floor(s / 60)).padStart(2, "0");
  const r = String(s % 60).padStart(2, "0");
  return `${m}:${r}`;
}

export default function Hud({ hud, onPause }) {
  const canPause = hud.status === "playing";
  return (
    <header className="hud-bar">
      <div className="hud-item hud-brand">Reef Muncher</div>

      {/* Filled vs outline hearts: the state is never shown by colour alone */}
      <div className="hud-item hearts" role="img" aria-label={`${hud.hearts} of 3 hearts left`}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={i < hud.hearts ? "heart full" : "heart empty"}>
            {i < hud.hearts ? "♥" : "♡"}
          </span>
        ))}
      </div>

      <div className="hud-item">
        <span className="hud-label">Size</span>
        <div className="size-bar" role="img" aria-label={`Size ${hud.size} of 100`}>
          <div className="size-fill" style={{ width: `${hud.size}%` }} />
        </div>
        <span className="hud-num">{hud.size}</span>
      </div>

      <div className="hud-item"><span className="hud-label">Combo</span><span className="hud-num">x{hud.combo}</span></div>
      <div className="hud-item"><span className="hud-label">Score</span><span className="hud-num">{hud.score}</span></div>
      <div className="hud-item"><span className="hud-label">Time</span><span className="hud-num">{formatTime(hud.seconds)}</span></div>

      <button className="hud-btn" onClick={onPause} disabled={!canPause}>
        {hud.paused ? "Resume" : "Pause"}
      </button>
    </header>
  );
}