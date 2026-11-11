// POST /api/auth/register  body: { username, email, password, confirm, terms }

import { NextResponse } from "next/server";
import { createUser, isUsernameTaken } from "../../../../lib/db/index.js";
import {
  validateUsername,
  validateEmail,
  validatePassword,
  hashPassword,
  startSession,
} from "../../../../lib/server/auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { username, email, password, confirm, terms } = body ?? {};

  const errors = {};
  const userErr = validateUsername(username);
  if (userErr) errors.username = userErr;
  const emailErr = validateEmail(email);
  if (emailErr) errors.email = emailErr;
  const pwProblems = validatePassword(password);
  if (pwProblems.length) errors.password = pwProblems;
  if (password !== confirm) errors.confirm = "Passwords do not match.";
  if (terms !== true) errors.terms = "You must accept the terms.";

  if (!errors.username && isUsernameTaken(username)) {
    errors.username = "That username is taken.";
  }

  if (Object.keys(errors).length) {
    return NextResponse.json({ error: "Please fix the highlighted fields.", errors }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);

  let userId;
  try {
    userId = createUser({ username, email, passwordHash });
  } catch {
    // Race condition: someone else took the name between the check and the insert
    return NextResponse.json(
      { error: "That username is taken.", errors: { username: "That username is taken." } },
      { status: 409 }
    );
  }

  await startSession({ userId });
  return NextResponse.json({ user: { id: userId, username } }, { status: 201 });
}