const tsParser = require("@typescript-eslint/parser");
const { createTypeScriptImportResolver } = require("eslint-import-resolver-typescript");
const { importX } = require("eslint-plugin-import-x");
const simpleImportSort = require("eslint-plugin-simple-import-sort");
const obsidianmd = require("eslint-plugin-obsidianmd").default;

module.exports = [
  {
    ignores: ["node_modules", "main.js", "bun.lock", "scripts", "eslint.config.cjs"]
  },
  ...obsidianmd.configs.recommended,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname
      }
    },
    plugins: {
      "import-x": importX,
      "simple-import-sort": simpleImportSort
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
      "obsidianmd/ui/sentence-case": [
        "warn",
        {
          enforceCamelCaseLower: true,
          brands: ["LeetCode", "CSRF", "LEETCODE_SESSION", "Obsidian"]
        }
      ],
      "import-x/order": "off",
      "simple-import-sort/imports": "warn",
      "simple-import-sort/exports": "warn"
    }
  }
];
