"use client";
// Reef Muncher: Register screen with live username check, email check,
// 4-segment password strength meter and rules checklist.
// The server ALWAYS re-validates; this is only to help the user.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import OceanArt from "../../components/OceanArt.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function passwordRules(pw) {
  return [
    { label: "At least 8 characters", met: pw.length >= 8 },
    { label: "At least one number", met: /[0-9]/.test(pw) },
    { label: "At least one symbol", met: /[^A-Za-z0-9]/.test(pw) },
  ];
}

/** 0 to 4: one point per rule met, plus one bonus point for 12+ characters (only once all rules are met). */
function strengthLevel(pw) {
  const rules = passwordRules(pw);
  const met = rules.filter((r) => r.met).length;
  if (pw.length === 0) return 0;
  if (met === 3 && pw.length >= 12) return 4;
  return met === 3 ? 3 : Math.min(met, 2);
}

const LEVEL_LABEL = ["", "Weak", "Fair", "Good", "Strong"];

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [terms, setTerms] = useState(false);

  const [nameState, setNameState] = useState({ status: "idle", message: "" }); // idle | checking | ok | bad
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const requestId = useRef(0);

  // Live username availability (debounced; stale responses are ignored).
  useEffect(() => {
    if (username.length === 0) {
      setNameState({ status: "idle", message: "" });
      return;
    }
    setNameState({ status: "checking", message: "Checking..." });
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check?username=${encodeURIComponent(username)}`);
        const data = await res.json();
        if (id !== requestId.current) return; // an older request: ignore
        if (data.available) setNameState({ status: "ok", message: "Username is available." });
        else setNameState({ status: "bad", message: data.reason ?? "Not available." });
      } catch {
        if (id === requestId.current) setNameState({ status: "idle", message: "" });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [username]);

  const rules = passwordRules(password);
  const level = strengthLevel(password);
  const emailOk = EMAIL_RE.test(email);
  const confirmOk = confirm.length > 0 && confirm === password;
  const allRulesMet = rules.every((r) => r.met);

  const canSubmit =
    !busy && nameState.status === "ok" && emailOk && allRulesMet && confirmOk && terms;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setFormError("");
    setFieldErrors({});
    setBusy(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, confirm, terms }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error ?? "Could not register.");
        setFieldErrors(data.errors ?? {});
        return;
      }
      router.push("/menu");
      router.refresh();
    } catch {
      setFormError("Network problem. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <OceanArt />

      <section className="auth-panel">
        <div className="card">
          <h2>Create account</h2>
          <p className="subtitle">Save your best scores and climb the leaderboard.</p>

          <form onSubmit={handleSubmit} noValidate>
            {formError && <div className="error-box" role="alert">{formError}</div>}

            <div className="field">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                className={`input ${nameState.status === "ok" ? "valid" : nameState.status === "bad" ? "invalid" : ""}`}
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                aria-describedby="username-hint"
              />
              <div
                id="username-hint"
                className={`hint ${nameState.status === "ok" ? "ok" : nameState.status === "bad" ? "bad" : ""}`}
                aria-live="polite"
              >
                {nameState.status === "ok" && "✓ "}
                {nameState.status === "bad" && "✗ "}
                {nameState.message || fieldErrors.username}
              </div>
            </div>

            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                className={`input ${email.length === 0 ? "" : emailOk ? "valid" : "invalid"}`}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <div className={`hint ${email.length === 0 ? "" : emailOk ? "ok" : "bad"}`}>
                {email.length > 0 && (emailOk ? "✓ Looks good." : "✗ Enter a valid email.")}
                {fieldErrors.email}
              </div>
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="input-row">
                <input
                  id="password"
                  className="input"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-describedby="pw-rules"
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

              <div className={`meter lvl${level}`} aria-hidden="true">
                <span /><span /><span /><span />
              </div>
              <div className="meter-label" aria-live="polite">
                {level > 0 ? `Strength: ${LEVEL_LABEL[level]}` : ""}
              </div>

              <ul className="rules" id="pw-rules">
                {rules.map((r) => (
                  <li key={r.label} className={r.met ? "met" : ""}>{r.label}</li>
                ))}
              </ul>
            </div>

            <div className="field">
              <label htmlFor="confirm">Confirm password</label>
              <input
                id="confirm"
                className={`input ${confirm.length === 0 ? "" : confirmOk ? "valid" : "invalid"}`}
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              <div className={`hint ${confirm.length === 0 ? "" : confirmOk ? "ok" : "bad"}`}>
                {confirm.length > 0 && (confirmOk ? "✓ Passwords match." : "✗ Passwords do not match.")}
              </div>
            </div>

            <label className="check-row">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
              I accept the terms of play (this is a student project).
            </label>

            <button className="btn" type="submit" disabled={!canSubmit}>
              {busy ? "Creating..." : "Create account"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: 20 }}>
            Already have an account? <Link href="/login">Log in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}