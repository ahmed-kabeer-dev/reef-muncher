"use client";
// Reef Muncher: Habitat Select. Four cards with LIVE sea data, time-of-day badge and bonus,
// data source chips and credits. The data comes from our own server (/api/habitats),
// which caches it, so the browser never calls the external APIs directly.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getJson } from "../../lib/client/api.js";

const TIME_ICON = { day: "☀️", twilight: "🌅", night: "🌙" };
const SOURCE_ICON = { live: "●", cached: "◐", fallback: "○" }; // shape + word, never colour alone
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function fmtMinutes(m) {
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function HabitatCard({ h }) {
  const { sea, sun } = h;
  const sunText = sun.label ?? sun.source;
  return (
    <article className="card habitat-card">
      <div className="habitat-top">
        <div>
          <h2>{h.name}</h2>
          <p className="subtitle">{h.location}</p>
        </div>
        <span className="stars" aria-label={`Difficulty ${h.stars} of 4`}>
          {"★".repeat(h.stars)}{"☆".repeat(4 - h.stars)}
        </span>
      </div>

      <div className={`time-badge ${h.timeOfDay}`}>
        <span aria-hidden="true">{TIME_ICON[h.timeOfDay]}</span> {cap(h.timeOfDay)} &middot; score x{h.multiplier}
      </div>

      <dl className="stat-grid">
        <div><dt>Waves</dt><dd>{sea.wave.toFixed(1)} m ({sea.risk})</dd></div>
        <div><dt>Sea temp</dt><dd>{sea.temp.toFixed(1)} °C</dd></div>
        <div><dt>Big fish every</dt><dd>{sea.bigFishInterval} s</dd></div>
        <div><dt>Small fish</dt><dd>{sea.speedLabel}</dd></div>
        <div><dt>Current</dt><dd>{sea.currentStrength} px/s</dd></div>
        <div><dt>Sea mines</dt><dd>{h.mines}</dd></div>
      </dl>

      <div className="chips">
        <span className="chip">{SOURCE_ICON[sea.source]} Sea: {sea.source}</span>
        <span className="chip">{SOURCE_ICON[sun.source]} Sun: {sunText}</span>
      </div>
      <p className="credit">Sunrise {fmtMinutes(sun.sunrise)} UTC &middot; Sunset {fmtMinutes(sun.sunset)} UTC</p>

      <Link className="btn" href={`/play?habitat=${h.id}`}>Dive in: {h.name}</Link>
    </article>
  );
}

export default function HabitatsPage() {
  const router = useRouter();
  const [habitats, setHabitats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true; // ignore results that arrive after we left or retried
    setLoading(true);
    setError("");
    (async () => {
      try {
        const data = await getJson("/api/habitats", 8000);
        if (alive) setHabitats(data.habitats);
      } catch (err) {
        if (!alive) return;
        if (err.status === 401) router.replace("/login");
        else setError("Could not load the sea conditions.");
      } finally {
        if (alive) setLoading(false); // loading flags always clear in finally
      }
    })();
    return () => { alive = false; };
  }, [reload, router]);

  return (
    <main className="habitat-page">
      <header className="habitat-head">
        <div>
          <h1>Choose your habitat</h1>
          <p>Live sea data sets the difficulty. The real time of day sets the lighting.</p>
        </div>
        <Link className="btn btn-secondary back-btn" href="/menu">Back</Link>
      </header>

      {loading && <div className="card">Reading the sea...</div>}

      {error && (
        <div className="card">
          <div className="error-box" role="alert">{error}</div>
          <button className="btn" onClick={() => setReload((n) => n + 1)}>Try again</button>
        </div>
      )}

      <div className="habitat-grid">
        {habitats?.map((h) => <HabitatCard key={h.id} h={h} />)}
      </div>

      <footer className="credits">
        Weather data: Open-Meteo (CC BY 4.0) &middot; Sun times: sunrise-sunset.org &middot; Fish pictures: Fish Game API
      </footer>
    </main>
  );
}