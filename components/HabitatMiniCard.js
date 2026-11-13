"use client";
// Reef Muncher: habitat mini-card shown under the sonar panel during play.
// Shows the live conditions, the time-of-day badge and the REQUIRED attributions
// (Open-Meteo is CC BY 4.0, sunrise-sunset.org requires attribution).

import { HABITATS } from "../lib/game/rules.js";

export const TIME_ICON = { day: "☀️", twilight: "🌅", night: "🌙" };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function HabitatMiniCard({ difficulty, conditions }) {
  if (!difficulty) return null;
  const h = HABITATS[difficulty.habitat];
  const sunLabel = conditions?.sun?.label ?? conditions?.sun?.source ?? "fallback";

  return (
    <div className="card sonar mini-card">
      <h3>{h.name} <span className="stars" aria-label={`Difficulty ${h.stars} of 4`}>{"★".repeat(h.stars)}{"☆".repeat(4 - h.stars)}</span></h3>
      <div className={`time-badge ${difficulty.timeOfDay}`}>
        <span aria-hidden="true">{TIME_ICON[difficulty.timeOfDay]}</span>{" "}
        {cap(difficulty.timeOfDay)} &middot; score x{difficulty.timeMultiplier}
        {conditions?.overridden && " (dev override)"}
      </div>
      <div className="chips">
        <span className="chip">{difficulty.risk} sea {difficulty.wave.toFixed(1)} m</span>
        <span className="chip">{difficulty.temp.toFixed(1)} °C &middot; fish {difficulty.speedLabel}</span>
        <span className="chip">Mines {difficulty.mines}</span>
      </div>
      <p className="credit">Weather data: Open-Meteo ({difficulty.source})</p>
      <p className="credit">Sun times: sunrise-sunset.org ({sunLabel})</p>
    </div>
  );
}