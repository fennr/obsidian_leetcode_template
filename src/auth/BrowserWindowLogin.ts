import type { AuthCookies } from "./types";

const PARTITION = "persist:leetcode-template";
const LOGIN_URL = "https://leetcode.com/accounts/login/";
const COOKIE_URL = "https://leetcode.com/";
const LOGIN_CAPTURE_TIMEOUT_MS = 120_000;

type CjsRequire = (id: string) => unknown;

type HostWindow = Window & {
  require?: CjsRequire;
  module?: { require?: CjsRequire };
};

function hostWindow(): HostWindow {
  // Prefer activeWindow for Obsidian popout compatibility (eslint-plugin-obsidianmd).
  return typeof activeWindow !== "undefined" ? activeWindow : window;
}

function nodeRequire(id: string): unknown {
  const w = hostWindow();
  const fn = w.require ?? w.module?.require;
  if (!fn) throw new Error("Node require() unavailable from renderer.");
  return fn(id);
}

function loadElectron(): ElectronModule {
  return nodeRequire("electron") as ElectronModule;
}

function loadElectronRemote(): ElectronRemote | null {
  try {
    return nodeRequire("@electron/remote") as ElectronRemote;
  } catch {
    return null;
  }
}

export interface ElectronCookieShape {
  name: string;
  value: string;
}

export function extractAuthCookies(cookies: ElectronCookieShape[]): AuthCookies | null {
  const lcSession = cookies.find((c) => c.name === "LEETCODE_SESSION");
  const csrf = cookies.find((c) => c.name === "csrftoken");
  if (!lcSession || !csrf) return null;
  return {
    LEETCODE_SESSION: lcSession.value,
    csrftoken: csrf.value
  };
}

export interface ElectronCookiesApi {
  get(filter: { url?: string; domain?: string }): Promise<ElectronCookieShape[]>;
  remove(url: string, name: string): Promise<void>;
}

export async function tryCaptureCookies(cookies: ElectronCookiesApi): Promise<AuthCookies | null> {
  try {
    const list = await cookies.get({ url: COOKIE_URL });
    return extractAuthCookies(list);
  } catch {
    return null;
  }
}

interface ElectronSession {
  cookies: ElectronCookiesApi;
}

interface ElectronWebContents {
  session: ElectronSession;
  on(event: string, listener: () => void): void;
  getURL?: () => string;
}

interface ElectronBrowserWindow {
  webContents: ElectronWebContents;
  on(event: "closed", listener: () => void): void;
  loadURL(url: string): Promise<void>;
  close(): void;
}

interface BrowserWindowOptions {
  width?: number;
  height?: number;
  show?: boolean;
  autoHideMenuBar?: boolean;
  webPreferences?: {
    partition?: string;
    nodeIntegration?: boolean;
    contextIsolation?: boolean;
  };
}

type BrowserWindowCtor = new (opts: BrowserWindowOptions) => ElectronBrowserWindow;

interface ElectronSessionModule {
  fromPartition(partition: string): {
    clearStorageData(opts?: { storages?: string[] }): Promise<void>;
    cookies: ElectronCookiesApi;
  };
}

interface ElectronRemote {
  BrowserWindow?: BrowserWindowCtor;
  session?: ElectronSessionModule;
}

interface ElectronModule {
  BrowserWindow?: BrowserWindowCtor;
  session?: ElectronSessionModule;
  remote?: ElectronRemote;
}

export type OpenLoginResult =
  | { kind: "success"; cookies: AuthCookies }
  | { kind: "cancelled" }
  | { kind: "timeout" };

function resolveBrowserWindow(): BrowserWindowCtor {
  const electron = loadElectron();
  let BrowserWindow: BrowserWindowCtor | undefined = electron.BrowserWindow;
  if (!BrowserWindow && electron.remote) {
    BrowserWindow = electron.remote.BrowserWindow;
  }
  if (!BrowserWindow) {
    BrowserWindow = loadElectronRemote()?.BrowserWindow;
  }
  if (!BrowserWindow) {
    throw new Error(
      "BrowserWindow unavailable. Use the cookie-paste fallback in Settings."
    );
  }
  return BrowserWindow;
}

export function isReadyToCaptureAuth(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "leetcode.com" && parsed.hostname !== "www.leetcode.com") {
      return false;
    }
    const path = parsed.pathname;
    // Anonymous LEETCODE_SESSION is already set on the login page; only capture after leave.
    if (path.startsWith("/accounts/login") || path.startsWith("/accounts/signup")) {
      return false;
    }
    if (path.startsWith("/accounts/")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function openLogin(): Promise<OpenLoginResult> {
  // Keep Google/GitHub/CF cookies in the partition so re-login skips verification.
  // Anonymous LEETCODE_SESSION on /accounts/login is ignored via isReadyToCaptureAuth.
  const BrowserWindowCtor = resolveBrowserWindow();

  return new Promise((resolve) => {
    const win = new BrowserWindowCtor({
      width: 980,
      height: 720,
      show: true,
      autoHideMenuBar: true,
      webPreferences: {
        partition: PARTITION,
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    let settled = false;
    let timeoutHandle: number | null = null;

    const settle = (result: OpenLoginResult): void => {
      if (settled) return;
      settled = true;
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      resolve(result);
    };

    const safeClose = (): void => {
      try {
        win.close();
      } catch {
        /* already destroyed */
      }
    };

    timeoutHandle = window.setTimeout(() => {
      settle({ kind: "timeout" });
      safeClose();
    }, LOGIN_CAPTURE_TIMEOUT_MS);

    win.on("closed", () => {
      settle({ kind: "cancelled" });
    });

    const tryCapture = async (): Promise<void> => {
      if (settled) return;
      let url = "";
      try {
        url = win.webContents.getURL?.() ?? "";
      } catch {
        url = "";
      }
      if (!isReadyToCaptureAuth(url)) return;

      const extracted = await tryCaptureCookies(win.webContents.session.cookies);
      if (!extracted || settled) return;

      settle({ kind: "success", cookies: extracted });
      safeClose();
    };

    win.webContents.on("did-navigate", () => {
      void tryCapture();
    });
    win.webContents.on("did-navigate-in-page", () => {
      void tryCapture();
    });

    win.loadURL(LOGIN_URL).catch(() => {
      settle({ kind: "cancelled" });
      safeClose();
    });
  });
}

const AUTH_COOKIE_NAMES = new Set(["LEETCODE_SESSION", "csrftoken"]);
const AUTH_COOKIE_URLS = ["https://leetcode.com/", "https://www.leetcode.com/"];

function partitionSession(): { cookies: ElectronCookiesApi } | null {
  try {
    const electron = loadElectron();
    const session = electron.session ?? electron.remote?.session;
    if (session) return session.fromPartition(PARTITION);
    return loadElectronRemote()?.session?.fromPartition(PARTITION) ?? null;
  } catch {
    return null;
  }
}

/**
 * Remove only LeetCode auth cookies from the login partition.
 * Leaves Google/GitHub/Cloudflare cookies so the next embedded login can skip re-verification.
 */
export async function clearLeetCodeAuthCookies(): Promise<void> {
  try {
    const sess = partitionSession();
    if (!sess) return;
    for (const url of AUTH_COOKIE_URLS) {
      const list = await sess.cookies.get({ url });
      for (const cookie of list) {
        if (AUTH_COOKIE_NAMES.has(cookie.name)) {
          await sess.cookies.remove(url, cookie.name);
        }
      }
    }
  } catch {
    /* best-effort */
  }
}
