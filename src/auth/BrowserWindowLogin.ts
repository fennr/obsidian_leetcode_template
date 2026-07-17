import type { AuthCookies } from "./types";

const PARTITION = "persist:leetcode-template";
const LOGIN_URL = "https://leetcode.com/accounts/login/";
const COOKIE_URL = "https://leetcode.com/";
const LOGIN_CAPTURE_TIMEOUT_MS = 30_000;

type CjsRequire = (id: string) => unknown;

function nodeRequire(id: string): unknown {
  const g = globalThis as typeof globalThis & {
    require?: CjsRequire;
    module?: { require?: CjsRequire };
    activeWindow?: { require?: CjsRequire };
  };
  const fn = g.activeWindow?.require ?? g.require ?? g.module?.require;
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

export function openLogin(): Promise<OpenLoginResult> {
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
        globalThis.clearTimeout(timeoutHandle);
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

    timeoutHandle = globalThis.setTimeout(() => {
      settle({ kind: "timeout" });
      safeClose();
    }, LOGIN_CAPTURE_TIMEOUT_MS);

    win.on("closed", () => {
      settle({ kind: "cancelled" });
    });

    const tryCapture = async (): Promise<void> => {
      if (settled) return;
      const extracted = await tryCaptureCookies(win.webContents.session.cookies);
      if (extracted && !settled) {
        settle({ kind: "success", cookies: extracted });
        safeClose();
      }
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

export async function clearLeetCodePartitionCookies(): Promise<void> {
  try {
    const electron = loadElectron();
    const session = electron.session ?? electron.remote?.session;
    if (session) {
      await session.fromPartition(PARTITION).clearStorageData({ storages: ["cookies"] });
      return;
    }
    const remoteSession = loadElectronRemote()?.session;
    if (remoteSession) {
      await remoteSession.fromPartition(PARTITION).clearStorageData({ storages: ["cookies"] });
    }
  } catch {
    /* best-effort */
  }
}
