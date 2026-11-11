// Reef Muncher: SQLite access (users, sessions, runs).
// Single responsibility: this is the ONLY module that touches the database.

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

function openDatabase() {
  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const db = new Database(path.join(dataDir, "reef.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
      email         TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE, -- NULL for guests
      token_hash  TEXT NOT NULL UNIQUE,
      expires_at  INTEGER NOT NULL,
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS runs (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id     INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
      user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
      habitat        TEXT NOT NULL,
      time_of_day    TEXT,
      current_answer INTEGER,
      next_answer    INTEGER,
      rescans_used   INTEGER NOT NULL DEFAULT 0,
      outcome        TEXT,      -- 'win' | 'lose' | NULL while playing
      score          INTEGER NOT NULL DEFAULT 0,
      seconds        INTEGER,
      created_at     INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_runs_user ON runs(user_id);
  `);

  return db;
}

// Next.js dev mode reloads modules, so keep ONE connection on globalThis.
const g = globalThis;
export const db = g.__reefDb ?? (g.__reefDb = openDatabase());

// ---------- Users ----------

export function createUser({ username, email, passwordHash }) {
  const info = db
    .prepare(
      "INSERT INTO users (username, email, password_hash, created_at) VALUES (?, ?, ?, ?)"
    )
    .run(username, email, passwordHash, Date.now());
  return Number(info.lastInsertRowid);
}

export function findUserByUsername(username) {
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username);
}

export function isUsernameTaken(username) {
  return !!db.prepare("SELECT 1 FROM users WHERE username = ?").get(username);
}

// ---------- Sessions ----------

export function createSession({ userId, tokenHash, expiresAt }) {
  const info = db
    .prepare(
      "INSERT INTO sessions (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)"
    )
    .run(userId, tokenHash, expiresAt, Date.now());
  return Number(info.lastInsertRowid);
}

/** Returns { session_id, user_id, expires_at, username, email } or undefined. */
export function findSessionByTokenHash(tokenHash) {
  return db
    .prepare(
      `SELECT s.id AS session_id, s.user_id, s.expires_at, u.username, u.email
       FROM sessions s
       LEFT JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`
    )
    .get(tokenHash);
}

export function deleteSessionByTokenHash(tokenHash) {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
}

export function deleteExpiredSessions() {
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
}