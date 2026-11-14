// GET /api/career -> totals and one card of stats per habitat (logged-in users only)

import { NextResponse } from "next/server";
import { getCurrentSession } from "../../../lib/server/auth.js";
import { buildCareer } from "../../../lib/server/stats.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  if (session.isGuest) return NextResponse.json({ guest: true });
  return NextResponse.json(buildCareer(session.userId));
}