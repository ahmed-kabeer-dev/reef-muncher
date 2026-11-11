// POST /api/auth/logout  -> deletes the session row and clears the cookie

import { NextResponse } from "next/server";
import { endSession } from "../../../../lib/server/auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await endSession();
  return NextResponse.json({ ok: true });
}