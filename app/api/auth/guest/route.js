// POST /api/auth/guest  -> anonymous session (user_id = NULL)
// Guests can play, and the server can still hold the secret puzzle answers,
// but nothing is saved to a profile.

import { NextResponse } from "next/server";
import { startSession } from "../../../../lib/server/auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await startSession({ userId: null });
  return NextResponse.json({ guest: true });
}