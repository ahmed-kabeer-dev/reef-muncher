// GET /api/me -> who am I? Used by every page to decide what to show.

import { NextResponse } from "next/server";
import { getCurrentSession } from "../../../lib/server/auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ user: null, guest: false });
  if (session.isGuest) return NextResponse.json({ user: null, guest: true });
  return NextResponse.json({
    user: { id: session.userId, username: session.username },
    guest: false,
  });
}