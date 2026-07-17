import type { AuthCookies } from "./types";

export function parseAuthCookiesFromHeader(raw: string): AuthCookies | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const session = matchCookie(trimmed, "LEETCODE_SESSION");
  const csrf = matchCookie(trimmed, "csrftoken");
  if (!session || !csrf) return null;

  return { LEETCODE_SESSION: session, csrftoken: csrf };
}

function matchCookie(header: string, key: string): string | null {
  const match = header.match(new RegExp(`(?:^|;\\s*)${key}=([^;\\s]+)`));
  return match?.[1] ?? null;
}
