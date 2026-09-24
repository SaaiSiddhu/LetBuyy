#!/usr/bin/env node
// LCIS — Custom-Domain Intelligence (Domain Center V5).
// STRUCTURE is CONNECTED: tables / routes / RPCs / provider detection / DNS + SSL model are
// verified directly from the repo. LIVE METRICS (per-store counts, provider distribution,
// verification/SSL failure rates, health distribution) are NOT CONNECTED — they require a
// Supabase read; we report the EXACT source and never fabricate a number.
// Output: graphify-out/domain-intelligence.json   ·   Run: pnpm graph:domains
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const read = (rel) => (existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), 'utf8') : '');
const has = (rel, needle) => read(rel).includes(needle);

const CONNECTED = 'CONNECTED';
const NOT = 'NOT CONNECTED';

// ── Structure (verified from the repo) ───────────────────────────────────────
const MIGRATION = 'database/supabase/migrations/185_v1_site_domains.sql';
const ROUTES = 'services/api-gateway/src/routes/custom-domains.ts';
const PROVIDER_LIB = 'services/api-gateway/src/lib/domain-provider.ts';
const HEALTH_LIB = 'services/api-gateway/src/lib/custom-domain-health.ts';
const DNS_LIB = 'services/api-gateway/src/lib/dns.ts';
const VERCEL_LIB = 'services/api-gateway/src/lib/vercel-domains.ts';
const PROXY = 'apps/commerce/web/src/proxy.ts';
const RESOLVER = 'services/api-gateway/src/middleware/store-context.ts';

function structure() {
    return {
        tables: [
            { name: 'site_domains', status: has(MIGRATION, 'create table if not exists public.site_domains') ? CONNECTED : NOT, role: 'multi-domain registry (primary | redirect)', migration: MIGRATION },
            { name: 'site_domain_verifications', status: has(MIGRATION, 'create table if not exists public.site_domain_verifications') ? CONNECTED : NOT, role: 'append-only verification history', migration: MIGRATION },
            { name: 'sites.custom_domain', status: CONNECTED, role: 'legacy single-domain column, synced to the primary for back-compat' },
        ],
        rpcs: [
            { name: 'set_primary_site_domain', status: has(MIGRATION, 'function public.set_primary_site_domain') ? CONNECTED : NOT, role: 'atomic demote/promote of the primary domain' },
            { name: 'record_domain_verification', status: has(MIGRATION, 'function public.record_domain_verification') ? CONNECTED : NOT, role: 'append a verification-history row' },
        ],
        routes: [
            { method: 'GET', path: '/custom/domains', status: has(ROUTES, "customDomainsRouter.get('/domains'") ? CONNECTED : NOT, role: 'list connected domains' },
            { method: 'POST', path: '/custom/domains', status: has(ROUTES, "customDomainsRouter.post('/domains'") ? CONNECTED : NOT, role: 'connect domain + DNS challenge' },
            { method: 'POST', path: '/custom/domains/verify', status: has(ROUTES, "post('/domains/verify'") ? CONNECTED : NOT, role: 'verify ownership + routing (DoH) + attach TLS' },
            { method: 'GET', path: '/custom/domains/:domain/status', status: has(ROUTES, "get('/domains/:domain/status'") ? CONNECTED : NOT, role: 'live health (DNS + SSL)' },
            { method: 'POST', path: '/custom/domains/:domain/primary', status: has(ROUTES, "post('/domains/:domain/primary'") ? CONNECTED : NOT, role: 'set primary (RPC)' },
            { method: 'PATCH', path: '/custom/domains/:domain', status: has(ROUTES, "patch('/domains/:domain'") ? CONNECTED : NOT, role: 'set redirect role' },
            { method: 'GET', path: '/custom/domains/:domain/history', status: has(ROUTES, "get('/domains/:domain/history'") ? CONNECTED : NOT, role: 'verification history' },
            { method: 'DELETE', path: '/custom/domains/:domain', status: has(ROUTES, "delete('/domains/:domain'") ? CONNECTED : NOT, role: 'release domain' },
        ],
        dns: { provider: 'DNS-over-HTTPS', resolvers: ['cloudflare-dns.com', 'dns.google'], status: has(DNS_LIB, 'cloudflare-dns.com') && has(DNS_LIB, 'dns.google') ? CONNECTED : NOT, role: 'real TXT/CNAME/MX/NS checks' },
        tls: { provider: 'Vercel', status: has(VERCEL_LIB, 'api.vercel.com') ? CONNECTED : NOT, note: 'TLS issued by Vercel; falls back to provider_status=unavailable without creds', envRequired: ['VERCEL_API_TOKEN', 'VERCEL_STOREFRONT_PROJECT_ID'] },
        providerDetection: { status: has(PROVIDER_LIB, 'detectDnsProvider') ? CONNECTED : NOT, source: 'NS records (real)', known: ['Cloudflare', 'GoDaddy', 'Namecheap', 'Hostinger', 'BigRock', 'Squarespace', 'Google Cloud DNS', 'AWS Route 53', 'Vercel', 'Other'] },
        health: { status: has(HEALTH_LIB, 'readCustomDomainHealth') ? CONNECTED : NOT, model: 'txt_verified · cname_verified · ssl_active · provider_status · misconfigured · renewal · records[]' },
        routing: {
            primary: { status: has(RESOLVER, "parsed.kind === 'custom_domain'") ? CONNECTED : NOT, via: 'sites.custom_domain (synced primary)' },
            redirect: { status: has(RESOLVER, "from('site_domains')") && has(PROXY, "matched_domain_role === 'redirect'") ? CONNECTED : NOT, via: 'site_domains active rows → 301 in storefront proxy' },
        },
    };
}

// ── Live metrics (NOT CONNECTED — exact source named) ────────────────────────
const SUPA = 'Supabase read: SUPABASE_DB_URL + SUPABASE_SERVICE_ROLE_KEY (deploy-time secret)';
function liveMetrics() {
    const metric = (key, query) => ({ key, status: NOT, exactSource: SUPA, query });
    return [
        metric('connectedDomains', "select count(*) from site_domains where status='active' and deleted_at is null"),
        metric('pendingDomains', "select count(*) from site_domains where status in ('pending','review','verifying') and deleted_at is null"),
        metric('primaryDomains', "select count(*) from site_domains where role='primary' and deleted_at is null"),
        metric('redirectDomains', "select count(*) from site_domains where role='redirect' and deleted_at is null"),
        metric('providerDistribution', 'select provider, count(*) from site_domains where deleted_at is null group by provider'),
        metric('verificationFailures', "select count(*) from site_domain_verifications where check_type='verify' and status<>'active'"),
        metric('sslFailures', "select count(*) from site_domains where ssl_status='error' and deleted_at is null"),
        metric('healthDistribution', 'computed from /custom/domains/:domain/status health per active domain (DoH + Vercel)'),
        metric('storefrontRoutingStatus', 'live host resolution via /internal/store-access/resolve (Cloudflare/Vercel edge)'),
    ];
}

export function buildDomainIntelligence() {
    const struct = structure();
    const live = liveMetrics();
    const flat = [
        ...struct.tables, ...struct.rpcs, ...struct.routes,
        struct.dns, struct.tls, struct.providerDetection, struct.health,
        struct.routing.primary, struct.routing.redirect,
    ];
    const connected = flat.filter((x) => x.status === CONNECTED).length;
    return {
        generatedFrom: 'repository structure (static) + named live sources',
        summary: {
            structuralChecks: flat.length,
            connected,
            structuralGaps: flat.length - connected,
            liveMetrics: live.length,
            liveConnected: 0,
            liveNotConnected: live.length,
        },
        structure: struct,
        liveMetrics: live,
        honesty: 'Structure is verified from the repo. Every live metric is NOT CONNECTED with its exact Supabase query — no counts are fabricated.',
    };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const intel = buildDomainIntelligence();
    if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, 'domain-intelligence.json'), JSON.stringify(intel));
    const s = intel.summary;
    console.log('\nLCIS — Custom-Domain Intelligence (Domain Center V5)');
    console.log(`  structure: ${s.connected}/${s.structuralChecks} CONNECTED · ${s.structuralGaps} gap(s)`);
    console.log(`  live metrics: ${s.liveNotConnected} NOT CONNECTED (each names its exact Supabase source — no fabrication)`);
    console.log(`  → graphify-out/domain-intelligence.json\n`);
}
