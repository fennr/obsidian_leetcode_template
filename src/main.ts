import {
  App,
  Modal,
  Notice,
  Plugin,
  Setting,
  TFile,
  TFolder,
  normalizePath
} from "obsidian";
import { LeetCodeSettingTab, DEFAULT_SETTINGS } from "./settings";
import {
  buildNoteContent,
  formatSolutionsSection,
  SOLUTIONS_HEADERS,
  type Language
} from "./template";
import {
  fetchQuestion,
  fetchAcceptedSolutions,
  fetchSlugByNumber,
  fetchLatestAcceptedSolution,
  type QuestionMetadata,
  type SubmissionSolution
} from "./leetcode";

type LocaleStrings = typeof LOCALES.en;

const LOCALES = {
  en: {
    commands: {
      createNote: "Create note from LeetCode link",
      importSolution: "Import solution for current problem"
    },
    modal: {
      title: "LeetCode link or problem number",
      label: "Link or number",
      placeholder: "https://leetcode.com/problems/two-sum/ or 1",
      button: "Create"
    },
    notices: {
      resolveSlugFail: "Could not resolve problem (check link or number)",
      fetchError: "Failed to fetch data",
      unknownRequestError: "Unknown request error",
      created: "Created",
      createFileFail: "Failed to create file",
      noActiveNote: "No active note",
      resolveFromFileFail: "Could not resolve problem (no link in frontmatter)",
      noCookies: "Set csrftoken and LEETCODE_SESSION in settings",
      noAccepted: "No Accepted solutions found",
      updated: "Solutions updated",
      importError: "Failed to import solution"
    },
    errors: {
      pathConflict: (path: string) => `Path ${path} is already a file.`
    }
  },
  ru: {
    commands: {
      createNote: "Создать заметку по ссылке LeetCode",
      importSolution: "Импортировать решение для текущей задачи"
    },
    modal: {
      title: "Ссылка или номер задачи LeetCode",
      label: "Ссылка или номер",
      placeholder: "https://leetcode.com/problems/two-sum/ или 1",
      button: "Создать"
    },
    notices: {
      resolveSlugFail: "Не удалось определить задачу (проверьте ссылку или номер)",
      fetchError: "Ошибка получения данных",
      unknownRequestError: "Неизвестная ошибка запроса",
      created: "Создано",
      createFileFail: "Не удалось создать файл",
      noActiveNote: "Нет активной заметки",
      resolveFromFileFail: "Не удалось определить задачу (нет ссылки в frontmatter)",
      noCookies: "Укажите csrftoken и LEETCODE_SESSION в настройках",
      noAccepted: "Accepted решения не найдены",
      updated: "Решения обновлены",
      importError: "Не удалось импортировать решение"
    },
    errors: {
      pathConflict: (path: string) => `Путь ${path} уже занят файлом.`
    }
  }
} satisfies Record<Language, any>;

function getLocaleStrings(language: Language): LocaleStrings {
  return (LOCALES as Record<string, LocaleStrings>)[language] ?? LOCALES.en;
}

export default class LeetCodeTemplatePlugin extends Plugin {
  settings = DEFAULT_SETTINGS;

  override async onload(): Promise<void> {
    await this.loadSettings();
    const strings = getLocaleStrings(this.settings.language);

    this.addCommand({
      id: "create-leetcode-note",
      name: strings.commands.createNote,
      callback: () => this.handleCreateNote()
    });

    this.addCommand({
      id: "import-leetcode-solution",
      name: strings.commands.importSolution,
      callback: () => this.handleImportSolution()
    });

    this.addSettingTab(new LeetCodeSettingTab(this.app, this));
  }

  async loadSettings(): Promise<void> {
    const saved = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private async handleCreateNote(): Promise<void> {
    const strings = getLocaleStrings(this.settings.language);
    const input = await new LinkInputModal(this.app, strings).waitForInput();
    if (!input) {
      return;
    }

    const cookie = this.buildCookieHeader();
    const slug = await resolveSlug(input, cookie);
    if (!slug) {
      new Notice(strings.notices.resolveSlugFail);
      return;
    }

    let metadata: QuestionMetadata;
    let solutions: SubmissionSolution[] = [];
    try {
      metadata = await fetchQuestion(slug, cookie);
      if (this.settings.insertAllSolutions) {
        solutions = await fetchAcceptedSolutions(slug, cookie);
      } else {
        const single = await fetchLatestAcceptedSolution(slug, cookie);
        solutions = single ? [single] : [];
      }
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : strings.notices.unknownRequestError;
      new Notice(`${strings.notices.fetchError}: ${message}`);
      return;
    }

    const noteContent = buildNoteContent(
      metadata,
      this.settings.includeDescription,
      solutions,
      this.settings.language
    );

    try {
      const filePath = await this.createNoteFile(metadata, noteContent);
      new Notice(`${strings.notices.created}: ${filePath}`);
      await this.app.workspace.openLinkText(filePath, "", false);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : strings.notices.createFileFail;
      new Notice(message);
    }
  }

  private async handleImportSolution(): Promise<void> {
    const strings = getLocaleStrings(this.settings.language);
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice(strings.notices.noActiveNote);
      return;
    }

    const slug = await extractSlugFromFile(this.app, file);
    if (!slug) {
      new Notice(strings.notices.resolveFromFileFail);
      return;
    }

    const cookie = this.buildCookieHeader();
    if (!cookie) {
      new Notice(strings.notices.noCookies);
      return;
    }

    try {
      const solutions = this.settings.insertAllSolutions
        ? await fetchAcceptedSolutions(slug, cookie)
        : (() => fetchLatestAcceptedSolution(slug, cookie).then((item) => (item ? [item] : [])))();

      const resolved = await solutions;
      if (!resolved.length) {
        new Notice(strings.notices.noAccepted);
        return;
      }

      const content = await this.app.vault.read(file);
      const updated = upsertSolutionsSection(content, resolved, this.settings.language);
      await this.app.vault.modify(file, updated);
      new Notice(strings.notices.updated);
    } catch (error) {
      console.error("Import solution error", error);
      const message = error instanceof Error ? error.message : strings.notices.importError;
      new Notice(message);
    }
  }

  private buildCookieHeader(): string {
    const parts: string[] = [];
    if (this.settings.csrftoken) {
      const token = this.settings.csrftoken.trim();
      if (token) parts.push(`csrftoken=${token.replace(/^csrftoken=/, "")}`);
    }
    if (this.settings.leetcodeSession) {
      const session = this.settings.leetcodeSession.trim();
      if (session) parts.push(`LEETCODE_SESSION=${session.replace(/^LEETCODE_SESSION=/, "")}`);
    }
    return parts.join("; ");
  }

  private async createNoteFile(metadata: QuestionMetadata, content: string): Promise<string> {
    const folder = this.settings.targetFolder.trim();
    const normalizedFolder = folder ? normalizePath(folder) : "";
    const baseName = this.buildFileName(metadata);
    const fileName = `${baseName}.md`;
    const requestedPath = normalizedFolder
      ? normalizePath(`${normalizedFolder}/${fileName}`)
      : normalizePath(fileName);

    if (normalizedFolder) {
      await this.ensureFolder(normalizedFolder);
    }

    const finalPath = await this.resolveCollision(requestedPath);
    await this.app.vault.create(finalPath, content);
    return finalPath;
  }

  private buildFileName(metadata: QuestionMetadata): string {
    const template = this.settings.filenameTemplate || "{{number}}-{{slug}}";
    const safe = sanitizeForPath;
    const replacements: Record<string, string> = {
      "{{number}}": metadata.number ?? metadata.id ?? "",
      "{{slug}}": metadata.slug ?? "",
      "{{title}}": metadata.title ?? ""
    };

    const replaced = Object.entries(replacements).reduce(
      (acc, [key, value]) => acc.replaceAll(key, safe(value)),
      template
    );

    const trimmed = replaced.trim();
    return trimmed.length ? trimmed : safe(metadata.slug ?? "leetcode-problem");
  }

  private async ensureFolder(path: string): Promise<void> {
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (!existing) {
      await this.app.vault.createFolder(path);
      return;
    }
    if (!(existing instanceof TFolder)) {
      throw new Error(getLocaleStrings(this.settings.language).errors.pathConflict(path));
    }
  }

  private async resolveCollision(path: string): Promise<string> {
    if (!this.app.vault.getAbstractFileByPath(path)) {
      return path;
    }

    const extIndex = path.lastIndexOf(".");
    const base = extIndex === -1 ? path : path.slice(0, extIndex);
    const ext = extIndex === -1 ? "" : path.slice(extIndex);

    let counter = 1;
    let candidate = `${base} ${counter}${ext}`;
    while (this.app.vault.getAbstractFileByPath(candidate)) {
      counter += 1;
      candidate = `${base} ${counter}${ext}`;
    }
    return candidate;
  }
}

class LinkInputModal extends Modal {
  private resolve: (value: string | null) => void = () => {};
  private reject: (reason?: unknown) => void = () => {};
  private strings: LocaleStrings;

  constructor(app: App, strings: LocaleStrings) {
    super(app);
    this.strings = strings;
  }

  waitForInput(): Promise<string | null> {
    return new Promise<string | null>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
      this.open();
    });
  }

  override onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: this.strings.modal.title });

    let inputValue = "";

    new Setting(contentEl)
      .setName(this.strings.modal.label)
      .addText((text) =>
        text
          .setPlaceholder(this.strings.modal.placeholder)
          .onChange((value) => {
            inputValue = value.trim();
          })
      );

    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText(this.strings.modal.button)
        .setCta()
        .onClick(() => {
          this.close();
          this.resolve(inputValue || null);
        })
    );
  }

  override onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}

function extractSlug(link: string): string | null {
  const match = link.match(/leetcode\.com\/problems\/([a-z0-9-]+)/i);
  return match?.[1] ?? null;
}

async function resolveSlug(input: string, cookie: string): Promise<string | null> {
  const linkSlug = extractSlug(input);
  if (linkSlug) return linkSlug;

  const numeric = input.trim();
  if (/^\d+$/.test(numeric)) {
    const slug = await fetchSlugByNumber(numeric, cookie);
    return slug;
  }

  return null;
}

function sanitizeForPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.replace(/[<>:"/\\|?*]+/g, "").replace(/\s+/g, "-");
}

async function extractSlugFromFile(app: App, file: TFile): Promise<string | null> {
  const cache = app.metadataCache.getFileCache(file);
  const linkField = cache?.frontmatter?.link;
  if (typeof linkField === "string") {
    const slug = extractSlug(linkField);
    if (slug) return slug;
  }

  const content = await app.vault.read(file);
  const slugFromContent = extractSlug(content);
  if (slugFromContent) return slugFromContent;
  return null;
}

function upsertSolutionsSection(
  content: string,
  solutions: SubmissionSolution[],
  language: Language
): string {
  if (!solutions.length) return content;

  const headers = Object.values(SOLUTIONS_HEADERS);
  const headerPattern = headers.map(escapeRegExp).join("|");
  const regex = new RegExp(`##\\s+(?:${headerPattern})[\\s\\S]*$`, "i");
  const existingMatch = content.match(regex);
  const existingSection = existingMatch ? existingMatch[0] : "";
  const existingCodes = extractCodes(existingSection);

  const uniqueNew = solutions.filter(
    (s) => !existingCodes.includes(s.code.trim())
  );

  if (uniqueNew.length === 0) return content;

  const appendBlock = formatSolutionsSection(uniqueNew, {
    includeHeader: false,
    language
  }).trim();

  if (existingMatch) {
    const updatedSection = existingSection.trimEnd() + "\n\n" + appendBlock;
    return content.replace(regex, updatedSection);
  }

  const block = formatSolutionsSection(uniqueNew, { includeHeader: true, language }).trim();
  const trimmed = content.trimEnd();
  return trimmed ? `${trimmed}\n\n${block}\n` : `${block}\n`;
}

function extractCodes(section: string): string[] {
  const codes: string[] = [];
  const regex = /```[a-z]*\n([\s\S]*?)\n```/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(section)) !== null) {
    codes.push((match[1] ?? "").trim());
  }
  return codes;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

