// POST /api/auth/login  body: { username, password, remember }
// Hardening: the same generic error for "no such user" and "wrong password",
// a dummy bcrypt compare so both cases take similar time, and rate limiting.

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { findUserByUsername } from "../../../../lib/db/index.js";
import { verifyPassword, startSession } from "../../../../lib/server/auth.js";
import { isBlocked, recordFailure, clearFailures } from "../../../../lib/server/rateLimit.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DUMMY_HASH = bcrypt.hashSync("not-a-real-password-1!", 10);
const GENERIC_ERROR = "Invalid username or password.";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { username, password, remember } = body ?? {};
  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const ip = request.headers.get("x-forwarded-for") ?? "local";
  const key = `${ip}|${username.toLowerCase()}`;

  if (isBlocked(key)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in 15 minutes." },
      { status: 429 }
    );
  }

  const user = findUserByUsername(username);
  const ok = await verifyPassword(password, user ? user.password_hash : DUMMY_HASH);

  if (!user || !ok) {
    recordFailure(key);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  clearFailures(key);
  await startSession({ userId: user.id, remember: remember === true });
  return NextResponse.json({ user: { id: user.id, username: user.username } });
}