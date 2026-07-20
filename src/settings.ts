import {
  type App,
  PluginSettingTab,
  Setting,
  type SettingDefinitionItem
} from "obsidian";

import { CookiePasteModal } from "./auth/CookiePasteModal";
import type LeetCodeTemplatePlugin from "./main";

export interface LeetCodeTemplateSettings {
  csrftoken: string;
  leetcodeSession: string;
  username: string | null;
  targetFolder: string;
  filenameTemplate: string;
  includeDescription: boolean;
  insertAllSolutions: boolean;
  language: "en" | "ru";
}

export const DEFAULT_SETTINGS: LeetCodeTemplateSettings = {
  csrftoken: "",
  leetcodeSession: "",
  username: null,
  targetFolder: "",
  filenameTemplate: "{{number}}-{{slug}}",
  includeDescription: true,
  insertAllSolutions: false,
  language: "en"
};

export class LeetCodeSettingTab extends PluginSettingTab {
  plugin: LeetCodeTemplatePlugin;

  constructor(app: App, plugin: LeetCodeTemplatePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /**
   * Declarative definitions (Obsidian 1.13+). Keep cheap — no I/O here.
   * Auth sync runs inside the render callback.
   */
  override getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        name: "LeetCode account",
        desc: "Log in to fetch problems and solutions.",
        aliases: ["cookies", "session", "CSRF", "LEETCODE_SESSION", "auth"],
        render: (setting) => {
          void this.bindAuthControls(setting);
        }
      },
      {
        name: "Notes folder",
        desc: "Target folder for generated notes (can be empty).",
        control: {
          type: "text",
          key: "targetFolder",
          placeholder: "LeetCode"
        }
      },
      {
        name: "Filename template",
        desc: "Placeholders: {{number}}, {{slug}}, {{title}}.",
        control: {
          type: "text",
          key: "filenameTemplate",
          placeholder: "{{number}}-{{slug}}"
        }
      },
      {
        name: "Include description",
        desc: "Turn off to skip task description in the note.",
        control: {
          type: "toggle",
          key: "includeDescription"
        }
      },
      {
        name: "Insert all solutions",
        desc: "If enabled, add all accepted solutions (deduplicated).",
        control: {
          type: "toggle",
          key: "insertAllSolutions"
        }
      },
      {
        name: "Language",
        desc: "UI language for plugin texts and template (en/ru).",
        control: {
          type: "dropdown",
          key: "language",
          defaultValue: "en",
          options: {
            en: "English",
            ru: "Русский"
          }
        }
      }
    ];
  }

  private async bindAuthControls(setting: Setting): Promise<void> {
    await this.plugin.auth.syncSession();
    const loggedIn = this.plugin.auth.isLoggedIn();
    const username = this.plugin.settings.username;
    const statusText = loggedIn
      ? username
        ? `Logged in as ${username}`
        : "Logged in"
      : "Not logged in";

    setting.setDesc(statusText);
    setting.addButton((btn) =>
      btn
        .setButtonText(loggedIn ? "Log out" : "Log in")
        .setCta(!loggedIn)
        .onClick(async () => {
          if (loggedIn) {
            await this.plugin.auth.logout();
          } else {
            await this.plugin.auth.login();
          }
          this.update();
        })
    );
    setting.addButton((btn) =>
      btn.setButtonText("Paste cookies").onClick(() => {
        new CookiePasteModal(this.plugin.app, async (cookies) => {
          await this.plugin.auth.loginManual(cookies);
          this.update();
        }).open();
      })
    );
  }
}
