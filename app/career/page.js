"use client";
// Reef Muncher: Career screen (totals and a card per habitat). Data from GET /api/career.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getJson } from "../../lib/client/api.js";

function fmtTime(s) {
  if (s == null) return "-";
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function CareerPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true; // ignore answers that arrive after we left the page
    (async () => {
      try {
        const d = await getJson("/api/career");
        if (alive) setData(d);
      } catch (err) {
        if (!alive) return;
        if (err.status === 401) router.replace("/login");
        else setError("Could not load your career.");
      } finally {
        if (alive) setLoading(false); // loading flags always clear in finally
      }
    })();
    return () => { alive = false; };
  }, [router]);

  return (
    <main className="habitat-page">
      <header className="habitat-head">
        <div><h1>Career</h1><p>Your results across all habitats.</p></div>
        <Link className="btn btn-secondary back-btn" href="/menu">Back</Link>
      </header>

      {loading && <div className="card">Loading...</div>}
      {error && <div className="card"><div className="error-box" role="alert">{error}</div></div>}

      {data?.guest && (
        <div className="card">
          <p>Guests do not have a career. <Link href="/register">Create an account</Link> to save your stats.</p>
        </div>
      )}

      {data?.totals && (
        <>
          <div className="card">
            <h2>Totals</h2>
            <dl className="stat-grid totals-grid">
              <div><dt>Rank</dt><dd>{data.rank.rank}</dd></div>
              <div><dt>Best score</dt><dd>{data.totals.bestScore}</dd></div>
              <div><dt>Games</dt><dd>{data.totals.games}</dd></div>
              <div><dt>Wins</dt><dd>{data.totals.wins}</dd></div>
              <div><dt>Best combo</dt><dd>x{data.totals.bestCombo || 1}</dd></div>
            </dl>
          </div>

          <div className="habitat-grid">
            {data.habitats.map((h) => (
              <article key={h.id} className="card">
                <div className="habitat-top">
                  <h2>{h.name}</h2>
                  <span className="stars" aria-label={`Difficulty ${h.stars} of 4`}>
                    {"★".repeat(h.stars)}{"☆".repeat(4 - h.stars)}
                  </span>
                </div>
                <dl className="stat-grid">
                  <div><dt>Games</dt><dd>{h.games}</dd></div>
                  <div><dt>Wins</dt><dd>{h.wins}</dd></div>
                  <div><dt>Best score</dt><dd>{h.bestScore}</dd></div>
                  <div><dt>Best time</dt><dd>{fmtTime(h.bestTime)}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </>
      )}
    </main>
  );
}