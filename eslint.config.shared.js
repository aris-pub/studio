// eslint.config.shared.js - Shared ESLint configuration (no imports)

// Base rules that apply to all JavaScript/TypeScript files
export const baseRules = {
  // Prettier integration
  "prettier/prettier": "error",

  // Console and debugging
  "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
  "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",

  // Code quality
  "no-unused-vars": ["error", {
    "argsIgnorePattern": "^_",
    "varsIgnorePattern": "^_",
    "caughtErrorsIgnorePattern": "^_"
  }],
  "no-undef": "error",
  "eqeqeq": ["error", "always"],
  "prefer-const": "warn",

  // Whitespace and formatting
  "no-trailing-spaces": "error",
  "eol-last": ["error", "always"],

  // Let prettier handle most formatting
  "indent": "off",
  "quotes": "off",
  "semi": "off",
  "comma-dangle": "off",
  "max-len": "off"
};

// Shared base configuration template
export const baseConfig = {
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    globals: {
      console: "readonly",
      process: "readonly"
    }
  },
  rules: baseRules
};

// Global ignores that all projects should use
export const globalIgnores = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.venv/**",
  "**/__pycache__/**",
  "**/coverage/**",
  "**/.coverage/**",
  "**/logs/**",
  "**/*.log"
];
