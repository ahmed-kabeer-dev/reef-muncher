// POST /api/run/finish  body: { runId, outcome, score, seconds, bestCombo }

import { NextResponse } from "next/server";
import { getCurrentSession } from "../../../../lib/server/auth.js";
import { finishRunFor } from "../../../../lib/server/runService.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const out = finishRunFor({
    session,
    runId: body?.runId,
    result: {
      outcome: body?.outcome,
      score: body?.score,
      seconds: body?.seconds,
      bestCombo: body?.bestCombo,
    },
  });
  if (out.error) return NextResponse.json({ error: out.error }, { status: out.status ?? 400 });
  return NextResponse.json(out);
}