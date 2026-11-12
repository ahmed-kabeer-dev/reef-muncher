// TEMPORARY debug page: shows the Fish API image AND its digit side by side,

import { fetchPuzzle } from "../../../../lib/services/fishClient.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export async function GET(request) {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }

  const force = new URL(request.url).searchParams.get("force") === "fallback";
  const result = await fetchPuzzle({ forceFallback: force });
  const { image, digit } = result.data;

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Puzzle debug</title>
<style>
body{font-family:system-ui,sans-serif;background:#053b4d;color:#fff;padding:24px}
.card{background:#fff;color:#08334a;border-radius:16px;padding:16px;max-width:720px}
img{max-width:100%;border-radius:12px;border:3px solid #08334a}
.digit{font-size:64px;font-weight:800}
a{color:#0a6c80;font-weight:700}
code{background:#eef;padding:2px 6px;border-radius:6px}
</style></head><body><div class="card">
<h2>Fish API debug (TEMPORARY)</h2>
<p>Source: <b>${esc(result.source)}</b> &middot; ${result.ms} ms${result.error ? ` &middot; error: <code>${esc(result.error)}</code>` : ""}</p>
<img src="${image}" alt="Sonar picture">
<p>Digit from the API: <span class="digit">${digit}</span></p>
<p>Count the fish yourself. Does it match?</p>
<p><a href="/api/debug/puzzle">New puzzle</a> &middot; <a href="/api/debug/puzzle?force=fallback">Force fallback</a></p>
</div></body></html>`;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}