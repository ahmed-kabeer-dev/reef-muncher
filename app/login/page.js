"use client";
// Reef Muncher: Login screen.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import OceanArt from "../../components/OceanArt.js";
import HowToPlayModal from "../../components/HowToPlayModal.js";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showHow, setShowHow] = useState(false);

  async function post(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const { ok, data } = await post("/api/auth/login", { username, password, remember });
      if (!ok) {
        setError(data.error ?? "Could not log in. Please try again.");
        return;
      }
      router.push("/menu");
      router.refresh();
    } catch {
      setError("Network problem. Please try again.");
    } finally {
      setBusy(false); // loading flags always clear in finally
    }
  }

  async function handleGuest() {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const { ok } = await post("/api/auth/guest");
      if (!ok) {
        setError("Could not start a guest session.");
        return;
      }
      router.push("/menu");
      router.refresh();
    } catch {
      setError("Network problem. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <OceanArt />

      <section className="auth-panel">
        <div className="card">
          <h2>Welcome back</h2>
          <p className="subtitle">Log in to save your scores and rank.</p>

          <form onSubmit={handleLogin} noValidate>
            {error && <div className="error-box" role="alert">{error}</div>}

            <div className="field">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                className="input"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="input-row">
                <input
                  id="password"
                  className="input"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <label className="check-row">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Remember me
            </label>

            <button className="btn" type="submit" disabled={busy || !username || !password}>
              {busy ? "Please wait..." : "Log in"}
            </button>
          </form>

          <div className="divider">or</div>

          <button className="btn btn-secondary" type="button" onClick={handleGuest} disabled={busy}>
            Play as guest
          </button>

          <p style={{ textAlign: "center", marginTop: 20 }}>
            New here? <Link href="/register">Create an account</Link>
            <br />
            <button type="button" className="link-btn" onClick={() => setShowHow(true)}>
              How to play
            </button>
          </p>
        </div>
      </section>

      {showHow && <HowToPlayModal onClose={() => setShowHow(false)} />}
    </main>
  );
}