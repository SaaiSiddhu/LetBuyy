import {
  createReporter,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Custom domain abuse screening validator");

const abuse = readFile("services/api-gateway/src/lib/custom-domain-abuse.ts");
const route = readFile("services/api-gateway/src/routes/custom-domains.ts");
const migration = readFile("database/supabase/migrations/090_custom_domains_and_store_access.sql");
const singleWriter = readFile("scripts/validators/single-writer-ownership-validator.mjs");

for (const fragment of [
  "PROTECTED_BRANDS",
  "STATIC_BLOCKLIST_FRAGMENTS",
  "levenshtein",
  "ABUSE_REPUTATION_API_URL",
  "ABUSE_REPUTATION_API_KEY",
  "action:",
  "'review'",
  "'reject'",
]) {
  reporter.assert(abuse.includes(fragment), `abuse screening helper missing ${fragment}`);
}

for (const fragment of [
  "screenCustomDomainClaim",
  "site_domain_reviews",
  "custom_domain_status: screening.action === 'review' ? 'review' : 'pending'",
  "DOMAIN_ABUSE_REJECTED",
  "domain-reviews/:reviewId/decision",
]) {
  reporter.assert(route.includes(fragment), `custom-domain route missing abuse fragment ${fragment}`);
}

for (const fragment of [
  "CREATE TABLE IF NOT EXISTS public.site_domain_reviews",
  "site_domain_reviews service role only",
  "'review'::text",
]) {
  reporter.assert(migration.includes(fragment), `migration missing abuse-screening fragment ${fragment}`);
}
reporter.assert(singleWriter.includes("site_domain_reviews"), "single-writer validator must govern site_domain_reviews");

reporter.finish("custom-domain abuse screening is fail-safe and manually reviewable");
