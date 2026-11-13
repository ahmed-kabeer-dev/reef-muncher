// TEMPORARY dev-only: reveals the current answer for YOUR OWN run. DELETE BEFORE SUBMISSION.

import { NextResponse } from "next/server";
import { getCurrentSession } from "../../../../lib/server/auth.js";
import { getRun } from "../../../../lib/db/index.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });

  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const runId = Number(new URL(request.url).searchParams.get("runId"));
  const run = Number.isInteger(runId) ? getRun(runId) : null;
  if (!run || run.session_id !== session.sessionId) {
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }
  return NextResponse.json({ digit: run.current_answer });
}