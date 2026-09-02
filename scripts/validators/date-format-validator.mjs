import {
  createReporter,
  getTrackedFiles,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Date format validator");
const trackedFiles = getTrackedFiles();

const formattingSource = readFile("packages/typescript/ui/src/formatting.ts");
for (const helper of [
  "formatDisplayDate",
  "formatIndiaDate",
  "formatUsShortDate",
  "formatUsLongDate",
  "formatIndiaDateWithTime",
  "formatIndiaDayMonthTime",
  "formatIndiaDateTime",
]) {
  reporter.assert(
    new RegExp(`export function ${helper}\\b`).test(formattingSource),
    `@letbuyy/ui/formatting must export ${helper}`,
  );
}

const localDateFormatterOffenders = trackedFiles.filter((file) => {
  if (!file.startsWith("apps/")) return false;
  if (!/\.(?:ts|tsx)$/.test(file)) return false;

  const source = readFile(file);
  return /\b(?:function|const)\s+format(?:Short)?Date(?:Time)?\b/.test(source);
});

reporter.assert(
  localDateFormatterOffenders.length === 0,
  `apps must import date display helpers from @letbuyy/ui/formatting instead of declaring local formatDate helpers: ${localDateFormatterOffenders.join(", ")}`,
);

for (const file of [
  "apps/merchant_web/src/app/[store]/orders/page.tsx",
  "apps/merchant_web/src/app/[store]/settings/billing/page.tsx",
  "apps/merchant_web/src/app/[store]/settings/plan/page.tsx",
  "apps/admin_web/src/lib/console-api.ts",
  "apps/platform-operations-portal/src/app/(dashboard)/operations/onboarding/page.tsx",
  "apps/app-marketplace/src/app/(store)/apps/[slug]/page.tsx",
]) {
  reporter.assert(
    readFile(file).includes("@letbuyy/ui/formatting"),
    `${file} must use the canonical shared date formatting helpers`,
  );
}

reporter.finish("date display formatting is single-sourced through @letbuyy/ui/formatting");
