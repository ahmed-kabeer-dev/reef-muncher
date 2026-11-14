// GET /api/leaderboard?range=all|week

import { NextResponse } from "next/server";
import { getCurrentSession } from "../../../lib/server/auth.js";
import { buildLeaderboard } from "../../../lib/server/stats.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const range = new URL(request.url).searchParams.get("range") === "week" ? "week" : "all";
  return NextResponse.json({ ...buildLeaderboard(range, session), guest: session.isGuest });
}