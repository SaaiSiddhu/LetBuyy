import {
  createReporter,
  readFile,
  readJson,
} from './governance-common.mjs';

const reporter = createReporter('Production safety validator');

const rateLimitSource = readFile('services/api-gateway/src/middleware/rateLimit.ts');
for (const fragment of [
  'function unavailableRateLimitResult',
  'function unavailableQueryCostResult',
  'warnRateLimitFailClosed',
  "code: 'RATE_LIMIT_UNAVAILABLE'",
]) {
  reporter.assert(rateLimitSource.includes(fragment), `Rate limiter must fail closed with fragment: ${fragment}`);
}
for (const forbidden of ['failOpenRateLimitResult', 'failOpenQueryCostResult', 'failing open', 'fail OPEN']) {
  reporter.assert(!rateLimitSource.includes(forbidden), `Rate limiter must not preserve production fail-open path: ${forbidden}`);
}

const registrarSource = readFile('services/api-gateway/src/lib/registrar/index.ts');
reporter.assert(!registrarSource.includes('raw: { mock: true }'), 'Sandbox registrar must not emit mock:true runtime success payloads');
reporter.assert(registrarSource.includes("REGISTRAR_SANDBOX_ENABLED !== 'true'"), 'Sandbox registrar must remain explicitly gated off unless enabled outside production');

const allowlist = readJson('config/governance/anti-fabrication-allowlist.json');
reporter.assert(
  !(allowlist.entries || []).some((entry) => entry.ownerWave === 'Wave 3'),
  'Wave 3 anti-fabrication allowlist entries must be burned down',
);

const preflightSource = readFile('scripts/governance/foundation-production-safety-preflight.mjs');
for (const fragment of [
  "startsWith('SKIP_NEEDS_HUMAN_')",
  'RATE_LIMIT_BACKEND_READY',
  'RUNTIME_TELEMETRY_READY',
  'MONEY_LEDGER_RECONCILIATION_ALERT_READY',
]) {
  reporter.assert(preflightSource.includes(fragment), `Shared-env preflight must enforce: ${fragment}`);
}

const preflight = readJson('config/runtime/production-safety-preflight.json');
reporter.assert(preflight.codexProductionActionPolicy === 'SKIP-DEPLOY', 'Production safety preflight must keep shared-env applies human-only');
for (const skipId of ['SKIP-W0-PITR-TIER', 'SKIP-W3-SENTRY-DSN', 'SKIP-W3-DNS-CUTOVER']) {
  reporter.assert(
    preflight.classASkips?.some((skip) => skip.id === skipId),
    `Production safety preflight missing Class-A skip: ${skipId}`,
  );
}

const skipped = readFile('SKIPPED_HUMAN_DECISIONS.md');
for (const skipId of ['SKIP-W3-SENTRY-DSN', 'SKIP-W3-DNS-CUTOVER']) {
  reporter.assert(skipped.includes(skipId), `SKIPPED_HUMAN_DECISIONS.md missing ${skipId}`);
}

const brandSource = readFile('packages/shared-types/src/brand.ts');
const marketingLayout = readFile('apps/marketing-site/src/app/layout.tsx');
const brandHasUnfilledHumanFacts =
  brandSource.includes("name: ''") ||
  brandSource.includes("foundingDate: ''") ||
  brandSource.includes("wikidata: ''");
reporter.assert(
  !brandHasUnfilledHumanFacts || skipped.includes('SKIP-BRAND-LEGAL-FACTS'),
  'Blank public brand founder/profile/founding facts must be paired with SKIP-BRAND-LEGAL-FACTS',
);
reporter.assert(
  brandSource.includes('HUMAN-REQUIRED: SKIP-BRAND-LEGAL-FACTS'),
  'Brand source must label unfilled public identity facts as human-required',
);
reporter.assert(!brandSource.includes('TODO'), 'Brand source must not carry loose public identity TODOs');
reporter.assert(
  marketingLayout.includes('from "@letbuyy/shared-types"') &&
    marketingLayout.includes('buildBrandSameAs()') &&
    !marketingLayout.includes('const FOUNDER_NAME') &&
    !marketingLayout.includes('const FOUNDING_YEAR'),
  'Marketing structured data must consume canonical shared brand constants instead of local founder/profile duplicates',
);

for (const file of [
  'apps/marketing-site/src/lib/public-urls.ts',
  'apps/theme-marketplace/src/lib/public-urls.ts',
  'apps/app-marketplace/src/lib/site-url.ts',
  'apps/developer-portal/src/lib/site-url.ts',
]) {
  reporter.assert(
    readFile(file).includes("const DEFAULT_PLATFORM_ROOT_DOMAIN = 'letbuyy.com'"),
    `${file} must default to letbuyy.com until DNS cutover is human-approved`,
  );
}

reporter.finish('rate limiting, registrar, shared-env preflight, skips, and domain defaults checked');
