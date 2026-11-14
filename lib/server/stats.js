// Reef Muncher: career and leaderboard data (computed from the runs table).
// Used by the Main Menu (server component) AND the REST routes, so the logic lives once.

import { getCareerRows, getLeaderboardRows } from "../db/index.js";
import { HABITATS, getRank, rankProgress } from "../game/rules.js";

export function buildCareer(userId) {
  const byHabitat = Object.fromEntries(getCareerRows(userId).map((r) => [r.habitat, r]));

  const habitats = Object.values(HABITATS).map((h) => {
    const r = byHabitat[h.id];
    return {
      id: h.id, name: h.name, stars: h.stars,
      games: r?.games ?? 0,
      wins: r?.wins ?? 0,
      bestScore: r?.best_score ?? 0,
      bestTime: r?.best_time ?? null,
    };
  });

  const rows = Object.values(byHabitat);
  const totals = {
    games: rows.reduce((n, r) => n + r.games, 0),
    wins: rows.reduce((n, r) => n + (r.wins ?? 0), 0),
    bestScore: rows.reduce((m, r) => Math.max(m, r.best_score ?? 0), 0),
    bestCombo: rows.reduce((m, r) => Math.max(m, r.best_combo ?? 0), 0),
  };

  return { totals, habitats, rank: rankProgress(totals.bestScore) };
}

export function buildLeaderboard(range, session) {
  const since = range === "week" ? Date.now() - 7 * 24 * 60 * 60 * 1000 : 0;
  const rows = getLeaderboardRows(since).map((r, i) => ({
    rank: i + 1,
    username: r.username, // never expose emails or ids
    best: r.best,
    games: r.games,
    rankName: getRank(r.best),
    isYou: session.userId != null && session.userId === r.user_id,
  }));
  return {
    range: range === "week" ? "week" : "all",
    top: rows.slice(0, 10), // 3 on the podium + 7 in the table
    you: rows.find((r) => r.isYou) ?? null,
    total: rows.length,
  };
}