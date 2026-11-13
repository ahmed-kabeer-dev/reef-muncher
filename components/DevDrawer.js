"use client";
// Reef Muncher: developer drawer (testing and video demos). Hidden in production.
// It is one more INDEPENDENT listener on the event bus, and knows nothing about the HUD.

import { useEffect, useState } from "react";
import { eventBus, EVENTS } from "../lib/events/eventBus.js";

export default function DevDrawer({ ctl, service, engineRef, runIdRef, override, onOverride }) {
  const enabled = process.env.NODE_ENV !== "production";
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState([]);
  const [tag, setTag] = useState(null);

  useEffect(() => {
    if (!enabled) return;
    const offs = Object.values(EVENTS).map((name) =>
      eventBus.on(name, (payload) => {
        const t = new Date().toLocaleTimeString([], { hour12: false });
        const line = `${t} ${name}${payload ? " " + JSON.stringify(payload) : ""}`;
        setLog((l) => [line, ...l].slice(0, 15)); // last 15 events
      })
    );
    function onKey(e) {
      if (e.key === "`") setOpen((v) => !v);
    }
    window.addEventListener("keydown", onKey);
    return () => { offs.forEach((off) => off()); window.removeEventListener("keydown", onKey); };
  }, [enabled]);

  if (!enabled) return null;

  const engine = () => engineRef.current;
  const playing = engine()?.status === "playing";

  async function reveal() {
    setTag("...");
    try {
      const res = await fetch(`/api/debug/answer?runId=${runIdRef.current}`);
      const data = await res.json();
      setTag(res.ok ? String(data.digit) : data.error);
    } catch { setTag("error"); }
  }

  const d = ctl.difficulty;
  const c = ctl.conditions;

  return (
    <>
      <button className="dev-toggle" onClick={() => setOpen((v) => !v)} aria-label="Developer drawer">{"{ }"}</button>
      {open && (
        <div className="dev-drawer">
          <h4>Developer drawer</h4>
          <div>Phase: <b>{ctl.phase}</b> &middot; runId: <b>{ctl.runId}</b></div>

          <div>Fish API: <b>{service?.source ?? "-"}</b> {service?.ms != null && `${service.ms}ms`}</div>
          <div>Open-Meteo: <b>{service?.sea ?? "-"}</b> &middot; Sun: <b>{service?.sunLabel ?? service?.sun ?? "-"}</b></div>
          {[service?.error, service?.seaError, service?.sunError].filter(Boolean).map((e, i) => (
            <div key={i} className="dev-err">error: {e}</div>
          ))}

          {d && (
            <div>
              Sea: {d.risk} ({d.wave}m, {d.temp}C) &middot; {d.source}<br />
              Big fish every {d.bigFishInterval}s &middot; current {d.current}px/s &middot; fish {d.speedLabel} &middot; mines {d.mines}<br />
              Time of day this run: <b>{d.timeOfDay}</b> (x{d.timeMultiplier}){c?.overridden && " [override]"}
            </div>
          )}

          <label className="dev-row">
            Time of day (next run):{" "}
            <select value={override} onChange={(e) => onOverride(e.target.value)}>
              <option value="auto">Auto (real)</option>
              <option value="day">Day</option>
              <option value="twilight">Twilight</option>
              <option value="night">Night</option>
            </select>
          </label>

          <div className="dev-btns">
            <button disabled={!playing} onClick={reveal}>Reveal safe tag</button>
            <button disabled={!playing} onClick={() => engine()?.debugWin()}>Instant win</button>
            <button disabled={!playing} onClick={() => engine()?.hazards.queueBigFish()}>Big fish</button>
            <button disabled={!playing} onClick={() => engine()?.hazards.spawnMine()}>Mine</button>
            <button disabled={!playing} onClick={() => { if (engine()) engine().lanternTimer = 8; }}>Lantern 8s</button>
          </div>
          {tag !== null && <div>Safe tag: <b>{tag}</b></div>}
          <ul className="dev-log">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </div>
      )}
    </>
  );
}