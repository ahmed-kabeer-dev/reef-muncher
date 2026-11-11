// Reef Muncher: Main Menu placeholder. The real menu (player card, rank, buttons) comes later.

import { redirect } from "next/navigation";
import { getCurrentSession } from "../../lib/server/auth.js";
import LogoutButton from "../../components/LogoutButton.js";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login"); // protect the page on the server

  return (
    <main className="page-center">
      <div className="card">
        <h1>Reef Muncher</h1>
        <p>
          {session.isGuest
            ? "Playing as a guest (scores are not saved)."
            : `Welcome, ${session.username}!`}
        </p>
        <p>The game is coming soon.</p>
        <LogoutButton />
      </div>
    </main>
  );
}