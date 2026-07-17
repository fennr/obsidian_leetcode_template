import assert from "node:assert/strict";

import { isReadyToCaptureAuth } from "../src/auth/BrowserWindowLogin.ts";

assert.equal(isReadyToCaptureAuth("https://leetcode.com/accounts/login/"), false);
assert.equal(isReadyToCaptureAuth("https://leetcode.com/accounts/login/?next=/"), false);
assert.equal(isReadyToCaptureAuth("https://leetcode.com/accounts/github/login/"), false);
assert.equal(isReadyToCaptureAuth("https://leetcode.com/"), true);
assert.equal(isReadyToCaptureAuth("https://leetcode.com/problemset/"), true);
assert.equal(isReadyToCaptureAuth("https://accounts.google.com/"), false);
