import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { createLetbuyyBoundaryConfig } from "../../../config/eslint/letbuyy-boundaries.mjs";
import uiPlugin from "../../../packages/typescript/ui/eslint/index.cjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  createLetbuyyBoundaryConfig(),
  {
    plugins: {
      "@letbuyy/ui": uiPlugin,
    },
    rules: {
      "@letbuyy/ui/no-raw-elements": "error",
      "@letbuyy/ui/no-hardcoded-hex": "error",
      "@letbuyy/ui/no-raw-form-controls": "warn",
      "@letbuyy/ui/no-raw-color-functions": "warn",
      "@letbuyy/ui/no-tailwind-default-color": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
