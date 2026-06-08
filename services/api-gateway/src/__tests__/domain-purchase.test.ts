import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createDomainRegistrarProvider } from '../lib/registrar';

function repositorySource(path: string): string {
    return readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8');
}

const routeSource = readFileSync(new URL('../routes/domains.ts', import.meta.url), 'utf8');
const sharedTypes = repositorySource('packages/shared-types/src/index.ts');
const tsClient = repositorySource('packages/typescript/api-client/src/index.ts');
const dartClient = repositorySource('packages/dart/api_client/lib/src/api_client.dart');
const mobileService = repositorySource('apps/mobile/merchant-app/lib/services/custom_domains.dart');
const mobileScreen = repositorySource('apps/mobile/merchant-app/lib/screens/settings/domain_settings_screen.dart');
const bffSource = repositorySource('services/mobile-bff/src/index.ts');

test('mock registrar verifies the sandbox buy-domain checkout path', async () => {
    const provider = createDomainRegistrarProvider({
        APP_ENV: 'development',
        REGISTRAR_PROVIDER: 'mock',
        REGISTRAR_MOCK_ENABLED: 'true',
        REGISTRAR_DEFAULT_CURRENCY: 'INR',
    });

    const quote = await provider.searchDomain('demo.in');
    assert.equal(quote.available, true);
    assert.equal(quote.amountMinor, 79900);
    assert.equal(quote.provider, 'mock');

    const purchase = await provider.purchaseDomain({
        domain: quote.domain,
        years: 1,
        owner: { name: 'Demo Merchant', email: 'merchant@example.com' },
        paymentReference: 'sandbox:domain_checkout:site_1:demo.in',
        idempotencyKey: 'domain-order:site_1:demo.in',
    });
    const dns = await provider.configureDns(quote.domain, 'cname.letbuyy.test');

    assert.equal(purchase.registrarOrderId, 'mock-domain-order:site_1:demo.in');
    assert.equal(dns.configured, true);
    assert.equal(dns.raw.target, 'cname.letbuyy.test');
});

test('domain purchase route records checkout, registrar, DNS, and Vercel evidence', () => {
    assert.match(routeSource, /router\.post\('\/purchase'/);
    assert.match(routeSource, /checkout_mode:\s*z\.enum\(\['sandbox', 'external_reference'\]\)/);
    assert.match(routeSource, /\.from\('domain_orders'\)[\s\S]*\.upsert\(/);
    assert.match(routeSource, /provider\.searchDomain\(domain\)/);
    assert.match(routeSource, /provider\.purchaseDomain\(/);
    assert.match(routeSource, /provider\.configureDns\(domain,\s*target\)/);
    assert.match(routeSource, /attachVercelProjectDomain\(c\.env,\s*domain\)/);
    assert.match(routeSource, /checkout:\s*\{[\s\S]*status:\s*checkoutStatus/);
    assert.match(routeSource, /DOMAIN_CHECKOUT_MODE_UNAVAILABLE/);
    assert.doesNotMatch(routeSource, /REGISTRAR_API_URL is required/);
});

test('shared clients and mobile app expose the verified buy-domain checkout flow', () => {
    assert.match(sharedTypes, /DomainAvailabilityQuoteSchema/);
    assert.match(sharedTypes, /DomainPurchaseResultSchema/);
    assert.match(tsClient, /readonly domains = \{/);
    assert.match(tsClient, /purchase:\s*\(input: DomainPurchaseInput/);
    assert.match(dartClient, /late final DomainsApi domains = DomainsApi\(this\)/);
    assert.match(dartClient, /Future<JsonMap> purchase\(JsonMap input/);
    assert.match(bffSource, /'\/v1\/domains'/);
    assert.match(mobileService, /_api\.domains\.search/);
    assert.match(mobileService, /_api\.domains\.purchase/);
    assert.match(mobileService, /checkoutVerified/);
    assert.match(mobileScreen, /Domain purchase could not complete/);
    assert.doesNotMatch(mobileScreen, /Could not buy domain: \$error/);
});
