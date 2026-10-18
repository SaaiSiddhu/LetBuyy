// Canonical storefront reviews use the signed buyer session and verified buyer/store-customer link.
// Real worker, middleware, PostgREST and owned Postgres; service-role access is not an RLS proof.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test, { afterEach, before } from 'node:test';
import { issueCustomerSession, LETBUYY_CUSTOMER_SESSION_COOKIE, LETBUYY_STOREFRONT_SESSION_HEADER } from '@letbuyy/auth-core';
import { Gateway, gatewayEnv, mintSession, newBarrier, newIdentityKeys, seedBuyerAccount, tapRest, type IdentityKeys, type RestCall } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const { psql } = owned;
const site = newSyntheticTenant('buyer-reviews');
let keys: IdentityKeys;
let gateway: Gateway;
let productId: string;

before(async () => {
    keys = await newIdentityKeys();
    seedSyntheticTenant(psql, site);
    productId = crypto.randomUUID();
    psql(`INSERT INTO products (id,store_id,name,price,is_active,status) VALUES ('${productId}','${site.siteId}','Synthetic review product',19.99,true,'active');`);
    // The local-only bypass is accepted by the real Turnstile verifier only in an explicitly local runtime.
    gateway = new Gateway(gatewayEnv(owned, keys, { ENVIRONMENT: 'development', CUSTOMER_SESSION_SECRET: 'synthetic-review-customer-session-secret' }));
});
afterEach(async () => { await gateway.settle(); });

async function headers(buyerId: string, siteId = site.siteId) {
    return {
        [LETBUYY_STOREFRONT_SESSION_HEADER]: await mintSession(keys, buyerId, {
            audience: 'letbuyy:storefront-session', tokenUse: 'storefront_session', epoch: 1,
            extraClaims: { site_id: siteId },
        }),
        'Content-Type': 'application/json',
    };
}
const url = (siteId = site.siteId) => `/v1/storefront/buyer/reviews?store_id=${siteId}`;
function link(buyerId: string) {
    return psql(`SELECT link_buyer_store_customer('${buyerId}'::uuid,'${site.siteId}'::uuid)::text;`);
}
function submit(body: Record<string, unknown> = {}) {
    return JSON.stringify({ product_id: productId, rating: 5, turnstile_token: 'dev-bypass-token', ...body });
}

// Empty-only maintenance controls run before any authored edge is created.
const migration357 = readFileSync('database/supabase/migrations/357_buyer_review_ownership.sql', 'utf8');
const rollback357 = readFileSync('database/supabase/rollback/357_buyer_review_ownership.rollback.sql', 'utf8');
const family357 = ['create_storefront_buyer_review_v1', 'protect_buyer_review_link_v1'];
const sqlQuote = (value: unknown) => "'" + String(value).replaceAll("'", "''") + "'";
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
function maintenanceState357(): string {
    const edgeExists = owned.psql("SELECT to_regclass('public.buyer_review_links') IS NOT NULL;") === 't';
    const edge = edgeExists ? owned.script("SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY review_id),'[]'::jsonb)::text FROM buyer_review_links e;") : 'absent';
    const metadata = owned.script(`SELECT jsonb_build_object(
      'functions',(SELECT jsonb_agg(jsonb_build_array(oid,proowner,proacl,pg_get_functiondef(oid)) ORDER BY oid) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=ANY(ARRAY[${family357.map(sqlQuote).join(',')}])),
      'relations',(SELECT jsonb_agg(jsonb_build_array(oid,relname,relowner,relacl,relrowsecurity,relforcerowsecurity) ORDER BY oid) FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN('buyer_review_links','product_reviews_buyer_ownership_key','store_customers_buyer_review_scope_key')),
      'journal',(SELECT jsonb_agg(to_jsonb(j) ORDER BY object_signature) FROM migration_privilege_journal j WHERE migration='357'),
      'roles',(SELECT jsonb_agg(jsonb_build_array(oid,rolname,rolsuper,rolcanlogin,rolbypassrls) ORDER BY oid) FROM pg_roles WHERE rolname IN('service_role','anon','authenticated','app_tenant')),
      'review_digest',(SELECT encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(r) ORDER BY id)::text,'[]'),'sha256'),'hex') FROM product_reviews r));`);
    return hash(JSON.stringify({ metadata, edge }));
}

test('357 empty rollback and reapply preserve legacy content and exact private runtime authority', async () => {
    await gateway.settle();
    const content = owned.psql("SELECT count(*) FROM product_reviews;");
    assert.equal(owned.psql('SELECT count(*) FROM buyer_review_links;'), '0');
    owned.script(rollback357);
    assert.equal(owned.psql("SELECT to_regclass('public.buyer_review_links') IS NULL;"), 't');
    assert.equal(owned.psql("SELECT count(*) FROM migration_privilege_journal WHERE migration='357';"), '0');
    owned.script(migration357);
    assert.equal(owned.psql('SELECT count(*) FROM product_reviews;'), content);
    assert.equal(owned.psql("SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid='public.buyer_review_links'::regclass;"), 't');
    assert.equal(owned.psql("SELECT has_function_privilege('service_role','public.create_storefront_buyer_review_v1(uuid,uuid,integer,uuid,integer,text,text)','EXECUTE');"), 't');
    assert.equal(owned.psql("SELECT count(*) FROM migration_privilege_journal WHERE migration='357';"), '3');
});

for (const family of family357) {
    test('357 rollback refuses an unknown overload of ' + family, () => {
        const args = family === 'protect_buyer_review_link_v1' ? 'integer' : '';
        owned.script(`CREATE FUNCTION public.${family}(${args}) RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;`);
        const before = maintenanceState357();
        try {
            assert.match(owned.psqlExpectError(rollback357), /rollback357 refuses unexpected ownership function family/);
            assert.equal(maintenanceState357(), before);
        } finally { owned.script(`DROP FUNCTION public.${family}(${args}) RESTRICT;`); }
    });
    test('357 forward refuses a preexisting ' + family + ' family without changing it', () => {
        owned.script(rollback357);
        const args = family === 'protect_buyer_review_link_v1' ? 'integer' : '';
        owned.script(`CREATE FUNCTION public.${family}(${args}) RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;`);
        const before = maintenanceState357();
        try {
            assert.match(owned.psqlExpectError(migration357), /migration357 refuses preexisting ownership schema, function family or provenance/);
            assert.equal(maintenanceState357(), before);
        } finally {
            owned.script(`DROP FUNCTION public.${family}(${args}) RESTRICT;`);
            owned.script(migration357);
        }
    });
}

const rollbackDrifts357 = [
    ['column shape', 'ALTER TABLE buyer_review_links ADD COLUMN synthetic_unknown text;'],
    ['column default', 'ALTER TABLE buyer_review_links ALTER COLUMN created_at SET DEFAULT now();'],
    ['function body/default', `CREATE OR REPLACE FUNCTION public.create_storefront_buyer_review_v1(p_buyer uuid,p_site uuid,p_epoch integer,p_product uuid,p_rating integer,p_title text,p_body text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$BEGIN RETURN '{}'::jsonb;END$$;`],
    ['function owner', 'ALTER FUNCTION public.create_storefront_buyer_review_v1(uuid,uuid,integer,uuid,integer,text,text) OWNER TO service_role;'],
    ['private ACL', 'GRANT UPDATE ON buyer_review_links TO service_role;'],
    ['role profile', 'ALTER ROLE service_role LOGIN;'],
    ['disabled immutable trigger', 'ALTER TABLE buyer_review_links DISABLE TRIGGER buyer_review_links_guard;'],
    ['external dependency', 'CREATE VIEW public.syn_review_dependency AS SELECT review_id FROM buyer_review_links;'],
    ['external routine', `CREATE FUNCTION public.syn_review_dependency() RETURNS bigint LANGUAGE plpgsql AS $$BEGIN RETURN(SELECT count(*) FROM public.buyer_review_links);END$$;`],
    ['provenance', "UPDATE migration_privilege_journal SET object_definition_hash=repeat('0',64) WHERE migration='357';"],
] as const;
for (const [label, change] of rollbackDrifts357) test('357 rollback refuses changed ' + label + ' before any retained authority is removed', () => {
    const before = maintenanceState357();
    assert.match(owned.psqlExpectError('BEGIN;' + change + rollback357), /rollback357 refuses/);
    assert.equal(maintenanceState357(), before, 'the failed transaction restores the exact source, grants and journal');
});

for (const [label, change] of [
    ['unknown schema', 'CREATE TABLE public.buyer_review_links(synthetic_unknown text);'],
    ['role profile', 'ALTER ROLE service_role SUPERUSER;'],
    ['default grants', 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticator;'],
] as const) test('357 forward refuses ' + label + ' before DDL', () => {
    owned.script(rollback357);
    const before = maintenanceState357();
    try {
        assert.match(owned.psqlExpectError('BEGIN;' + change + migration357), /migration357 refuses/);
        assert.equal(maintenanceState357(), before);
    } finally { owned.script(migration357); }
});

for (const direction of ['forward', 'rollback'] as const) test('357 ' + direction + ' refuses a stale or non-read-committed maintenance snapshot', () => {
    if (direction === 'forward') owned.script(rollback357);
    try {
        for (const isolation of ['REPEATABLE READ', 'SERIALIZABLE', 'READ UNCOMMITTED']) {
            const before = maintenanceState357();
            assert.match(owned.psqlExpectError('BEGIN ISOLATION LEVEL ' + isolation + ';SELECT count(*) FROM pg_proc;' + (direction === 'forward' ? migration357 : rollback357)), /357 refuses concurrent\/prepared writes or non-read-committed state/);
            assert.equal(maintenanceState357(), before);
        }
    } finally { if (direction === 'forward') owned.script(migration357); }
});

for (const kind of ['catalog', 'source'] as const) for (const direction of ['forward', 'rollback'] as const) test('357 ' + direction + ' refuses a natural uncommitted ' + kind + ' writer without a cooperative catalog lock', { timeout: 40000 }, async () => {
    if (direction === 'forward') owned.script(rollback357);
    const token = crypto.randomUUID().replaceAll('-', '');
    const table = 'syn_review_gate_' + token;
    const holderName = 'syn-review-hold-' + token;
    const creatorName = 'syn-review-create-' + token;
    const key = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000000 + 1000000000;
    const before = maintenanceState357();
    owned.script(`CREATE TABLE public.${table}(released boolean NOT NULL);INSERT INTO public.${table} VALUES(false);`);
    const holder = owned.psqlAsync(`BEGIN;SET LOCAL statement_timeout='20s';SET LOCAL application_name='${holderName}';SELECT pg_advisory_xact_lock(${key}::bigint);
      DO $$DECLARE deadline timestamptz:=clock_timestamp()+interval '15 seconds';BEGIN
       WHILE NOT(SELECT released FROM public.${table}) LOOP
        IF clock_timestamp()>deadline THEN RAISE EXCEPTION 'Synthetic review gate not released';END IF;PERFORM pg_sleep(0.01);
       END LOOP;END$$;COMMIT;`).then(() => null, (e: Error) => e);
    let creator: Promise<Error | null> | undefined;
    try {
        const deadline = Date.now() + 5000;
        while (owned.psql(`SELECT EXISTS(SELECT 1 FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.application_name='${holderName}' AND a.datname=current_database() AND l.locktype='advisory' AND l.objid=${key} AND l.granted);`) !== 't') {
            assert.ok(Date.now() < deadline); await new Promise(resolve => setTimeout(resolve, 25));
        }
        const statement = kind === 'catalog' ? `CREATE FUNCTION public.create_storefront_buyer_review_v1() RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;`
            : `UPDATE products SET name=name WHERE id='${productId}';`;
        creator = owned.psqlAsync(`BEGIN;SET LOCAL statement_timeout='20s';SET LOCAL application_name='${creatorName}';${statement}SELECT pg_advisory_xact_lock(${key}::bigint);${kind === 'catalog' ? 'COMMIT' : 'ROLLBACK'};`).then(() => null, (e: Error) => e);
        const creatorDeadline = Date.now() + 5000;
        while (owned.psql(`SELECT EXISTS(SELECT 1 FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.application_name='${creatorName}' AND a.datname=current_database() AND l.locktype='advisory' AND l.objid=${key} AND NOT l.granted)
          AND EXISTS(SELECT 1 FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.application_name='${creatorName}' AND l.locktype='transactionid' AND l.mode='ExclusiveLock' AND l.granted);`) !== 't') {
            assert.ok(Date.now() < creatorDeadline); await new Promise(resolve => setTimeout(resolve, 25));
        }
        assert.equal(owned.psql(`SELECT count(*) FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.application_name='${creatorName}' AND l.relation='pg_proc'::regclass AND l.granted;`), '0');
        assert.match(owned.psqlExpectError("SET statement_timeout='3s';" + (direction === 'forward' ? migration357 : rollback357)), /357 refuses concurrent\/prepared writes or non-read-committed state|canceling statement due to statement timeout/);
        assert.equal(maintenanceState357(), before, 'committed function/role/schema/data authority is conserved while the native writer remains invisible');
    } finally {
        owned.script(`UPDATE public.${table} SET released=true;`);
        const results = await Promise.all([holder, ...(creator ? [creator] : [])]);
        assert.ok(results.every(result => result === null));
        if (kind === 'catalog') owned.script('DROP FUNCTION public.create_storefront_buyer_review_v1() RESTRICT;');
        owned.script(`DROP TABLE public.${table};`);
        if (direction === 'forward') owned.script(migration357);
    }
});

test('357 paired reapply exposes the real typed RPC through the current PostgREST schema cache', { timeout: 15000 }, async () => {
    const buyer = seedBuyerAccount(psql, 'review-ready');
    const deadline = Date.now() + 10000;
    const statuses: number[] = [];
    for (;;) {
        let missingSchemaCache = false;
        const tap = tapRest(owned.restUrl, async (call, forward) => {
            const reply = await forward();
            if (call.resource === 'rpc/create_storefront_buyer_review_v1' && reply.status === 404) {
                const body = await reply.clone().json() as { code?: string };
                missingSchemaCache = body.code === 'PGRST202';
            }
            return reply;
        });
        let response: Awaited<ReturnType<Gateway['request']>>;
        try { response = await gateway.request(url(), { method: 'POST', headers: await headers(buyer.id), body: submit() }); }
        finally { tap.restore(); }
        statuses.push(response.status);
        await gateway.settle();
        if (response.status === 409 && response.json?.error?.code === 'STORE_ACCOUNT_NOT_LINKED') break;
        assert.equal(response.status, 500, 'unexpected readiness status: ' + JSON.stringify(statuses));
        assert.equal(missingSchemaCache, true, 'only the observed PGRST202 cache miss may be retried');
        assert.ok(Date.now() < deadline, 'typed RPC readiness did not recover: ' + JSON.stringify(statuses));
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(owned.psql(`SELECT count(*) FROM buyer_review_links WHERE buyer_account_id='${buyer.id}';`), '0');
});

test('a verified linked buyer creates a pending review with server-derived identity and no PII in the response', async () => {
    const buyer = seedBuyerAccount(psql, 'review-linked');
    assert.match(link(buyer.id), /linked/);
    const customerId = psql(`SELECT store_customer_id FROM buyer_store_customers WHERE buyer_account_id='${buyer.id}' AND site_id='${site.siteId}';`);
    psql(`UPDATE store_customers SET full_name='Synthetic Linked Buyer' WHERE id='${customerId}';`);

    const response = await gateway.request(url(), { method: 'POST', headers: await headers(buyer.id), body: submit({
        store_id: crypto.randomUUID(), customer_email: 'forged@example.invalid', customer_name: 'Forged', is_verified: false,
    }) });
    assert.equal(response.status, 201);
    assert.deepEqual(response.json?.data, { review: { id: response.json?.data.review.id, status: 'pending' }, message: 'Review submitted! It will appear after approval.' });
    assert.doesNotMatch(response.text, /forged@example|Synthetic Linked Buyer|@example\.invalid/);
    assert.equal(psql(`SELECT customer_email || '|' || customer_name || '|' || is_verified::text || '|' || is_approved::text || '|' || status FROM product_reviews WHERE id='${response.json?.data.review.id}';`), `${buyer.email}|Synthetic Linked Buyer|true|false|pending`);
});

test('unlinked, legacy-unverified and inactive store relationships cannot submit reviews', async () => {
    const unlinked = seedBuyerAccount(psql, 'review-unlinked');
    const noLink = await gateway.request(url(), { method: 'POST', headers: await headers(unlinked.id), body: submit() });
    assert.equal(noLink.status, 409);
    assert.match(noLink.text, /STORE_ACCOUNT_NOT_LINKED/);

    const legacy = seedBuyerAccount(psql, 'review-legacy');
    const legacyCustomer = crypto.randomUUID();
    psql(`INSERT INTO store_customers (id,store_id,email,status) VALUES ('${legacyCustomer}','${site.siteId}','${legacy.email}','active');`);
    psql(`INSERT INTO buyer_store_customers (buyer_account_id,store_customer_id,site_id,link_basis) VALUES ('${legacy.id}','${legacyCustomer}','${site.siteId}','legacy_unverified');`);
    assert.equal((await gateway.request(url(), { method: 'POST', headers: await headers(legacy.id), body: submit() })).status, 409);

    const inactive = seedBuyerAccount(psql, 'review-inactive');
    assert.match(link(inactive.id), /linked/);
    psql(`UPDATE store_customers SET status='disabled' WHERE id=(SELECT store_customer_id FROM buyer_store_customers WHERE buyer_account_id='${inactive.id}' AND site_id='${site.siteId}');`);
    const unavailable = await gateway.request(url(), { method: 'POST', headers: await headers(inactive.id), body: submit() });
    assert.equal(unavailable.status, 409);
    assert.match(unavailable.text, /STORE_ACCOUNT_UNAVAILABLE/);
});

test('reviews reject wrong-site sessions, untrusted identity, archived products and duplicate submissions', async () => {
    const buyer = seedBuyerAccount(psql, 'review-boundary');
    assert.match(link(buyer.id), /linked/);
    const auth = await headers(buyer.id);
    assert.equal((await gateway.request(url(crypto.randomUUID()), { method: 'POST', headers: auth, body: submit() })).status, 401);
    assert.equal((await gateway.request(url(), { method: 'POST', headers: auth, body: submit({ product_id: 'not-a-uuid' }) })).status, 400);

    const first = await gateway.request(url(), { method: 'POST', headers: auth, body: submit() });
    assert.equal(first.status, 201);
    const duplicate = await gateway.request(url(), { method: 'POST', headers: auth, body: submit() });
    assert.equal(duplicate.status, 409);

    const otherProduct = crypto.randomUUID();
    psql(`INSERT INTO products (id,store_id,name,price,is_active,status) VALUES ('${otherProduct}','${site.siteId}','Synthetic archived product',19.99,false,'archived');`);
    const archived = await gateway.request(url(), { method: 'POST', headers: auth, body: submit({ product_id: otherProduct }) });
    assert.equal(archived.status, 400);
    assert.equal(psql(`SELECT count(*) FROM product_reviews WHERE product_id='${otherProduct}';`), '0');
});

test('legacy anonymous identity cannot claim a verified badge, while a database-backed customer session can', async () => {
    const csrf = crypto.randomUUID();
    const csrfHeaders = { 'Content-Type': 'application/json', Cookie: `letbuyy_csrf=${csrf}`, 'X-CSRF-Token': csrf };
    const guestEmail = `guest-${crypto.randomUUID()}@example.invalid`;
    const guest = await gateway.request('/v1/storefront/reviews', {
        method: 'POST', headers: csrfHeaders,
        body: submit({ store_id: site.siteId, customer_email: guestEmail, customer_name: 'Synthetic Guest', is_verified: true }),
    });
    assert.equal(guest.status, 201);
    assert.equal(guest.text.includes(guestEmail), false);
    assert.doesNotMatch(guest.text, /Synthetic Guest/);
    assert.equal(psql(`SELECT is_verified::text FROM product_reviews WHERE customer_email='${guestEmail}';`), 'false');

    const customerId = crypto.randomUUID();
    const customerEmail = `session-${crypto.randomUUID()}@example.invalid`;
    psql(`INSERT INTO store_customers (id,store_id,email,full_name,status) VALUES ('${customerId}','${site.siteId}','${customerEmail}','Synthetic Session Customer','active');`);
    const session = await issueCustomerSession({ storeId: site.siteId, customerId }, 'synthetic-review-customer-session-secret');
    const signedIn = await gateway.request('/v1/storefront/reviews', {
        method: 'POST',
        headers: { ...csrfHeaders, Cookie: `letbuyy_csrf=${csrf}; ${LETBUYY_CUSTOMER_SESSION_COOKIE}=${session.token}` },
        body: submit({ store_id: site.siteId, customer_email: guestEmail, customer_name: 'Forged', is_verified: false }),
    });
    assert.equal(signedIn.status, 201);
    assert.equal(signedIn.text.includes(customerEmail), false);
    assert.doesNotMatch(signedIn.text, /Synthetic Session Customer/);
    assert.equal(psql(`SELECT customer_email || '|' || customer_name || '|' || is_verified::text FROM product_reviews WHERE customer_email='${customerEmail}';`), `${customerEmail}|Synthetic Session Customer|true`);
});

// N1.5 canonical review submission: retained ten-case semantic controls after the atomic fix.
// The four original tests above remain unchanged. These cases drive the same real worker,
// signed storefront credentials, verified links and explicitly local Turnstile condition.
// The REST tap only schedules real requests or changes one synthetic live source row;
// it never fabricates an authorization result, rewrites a review, or disables a constraint.
// This is route/database proof, not Identity issuance, browser, provider or RLS proof.

function newReviewProduct(storeId = site.siteId): string {
    const id = crypto.randomUUID();
    psql(`INSERT INTO products (id,store_id,name,price,is_active,status) VALUES ('${id}','${storeId}','Synthetic review boundary product',19.99,true,'active');`);
    return id;
}

function reviewCount(id: string): number {
    return Number(psql(`SELECT count(*) FROM product_reviews WHERE product_id='${id}' AND deleted_at IS NULL;`));
}

/** Full-row conservation without printing contact details in a failing assertion. */
function reviewFingerprint(id: string, reviewId?: string): string {
    return psql(`SELECT encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id)::text,'[]'),'sha256'),'hex')
        FROM product_reviews r WHERE product_id='${id}'${reviewId ? ` AND id='${reviewId}'` : ''};`);
}

function isReviewInsert(call: RestCall, id: string): boolean {
    const body = call.json as { p_product?: string; p_site?: string } | null;
    return call.method === 'POST' && call.resource === 'rpc/create_storefront_buyer_review_v1'
        && body?.p_product === id && body.p_site === site.siteId;
}

test('parallel submissions by one linked buyer leave one pending review and refuse the duplicate', async () => {
    const buyer = seedBuyerAccount(psql, 'review-parallel');
    assert.match(link(buyer.id), /linked/);
    const id = newReviewProduct();
    assert.equal(reviewCount(id), 0);
    const barrier = newBarrier(2);
    const callsAtRelease: number[] = [];
    const tap = tapRest(owned.restUrl, async (call, forward) => {
        if (isReviewInsert(call, id)) {
            await barrier.arrive();
            callsAtRelease.push(tap.calls.filter(item => isReviewInsert(item, id)).length);
        }
        return forward();
    });
    const responses: Awaited<ReturnType<Gateway['request']>>[] = [];
    try {
        responses.push(...await Promise.all([0, 1].map(async () => gateway.request(url(), {
            method: 'POST', headers: await headers(buyer.id), body: submit({ product_id: id }),
        }))));
    } finally {
        tap.restore();
    }
    assert.equal(barrier.arrived, 2, 'both real atomic calls reached the scheduling boundary');
    assert.deepEqual(callsAtRelease, [2, 2], 'both calls arrived before either real transaction was forwarded');
    const statuses = responses.map(response => response.status).sort((a, b) => a - b);
    assert.equal(reviewCount(id), 1, `parallel response statuses: ${JSON.stringify(statuses)}`);
    assert.deepEqual(statuses, [201, 409]);
    assert.equal(psql(`SELECT count(*) FROM product_reviews WHERE product_id='${id}'
        AND status='pending' AND is_verified AND NOT is_approved AND deleted_at IS NULL;`), '1');
    for (const response of responses) assert.equal(response.text.includes(buyer.email), false);
});

test('changing linked customer contact email does not grant the same buyer a second review', async () => {
    const buyer = seedBuyerAccount(psql, 'review-contact');
    assert.match(link(buyer.id), /linked/);
    const id = newReviewProduct();
    const customerId = psql(`SELECT store_customer_id FROM buyer_store_customers
        WHERE buyer_account_id='${buyer.id}' AND site_id='${site.siteId}';`);
    const first = await gateway.request(url(), {
        method: 'POST', headers: await headers(buyer.id), body: submit({ product_id: id }),
    });
    assert.equal(first.status, 201);
    const before = reviewFingerprint(id);
    const changedContact = `changed-review-${crypto.randomUUID()}@example.invalid`;
    // Only merchant contact data changes. The buyer, customer id and verified link remain the same.
    psql(`UPDATE store_customers SET email='${changedContact}' WHERE id='${customerId}' AND store_id='${site.siteId}';`);
    assert.equal(psql(`SELECT email FROM store_customers WHERE id='${customerId}' AND store_id='${site.siteId}';`), changedContact);
    assert.equal(psql(`SELECT count(*) FROM buyer_store_customers WHERE buyer_account_id='${buyer.id}'
        AND site_id='${site.siteId}' AND store_customer_id='${customerId}' AND verified_at IS NOT NULL;`), '1');
    assert.equal(psql(`SELECT email FROM buyer_accounts WHERE id='${buyer.id}';`), buyer.email);
    const retry = await gateway.request(url(), {
        method: 'POST', headers: await headers(buyer.id), body: submit({ product_id: id }),
    });
    assert.equal(reviewCount(id), 1, `contact-change response status: ${retry.status}`);
    assert.equal(reviewFingerprint(id), before, 'the retained review and its contact snapshot stay unchanged');
    assert.equal(retry.status, 409);
    assert.equal(retry.text.includes(buyer.email), false);
    assert.equal(retry.text.includes(changedContact), false);
});

test('buyer and site bindings ignore forged author fields and conserve another buyer review', async () => {
    const buyerA = seedBuyerAccount(psql, 'review-binding-a');
    const buyerB = seedBuyerAccount(psql, 'review-binding-b');
    assert.match(link(buyerA.id), /linked/);
    assert.match(link(buyerB.id), /linked/);
    const customerA = psql(`SELECT store_customer_id FROM buyer_store_customers
        WHERE buyer_account_id='${buyerA.id}' AND site_id='${site.siteId}';`);
    const id = newReviewProduct();
    const first = await gateway.request(url(), {
        method: 'POST', headers: await headers(buyerA.id), body: submit({ product_id: id }),
    });
    assert.equal(first.status, 201);
    const reviewA = first.json?.data.review.id as string;
    const beforeA = reviewFingerprint(id, reviewA);
    const forged = await gateway.request(url(), {
        method: 'POST', headers: await headers(buyerB.id), body: submit({
            product_id: id, buyer_account_id: buyerA.id, customer_id: customerA,
            customer_email: buyerA.email, customer_name: 'Forged author', is_approved: true,
        }),
    });
    assert.equal(forged.status, 201, 'a different linked buyer can submit their own review');
    assert.notEqual(forged.json?.data.review.id, reviewA);
    assert.equal(reviewFingerprint(id, reviewA), beforeA);
    assert.equal(psql(`SELECT customer_email || '|' || status || '|' || is_approved::text FROM product_reviews
        WHERE id='${forged.json?.data.review.id}';`), `${buyerB.email}|pending|false`);
    assert.equal(forged.text.includes(buyerA.email), false);
    assert.equal(forged.text.includes(buyerB.email), false);

    const other = newSyntheticTenant('review-binding-other');
    seedSyntheticTenant(psql, other);
    const otherProduct = newReviewProduct(other.siteId);
    assert.match(psql(`SELECT link_buyer_store_customer('${buyerB.id}'::uuid,'${other.siteId}'::uuid)::text;`), /linked/);
    const before = { original: reviewFingerprint(id), other: reviewFingerprint(otherProduct) };
    const wrongSite = await gateway.request(url(other.siteId), {
        method: 'POST', headers: await headers(buyerB.id), body: submit({ product_id: otherProduct }),
    });
    const wrongProduct = await gateway.request(url(other.siteId), {
        method: 'POST', headers: await headers(buyerB.id, other.siteId), body: submit({ product_id: id }),
    });
    assert.equal(wrongSite.status, 401);
    assert.equal(wrongProduct.status, 404);
    assert.deepEqual({ original: reviewFingerprint(id), other: reviewFingerprint(otherProduct) }, before);
    const ownOtherSite = await gateway.request(url(other.siteId), {
        method: 'POST', headers: await headers(buyerB.id, other.siteId), body: submit({ product_id: otherProduct }),
    });
    assert.equal(ownOtherSite.status, 201, 'same buyer may review a permitted product at their other verified store');
    assert.equal(reviewCount(otherProduct), 1);
    assert.equal(reviewFingerprint(id, reviewA), beforeA);
});

/** Revoke one real synthetic source at the actual atomic RPC boundary, before database validation/write. */
async function refusesChangedReviewSource(kind: 'link' | 'disabled' | 'deleted'): Promise<void> {
    const buyer = seedBuyerAccount(psql, `review-live-${kind}`);
    assert.match(link(buyer.id), /linked/);
    const id = newReviewProduct();
    const customerId = psql(`SELECT store_customer_id FROM buyer_store_customers
        WHERE buyer_account_id='${buyer.id}' AND site_id='${site.siteId}';`);
    assert.equal(psql(`SELECT count(*) FROM buyer_store_customers b JOIN store_customers s ON s.id=b.store_customer_id
        WHERE b.buyer_account_id='${buyer.id}' AND b.site_id='${site.siteId}' AND b.verified_at IS NOT NULL
          AND s.status='active' AND s.deleted_at IS NULL;`), '1');
    const before = reviewFingerprint(id);
    let boundaryHits = 0;
    const tap = tapRest(owned.restUrl, async (call, forward) => {
        if (isReviewInsert(call, id)) {
            boundaryHits += 1;
            assert.equal(boundaryHits, 1, 'only the first request reaches the write boundary');
            if (kind === 'link') {
                // Both fields change together to respect the existing verified-at constraint.
                psql(`UPDATE buyer_store_customers SET link_basis='legacy_unverified',verified_at=NULL
                    WHERE buyer_account_id='${buyer.id}' AND site_id='${site.siteId}' AND store_customer_id='${customerId}';`);
            } else if (kind === 'disabled') {
                psql(`UPDATE store_customers SET status='disabled' WHERE id='${customerId}' AND store_id='${site.siteId}';`);
            } else {
                psql(`UPDATE store_customers SET deleted_at=now() WHERE id='${customerId}' AND store_id='${site.siteId}';`);
            }
            assert.equal(psql(`SELECT count(*) FROM buyer_store_customers b JOIN store_customers s ON s.id=b.store_customer_id
                WHERE b.buyer_account_id='${buyer.id}' AND b.site_id='${site.siteId}' AND b.verified_at IS NOT NULL
                  AND s.status='active' AND s.deleted_at IS NULL;`), '0');
        }
        return forward();
    });
    let response: Awaited<ReturnType<Gateway['request']>>;
    try {
        response = await gateway.request(url(), {
            method: 'POST', headers: await headers(buyer.id), body: submit({ product_id: id }),
        });
    } finally {
        tap.restore();
    }
    // An ordinary subsequent request is independently refused by the now-current link/customer read.
    const retry = await gateway.request(url(), {
        method: 'POST', headers: await headers(buyer.id), body: submit({ product_id: id }),
    });
    assert.equal(boundaryHits, 1);
    assert.equal(retry.status, 409);
    assert.equal(reviewCount(id), 0, `${kind} changed before insert; in-flight status ${response.status}, subsequent status ${retry.status}`);
    assert.equal(reviewFingerprint(id), before, 'no review may commit using a stale source snapshot');
    assert.equal(response.status, 409);
    assert.equal(response.text.includes(buyer.email), false);
    assert.equal(retry.text.includes(buyer.email), false);
}

test('a link losing verification before review insertion cannot authorize the in-flight write', async () => {
    await refusesChangedReviewSource('link');
});

test('a linked customer disabled before review insertion cannot authorize the in-flight write', async () => {
    await refusesChangedReviewSource('disabled');
});

test('a linked customer soft-deleted before review insertion cannot authorize the in-flight write', async () => {
    await refusesChangedReviewSource('deleted');
});

function edgeCount(product: string, buyer?: string): number {
    return Number(owned.psql(`SELECT count(*) FROM buyer_review_links WHERE product_id='${product}'${buyer ? ` AND buyer_account_id='${buyer}'` : ''};`));
}
function edgeFingerprint(product: string): string {
    return owned.psql(`SELECT encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(e) ORDER BY review_id)::text,'[]'),'sha256'),'hex') FROM buyer_review_links e WHERE product_id='${product}';`);
}
function canonicalReviewFixture(label: string) {
    const buyer = seedBuyerAccount(psql, label);
    assert.match(link(buyer.id), /linked/);
    const product = newReviewProduct();
    const customer = psql(`SELECT store_customer_id FROM buyer_store_customers WHERE buyer_account_id='${buyer.id}' AND site_id='${site.siteId}';`);
    const write = () => headers(buyer.id).then(auth => gateway.request(url(), {
        method: 'POST', headers: auth, body: submit({ product_id: product }),
    }));
    return { buyer, product, customer, write };
}
function directReviewSql(buyer: string, product: string, epoch = 1): string {
    return `SELECT public.create_storefront_buyer_review_v1('${buyer}','${site.siteId}',${epoch},'${product}',5,NULL,NULL)::text;`;
}

test('private authorship and its RPC deny actual ordinary database roles', () => {
    const fixture = canonicalReviewFixture('review-role');
    for (const role of ['anon', 'authenticated', 'app_tenant']) {
        assert.match(owned.psqlExpectError(`BEGIN;SET LOCAL ROLE ${role};SELECT * FROM buyer_review_links;`), /permission denied/);
        assert.match(owned.psqlExpectError(`BEGIN;SET LOCAL ROLE ${role};` + directReviewSql(fixture.buyer.id, fixture.product)), /permission denied/);
    }
    assert.match(owned.psqlExpectError('BEGIN;' + directReviewSql(fixture.buyer.id, fixture.product) + 'ROLLBACK;'), /Backend review writer required/);
    assert.equal(reviewCount(fixture.product), 0);
    assert.equal(edgeCount(fixture.product), 0);
});

test('actual backend RPC rechecks buyer epoch, active status and nonempty tenant GUC bindings', () => {
    const fixture = canonicalReviewFixture('review-context');
    const wrongSite = crypto.randomUUID();
    for (const setting of ['app.site_id', 'app.tenant_id']) {
        const result = JSON.parse(owned.script(`BEGIN;SET LOCAL ROLE service_role;SET LOCAL ${setting}='${wrongSite}';` + directReviewSql(fixture.buyer.id, fixture.product) + 'COMMIT;'));
        assert.deepEqual(result, { accepted: false, code: 'BUYER_SCOPE_MISMATCH' });
    }
    for (const isolation of ['REPEATABLE READ', 'SERIALIZABLE', 'READ UNCOMMITTED']) {
        const result = JSON.parse(owned.script('BEGIN ISOLATION LEVEL ' + isolation + ';SET LOCAL ROLE service_role;' + directReviewSql(fixture.buyer.id, fixture.product) + 'COMMIT;'));
        assert.deepEqual(result, { accepted: false, code: 'REVIEW_SOURCE_BUSY' });
    }
    const stale = JSON.parse(owned.script('BEGIN;SET LOCAL ROLE service_role;' + directReviewSql(fixture.buyer.id, fixture.product, 2) + 'COMMIT;'));
    assert.deepEqual(stale, { accepted: false, code: 'BUYER_SESSION_INVALID' });
    owned.script(`UPDATE buyer_accounts SET status='disabled' WHERE id='${fixture.buyer.id}';`);
    const disabled = JSON.parse(owned.script('BEGIN;SET LOCAL ROLE service_role;' + directReviewSql(fixture.buyer.id, fixture.product) + 'COMMIT;'));
    assert.deepEqual(disabled, { accepted: false, code: 'BUYER_DISABLED' });
    assert.equal(reviewCount(fixture.product), 0);
    assert.equal(edgeCount(fixture.product), 0);
});

test('private author evidence is immutable and scope foreign keys cannot move its review or customer across stores', async () => {
    const fixture = canonicalReviewFixture('review-immutable');
    const result = await fixture.write();
    assert.equal(result.status, 201);
    const review = result.json?.data.review.id;
    const before = edgeFingerprint(fixture.product);
    for (const statement of [
        `UPDATE buyer_review_links SET buyer_account_id=buyer_account_id WHERE review_id='${review}';`,
        `DELETE FROM buyer_review_links WHERE review_id='${review}';`,
        'TRUNCATE buyer_review_links;',
    ]) {
        assert.match(owned.psqlExpectError('BEGIN;SET LOCAL ROLE service_role;' + statement), /permission denied/);
        assert.match(owned.psqlExpectError('BEGIN;' + statement + 'ROLLBACK;'), /author evidence is immutable/);
        assert.equal(edgeFingerprint(fixture.product), before);
    }
    assert.match(owned.psqlExpectError('BEGIN;TRUNCATE product_reviews CASCADE;ROLLBACK;'), /author evidence is immutable/);
    assert.equal(edgeFingerprint(fixture.product), before);
    const other = newSyntheticTenant('review-scope'); seedSyntheticTenant(psql, other);
    assert.match(owned.psqlExpectError(`BEGIN;UPDATE product_reviews SET store_id='${other.siteId}' WHERE id='${review}';ROLLBACK;`), /foreign key constraint/);
    assert.match(owned.psqlExpectError(`BEGIN;UPDATE store_customers SET store_id='${other.siteId}' WHERE id='${fixture.customer}';ROLLBACK;`), /foreign key constraint/);
    assert.equal(edgeFingerprint(fixture.product), before);
    assert.doesNotMatch(result.text, new RegExp(fixture.buyer.id + '|' + fixture.customer + '|buyer_account_id|store_customer_id|@example.invalid'));
});

test('authorship stays with the original buyer after contact and verified customer-link changes', async () => {
    const fixture = canonicalReviewFixture('review-author');
    const first = await fixture.write(); assert.equal(first.status, 201);
    const reviewA = first.json?.data.review.id as string;
    const originalContent = reviewFingerprint(fixture.product, reviewA);
    const originalEdge = owned.psql(`SELECT row_to_json(e)::text FROM buyer_review_links e WHERE review_id='${reviewA}';`);
    const buyerB = seedBuyerAccount(psql, 'review-author-b');
    // Controlled synthetic source changes, not a claim of an operator UI journey.
    //255 allows explicit operator-resolution relationships. No private review edge is rewritten.
    owned.script(`UPDATE buyer_store_customers SET buyer_account_id='${buyerB.id}',link_basis='operator_resolution',verified_at=now()
        WHERE buyer_account_id='${fixture.buyer.id}' AND site_id='${site.siteId}';`);
    const newCustomer = crypto.randomUUID();
    owned.script(`INSERT INTO store_customers(id,store_id,email,status) VALUES('${newCustomer}','${site.siteId}','replacement-${newCustomer}@example.invalid','active');
        INSERT INTO buyer_store_customers(buyer_account_id,store_customer_id,site_id,link_basis,verified_at)
        VALUES('${fixture.buyer.id}','${newCustomer}','${site.siteId}','operator_resolution',now());`);
    const retryA = await fixture.write();
    assert.equal(retryA.status, 409, 'same canonical author remains a duplicate through a different current customer link');
    const ownB = await gateway.request(url(), { method: 'POST', headers: await headers(buyerB.id), body: submit({ product_id: fixture.product }) });
    assert.equal(ownB.status, 201, 'the new buyer submits their own new review, never claims the old one');
    assert.notEqual(ownB.json?.data.review.id, reviewA);
    assert.equal(edgeCount(fixture.product, fixture.buyer.id), 1);
    assert.equal(edgeCount(fixture.product, buyerB.id), 1);
    assert.equal(owned.psql(`SELECT row_to_json(e)::text FROM buyer_review_links e WHERE review_id='${reviewA}';`), originalEdge);
    assert.equal(reviewFingerprint(fixture.product, reviewA), originalContent);
});

test('legacy matching-contact reviews stay unclaimed and public reads expose no canonical author identity', async () => {
    const fixture = canonicalReviewFixture('review-history');
    const csrf = crypto.randomUUID();
    const guest = await gateway.request('/v1/storefront/reviews', { method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: `letbuyy_csrf=${csrf}`, 'X-CSRF-Token': csrf },
        body: submit({ product_id: fixture.product, store_id: site.siteId, customer_email: fixture.buyer.email, customer_name: 'Synthetic Guest', is_verified: true }),
    });
    assert.equal(guest.status, 201);
    const guestId = guest.json?.data.review.id as string;
    const legacyBefore = reviewFingerprint(fixture.product, guestId);
    assert.equal(edgeCount(fixture.product), 0);
    const own = await fixture.write(); assert.equal(own.status, 201);
    assert.notEqual(own.json?.data.review.id, guestId);
    assert.equal(owned.psql(`SELECT count(*) FROM buyer_review_links WHERE review_id='${guestId}';`), '0');
    assert.equal(reviewFingerprint(fixture.product, guestId), legacyBefore);
    owned.script(`UPDATE product_reviews SET status='approved',is_approved=true WHERE product_id='${fixture.product}';`);
    const visible = await gateway.request(`/v1/storefront/reviews?store_id=${site.siteId}&product_id=${fixture.product}`);
    assert.equal(visible.status, 200);
    assert.doesNotMatch(visible.text, new RegExp(fixture.buyer.id + '|' + fixture.customer + '|buyer_account_id|store_customer_id|buyer_review_links|customer_email'));
    assert.equal(edgeCount(fixture.product), 1);
});

test('soft deletion retains private author evidence and permits a new review under the original active-only duplicate policy', async () => {
    const fixture = canonicalReviewFixture('review-softdelete');
    const first = await fixture.write(); assert.equal(first.status, 201);
    const old = first.json?.data.review.id;
    const oldEdge = owned.psql(`SELECT row_to_json(e)::text FROM buyer_review_links e WHERE review_id='${old}';`);
    owned.script(`UPDATE product_reviews SET deleted_at=now() WHERE id='${old}';`);
    const second = await fixture.write(); assert.equal(second.status, 201);
    assert.notEqual(second.json?.data.review.id, old);
    assert.equal(reviewCount(fixture.product), 1);
    assert.equal(edgeCount(fixture.product), 2);
    assert.equal(owned.psql(`SELECT row_to_json(e)::text FROM buyer_review_links e WHERE review_id='${old}';`), oldEdge);
});

for (const fault of ['edge-unavailable', 'epoch-changed', 'customer-changed'] as const) test('atomic review failure conserves content, ownership and source after ' + fault, async () => {
    const fixture = canonicalReviewFixture('review-fault');
    const before = { content: reviewFingerprint(fixture.product), edge: edgeFingerprint(fixture.product), epoch: owned.psql(`SELECT session_epoch FROM buyer_accounts WHERE id='${fixture.buyer.id}';`) };
    const suffix = crypto.randomUUID().replaceAll('-', '');
    const fn = 'syn_review_fault_' + suffix;
    const when = fault === 'edge-unavailable' ? 'BEFORE' : 'AFTER';
    const change = fault === 'edge-unavailable' ? "RAISE EXCEPTION 'Synthetic private review author unavailable';"
        : fault === 'epoch-changed' ? `UPDATE buyer_accounts SET session_epoch=session_epoch+1 WHERE id=NEW.buyer_account_id;`
        : `UPDATE store_customers SET status='disabled' WHERE id=NEW.store_customer_id;`;
    owned.script(`CREATE FUNCTION public.${fn}() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN ${change} RETURN NEW;END$$;
        CREATE TRIGGER ${fn} ${when} INSERT ON buyer_review_links FOR EACH ROW EXECUTE FUNCTION public.${fn}();`);
    try {
        const response = await fixture.write();
        assert.equal(response.status, 500);
        assert.doesNotMatch(response.text, /Synthetic private|author unavailable|Review authority changed|buyer_account_id|@example.invalid/);
        assert.equal(reviewFingerprint(fixture.product), before.content);
        assert.equal(edgeFingerprint(fixture.product), before.edge);
        assert.equal(owned.psql(`SELECT session_epoch FROM buyer_accounts WHERE id='${fixture.buyer.id}';`), before.epoch);
        assert.equal(owned.psql(`SELECT status FROM store_customers WHERE id='${fixture.customer}';`), 'active');
    } finally { owned.script(`DROP TRIGGER ${fn} ON buyer_review_links;DROP FUNCTION public.${fn}() RESTRICT;`); }
    const recovered = await fixture.write(); assert.equal(recovered.status, 201);
    assert.equal(reviewCount(fixture.product), 1); assert.equal(edgeCount(fixture.product), 1);
});

test('357 rollback refuses every retained private author edge including soft-deleted content', async () => {
    const fixture = canonicalReviewFixture('review-retained');
    const response = await fixture.write(); assert.equal(response.status, 201);
    owned.script(`UPDATE product_reviews SET deleted_at=now() WHERE id='${response.json?.data.review.id}';`);
    await gateway.settle();
    const before = maintenanceState357();
    assert.match(owned.psqlExpectError(rollback357), /rollback357 refuses retained buyer review author evidence/);
    assert.equal(maintenanceState357(), before);
    assert.equal(edgeCount(fixture.product), 1);
});
