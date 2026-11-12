"use client";
// Reef Muncher: Gameplay screen (Day 1 test version).
// The page creates ONE engine in an effect and destroys it in the cleanup,
// so React StrictMode cannot leave two loops running.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GameEngine } from "../../lib/game/engine.js";
import { eventBus, EVENTS } from "../../lib/events/eventBus.js";

const LOGGED_EVENTS = [
  EVENTS.GAME_STARTED,
  EVENTS.SAFE_FISH_EATEN,
  EVENTS.POISONED_FISH_EATEN,
  EVENTS.PLAYER_GREW,
  EVENTS.COMBO_CHANGED,
  EVENTS.LEVEL_COMPLETE,
];

const EMPTY_HUD = {
  size: 10, score: 0, combo: 1, eaten: 0, poisoned: 0,
  seconds: 0, safeTag: 0, status: "playing", paused: false,
};

function formatTime(s) {
  const m = String(Math.floor(s / 60)).padStart(2, "0");
  const r = String(s % 60).padStart(2, "0");
  return `${m}:${r}`;
}

export default function PlayPage() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const [hud, setHud] = useState(EMPTY_HUD);
  const [log, setLog] = useState([]);

  useEffect(() => {
    const engine = new GameEngine(canvasRef.current, { onHud: setHud });
    engine.setSafeTag(4); // hard-coded for now: the server will own this on Day 2
    engineRef.current = engine;
    engine.start();

    // Several independent listeners on the bus: this is the event-driven theme.
    const unsubscribers = LOGGED_EVENTS.map((name) =>
      eventBus.on(name, (payload) => {
        const line = `${name} ${payload ? JSON.stringify(payload) : ""}`;
        setLog((l) => [line, ...l].slice(0, 8));
      })
    );

    return () => {
      unsubscribers.forEach((off) => off());
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  function playAgain() {
    engineRef.current?.reset();
    engineRef.current?.setSafeTag(4);
    setLog([]);
  }

  return (
    <main className="play-page">
      <header className="hud-bar">
        <div className="hud-item hud-brand">Reef Muncher</div>
        <div className="hud-item">
          <span className="hud-label">Size</span>
          <div className="size-bar" aria-label={`Size ${hud.size} of 100`}>
            <div className="size-fill" style={{ width: `${hud.size}%` }} />
          </div>
          <span className="hud-num">{hud.size}</span>
        </div>
        <div className="hud-item"><span className="hud-label">Combo</span><span className="hud-num">x{hud.combo}</span></div>
        <div className="hud-item"><span className="hud-label">Score</span><span className="hud-num">{hud.score}</span></div>
        <div className="hud-item"><span className="hud-label">Time</span><span className="hud-num">{formatTime(hud.seconds)}</span></div>
        <button className="hud-btn" onClick={() => engineRef.current?.togglePause()}>
          {hud.paused ? "Resume" : "Pause"}
        </button>
      </header>

      <div className="play-layout">
        <div className="canvas-wrap">
          <canvas ref={canvasRef} className="game-canvas" />

          {hud.paused && (
            <div className="overlay">
              <div className="card overlay-card">
                <h2>Paused</h2>
                <button className="btn" onClick={() => engineRef.current?.togglePause()}>Resume</button>
                <Link className="btn btn-secondary" href="/menu">Quit to menu</Link>
              </div>
            </div>
          )}

          {hud.status === "won" && (
            <div className="overlay">
              <div className="card overlay-card">
                <h2>Level complete!</h2>
                <p>Score {hud.score} in {formatTime(hud.seconds)}</p>
                <button className="btn" onClick={playAgain}>Play again</button>
                <Link className="btn btn-secondary" href="/menu">Main menu</Link>
              </div>
            </div>
          )}
        </div>

        <aside className="card sonar">
          <h3>Sonar (test panel)</h3>
          <p className="hint">The real sonar picture arrives on Day 2.</p>
          <div className="sonar-tag">
            <span className="hud-label">Safe tag (TEMPORARY, visible for testing)</span>
            <span className="sonar-digit">{hud.safeTag}</span>
          </div>
          <p>Eaten safe: <strong>{hud.eaten}</strong><br />Poisoned: <strong>{hud.poisoned}</strong></p>
          <p className="hint">Arrow keys or WASD to swim. P or Esc to pause.</p>

          <h3 style={{ marginTop: 16 }}>Event log</h3>
          <ul className="event-log">
            {log.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </aside>
      </div>
    </main>
  );
}