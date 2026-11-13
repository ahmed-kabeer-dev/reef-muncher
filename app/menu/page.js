// Reef Muncher: Main Menu placeholder. The real menu (player card, rank) comes later.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "../../lib/server/auth.js";
import LogoutButton from "../../components/LogoutButton.js";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  return (
    <main className="page-center">
      <div className="card">
        <h1>Reef Muncher</h1>
        <p>
          {session.isGuest
            ? "Playing as a guest (scores are not saved)."
            : `Welcome, ${session.username}!`}
        </p>
        <Link className="btn" href="/habitats">Play</Link>
        <LogoutButton />
      </div>
    </main>
  );
}