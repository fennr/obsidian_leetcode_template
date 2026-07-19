/** Pure session policy — no Obsidian imports (agent-runnable checks). */

export function hasCookiePresence(csrftoken: string, leetcodeSession: string): boolean {
  return Boolean(csrftoken.trim() && leetcodeSession.trim());
}

export function isWhoamiSignedIn(whoami: { isSignedIn: boolean } | null): boolean {
  return Boolean(whoami?.isSignedIn);
}

/**
 * After sync: if cookies are present but whoami is not signed in, drop them.
 * Returns whether the UI should treat the user as logged in.
 */
export function sessionAfterWhoami(args: {
  hasCookies: boolean;
  whoami: { isSignedIn: boolean } | null;
}): { keepCookies: boolean; uiLoggedIn: boolean } {
  if (!args.hasCookies) return { keepCookies: false, uiLoggedIn: false };
  if (!isWhoamiSignedIn(args.whoami)) return { keepCookies: false, uiLoggedIn: false };
  return { keepCookies: true, uiLoggedIn: true };
}
