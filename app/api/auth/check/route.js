// GET /api/auth/check?username=abc -> live availability for the register form

import { NextResponse } from "next/server";
import { isUsernameTaken } from "../../../../lib/db/index.js";
import { validateUsername } from "../../../../lib/server/auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const username = new URL(request.url).searchParams.get("username") ?? "";
  const problem = validateUsername(username);
  if (problem) return NextResponse.json({ available: false, reason: problem });
  if (isUsernameTaken(username))
    return NextResponse.json({ available: false, reason: "That username is taken." });
  return NextResponse.json({ available: true });
}