const js = require("@eslint/js");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const tsParser = require("@typescript-eslint/parser");
const importPlugin = require("eslint-plugin-import");
const simpleImportSort = require("eslint-plugin-simple-import-sort");
const globals = require("globals");

module.exports = [
  {
    ignores: ["node_modules", "main.js", "bun.lock"]
  },
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
      import: importPlugin,
      "simple-import-sort": simpleImportSort
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      ...tsPlugin.configs["recommended-requiring-type-checking"].rules,
      ...importPlugin.configs.recommended.rules,
      ...importPlugin.configs.typescript.rules,
      "no-console": ["error", { allow: ["warn", "error", "debug"] }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        { assertionStyle: "as", objectLiteralTypeAssertions: "never" }
      ],
      "import/order": "off",
      "simple-import-sort/imports": "warn",
      "simple-import-sort/exports": "warn"
    }
  }
];

