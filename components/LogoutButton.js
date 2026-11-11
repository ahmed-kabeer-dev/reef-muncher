"use client";
// Reef Muncher: logout button. Calls the server so the session row is deleted.

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setBusy(false);
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <button className="btn btn-secondary" onClick={logout} disabled={busy}>
      {busy ? "Logging out..." : "Log out"}
    </button>
  );
}