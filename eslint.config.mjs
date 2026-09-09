import js from "@eslint/js";
import tseslint from "typescript-eslint";
import powerbiVisuals from "eslint-plugin-powerbi-visuals";

export default tseslint.config(
  { ignores: ["node_modules/**", ".tmp/**", "dist/**", "test-results/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { ...powerbiVisuals.configs.recommended, files: ["src/**/*.ts"] },
  {
    files: ["**/*.mjs"],
    languageOptions: { globals: { console: "readonly", process: "readonly", Buffer: "readonly", URL: "readonly" } }
  },
  { rules: { "@typescript-eslint/no-explicit-any": "error" } }
);
