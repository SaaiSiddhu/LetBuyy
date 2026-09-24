import {
  createReporter,
  getTrackedFiles,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("INR currency format validator");
const trackedFiles = getTrackedFiles();

const uiPackage = readJson("packages/typescript/ui/package.json");
reporter.assert(
  uiPackage?.exports?.["./formatting"] === "./src/formatting.ts",
  "@letbuyy/ui must expose the browser-safe formatting subpath",
);

const formattingSource = readFile("packages/typescript/ui/src/formatting.ts");
reporter.assert(
  /export function formatInrCurrency\b/.test(formattingSource),
  "@letbuyy/ui/formatting must own the canonical formatInrCurrency helper",
);
reporter.assert(
  /new Intl\.NumberFormat\('en-IN'/.test(formattingSource) && /currency:\s*'INR'/.test(formattingSource),
  "formatInrCurrency must keep the India-first INR display contract",
);

const localCurrencyOffenders = trackedFiles.filter((file) => {
  if (!file.startsWith("apps/")) return false;
  if (!/\.(?:ts|tsx)$/.test(file)) return false;
  return /\b(?:function|const)\s+formatCurrency\b/.test(readFile(file));
});
reporter.assert(
  localCurrencyOffenders.length === 0,
  `apps must import formatInrCurrency instead of declaring local formatCurrency helpers: ${localCurrencyOffenders.join(", ")}`,
);

for (const file of [
  "apps/merchant/web/src/app/[store]/customers/page.tsx",
  "apps/merchant/web/src/app/[store]/analytics/page.tsx",
  "apps/merchant/web/src/app/[store]/dashboard/page.tsx",
  "apps/merchant/web/src/app/[store]/dashboard/DashboardClient.tsx",
  "apps/merchant/web/src/app/[store]/products/gift-cards/page.tsx",
  "apps/frozen/app-store/src/app/(store)/apps/[slug]/page.tsx",
]) {
  reporter.assert(
    readFile(file).includes("formatInrCurrency"),
    `${file} must use the canonical INR currency formatter`,
  );
}

reporter.finish("INR display currency formatting is single-sourced through @letbuyy/ui/formatting");
