// POST /api/run/rescan  body: { runId }  ->  { image, rescansLeft }

import { NextResponse } from "next/server";
import { getCurrentSession } from "../../../../lib/server/auth.js";
import { rescan } from "../../../../lib/server/puzzleManager.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const out = await rescan({ session, runId: body?.runId });
  if (out.error) return NextResponse.json({ error: out.error }, { status: out.status ?? 400 });
  return NextResponse.json(out);
}