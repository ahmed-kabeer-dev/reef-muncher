// Reef Muncher: browser-side helpers for calling our own server routes.
// Every call has a timeout (AbortController) so no loading state lasts forever.

async function request(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error ?? `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export function postJson(url, body, timeoutMs = 8000) {
  return request(
    url,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) },
    timeoutMs
  );
}

export function getJson(url, timeoutMs = 8000) {
  return request(url, { method: "GET", cache: "no-store" }, timeoutMs);
}