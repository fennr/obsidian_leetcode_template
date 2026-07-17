# LeetCode Template

An Obsidian plugin that creates a structured note from a LeetCode problem link or number. It fetches metadata, the problem description, similar questions, and your accepted solution(s).

## Features

- **Create note from LeetCode link** — prompts for a URL or problem number, fetches metadata, description, and solutions, then creates a note in your target folder.
- **Import solution for current problem** — reads the `link` field from the active note's frontmatter and appends new accepted solutions without duplicates.
- Custom filename template (`{{number}}`, `{{slug}}`, `{{title}}`) and target folder.
- Optional problem description and all accepted solutions (or only the latest one).
- Auto-generated sections: frontmatter, Description, My idea, Optimal solution, Similar questions (optional), Solutions.

## Requirements

- Obsidian 1.5.0+ (desktop only)
- LeetCode login via embedded browser window (or paste cookies as fallback)

## Installation and build

```bash
bun install
bun run build
```

Copy `main.js` and `manifest.json` into `.obsidian/plugins/leetcode-template/` and reload the plugin.

`versions.json` stays in the repository root for compatibility with older Obsidian versions and is not included in GitHub Releases.

## Settings

- **LeetCode account** — Log in (embedded window), Log out, or Paste cookies
- **Notes folder** — target folder for new notes (can be empty)
- **Filename template** — placeholders: `{{number}}`, `{{slug}}`, `{{title}}`
- **Include description** — include or skip the problem description
- **Insert all solutions** — insert all accepted solutions instead of only the latest
- **Language** — `en` / `ru`; switches commands, notices, modal text, and template labels

## Usage

1. Open the command palette and run a plugin command.
2. To import solutions, make sure the active note's frontmatter contains `link: https://leetcode.com/problems/.../`.

## Note format

Frontmatter includes `title`, `number`, `difficulty`, `tags`, and `link`. Body sections: Description, My idea, Optimal solution, optional Similar questions, and Solutions with code, runtime, and memory. Duplicate solutions are removed; new ones are appended to the Solutions section.

## Русский

Плагин создаёт заметку по ссылке или номеру задачи LeetCode: подтягивает метаданные, описание, похожие задачи и Accepted-решения. Команды и интерфейс доступны на русском — включите `Language: ru` в настройках.
