/**
 * Feedback loop for stale LeetCode session UX.
 * Run: bun run scripts/check-stale-auth.ts
 */
import assert from "node:assert/strict";

import {
  hasCookiePresence,
  isWhoamiSignedIn,
  sessionAfterWhoami
} from "../src/auth/sessionPolicy.ts";

const csrf = "stale-csrf-token";
const session = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.stale";
const whoamiExpired = { isSignedIn: false as const };

assert.equal(hasCookiePresence(csrf, session), true);
assert.equal(isWhoamiSignedIn(whoamiExpired), false);

const after = sessionAfterWhoami({ hasCookies: true, whoami: whoamiExpired });
assert.deepEqual(
  after,
  { keepCookies: false, uiLoggedIn: false },
  "BUG: stale whoami must drop cookies and show logged-out UI"
);

const afterOk = sessionAfterWhoami({
  hasCookies: true,
  whoami: { isSignedIn: true }
});
assert.deepEqual(afterOk, { keepCookies: true, uiLoggedIn: true });

console.log("check-stale-auth: ok");
