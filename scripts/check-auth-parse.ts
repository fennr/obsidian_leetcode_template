import assert from "node:assert/strict";

import { parseAuthCookiesFromHeader } from "../src/auth/parseCookies.ts";

const ok = parseAuthCookiesFromHeader(
  "csrftoken=abc123; LEETCODE_SESSION=eyJ.token; other=1"
);
assert.deepEqual(ok, { csrftoken: "abc123", LEETCODE_SESSION: "eyJ.token" });

assert.equal(parseAuthCookiesFromHeader("csrftoken=only"), null);
assert.equal(parseAuthCookiesFromHeader(""), null);
