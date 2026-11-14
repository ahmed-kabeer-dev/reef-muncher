"use client";
// Reef Muncher: Leaderboard (All time / This week, podium for the top 3, table of 7,
// highlighted "You" row, sticky position bar). Data from GET /api/leaderboard.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getJson } from "../../lib/client/api.js";

const TABS = [["all", "All time"], ["week", "This week"]];
const MEDAL = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function LeaderboardPage() {
  const router = useRouter();
  const [range, setRange] = useState("all");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true; // a slow answer for the old tab must not overwrite the new tab
    setLoading(true);
    setError("");
    (async () => {
      try {
        const d = await getJson(`/api/leaderboard?range=${range}`);
        if (alive) setData(d);
      } catch (err) {
        if (!alive) return;
        if (err.status === 401) router.replace("/login");
        else setError("Could not load the leaderboard.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [range, router]);

  const top = data?.top ?? [];
  const podium = [top[1], top[0], top[2]].filter(Boolean); // 2nd, 1st, 3rd
  const rest = top.slice(3, 10);

  return (
    <main className="habitat-page lb-page">
      <header className="habitat-head">
        <div><h1>Leaderboard</h1><p>Best score per player.</p></div>
        <Link className="btn btn-secondary back-btn" href="/menu">Back</Link>
      </header>

      <div className="tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button
            key={id} role="tab" aria-selected={range === id}
            className={`tab ${range === id ? "active" : ""}`}
            onClick={() => setRange(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <div className="card">Loading...</div>}
      {error && <div className="card"><div className="error-box" role="alert">{error}</div></div>}

      {!loading && data && top.length === 0 && (
        <div className="card">No scores yet. Be the first to finish a run!</div>
      )}

      {!loading && podium.length > 0 && (
        <div className="podium">
          {podium.map((r) => (
            <div key={r.rank} className={`podium-col place-${r.rank} ${r.isYou ? "you" : ""}`}>
              <div className="podium-name">{MEDAL[r.rank]} {r.username}{r.isYou && " (You)"}</div>
              <div className="podium-score">{r.best}</div>
              <div className="podium-block"><span>{r.rank}</span></div>
            </div>
          ))}
        </div>
      )}

      {!loading && rest.length > 0 && (
        <div className="card">
          <table className="lb-table">
            <thead><tr><th>#</th><th>Player</th><th>Rank</th><th>Best</th></tr></thead>
            <tbody>
              {rest.map((r) => (
                <tr key={r.rank} className={r.isYou ? "you-row" : ""}>
                  <td>{r.rank}</td>
                  <td>{r.username}{r.isYou && " (You)"}</td>
                  <td>{r.rankName}</td>
                  <td>{r.best}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="position-bar" role="status">
        {data?.guest
          ? "Guests are not ranked. Create an account to join."
          : data?.you
            ? `Your position: #${data.you.rank} of ${data.total} · best ${data.you.best}`
            : "Finish a run to get ranked."}
      </div>
    </main>
  );
}