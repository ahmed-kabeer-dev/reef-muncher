// GET /api/habitats -> cached conditions, sun times and time of day for the four habitats.

import { NextResponse } from "next/server";
import { getCurrentSession } from "../../../lib/server/auth.js";
import { getAllHabitats } from "../../../lib/server/conditions.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const habitats = await getAllHabitats();
  return NextResponse.json({ habitats });
}