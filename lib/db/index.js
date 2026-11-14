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

  // Small migration: add the column that older databases do not have yet.
  const runCols = db.prepare("PRAGMA table_info(runs)").all().map((c) => c.name);
  if (!runCols.includes("best_combo")) {
    db.exec("ALTER TABLE runs ADD COLUMN best_combo INTEGER NOT NULL DEFAULT 0");
  }

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

export function createRun({ sessionId, userId, habitat, timeOfDay = null, currentAnswer, nextAnswer = null }) {
  const info = db
    .prepare(
      `INSERT INTO runs (session_id, user_id, habitat, time_of_day, current_answer, next_answer, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(sessionId, userId, habitat, timeOfDay, currentAnswer, nextAnswer, Date.now());
  return Number(info.lastInsertRowid);
}

export function getRun(runId) {
  return db.prepare("SELECT * FROM runs WHERE id = ?").get(runId);
}

export function setCurrentAndNext(runId, currentAnswer, nextAnswer) {
  db.prepare("UPDATE runs SET current_answer = ?, next_answer = ? WHERE id = ?")
    .run(currentAnswer, nextAnswer, runId);
}

export function setNextAnswer(runId, nextAnswer) {
  db.prepare("UPDATE runs SET next_answer = ? WHERE id = ?").run(nextAnswer, runId);
}

/** Uses one rescan and sets the new answer. Returns false if no rescans are left. */
export function useRescan(runId, newAnswer, maxRescans) {
  const info = db
    .prepare(
      `UPDATE runs SET current_answer = ?, rescans_used = rescans_used + 1
       WHERE id = ? AND rescans_used < ? AND outcome IS NULL`
    )
    .run(newAnswer, runId, maxRescans);
  return info.changes === 1;
}

// ---------- Finishing, career, leaderboard ----------

/** Saves the outcome. Returns false if the run was already finished (so it cannot be saved twice). */
export function finishRun({ runId, outcome, score, seconds, bestCombo }) {
  const info = db
    .prepare(
      `UPDATE runs SET outcome = ?, score = ?, seconds = ?, best_combo = ?
       WHERE id = ? AND outcome IS NULL`
    )
    .run(outcome, score, seconds, bestCombo, runId);
  return info.changes === 1;
}

export function getBestScore(userId) {
  return db
    .prepare("SELECT COALESCE(MAX(score), 0) AS best FROM runs WHERE user_id = ? AND outcome IS NOT NULL")
    .get(userId).best;
}

/** One row per habitat. Career stats are COMPUTED from runs, never stored twice. */
export function getCareerRows(userId) {
  return db
    .prepare(
      `SELECT habitat,
              COUNT(*) AS games,
              SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END) AS wins,
              MAX(score) AS best_score,
              MIN(CASE WHEN outcome = 'win' THEN seconds END) AS best_time,
              MAX(best_combo) AS best_combo
       FROM runs
       WHERE user_id = ? AND outcome IS NOT NULL
       GROUP BY habitat`
    )
    .all(userId);
}

/** Best score per user since a time (0 = all time). Guests have no user_id, so they never appear. */
export function getLeaderboardRows(sinceMs) {
  return db
    .prepare(
      `SELECT u.id AS user_id, u.username AS username, MAX(r.score) AS best, COUNT(*) AS games
       FROM runs r JOIN users u ON u.id = r.user_id
       WHERE r.outcome IS NOT NULL AND r.created_at >= ?
       GROUP BY u.id
       ORDER BY best DESC, u.username ASC
       LIMIT 100`
    )
    .all(sinceMs);
}