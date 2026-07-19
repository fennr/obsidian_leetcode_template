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
   * Obsidian 1.13+: declarative definitions for settings search + rendering.
   * Keep cheap (no I/O). Auth sync runs inside the render callback.
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

  /** Fallback for Obsidian < 1.13.0 (display is skipped when definitions exist on 1.13+). */
  override display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("p", {
      text: "Checking LeetCode session…",
      cls: "setting-item-description"
    });
    void this.renderAfterSync();
  }

  private async renderAfterSync(): Promise<void> {
    await this.plugin.auth.syncSession();
    const { containerEl } = this;
    containerEl.empty();

    const authSetting = new Setting(containerEl).setName("LeetCode account");
    await this.bindAuthControls(authSetting);

    new Setting(containerEl)
      .setName("Notes folder")
      .setDesc("Target folder for generated notes (can be empty).")
      .addText((text) =>
        text
          .setPlaceholder("LeetCode")
          .setValue(this.plugin.settings.targetFolder)
          .onChange(async (value) => {
            this.plugin.settings.targetFolder = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Filename template")
      .setDesc("Placeholders: {{number}}, {{slug}}, {{title}}.")
      .addText((text) =>
        text
          .setPlaceholder("{{number}}-{{slug}}")
          .setValue(this.plugin.settings.filenameTemplate)
          .onChange(async (value) => {
            this.plugin.settings.filenameTemplate = value.trim() || "{{number}}-{{slug}}";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Include description")
      .setDesc("Turn off to skip task description in the note.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.includeDescription)
          .onChange(async (value) => {
            this.plugin.settings.includeDescription = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Insert all solutions")
      .setDesc("If enabled, add all accepted solutions (deduplicated).")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.insertAllSolutions)
          .onChange(async (value) => {
            this.plugin.settings.insertAllSolutions = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Language")
      .setDesc("UI language for plugin texts and template (en/ru).")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("en", "English")
          .addOption("ru", "Русский")
          .setValue(this.plugin.settings.language)
          .onChange(async (value) => {
            this.plugin.settings.language = (value as "en" | "ru") || "en";
            await this.plugin.saveSettings();
          })
      );
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
          if (typeof this.update === "function") {
            this.update();
          } else {
            this.display();
          }
        })
    );
    setting.addButton((btn) =>
      btn.setButtonText("Paste cookies").onClick(() => {
        new CookiePasteModal(this.plugin.app, async (cookies) => {
          await this.plugin.auth.loginManual(cookies);
          if (typeof this.update === "function") {
            this.update();
          } else {
            this.display();
          }
        }).open();
      })
    );
  }
}
