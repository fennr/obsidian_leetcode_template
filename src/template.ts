import { htmlToMarkdown } from "obsidian";
import type { QuestionMetadata, SubmissionSolution } from "./leetcode";

export type Language = "en" | "ru";

const TEMPLATE_STRINGS: Record<Language, {
  descriptionHeader: string;
  myIdeaHeader: string;
  myIdeaPlaceholder: string;
  optimalSolutionHeader: string;
  optimalSolutionPlaceholder: string;
  similarHeader: string;
  solutionsHeader: string;
  descriptionUnavailable: string;
}> = {
  en: {
    descriptionHeader: "Description",
    myIdeaHeader: "My idea",
    myIdeaPlaceholder: "(your plan)",
    optimalSolutionHeader: "Optimal solution",
    optimalSolutionPlaceholder: "(notes)",
    similarHeader: "Similar questions",
    solutionsHeader: "Solutions",
    descriptionUnavailable: "(description unavailable or disabled)"
  },
  ru: {
    descriptionHeader: "Описание",
    myIdeaHeader: "Моя идея",
    myIdeaPlaceholder: "(ваш план)",
    optimalSolutionHeader: "Оптимальное решение",
    optimalSolutionPlaceholder: "(конспект)",
    similarHeader: "Похожие вопросы",
    solutionsHeader: "Решения",
    descriptionUnavailable: "(описание недоступно или отключено)"
  }
};

export function getTemplateStrings(language: Language = "en") {
  return TEMPLATE_STRINGS[language] ?? TEMPLATE_STRINGS.en;
}

export const SOLUTIONS_HEADERS: Record<Language, string> = {
  en: "Solutions",
  ru: "Решения"
};

export function buildNoteContent(
  metadata: QuestionMetadata,
  includeDescription: boolean,
  solutions?: SubmissionSolution[] | SubmissionSolution | null,
  language: Language = "en"
): string {
  const strings = getTemplateStrings(language);

  const tags = metadata.tags?.length ? metadata.tags.join(", ") : "";
  const link = `https://leetcode.com/problems/${metadata.slug}/`;

  const frontmatter = [
    "---",
    `title: ${metadata.title}`,
    `number: ${metadata.number ?? ""}`,
    `difficulty: ${metadata.difficulty}`,
    `tags: [${tags}]`,
    `link: ${link}`,
    "---"
  ].join("\n");

  const descriptionBlock =
    includeDescription && metadata.content
      ? formatDescription(htmlToMarkdown(metadata.content).trim())
      : strings.descriptionUnavailable;

  const parts: string[] = [
    frontmatter,
    `# ${metadata.title}`,
    "",
    `## ${strings.descriptionHeader}`,
    descriptionBlock,
    "",
    `## ${strings.myIdeaHeader}`,
    strings.myIdeaPlaceholder,
    "",
    `## ${strings.optimalSolutionHeader}`,
    strings.optimalSolutionPlaceholder,
    ""
  ];

  if (metadata.similarQuestions.length > 0) {
    const similarBlock = metadata.similarQuestions
      .map(
        (q) =>
          `- ${q.title} (${q.difficulty || "?"}) — https://leetcode.com/problems/${q.slug}/`
      )
      .join("\n");
    parts.push(`## ${strings.similarHeader}`, similarBlock, "");
  }

  const preparedSolutions = Array.isArray(solutions)
    ? solutions
    : solutions
      ? [solutions]
      : [];

  if (preparedSolutions.length > 0) {
    parts.push(formatSolutionsSection(preparedSolutions, { language }));
  }

  return parts.join("\n");
}

export function formatSolutionsSection(
  solutions: SubmissionSolution[],
  options: { includeHeader?: boolean; language?: Language } = {}
): string {
  const { includeHeader = true, language = "en" } = options;
  const deduped = dedupeSolutionsByCode(solutions);
  if (deduped.length === 0) return "";
  const entries = deduped.map(formatSingleSolution);
  if (!includeHeader) return entries.join("\n\n");
  const header = SOLUTIONS_HEADERS[language] ?? SOLUTIONS_HEADERS.en;
  return [`## ${header}`, entries.join("\n\n")].join("\n\n");
}

function formatSingleSolution(solution: SubmissionSolution): string {
  const lang = solution.lang ? solution.lang.toLowerCase() : "";
  const code = solution.code.trimEnd();
  const details: string[] = [];
  if (solution.lang) details.push(solution.lang);
  const runtime = formatRuntime(solution.runtime);
  if (runtime) details.push(`Runtime: ${runtime}`);
  const memory = formatMemory(solution.memory);
  if (memory) details.push(`Memory: ${memory}`);
  const time = solution.timestamp ? new Date(solution.timestamp * 1000) : null;
  if (time) details.push(time.toISOString());
  const detailsLine = details.join(" · ");

  const meta = detailsLine ? `${detailsLine}\n\n` : "";
  return `${meta}\`\`\`${lang}\n${code}\n\`\`\``;
}

function formatRuntime(raw: string | number | undefined | null): string {
  const text = String(raw ?? "").trim();
  if (!text) return "";

  const match = text.match(/([0-9]+(?:\.[0-9]+)?)\s*(ms|milliseconds?|s|sec|seconds?)?/i);
  if (!match) return text;

  const value = parseFloat(match[1] ?? "");
  const unitRaw = match[2] ?? "";
  const unit = unitRaw.toLowerCase();
  if (Number.isNaN(value)) return text;

  let ms = value;
  if (unit.startsWith("s")) {
    ms = value * 1000;
  }

  const normalized = ms >= 10 ? Math.round(ms) : parseFloat(ms.toFixed(2));
  return `${normalized} ms`;
}

function formatMemory(raw: string | number | undefined | null): string {
  const text = String(raw ?? "").trim();
  if (!text) return "";

  const match = text.match(/([0-9]+(?:\.[0-9]+)?)\s*(b|bytes?|kb|mb|gb)?/i);
  if (!match) return text;

  const value = parseFloat(match[1] ?? "");
  const unitRaw = match[2];
  const unit = unitRaw ? unitRaw.toLowerCase() : "";
  if (Number.isNaN(value)) return text;

  let mb: number;
  switch (unit) {
    case "b":
    case "byte":
    case "bytes":
      mb = value / (1024 * 1024);
      break;
    case "kb":
      mb = value / 1024;
      break;
    case "gb":
      mb = value * 1024;
      break;
    case "mb":
      mb = value;
      break;
    default: {
      if (value > 1_000_000) {
        mb = value / (1024 * 1024);
      } else if (value > 10_000) {
        mb = value / 1024;
      } else {
        mb = value;
      }
    }
  }

  const normalized = parseFloat(mb.toFixed(2));
  return `${normalized} MB`;
}

function formatDescription(markdown: string): string {
  const lines = markdown.split("\n");
  const out: string[] = [];
  let inCode = false;

  const normalizeForCheck = (line: string) =>
    line
      .trim()
      .replace(/^[-*>+\s]+/, "")
      .replace(/^\*\*/, "")
      .replace(/\*\*$/, "");

  const shouldCode = (line: string) =>
    /^(Input|Output|Explanation)\s*:/i.test(normalizeForCheck(line));

  const isExampleHeader = (line: string) => /^Example\b/i.test(normalizeForCheck(line));

  for (const line of lines) {
    if (shouldCode(line)) {
      if (!inCode) {
        out.push("```");
        inCode = true;
      }
      out.push(line.trim());
      continue;
    }

    if (inCode) {
      out.push("```");
      inCode = false;
      if (line.trim() === "") {
        out.push("");
        continue;
      }
    }

    if (isExampleHeader(line)) {
      out.push(line);
      continue;
    }

    out.push(line);
  }

  if (inCode) {
    out.push("```");
  }

  return out.join("\n");
}

function dedupeSolutionsByCode(solutions: SubmissionSolution[]): SubmissionSolution[] {
  const seen = new Set<string>();
  const result: SubmissionSolution[] = [];
  for (const solution of solutions) {
    const normalized = solution.code.trim();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push({ ...solution, code: normalized });
  }
  return result;
}

