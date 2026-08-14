import {
  createReporter,
  getTrackedFiles,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Legacy site type validator");
const trackedFiles = getTrackedFiles();

const tenantCore = readFile("packages/tenant-core/src/index.ts");
reporter.assert(
  /ACTIVE_SITE_TYPES\s*=\s*\['store'\]/.test(tenantCore) &&
    /COMING_SOON_SITE_TYPES\s*=\s*\['blog', 'landing'\]/.test(tenantCore),
  "tenant-core must keep only store active and classify blog/landing as launch-disabled",
);
reporter.assert(
  /LEGACY_SITE_TYPES\s*=\s*\['portfolio', 'resume'\]/.test(tenantCore),
  "tenant-core must explicitly classify portfolio/resume as legacy site types",
);
reporter.assert(
  tenantCore.includes("legacySiteTypeCreationEnabled"),
  "tenant-core must expose the legacy site-type creation flag parser",
);

const gatewayStores = readFile("services/api-gateway/src/routes/stores.ts");
reporter.assert(
  gatewayStores.includes("isLegacySiteType(body.site_type)") &&
    gatewayStores.includes("LEGACY_SITE_TYPE_DISABLED") &&
    gatewayStores.includes("LETBUYY_ENABLE_LEGACY_SITE_TYPES"),
  "gateway store creation must reject portfolio/resume unless the legacy flag is enabled",
);

const gatewayOnboarding = readFile("services/api-gateway/src/routes/onboarding.ts");
for (const marker of [
  "isLegacySiteType(body.site_type)",
  "isLegacySiteType(nextSiteType)",
  "isLegacySiteType(attemptSiteType)",
  "isLegacySiteType(siteType)",
  "LEGACY_SITE_TYPE_DISABLED",
]) {
  reporter.assert(
    gatewayOnboarding.includes(marker),
    `gateway onboarding must guard legacy site types at ${marker}`,
  );
}

const identityCreateStore = readFile("apps/identity-platform/src/app/api/auth/create-store/route.ts");
const identityOnboarding = readFile("apps/identity-platform/src/app/onboarding/page.tsx");
reporter.assert(
  identityCreateStore.includes("ACTIVE_SITE_TYPES = ['store']") &&
    identityCreateStore.includes("COMING_SOON_SITE_TYPES = ['landing', 'blog']") &&
    identityCreateStore.includes("LEGACY_SITE_TYPES = ['portfolio', 'resume']") &&
    identityCreateStore.includes("legacySiteTypesEnabled"),
  "identity create-store route must keep unavailable site types out of default creation",
);
for (const [fileName, source] of [
  ["services/api-gateway/src/routes/stores.ts", gatewayStores],
  ["services/api-gateway/src/routes/onboarding.ts", gatewayOnboarding],
  ["apps/identity-platform/src/app/api/auth/create-store/route.ts", identityCreateStore],
  ["apps/identity-platform/src/app/onboarding/page.tsx", identityOnboarding],
]) {
  reporter.assert(
    !/site creation is coming soon|Landing pages and blogs are coming soon|Coming soon/.test(source),
    `${fileName} must not advertise launch-disabled site types as coming soon`,
  );
  reporter.assert(
    source.includes("not enabled for publication"),
    `${fileName} must describe launch-disabled site types as not enabled for publication`,
  );
}

const defaultIdentityTypes = identityOnboarding.match(/const SITE_TYPES:[\s\S]*?\]\n\nconst LEGACY_SITE_TYPES/);
reporter.assert(
  Boolean(defaultIdentityTypes) &&
    !defaultIdentityTypes?.[0].includes("portfolio") &&
    !defaultIdentityTypes?.[0].includes("resume") &&
    defaultIdentityTypes?.[0].includes("availability: 'launch-disabled'"),
  "identity onboarding default SITE_TYPES must not include portfolio/resume",
);
reporter.assert(
  identityOnboarding.includes("NEXT_PUBLIC_LETBUYY_ENABLE_LEGACY_SITE_TYPES") &&
    identityOnboarding.includes("ACQUISITION_SITE_TYPES"),
  "identity onboarding must gate legacy site-type UI behind the public legacy flag",
);

for (const file of [
  "apps/merchant-control-plane/src/app/launching-soon/page.tsx",
  "apps/storefront-runtime/src/components/coming-soon/components/landing/landing-coming-soon.tsx",
  "apps/storefront-runtime/src/components/coming-soon/components/portfolio/portfolio-coming-soon.tsx",
  "apps/storefront-runtime/src/components/coming-soon/components/resume/resume-coming-soon.tsx",
]) {
  const source = readFile(file);
  reporter.assert(
    !/launching soon|check back soon/i.test(source),
    `${file} must not promise launch timing from draft/gated storefront defaults`,
  );
  reporter.assert(
    /not open(?: to shoppers)? yet/i.test(source),
    `${file} must describe draft/gated storefront defaults as not open yet`,
  );
}

for (const file of [
  "apps/storefront-runtime/src/components/coming-soon/components/store/store-coming-soon.tsx",
  "apps/storefront-runtime/src/components/coming-soon/components/landing/landing-coming-soon.tsx",
  "apps/storefront-runtime/src/components/coming-soon/components/portfolio/portfolio-coming-soon.tsx",
  "apps/storefront-runtime/src/components/coming-soon/components/resume/resume-coming-soon.tsx",
  "apps/storefront-runtime/src/components/coming-soon/components/blog/blog-coming-soon.tsx",
]) {
  const source = readFile(file);
  reporter.assert(
    !source.includes("setDate(d.getDate() + 14)"),
    `${file} must not fabricate a launch date when no launchDate is supplied`,
  );
  reporter.assert(
    !/(10K\+|99\.9%|<50ms|2,400\+|150\+|4\.9|50\+|12K|Weekly|Senior Developer|StartupXYZ|Tech Corp|SOON|Launch Rewards|Scale Infinitely|Global CDN|Waitlist|First post incoming)/.test(source),
    `${file} must not ship fabricated launch metrics, sample resume history, or future-state badges`,
  );
}

const marketingCreate = readFile("apps/marketing-site/src/app/[locale]/create/page.tsx");
reporter.assert(
  marketingCreate.indexOf("NEXT_PUBLIC_LETBUYY_ENABLE_LEGACY_SITE_TYPES") !== -1 &&
    marketingCreate.indexOf("portfolio") > marketingCreate.indexOf("NEXT_PUBLIC_LETBUYY_ENABLE_LEGACY_SITE_TYPES") &&
    marketingCreate.indexOf("resume") > marketingCreate.indexOf("NEXT_PUBLIC_LETBUYY_ENABLE_LEGACY_SITE_TYPES"),
  "marketing create page must expose portfolio/resume only behind the public legacy flag",
);

const marketingSiteTypes = readFile("apps/marketing-site/src/components/SiteTypes.tsx");
reporter.assert(
  marketingSiteTypes.indexOf("NEXT_PUBLIC_LETBUYY_ENABLE_LEGACY_SITE_TYPES") !== -1 &&
    marketingSiteTypes.indexOf("id: 'portfolio'") > marketingSiteTypes.indexOf("NEXT_PUBLIC_LETBUYY_ENABLE_LEGACY_SITE_TYPES") &&
    marketingSiteTypes.indexOf("id: 'resume'") > marketingSiteTypes.indexOf("NEXT_PUBLIC_LETBUYY_ENABLE_LEGACY_SITE_TYPES"),
  "marketing capabilities must expose portfolio/resume only behind the public legacy flag",
);

const publicMarketingCopyOffenders = trackedFiles.filter((file) => {
  if (!file.startsWith("apps/marketing-site/src/")) return false;
  if (!/\.(?:ts|tsx)$/.test(file)) return false;
  if (
    file === "apps/marketing-site/src/app/[locale]/create/page.tsx" ||
    file === "apps/marketing-site/src/components/SiteTypes.tsx"
  ) {
    return false;
  }
  return /\b(?:portfolio|resume|CV|PDF export)\b/i.test(readFile(file));
});
reporter.assert(
  publicMarketingCopyOffenders.length === 0,
  `Default marketing source must not advertise legacy portfolio/resume acquisition: ${publicMarketingCopyOffenders.join(", ")}`,
);

const developerSurface = readFile("apps/developer-portal/src/lib/developer-surface.ts");
reporter.assert(
  developerSurface.includes("legacy site types only") &&
    developerSurface.includes("New portfolio acquisition is gated") &&
    developerSurface.includes("New resume acquisition is gated"),
  "developer portal must mark portfolio/resume API surfaces as legacy-gated",
);

const merchantNavigation = readFile("apps/merchant-control-plane/src/components/merchantNavigation.ts");
reporter.assert(
  !merchantNavigation.includes("ats-score") && !merchantNavigation.includes("PDF export"),
  "merchant resume navigation must not expose deleted ATS/PDF-export stub routes",
);

for (const file of [
  "config/env/templates/next-app.env.example",
  "config/env/templates/worker.env.example",
  "config/env/schemas/next-app.schema.json",
  "config/env/schemas/worker.schema.json",
  "docs/governance/feature-flag-governance.md",
  "docs/governance/domain-governance.md",
]) {
  reporter.assert(
    readFile(file).includes("LETBUYY_ENABLE_LEGACY_SITE_TYPES"),
    `${file} must document the legacy site-type flag`,
  );
}

reporter.finish("legacy portfolio/resume acquisition is default-off and documented");
