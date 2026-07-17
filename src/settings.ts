import { type App, PluginSettingTab, Setting } from "obsidian";

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

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const loggedIn = this.plugin.auth.isLoggedIn();
    const username = this.plugin.settings.username;
    const statusText = loggedIn
      ? username
        ? `Logged in as ${username}`
        : "Logged in"
      : "Not logged in";

    new Setting(containerEl)
      .setName("LeetCode account")
      .setDesc(statusText)
      .addButton((btn) =>
        btn
          .setButtonText(loggedIn ? "Log out" : "Log in")
          .setCta(!loggedIn)
          .onClick(async () => {
            if (loggedIn) {
              await this.plugin.auth.logout();
            } else {
              await this.plugin.auth.login();
            }
            this.display();
          })
      )
      .addButton((btn) =>
        btn.setButtonText("Paste cookies").onClick(() => {
          new CookiePasteModal(this.plugin.app, async (cookies) => {
            await this.plugin.auth.loginManual(cookies);
            this.display();
          }).open();
        })
      );

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
}
