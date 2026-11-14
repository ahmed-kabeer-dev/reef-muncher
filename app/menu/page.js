// Reef Muncher: Main Menu with the player card (rank, progress, best score, games, wins).
// A server component: it reads the session and the stats on the server, so a logged-out
// visitor is redirected before anything is sent.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "../../lib/server/auth.js";
import { buildCareer } from "../../lib/server/stats.js";
import LogoutButton from "../../components/LogoutButton.js";
import HowToPlayButton from "../../components/HowToPlayButton.js";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const career = session.isGuest ? null : buildCareer(session.userId);

  return (
    <main className="page-center">
      <div className="card menu-card">
        <h1>Reef Muncher</h1>

        {career ? (
          <div className="player-card">
            <div className="player-top">
              <span className="player-name">{session.username}</span>
              <span className="rank-badge">{career.rank.rank}</span>
            </div>
            <div
              className="rank-bar" role="img"
              aria-label={`Progress to the next rank: ${career.rank.pct} percent`}
            >
              <div className="rank-fill" style={{ width: `${career.rank.pct}%` }} />
            </div>
            <p className="hint">
              {career.rank.next
                ? `${career.rank.nextAt - career.totals.bestScore} points to ${career.rank.next}`
                : "Top rank reached!"}
            </p>
            <dl className="stat-grid">
              <div><dt>Best score</dt><dd>{career.totals.bestScore}</dd></div>
              <div><dt>Games</dt><dd>{career.totals.games}</dd></div>
              <div><dt>Wins</dt><dd>{career.totals.wins}</dd></div>
              <div><dt>Best combo</dt><dd>x{career.totals.bestCombo || 1}</dd></div>
            </dl>
          </div>
        ) : (
          <div className="player-card">
            <p><strong>Playing as a guest.</strong></p>
            <p className="hint">Scores, rank and career stats are saved only for accounts.</p>
            <Link href="/register">Create an account</Link>
          </div>
        )}

        <Link className="btn" href="/habitats">Play</Link>
        <Link className="btn btn-secondary" href="/career">Career</Link>
        <Link className="btn btn-secondary" href="/leaderboard">Leaderboard</Link>
        <HowToPlayButton />
        <LogoutButton />
      </div>
    </main>
  );
}