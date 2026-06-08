import {
  createReporter,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Registrar provider validator");

const provider = readFile("services/api-gateway/src/lib/registrar/index.ts");
const route = readFile("services/api-gateway/src/routes/domains.ts");
const index = readFile("services/api-gateway/src/index.ts");
const migration = readFile("database/supabase/migrations/090_custom_domains_and_store_access.sql");
const singleWriter = readFile("scripts/validators/single-writer-ownership-validator.mjs");
const merchant = readFile("apps/merchant-control-plane/src/app/[store]/settings/domains/page.tsx");
const mobile = readFile("apps/mobile/merchant-app/lib/services/custom_domains.dart");

for (const fragment of [
  "DomainRegistrarProvider",
  "ResellerClubRegistrarProvider",
  "OpenSrsRegistrarProvider",
  "MockRegistrarProvider",
  "REGISTRAR_PROVIDER",
  "REGISTRAR_API_KEY",
  "REGISTRAR_MOCK_FORBIDDEN",
]) {
  reporter.assert(provider.includes(fragment), `registrar provider missing ${fragment}`);
}

for (const fragment of [
  "router.get('/search'",
  "router.post('/purchase'",
  "domain_orders",
  "createDomainRegistrarProvider",
  "attachVercelProjectDomain",
  "payment_provider: 'razorpay'",
]) {
  reporter.assert(route.includes(fragment), `domain purchase route missing ${fragment}`);
}

reporter.assert(index.includes("api.route('/domains', domainsRouter)"), "gateway must mount /domains router");
reporter.assert(migration.includes("CREATE TABLE IF NOT EXISTS public.domain_orders"), "migration must create domain_orders");
reporter.assert(singleWriter.includes("domain_orders"), "single-writer validator must govern domain_orders");
reporter.assert(merchant.includes("Buy a domain") && merchant.includes("gatewayUrl('/domains/purchase')"), "merchant UI must expose buy-a-domain flow");
reporter.assert(mobile.includes("searchDomainToBuy") && mobile.includes("purchaseDomain"), "mobile service must expose buy-a-domain flow");

reporter.finish("registrar buy-a-domain provider flow is wired through gateway");
