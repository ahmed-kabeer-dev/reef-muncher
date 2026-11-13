// POST /api/run/start  body: { habitat }  ->  { runId, image, source, rescansLeft }

import { NextResponse } from "next/server";
import { getCurrentSession } from "../../../../lib/server/auth.js";
import { startRun } from "../../../../lib/server/puzzleManager.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const out = await startRun({ session, habitat: body?.habitat, timeOverride: body?.timeOverride  });
  if (out.error && out.status) {
    return NextResponse.json({ error: out.error }, { status: out.status });
  }
  return NextResponse.json(out);
}