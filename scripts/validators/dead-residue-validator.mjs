import {
  createReporter,
  exists,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Dead residue validator");

const envFiles = [
  "config/env/staging.env.example",
  "config/env/production.env.example",
  "config/env/staging.env.template",
  "config/env/production.env.template",
];

const workflowFiles = [
  ".github/workflows/deploy-staging.yml",
  ".github/workflows/staging-deploy.yml",
  ".github/workflows/production-deploy.yml",
  "config/vercel/projects.json",
];

const forbiddenVercelProjectPattern = /\bVERCEL_PROJECT_ID_[A-Z0-9_]+\b/;

for (const file of [...envFiles, ...workflowFiles]) {
  const source = readFile(file);
  reporter.assert(
    !forbiddenVercelProjectPattern.test(source),
    `${file} must not use orphaned VERCEL_PROJECT_ID_* names; use STAGING_*_PROJECT_ID or PRODUCTION_*_PROJECT_ID`,
  );
}

const stagingProjectIds = [
  "STAGING_MARKETING_PROJECT_ID",
  "STAGING_IDENTITY_PROJECT_ID",
  "STAGING_MERCHANT_PROJECT_ID",
  "STAGING_STOREFRONT_PROJECT_ID",
  "STAGING_APP_MARKETPLACE_PROJECT_ID",
  "STAGING_DEVELOPER_PORTAL_PROJECT_ID",
  "STAGING_THEME_MARKETPLACE_PROJECT_ID",
  "STAGING_PLATFORM_CONSOLE_PROJECT_ID",
  "STAGING_PLATFORM_OPERATIONS_PORTAL_PROJECT_ID",
];

const productionProjectIds = stagingProjectIds.map((name) => name.replace("STAGING_", "PRODUCTION_"));

for (const file of ["config/env/staging.env.example", "config/env/staging.env.template"]) {
  const source = readFile(file);
  for (const name of stagingProjectIds) {
    reporter.assert(source.includes(name), `${file} must document ${name}`);
  }
}

for (const file of ["config/env/production.env.example", "config/env/production.env.template"]) {
  const source = readFile(file);
  for (const name of productionProjectIds) {
    reporter.assert(source.includes(name), `${file} must document ${name}`);
  }
}

const forbiddenEmptyProofDirs = [
  "apps/merchant-control-plane/src/app/codex-theme-editor-empty-proof",
  "apps/merchant-control-plane/src/app/__codex-theme-editor-empty-proof",
];

for (const dir of forbiddenEmptyProofDirs) {
  reporter.assert(!exists(dir), `${dir} must not remain as empty route residue`);
}

reporter.finish("orphaned env names and empty route residue checked");
