import {
  assertNoOffenders,
  phaseBEntries,
  pushRegexOffenders,
} from "./phase-b-common.mjs";
import { createReporter } from "./governance-common.mjs";
import { existsSync, readFileSync } from "node:fs";

const reporter = createReporter("Token source single validator");

const allowedTokenAuthorities = [
  "packages/typescript/ui/src/tokens.ts",
  "packages/typescript/ui/tokens.json",
  "packages/dart/ui_kit/lib/src/tokens/letbuyy_tokens.dart",
];

const forbiddenMobileTokenAuthorities = [
  "packages/typescript/ui/src/mobile-tokens.ts",
  "apps/merchant_app/lib/theme/letbuyy_color_tokens.dart",
  "apps/merchant_app/lib/theme/light_theme_colors.dart",
  "apps/merchant_app/lib/theme/dark_theme_colors.dart",
  "apps/merchant_app/lib/theme/store_admin_colors.dart",
];

const tokenAuthorityPattern =
  /\bexport\s+const\s+(tokens|colors|palette|themeColors|brandColors)\b|\bconst\s+(tokens|colors|palette|themeColors|brandColors)\s*=\s*\{[\s\S]{0,220}#[0-9A-Fa-f]{3,8}/g;

const offenders = [];
for (const filePath of forbiddenMobileTokenAuthorities) {
  if (existsSync(filePath)) {
    offenders.push(`${filePath}: mobile token/color authority is forbidden; use packages/typescript/ui/src/tokens.ts -> tokens.json -> packages/dart/ui_kit/lib/src/tokens/letbuyy_tokens.dart`);
  }
}

for (const entry of phaseBEntries(["apps", "packages"])) {
  if (allowedTokenAuthorities.some((allowed) => entry.path === allowed || entry.path.startsWith(`${allowed}/`)) && !entry.extra) continue;
  if (/import\s+['"][^'"]*(?:letbuyy_color_tokens|store_admin_colors|light_theme_colors|dark_theme_colors)\.dart['"]/.test(entry.text)) {
    offenders.push(`${entry.path}: imports deleted mobile token/color authority; use letbuyy_ui_kit generated tokens`);
  }
  pushRegexOffenders(
    offenders,
    entry,
    tokenAuthorityPattern,
    () => "new token/color authority is forbidden; use packages/typescript/ui/src/tokens.ts",
  );
}

const generator = readFileSync("scripts/generators/generate-mobile-tokens.mjs", "utf8");
if (!generator.includes("packages', 'typescript', 'ui', 'tokens.json")) {
  offenders.push("scripts/generators/generate-mobile-tokens.mjs: Flutter token bridge must read packages/typescript/ui/tokens.json");
}
if (/mobile-tokens\.ts|apps['"], ['"]mobile['"], ['"]merchant-app/.test(generator)) {
  offenders.push("scripts/generators/generate-mobile-tokens.mjs: bypassed mobile token source/app-local bridge reference found");
}

const dartBridge = readFileSync("packages/dart/ui_kit/lib/src/tokens/letbuyy_tokens.dart", "utf8");
if (!dartBridge.startsWith("// GENERATED FILE - DO NOT EDIT.\n// Source: packages/typescript/ui/tokens.json")) {
  offenders.push("packages/dart/ui_kit/lib/src/tokens/letbuyy_tokens.dart: generated bridge header must point to tokens.json");
}
const appColors = readFileSync("packages/dart/ui_kit/lib/src/themes/app_colors.dart", "utf8");
if (!appColors.includes("import '../tokens/letbuyy_tokens.dart';")) {
  offenders.push("packages/dart/ui_kit/lib/src/themes/app_colors.dart: ThemeData color facade must consume generated token bridge");
}

assertNoOffenders(reporter, offenders, "Design tokens must have one source of truth");
reporter.finish("token authority ratchet checked");
