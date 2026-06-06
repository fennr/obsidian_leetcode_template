const js = require("@eslint/js");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const tsParser = require("@typescript-eslint/parser");
const { createTypeScriptImportResolver } = require("eslint-import-resolver-typescript");
const { importX } = require("eslint-plugin-import-x");
const simpleImportSort = require("eslint-plugin-simple-import-sort");
const obsidianmd = require("eslint-plugin-obsidianmd").default;
const globals = require("globals");

module.exports = [
  {
    ignores: ["node_modules", "main.js", "bun.lock"]
  },
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  {
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname
      },
      globals: {
        ...globals.node,
        ...globals.es2022
      }
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "import-x": importX,
      "simple-import-sort": simpleImportSort,
      obsidianmd
    },
    settings: {
      "import-x/resolver-next": [
        createTypeScriptImportResolver({
          project: "./tsconfig.json"
        })
      ],
      "import-x/core-modules": ["obsidian"]
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      ...tsPlugin.configs["recommended-requiring-type-checking"].rules,
      "obsidianmd/commands/no-command-in-command-id": "error",
      "obsidianmd/commands/no-command-in-command-name": "error",
      "obsidianmd/commands/no-default-hotkeys": "error",
      "obsidianmd/commands/no-plugin-id-in-command-id": "error",
      "obsidianmd/commands/no-plugin-name-in-command-name": "error",
      "obsidianmd/settings-tab/no-manual-html-headings": "error",
      "obsidianmd/settings-tab/no-problematic-settings-headings": "error",
      "obsidianmd/vault/iterate": "error",
      "obsidianmd/detach-leaves": "error",
      "obsidianmd/hardcoded-config-path": "error",
      "obsidianmd/no-forbidden-elements": "error",
      "obsidianmd/no-plugin-as-component": "error",
      "obsidianmd/no-sample-code": "error",
      "obsidianmd/no-tfile-tfolder-cast": "error",
      "obsidianmd/no-view-references-in-plugin": "error",
      "obsidianmd/no-static-styles-assignment": "error",
      "obsidianmd/object-assign": "error",
      "obsidianmd/platform": "error",
      "obsidianmd/prefer-file-manager-trash-file": "warn",
      "obsidianmd/prefer-abstract-input-suggest": "error",
      "obsidianmd/regex-lookbehind": "error",
      "obsidianmd/sample-names": "error",
      "obsidianmd/validate-manifest": "error",
      "obsidianmd/validate-license": ["error"],
      "obsidianmd/ui/sentence-case": [
        "warn",
        {
          enforceCamelCaseLower: true,
          brands: ["LeetCode", "CSRF", "LEETCODE_SESSION", "Obsidian"]
        }
      ],
      "no-console": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        { assertionStyle: "as", objectLiteralTypeAssertions: "never" }
      ],
      "import-x/order": "off",
      "simple-import-sort/imports": "warn",
      "simple-import-sort/exports": "warn"
    }
  }
];
