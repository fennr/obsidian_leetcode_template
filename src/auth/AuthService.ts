import { type App, Notice } from "obsidian";

import { fetchWhoami } from "../leetcode";
import type { LeetCodeTemplateSettings } from "../settings";
import { clearLeetCodePartitionCookies, openLogin } from "./BrowserWindowLogin";
import { CookiePasteModal } from "./CookiePasteModal";
import type { AuthCookies } from "./types";

export type AuthNotices = {
  loggedIn: (username: string) => string;
  loginCancelled: string;
  loginTimeout: string;
  cookiesSaved: (username: string) => string;
  loggedOut: string;
  cookiesInvalid: string;
};

export interface AuthPluginHost {
  app: App;
  settings: LeetCodeTemplateSettings;
  saveSettings(): Promise<void>;
}

function cookieHeader(cookies: AuthCookies): string {
  return `csrftoken=${cookies.csrftoken}; LEETCODE_SESSION=${cookies.LEETCODE_SESSION}`;
}

export class AuthService {
  constructor(
    private readonly plugin: AuthPluginHost,
    private readonly getNotices: () => AuthNotices
  ) {}

  isLoggedIn(): boolean {
    return Boolean(
      this.plugin.settings.csrftoken.trim() && this.plugin.settings.leetcodeSession.trim()
    );
  }

  async login(): Promise<boolean> {
    const notices = this.getNotices();
    let result;
    try {
      result = await openLogin();
    } catch (error) {
      const message = error instanceof Error ? error.message : notices.loginTimeout;
      new Notice(message, 7000);
      return false;
    }

    switch (result.kind) {
      case "cancelled":
        new Notice(notices.loginCancelled, 4000);
        return false;
      case "timeout":
        new Notice(notices.loginTimeout, 7000);
        return false;
      case "success":
        break;
    }

    return this.persistValidated(result.cookies, notices.loggedIn);
  }

  async loginManual(cookies: AuthCookies): Promise<boolean> {
    const notices = this.getNotices();
    return this.persistValidated(cookies, notices.cookiesSaved);
  }

  openPasteModal(): void {
    new CookiePasteModal(this.plugin.app, async (cookies) => {
      await this.loginManual(cookies);
    }).open();
  }

  async logout(): Promise<void> {
    const notices = this.getNotices();
    this.plugin.settings.csrftoken = "";
    this.plugin.settings.leetcodeSession = "";
    this.plugin.settings.username = null;
    await this.plugin.saveSettings();
    await clearLeetCodePartitionCookies();
    new Notice(notices.loggedOut, 4000);
  }

  private async persistValidated(
    cookies: AuthCookies,
    successNotice: (username: string) => string
  ): Promise<boolean> {
    const notices = this.getNotices();
    const who = await fetchWhoami(cookieHeader(cookies));
    if (!who?.isSignedIn || !who.username) {
      new Notice(notices.cookiesInvalid, 5000);
      return false;
    }

    this.plugin.settings.csrftoken = cookies.csrftoken;
    this.plugin.settings.leetcodeSession = cookies.LEETCODE_SESSION;
    this.plugin.settings.username = who.username;
    await this.plugin.saveSettings();
    new Notice(successNotice(who.username), 4000);
    return true;
  }
}
