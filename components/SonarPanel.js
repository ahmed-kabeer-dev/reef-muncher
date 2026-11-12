"use client";
// Reef Muncher: sonar panel. Shows the picture, the safe tag as "?" (the real answer
// never reaches the browser), the speed bonus bar and the Rescan button.

import { MAX_RESCANS, RESCAN_COST } from "../lib/game/rules.js";

export default function SonarPanel({
  image, pictureId, speedBonus, rescansLeft, rescanBusy, canRescan, onRescan, notice,
}) {
  const disabled = !canRescan || rescanBusy || rescansLeft <= 0;

  return (
    <aside className="card sonar">
      <h3>Sonar</h3>

      <div className="sonar-frame">
        {image ? (
          // key changes on every new picture, which replays the scan-line sweep
          <div key={pictureId} className="sonar-scan">
            <img className="sonar-img" src={image} alt="Sonar picture: count the fish" />
          </div>
        ) : (
          <div className="sonar-empty">Press Dive in to scan</div>
        )}
      </div>

      <div className="sonar-tag">
        <span className="hud-label">Safe fish tag</span>
        <span className="sonar-digit" aria-label="Hidden. Count the fish in the picture.">?</span>
      </div>

      <div className="bonus-wrap">
        <div className="bonus-head">
          <span className="hud-label">Speed bonus</span>
          <strong>{image ? speedBonus : 0}</strong>
        </div>
        <div className="bonus-bar" role="img" aria-label={`Speed bonus ${speedBonus} of 100`}>
          <div className="bonus-fill" style={{ width: `${image ? speedBonus : 0}%` }} />
        </div>
      </div>

      <button className="btn btn-secondary" onClick={onRescan} disabled={disabled}>
        {rescanBusy ? "Scanning..." : `Rescan (R) -${RESCAN_COST}`} 
      </button>
      <p className="hint">Rescans left: {rescansLeft} of {MAX_RESCANS}</p>
      {notice && <p className="hint bad" role="status">{notice}</p>}

      <p className="hint">Arrow keys or WASD to swim. P or Esc to pause.</p>
    </aside>
  );
}