export const REPORT_CARDS_API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

function accessToken() {
  return typeof window === "undefined"
    ? ""
    : localStorage.getItem("access_token") || "";
}

export async function reportCardsFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${REPORT_CARDS_API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken() ? { Authorization: `Bearer ${accessToken()}` } : {}),
      ...(options.headers || {}),
    },
  });
  const raw = await response.text();
  const body: unknown = raw ? (() => {
    try { return JSON.parse(raw) as unknown; } catch { return raw; }
  })() : null;

  if (!response.ok) {
    const detail = body && typeof body === "object" && "detail" in body
      ? (body as { detail?: unknown }).detail
      : raw;
    throw new Error(typeof detail === "string" ? detail : `Request failed with status ${response.status}`);
  }
  return body as T;
}
