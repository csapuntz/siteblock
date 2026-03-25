import globals from "globals";

export default [
  {
    files: ["js/**/*.js"],
    ignores: ["js/**/*.test.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        chrome: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-undef": "error",
      "no-constant-condition": "warn",
      "eqeqeq": ["warn", "always"],
      "no-var": "warn",
      "prefer-const": "warn",
    },
  },
  {
    files: ["js/**/*.test.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        chrome: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-undef": "error",
      "no-var": "warn",
    },
  },
];

