"use client";
// Reef Muncher: Gameplay screen.
// - The run is started from a BUTTON CLICK, never from a mount effect
//   (the spec rule that avoids double runs under React StrictMode).
// - The page owns all server calls. The engine only gets resolveBite().
// - A request id ignores late answers from an old start request.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GameEngine } from "../../lib/game/engine.js";
import { eventBus, EVENTS } from "../../lib/events/eventBus.js";
import { postJson } from "../../lib/client/api.js";
import { HABITATS } from "../../lib/game/rules.js";
import Hud from "../../components/Hud.js";
import SonarPanel from "../../components/SonarPanel.js";
import ResultOverlay from "../../components/ResultOverlay.js";

const LOGGED_EVENTS = [
  EVENTS.GAME_STARTED, EVENTS.SAFE_FISH_EATEN, EVENTS.POISONED_FISH_EATEN,
  EVENTS.PLAYER_GREW, EVENTS.COMBO_CHANGED, EVENTS.PLAYER_HIT,
  EVENTS.SPEED_BONUS_AWARDED, EVENTS.RESCAN_USED, EVENTS.LEVEL_COMPLETE, EVENTS.GAME_OVER,
];

const EMPTY_HUD = {
  size: 10, score: 0, combo: 1, hearts: 3, eaten: 0, poisoned: 0,
  seconds: 0, speedBonus: 100, status: "idle", paused: false, result: null,
};

export default function PlayPage() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const runIdRef = useRef(null);
  const startIdRef = useRef(0);
  const loadingRef = useRef(false);
  const rescanBusyRef = useRef(false);
  const rescansLeftRef = useRef(3);

  const [hud, setHud] = useState(EMPTY_HUD);
  const [image, setImage] = useState(null);
  const [pictureId, setPictureId] = useState(0);
  const [rescansLeft, setRescansLeft] = useState(3);
  const [rescanBusy, setRescanBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [log, setLog] = useState([]);

  function showPicture(img) {
    setImage(img);
    setPictureId((n) => n + 1);
  }

  function updateRescans(n) {
    rescansLeftRef.current = n;
    setRescansLeft(n);
  }

  // ---------- Engine setup (one engine, destroyed on cleanup) ----------

  useEffect(() => {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const engine = new GameEngine(canvasRef.current, {
      onHud: setHud,
      reduceMotion,

      // The engine asks, the SERVER decides. The engine never learns the answer.
      resolveBite: async (digit) => {
        const runId = runIdRef.current;
        if (!runId) return "error";
        try {
          const data = await postJson("/api/run/eat", { runId, digit });
          if (data.result === "safe" && data.image) showPicture(data.image);
          return data.result;
        } catch {
          return "error";
        }
      },

      onRescanRequest: () => doRescanRef.current?.(),
    });

    engineRef.current = engine;
    engine.start(); // starts the loop (idle background) but the game is not playable yet

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

  // ---------- Start a run (called from a button click) ----------

  async function startRun() {
    if (loadingRef.current) return; // ignore double clicks
    loadingRef.current = true;
    setLoading(true);
    setError("");
    setNotice("");
    const myId = ++startIdRef.current;

    try {
      const params = new URLSearchParams(window.location.search);
      const wanted = params.get("habitat");
      const habitat = wanted && HABITATS[wanted] ? wanted : "reef";

      const data = await postJson("/api/run/start", { habitat }, 8000);
      if (myId !== startIdRef.current) return; // a newer request replaced this one

      runIdRef.current = data.runId;
      showPicture(data.image);
      updateRescans(data.rescansLeft);
      setLog([]);
      engineRef.current?.reset();
      engineRef.current?.beginRun();
    } catch (err) {
      setError(err.message === "Not logged in." ? "Please log in first." : "Could not start. Please try again.");
    } finally {
      loadingRef.current = false; // loading flags always clear in finally
      setLoading(false);
    }
  }

  // ---------- Rescan ----------

  const doRescanRef = useRef(null);
  doRescanRef.current = async function doRescan() {
    const engine = engineRef.current;
    if (!engine || engine.status !== "playing" || engine.paused) return;
    if (rescanBusyRef.current || rescansLeftRef.current <= 0) return;

    rescanBusyRef.current = true;
    setRescanBusy(true);
    setNotice("");
    try {
      const data = await postJson("/api/run/rescan", { runId: runIdRef.current });
      showPicture(data.image);
      updateRescans(data.rescansLeft);
      engine.applyRescan(); // costs 150 points and resets the speed-bonus clock
    } catch (err) {
      setNotice(err.message || "Rescan failed.");
    } finally {
      rescanBusyRef.current = false;
      setRescanBusy(false);
    }
  };

  const playing = hud.status === "playing";

  return (
    <main className="play-page">
      <Hud hud={hud} onPause={() => engineRef.current?.togglePause()} />

      <div className="play-layout">
        <div className="canvas-wrap">
          <canvas ref={canvasRef} className="game-canvas" />

          {hud.status === "idle" && (
            <div className="overlay">
              <div className="card overlay-card">
                <h2>Ready to dive?</h2>
                <p>Count the fish in the sonar picture. That number is the only safe tag.</p>
                {error && <div className="error-box" role="alert">{error}</div>}
                <button className="btn" onClick={startRun} disabled={loading}>
                  {loading ? "Loading sonar..." : "Dive in"}
                </button>
                <Link className="btn btn-secondary" href="/menu">Back to menu</Link>
              </div>
            </div>
          )}

          {hud.paused && (
            <div className="overlay">
              <div className="card overlay-card">
                <h2>Paused</h2>
                <button className="btn" onClick={() => engineRef.current?.togglePause()}>Resume</button>
                <Link className="btn btn-secondary" href="/menu">Quit to menu</Link>
              </div>
            </div>
          )}

          {(hud.status === "won" || hud.status === "lost") && (
            <ResultOverlay result={hud.result} onAgain={() => { engineRef.current?.reset(); startRun(); }} />
          )}
        </div>

        <div>
          <SonarPanel
            image={image}
            pictureId={pictureId}
            speedBonus={hud.speedBonus}
            rescansLeft={rescansLeft}
            rescanBusy={rescanBusy}
            canRescan={playing && !hud.paused}
            onRescan={() => doRescanRef.current?.()}
            notice={notice}
          />
          <div className="card sonar" style={{ marginTop: 16 }}>
            <h3>Event log</h3>
            <ul className="event-log">
              {log.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}