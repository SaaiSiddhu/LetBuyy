import {
  createReporter,
  getTrackedFiles,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("CMS slugify validator");
const trackedFiles = getTrackedFiles();

const cmsCore = readFile("packages/cms-core/src/index.ts");
reporter.assert(
  /export function slugifyCmsTitle\b/.test(cmsCore),
  "cms-core must own the canonical slugifyCmsTitle helper",
);

const merchantPackage = readJson("apps/merchant/web/package.json");
reporter.assert(
  merchantPackage?.dependencies?.["@letbuyy/cms-core"] === "workspace:*",
  "merchant-web must declare @letbuyy/cms-core before importing CMS helpers",
);

const merchantManifest = readJson("apps/merchant/web/runtime.manifest.json");
reporter.assert(
  merchantManifest?.allowedDependencies?.workspacePackages?.includes("@letbuyy/cms-core"),
  "merchant-web runtime manifest must allow @letbuyy/cms-core",
);

const localSlugifyOffenders = trackedFiles.filter((file) => {
  if (!file.startsWith("apps/merchant/web/src/")) return false;
  if (!/\.(?:ts|tsx)$/.test(file)) return false;
  return /\b(?:function|const)\s+slugify\b/.test(readFile(file));
});
reporter.assert(
  localSlugifyOffenders.length === 0,
  `merchant-web must import slugifyCmsTitle instead of declaring local slugify helpers: ${localSlugifyOffenders.join(", ")}`,
);

for (const file of [
  "apps/merchant/web/src/app/[store]/posts/page.tsx",
  "apps/merchant/web/src/app/[store]/pages/page.tsx",
  "apps/merchant/web/src/app/[store]/online-store/pages/page.tsx",
]) {
  reporter.assert(
    readFile(file).includes("slugifyCmsTitle as slugify"),
    `${file} must use the canonical cms-core slug helper`,
  );
}

reporter.finish("merchant CMS slug generation is single-sourced through @letbuyy/cms-core");
