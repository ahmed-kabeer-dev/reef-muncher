// Reef Muncher: identity helpers (validation, bcrypt, session cookies).
// Design: server-side sessions. The browser holds a random token in an
// HttpOnly cookie. The database stores only the SHA-256 HASH of that token,
// so a leaked database cannot be used to hijack sessions.

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import {
  createSession,
  findSessionByTokenHash,
  deleteSessionByTokenHash,
} from "../db/index.js";

export const SESSION_COOKIE = "reef_session";
const USER_SESSION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const REMEMBER_SESSION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const GUEST_SESSION_MS = 24 * 60 * 60 * 1000; // 1 day

// ---------- Validation (the server always re-validates) ----------

export function validateUsername(username) {
  if (typeof username !== "string") return "Username is required.";
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username))
    return "Username must be 3 to 20 letters, numbers or underscores.";
  if (username.toLowerCase() === "admin") return "That username is not allowed.";
  return null;
}

export function validateEmail(email) {
  if (typeof email !== "string" || email.length > 254) return "Enter a valid email.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email.";
  return null;
}

/** Returns an array of problems (empty array means the password is fine). */
export function validatePassword(password) {
  const problems = [];
  if (typeof password !== "string" || password.length < 8)
    problems.push("At least 8 characters.");
  if (typeof password !== "string" || !/[0-9]/.test(password))
    problems.push("At least one number.");
  if (typeof password !== "string" || !/[^A-Za-z0-9]/.test(password))
    problems.push("At least one symbol.");
  if (typeof password === "string" && password.length > 72)
    problems.push("At most 72 characters.");
  return problems;
}

// ---------- Passwords (bcrypt hashes AND salts automatically) ----------

export function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// ---------- Session tokens ----------

function newToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Create a session row and set the HttpOnly cookie.
 * userId = null creates a guest session.
 */
export async function startSession({ userId = null, remember = false } = {}) {
  const token = newToken();
  const lifetime = userId === null ? GUEST_SESSION_MS : remember ? REMEMBER_SESSION_MS : USER_SESSION_MS;
  const expiresAt = Date.now() + lifetime;

  createSession({ userId, tokenHash: hashToken(token), expiresAt });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,                                  // JavaScript cannot read it
    sameSite: "lax",                                 // basic CSRF protection
    secure: process.env.NODE_ENV === "production",   // HTTPS only in production
    path: "/",
    maxAge: Math.floor(lifetime / 1000),
  });
}

/**
 * Read the cookie and return { sessionId, userId, username, email, isGuest }
 * or null when there is no valid session.
 */
export async function getCurrentSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const row = findSessionByTokenHash(tokenHash);
  if (!row) return null;

  if (row.expires_at < Date.now()) {
    deleteSessionByTokenHash(tokenHash);
    return null;
  }

  return {
    sessionId: row.session_id,
    userId: row.user_id,
    username: row.username ?? null,
    email: row.email ?? null,
    isGuest: row.user_id === null,
  };
}

/** Delete the session from the database and clear the cookie. */
export async function endSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) deleteSessionByTokenHash(hashToken(token));
  store.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
}