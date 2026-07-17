import { App, Modal, Notice, Setting } from "obsidian";

import { parseAuthCookiesFromHeader } from "./parseCookies";
import type { AuthCookies } from "./types";

export class CookiePasteModal extends Modal {
  private cookieValue = "";

  constructor(
    app: App,
    private readonly onSave: (cookies: AuthCookies) => void | Promise<void>
  ) {
    super(app);
  }

  override onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    new Setting(contentEl).setName("Paste cookies").setHeading();
    contentEl.createEl("p", {
      text: "Paste the full cookie header from LeetCode (must include LEETCODE_SESSION and csrftoken).",
      cls: "setting-item-description"
    });

    new Setting(contentEl)
      .setName("Raw cookie string")
      .addTextArea((area) => {
        area.setPlaceholder("Paste cookie header here");
        area.inputEl.rows = 4;
        area.onChange((value) => {
          this.cookieValue = value;
        });
      });

    new Setting(contentEl).addButton((btn) =>
      btn.setButtonText("Save cookies").onClick(async () => {
        const cookies = parseAuthCookiesFromHeader(this.cookieValue);
        if (!cookies) {
          new Notice("Cookie header must include LEETCODE_SESSION and csrftoken.", 4000);
          return;
        }
        await this.onSave(cookies);
        this.close();
      })
    );
  }

  override onClose(): void {
    this.contentEl.empty();
  }
}
