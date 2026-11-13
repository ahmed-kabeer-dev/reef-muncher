"use client";
// Reef Muncher: Gameplay screen.
// The page only wires things together: engine, run controller, server calls, UI.
// - The run starts from a BUTTON CLICK (controller.start), never from a mount effect.
// - The engine gets resolveBite(); the controller gets loadRun(). Neither knows about React.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GameEngine } from "../../lib/game/engine.js";
import { RunController, PHASE } from "../../lib/game/runController.js";
import { eventBus, EVENTS } from "../../lib/events/eventBus.js";
import { postJson } from "../../lib/client/api.js";
import { HABITATS } from "../../lib/game/rules.js";
import Hud from "../../components/Hud.js";
import SonarPanel from "../../components/SonarPanel.js";
import HabitatMiniCard from "../../components/HabitatMiniCard.js";
import ResultOverlay from "../../components/ResultOverlay.js";
import CountdownOverlay from "../../components/CountdownOverlay.js";
import DevDrawer from "../../components/DevDrawer.js";

const EMPTY_HUD = {
  size: 10, score: 0, combo: 1, hearts: 3, eaten: 0, poisoned: 0,
  seconds: 0, speedBonus: 100, status: "idle", paused: false, result: null,
};
const EMPTY_CTL = {
  phase: PHASE.IDLE, runId: 0, count: "", error: "", difficulty: null, conditions: null,
};

export default function PlayPage() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const controllerRef = useRef(null);
  const runIdRef = useRef(null);
  const rescanBusyRef = useRef(false);
  const rescansLeftRef = useRef(3);
  const doRescanRef = useRef(null);
  const overrideRef = useRef(null); // dev time-of-day override, read when a run starts

  const [hud, setHud] = useState(EMPTY_HUD);
  const [ctl, setCtl] = useState(EMPTY_CTL);
  const [image, setImage] = useState(null);
  const [pictureId, setPictureId] = useState(0);
  const [rescansLeft, setRescansLeft] = useState(3);
  const [rescanBusy, setRescanBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [service, setService] = useState(null);
  const [override, setOverride] = useState("auto");

  function showPicture(img) {
    setImage(img);
    setPictureId((n) => n + 1);
  }
  function updateRescans(n) {
    rescansLeftRef.current = n;
    setRescansLeft(n);
  }
  function changeOverride(value) {
    setOverride(value);
    overrideRef.current = value === "auto" ? null : value;
  }

  // ---------- One engine, one controller, destroyed on cleanup ----------

  useEffect(() => {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const engine = new GameEngine(canvasRef.current, {
      reduceMotion,
      onHud: (h) => {
        setHud(h);
        controllerRef.current?.syncHud(h); // the controller follows pause and game end
      },
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

    const controller = new RunController({
      engine,
      // One call: the server loads puzzle + sea + sun in parallel and decides the time of day.
      loadRun: (habitat) =>
        postJson("/api/run/start", { habitat, timeOverride: overrideRef.current }, 4500),
      onPuzzle: (data) => {
        const c = data.conditions;
        runIdRef.current = data.runId;
        showPicture(data.image);
        updateRescans(data.rescansLeft);
        setNotice("");
        setService({
          source: data.source, ms: data.ms, error: data.error ?? null,
          sea: c?.sea?.source ?? null, seaError: c?.sea?.error ?? null,
          sun: c?.sun?.source ?? null, sunLabel: c?.sun?.label ?? null, sunError: c?.sun?.error ?? null,
        });
        if (data.source === "fallback") eventBus.emit(EVENTS.API_FALLBACK_USED, { service: "fish", error: data.error });
        if (c?.sea?.source === "fallback") eventBus.emit(EVENTS.API_FALLBACK_USED, { service: "marine", error: c.sea.error });
        if (c?.sun?.source === "fallback") eventBus.emit(EVENTS.API_FALLBACK_USED, { service: "sun", error: c.sun.error });
      },
      onChange: setCtl,
    });

    engineRef.current = engine;
    controllerRef.current = controller;
    engine.start(); // the loop runs (idle background), but nothing is playable until GO

    return () => {
      controller.dispose();
      engine.destroy();
      engineRef.current = null;
      controllerRef.current = null;
    };
  }, []);

  // ---------- Start (button click) ----------

  function startRun() {
    const wanted = new URLSearchParams(window.location.search).get("habitat");
    const habitat = wanted && HABITATS[wanted] ? wanted : "reef";
    controllerRef.current?.start(habitat);
  }

  // ---------- Rescan ----------

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
      engine.applyRescan();
    } catch (err) {
      setNotice(err.message || "Rescan failed.");
    } finally {
      rescanBusyRef.current = false;
      setRescanBusy(false);
    }
  };

  const playing = ctl.phase === PHASE.PLAYING;

  return (
    <main className="play-page">
      <Hud hud={hud} onPause={() => engineRef.current?.togglePause()} />

      <div className="play-layout">
        <div className="canvas-wrap">
          <canvas ref={canvasRef} className="game-canvas" />

          {ctl.phase === PHASE.IDLE && (
            <div className="overlay">
              <div className="card overlay-card">
                <h2>Ready to dive?</h2>
                <p>Count the fish in the sonar picture. That number is the only safe tag.</p>
                {ctl.error && <div className="error-box" role="alert">{ctl.error}</div>}
                <button className="btn" onClick={startRun}>Dive in</button>
                <Link className="btn btn-secondary" href="/habitats">Choose habitat</Link>
                <Link className="btn btn-secondary" href="/menu">Back to menu</Link>
              </div>
            </div>
          )}

          <CountdownOverlay phase={ctl.phase} runId={ctl.runId} count={ctl.count} />

          {(ctl.phase === PHASE.PLAYING || ctl.phase === PHASE.PAUSED) && (
            <div key={ctl.runId} className="go-toast" aria-hidden="true">GO!</div>
          )}

          {ctl.phase === PHASE.PAUSED && (
            <div className="overlay">
              <div className="card overlay-card">
                <h2>Paused</h2>
                <button className="btn" onClick={() => engineRef.current?.togglePause()}>Resume</button>
                <Link className="btn btn-secondary" href="/menu">Quit to menu</Link>
              </div>
            </div>
          )}

          {ctl.phase === PHASE.ENDED && hud.result && (
            <ResultOverlay result={hud.result} onAgain={startRun} />
          )}
        </div>

        <div>
          <SonarPanel
            image={image}
            pictureId={pictureId}
            speedBonus={hud.speedBonus}
            rescansLeft={rescansLeft}
            rescanBusy={rescanBusy}
            canRescan={playing}
            onRescan={() => doRescanRef.current?.()}
            notice={notice}
          />
          <HabitatMiniCard difficulty={ctl.difficulty} conditions={ctl.conditions} />
        </div>
      </div>

      <DevDrawer
        ctl={ctl}
        service={service}
        engineRef={engineRef}
        runIdRef={runIdRef}
        override={override}
        onOverride={changeOverride}
      />
    </main>
  );
}