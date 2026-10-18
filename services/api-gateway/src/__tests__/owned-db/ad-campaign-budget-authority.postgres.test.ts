// N8.2: real worker, real app_tenant pooled transaction and owned Postgres.
// Synthetic paid billing records enter through the existing canonical finalizer.
// No provider endpoint, foreign runtime, ambient database or funding shortcut.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import test, { after, afterEach, before } from 'node:test';
import { closePooledSqlClients } from '@letbuyy/infrastructure/pooled-sql-adapter';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, tapRest, type IdentityKeys, type RestTap } from './gateway-harness';
import { requireOwnedDatabase, startOwnedPooledSqlProxy, type OwnedPooledSqlProxy } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
let proxy: OwnedPooledSqlProxy;
let keys: IdentityKeys;
let gateway: Gateway;
let tap: RestTap | undefined;
const q = (value: string) => `'${value.replaceAll("'", "''")}'`;
const forward355 = readFileSync(new URL('../../../../../database/supabase/migrations/355_ad_campaign_current_budget_authority.sql', import.meta.url), 'utf8');
const rollback355 = readFileSync(new URL('../../../../../database/supabase/rollback/355_ad_campaign_current_budget_authority.rollback.sql', import.meta.url), 'utf8');
const allocationSignature = 'public.allocate_ad_campaign_budget(uuid,uuid,bigint,text,text,uuid)';
const releaseSignature = 'public.release_ad_campaign_budget(uuid,uuid,bigint,text,text,uuid)';
type Actor = { id: string; email: string };
type Fixture = { siteId: string; campaignId: string; owner: Actor; stranger: Actor; accountId: string; billingId: string; funded: number };

before(async () => {
    keys = await newIdentityKeys('n8-budget');
    proxy = await startOwnedPooledSqlProxy(owned);
    gateway = new Gateway(gatewayEnv(owned, keys, proxy.env()));
});
afterEach(async () => { tap?.restore(); tap = undefined; await gateway?.settle(); });
after(async () => { await closePooledSqlClients(); await proxy?.stop(); });

function fixture(funded = 1000): Fixture {
    const tenant = newSyntheticTenant('budget-' + randomUUID().slice(0, 12));
    seedSyntheticTenant(owned.psql, tenant);
    const owner = { id: randomUUID(), email: `syn-ad-owner-${randomUUID()}@example.invalid` };
    const stranger = { id: randomUUID(), email: `syn-ad-other-${randomUUID()}@example.invalid` };
    const campaignId = randomUUID(), billingId = randomUUID();
    const orderId = `order_syn_${randomUUID().replaceAll('-', '')}`;
    const paymentId = `pay_syn_${randomUUID().replaceAll('-', '')}`;
    owned.script(`
      INSERT INTO public.users (id,email) VALUES (${q(owner.id)}::uuid,${q(owner.email)}),(${q(stranger.id)}::uuid,${q(stranger.email)});
      INSERT INTO public.users_custom (id,email,email_verified) VALUES (${q(owner.id)}::uuid,${q(owner.email)},true),(${q(stranger.id)}::uuid,${q(stranger.email)},true);
      UPDATE public.sites SET user_id=${q(owner.id)}::uuid,custom_user_id=${q(owner.id)}::uuid WHERE id=${q(tenant.siteId)}::uuid;
      INSERT INTO public.ad_campaigns (id,site_id,name,status,pricing_model,bid_minor)
      VALUES (${q(campaignId)}::uuid,${q(tenant.siteId)}::uuid,'Synthetic authority campaign','active','cpc',100);
      INSERT INTO public.billing_history
        (id,user_id,store_id,site_id,invoice_number,description,amount,currency,tax_amount,total_amount,payment_gateway,payment_id,payment_status)
      VALUES (${q(billingId)}::uuid,${q(owner.id)}::uuid,${q(tenant.siteId)}::uuid,${q(tenant.siteId)}::uuid,
        ${q('SYN-ADC-' + billingId)},'Synthetic prepaid entitlement',${funded},'INR',0,${funded},'razorpay',${q(orderId)},'pending');
      SELECT public.finalize_ad_credit_purchase(${q(tenant.siteId)}::uuid,${q(billingId)}::uuid,${q(orderId)},${q(paymentId)},'synthetic-budget-funding',${q(owner.id)}::uuid);
    `);
    const accountId = owned.psql(`SELECT id FROM public.ad_credit_accounts WHERE site_id=${q(tenant.siteId)}::uuid;`);
    assert.match(accountId, /^[0-9a-f-]{36}$/i);
    assert.equal(owned.psql(`SELECT public.ledger_account_balance_minor(${q(tenant.siteId)}::uuid,'merchant_payable');`), '0');
    assert.equal(owned.psql(`SELECT public.ledger_account_balance_minor(${q(tenant.siteId)}::uuid,'ad_credit_liability');`), String(funded));
    return { siteId: tenant.siteId, campaignId, owner, stranger, accountId, billingId, funded };
}

async function send(f: Fixture, operation: 'budget' | 'release', amount: number | undefined, key: string, actor = f.owner, signedSite = f.siteId) {
    return gateway.request(`/v1/ads/campaigns/${f.campaignId}/${operation}`, {
        method: 'POST', headers: await signedIdentityHeaders(actor.id, actor.email, signedSite),
        body: JSON.stringify({ store_id: f.siteId, ...(amount === undefined ? {} : { amount_minor: amount }), idempotency_key: key }),
    });
}
function rpc(f: Fixture, operation: 'allocate' | 'release', amount: number | null, key: string, actor = f.owner.id) {
    return `SELECT public.${operation === 'allocate' ? 'allocate' : 'release'}_ad_campaign_budget(${q(f.siteId)}::uuid,${q(f.campaignId)}::uuid,${amount === null ? 'NULL' : amount}::bigint,${q(key)},'synthetic-budget-role',${q(actor)}::uuid);`;
}
function tenantSql(f: Fixture, statement: string, site: string | null = f.siteId) {
    return `BEGIN; SET LOCAL ROLE app_tenant; ${site === null ? '' : `SELECT set_config('app.site_id',${q(site)},true);`}
      SELECT set_config('app.user_id',${q(f.owner.id)},true); ${statement} COMMIT;`;
}
function snapshot(f: Fixture) {
    return JSON.parse(owned.psql(`SELECT jsonb_build_object(
      'balance',public.ad_credit_balance_minor(${q(f.accountId)}::uuid),
      'remaining',public.ad_campaign_remaining_minor(${q(f.campaignId)}::uuid),
      'spent',public.ad_campaign_spent_minor(${q(f.campaignId)}::uuid),
      'allocated',(SELECT allocated_minor FROM public.ad_campaigns WHERE id=${q(f.campaignId)}::uuid),
      'entries',(SELECT count(*) FROM public.ad_credit_ledger_entries WHERE site_id=${q(f.siteId)}::uuid),
      'money_transactions',(SELECT count(*) FROM public.ledger_transactions WHERE site_id=${q(f.siteId)}::uuid));`)) as Record<string, number>;
}
function conserved(f: Fixture) {
    const state = snapshot(f);
    assert.ok(state.balance >= 0 && state.remaining >= 0 && state.allocated >= state.spent, JSON.stringify(state));
    assert.equal(state.balance + state.remaining + state.spent, f.funded, 'unallocated + campaign remaining + consumed equals funded entitlement');
    return state;
}

test('current function lineage and real grants keep stored value, funding and spending out of tenant direct writes', () => {
    const f = fixture();
    const catalog = JSON.parse(owned.psql(`SELECT jsonb_build_object(
      'tenant_allocate',has_function_privilege('app_tenant','public.allocate_ad_campaign_budget(uuid,uuid,bigint,text,text,uuid)','EXECUTE'),
      'tenant_release',has_function_privilege('app_tenant','public.release_ad_campaign_budget(uuid,uuid,bigint,text,text,uuid)','EXECUTE'),
      'tenant_purchase',has_function_privilege('app_tenant','public.record_ad_credit_purchase(uuid,bigint,text,text,text,uuid)','EXECUTE'),
      'tenant_spend',has_function_privilege('app_tenant','public.record_ad_spend(uuid,uuid,text,integer,text,text,uuid)','EXECUTE'),
      'anon_allocate',has_function_privilege('anon','public.allocate_ad_campaign_budget(uuid,uuid,bigint,text,text,uuid)','EXECUTE'),
      'authenticated_release',has_function_privilege('authenticated','public.release_ad_campaign_budget(uuid,uuid,bigint,text,text,uuid)','EXECUTE'),
      'force_rls',(SELECT bool_and(relrowsecurity AND relforcerowsecurity) FROM pg_class WHERE oid IN ('public.ad_credit_accounts'::regclass,'public.ad_credit_ledger_entries'::regclass,'public.ad_campaigns'::regclass)),
      'payload_guard',strpos(pg_get_functiondef('public.allocate_ad_campaign_budget(uuid,uuid,bigint,text,text,uuid)'::regprocedure),'different request payload')>0);`));
    assert.deepEqual(catalog, { tenant_allocate: true, tenant_release: true, tenant_purchase: false, tenant_spend: false, anon_allocate: false, authenticated_release: false, force_rls: true, payload_guard: true });
    for (const role of ['app_tenant', 'service_role', 'authenticated', 'anon']) {
        for (const statement of [
            `UPDATE public.ad_campaigns SET allocated_minor=900000 WHERE id=${q(f.campaignId)}::uuid;`,
            `INSERT INTO public.ad_credit_ledger_entries(site_id,ad_credit_account_id,entry_type,amount_minor,balance_after_minor,idempotency_key) VALUES(${q(f.siteId)}::uuid,${q(f.accountId)}::uuid,'granted',999,999,'forbidden-direct-grant');`,
        ]) assert.match(owned.psqlExpectError(`BEGIN; SET LOCAL ROLE ${role}; ${statement} COMMIT;`), /permission denied/i);
    }
    assert.deepEqual(conserved(f), { balance: 1000, remaining: 0, spent: 0, allocated: 0, entries: 1, money_transactions: 1 });
});

test('normal mounted Gateway allocation and release replay once; changed payload stays a conflict under latest SQL', async () => {
    const f = fixture();
    const first = await send(f, 'budget', 600, 'normal-allocation');
    assert.equal(first.status, 200, first.text);
    assert.equal((await send(f, 'budget', 600, 'normal-allocation')).json?.data?.replayed, true);
    const release = await send(f, 'release', 100, 'normal-release');
    assert.equal(release.status, 200, release.text);
    assert.equal((await send(f, 'release', 100, 'normal-release')).json?.data?.replayed, true);
    const state = conserved(f);
    assert.equal(state.balance, 500); assert.equal(state.remaining, 500); assert.equal(state.entries, 3);
    const conflict = await send(f, 'budget', 601, 'normal-allocation');
    assert.equal(conflict.status, 409, 'latest291 already rejects changed payload; Gateway must project a bounded conflict');
    assert.deepEqual(snapshot(f), state);
});

test('real Gateway denies guest, foreign owner, signed other site and ownership removed before request', async () => {
    const f = fixture(), beforeState = snapshot(f);
    const guest = await gateway.request(`/v1/ads/campaigns/${f.campaignId}/budget`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ store_id: f.siteId, amount_minor: 100, idempotency_key: 'guest-denied' }) });
    assert.equal(guest.status, 401);
    assert.equal((await send(f, 'budget', 100, 'foreign-denied', f.stranger)).status, 403);
    assert.equal((await send(f, 'budget', 100, 'wrong-site-denied', f.owner, randomUUID())).status, 403);
    owned.script(`UPDATE public.sites SET user_id=${q(f.stranger.id)}::uuid,custom_user_id=${q(f.stranger.id)}::uuid WHERE id=${q(f.siteId)}::uuid;`);
    assert.equal((await send(f, 'budget', 100, 'old-owner-denied')).status, 403);
    assert.deepEqual(snapshot(f), beforeState);
});

test('ownership revoked after actual Gateway lookup is rechecked in the canonical budget transaction', async () => {
    const f = fixture(), state = snapshot(f);
    let revoked = false;
    tap = tapRest(owned.restUrl, async (call, forward) => {
        const response = await forward();
        if (!revoked && call.resource === 'sites' && call.method === 'GET' && call.search.has('or')) {
            revoked = true;
            owned.script(`UPDATE public.sites SET user_id=${q(f.stranger.id)}::uuid,custom_user_id=${q(f.stranger.id)}::uuid WHERE id=${q(f.siteId)}::uuid;`);
        }
        return response;
    });
    const result = await send(f, 'budget', 100, 'revoked-during-lookup');
    assert.equal(revoked, true, 'the real ownership read must have reached the tap');
    assert.equal(result.status, 403, 'a stale resolved scope cannot authorize a financial mutation: ' + JSON.stringify({ receipt: result.json?.data, before: state, after: snapshot(f) }));
    assert.deepEqual(snapshot(f), state);
});

for (const operation of ['budget', 'release'] as const) {
    test(`frozen prepaid account refuses current ${operation} authority before an exact replay`, async () => {
        const f = fixture();
        assert.equal((await send(f, 'budget', 600, 'frozen-initial-budget')).status, 200);
        const amount = operation === 'budget' ? 600 : 100;
        const key = operation === 'budget' ? 'frozen-initial-budget' : 'frozen-initial-release';
        if (operation === 'release') assert.equal((await send(f, operation, amount, key)).status, 200);
        const state = snapshot(f);
        owned.script(`UPDATE public.ad_credit_accounts SET status='frozen' WHERE id=${q(f.accountId)}::uuid;`);
        assert.equal((await send(f, operation, 50, 'frozen-fresh-command')).status, 409,
            'positive denial control: the current account gate already refuses a fresh command');
        const replay = await send(f, operation, amount, key);
        assert.equal(replay.status, 409, 'cached success must not bypass a frozen current account: ' + JSON.stringify({ receipt: replay.json?.data, before: state, after: snapshot(f) }));
        assert.deepEqual(snapshot(f), state);
    });
}

test('real app_tenant cannot mutate entitlement with missing site context', () => {
    const f = fixture();
    owned.script(tenantSql(f, rpc(f, 'allocate', 100, 'present-site-guc-control')));
    const state = snapshot(f);
    const error = owned.psqlExpectError(tenantSql(f, rpc(f, 'allocate', 100, 'missing-site-guc'), null));
    assert.match(error, /tenant|site|context|authoriz/i, 'missing site context must fail before effect: ' + JSON.stringify({ before: state, after: snapshot(f) }));
    assert.deepEqual(snapshot(f), state);
});

test('real app_tenant cannot forge the captured financial actor with a correct site GUC', () => {
    const f = fixture(), state = snapshot(f);
    const error = owned.psqlExpectError(tenantSql(f, rpc(f, 'allocate', 100, 'forged-actor', f.stranger.id)));
    const recordedActor = owned.psql(`SELECT created_by FROM public.ad_credit_ledger_entries WHERE site_id=${q(f.siteId)}::uuid AND idempotency_key='forged-actor';`);
    assert.match(error, /actor|owner|authoriz/i, 'captured actor must authorize attribution: ' + JSON.stringify({ capturedActor: f.owner.id, submittedActor: f.stranger.id, recordedActor, before: state, after: snapshot(f) }));
    assert.deepEqual(snapshot(f), state);
});

test('real app_tenant mismatched site context refuses before replay and before new effect', async () => {
    const f = fixture();
    assert.equal((await send(f, 'budget', 100, 'correct-site-control')).status, 200);
    const state = snapshot(f);
    for (const key of ['correct-site-control', 'wrong-site-new']) {
        assert.match(owned.psqlExpectError(tenantSql(f, rpc(f, 'allocate', 100, key), randomUUID())), /tenant context|tenant|site/i);
    }
    assert.deepEqual(snapshot(f), state);
});

test('concurrent real Gateway allocations cannot overdraw prepaid credit and exact concurrent key has one effect', async () => {
    const f = fixture();
    const results = await Promise.all(Array.from({ length: 4 }, (_, index) => send(f, 'budget', 400, `concurrent-cap-${index}`)));
    assert.equal(results.filter(result => result.status === 200).length, 2);
    assert.equal(results.filter(result => result.status === 422).length, 2);
    assert.equal(conserved(f).balance, 200);
    const g = fixture();
    const same = await Promise.all(Array.from({ length: 4 }, () => send(g, 'budget', 400, 'concurrent-same-key')));
    assert.ok(same.every(result => result.status === 200), 'all same-key callers see one winner or its receipt');
    assert.equal(conserved(g).entries, 2); assert.equal(conserved(g).balance, 600);
});

test('release versus actual metered spend conserves the original funded entitlement under a real race', async () => {
    const f = fixture();
    assert.equal((await send(f, 'budget', 600, 'race-start-allocation')).status, 200);
    const [, spent] = await Promise.all([
        send(f, 'release', 600, 'race-release'),
        owned.psqlAsync(`BEGIN; SET LOCAL ROLE service_role; SELECT public.record_ad_spend(${q(f.siteId)}::uuid,${q(f.campaignId)}::uuid,'click',3,'race-spend',NULL,NULL); COMMIT;`),
    ]);
    assert.ok(spent.length > 0);
    conserved(f);
    assert.ok(snapshot(f).spent === 0 || snapshot(f).spent === 300);
});

test('ledger and campaign projection faults each roll back the entire real Gateway allocation', async () => {
    const f = fixture();
    for (const table of ['ad_credit_ledger_entries', 'ad_campaigns']) {
        const state = snapshot(f);
        owned.script(`CREATE FUNCTION public.n8_budget_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic budget transaction fault'; END $$;
          CREATE TRIGGER n8_budget_fault BEFORE ${table === 'ad_campaigns' ? 'UPDATE' : 'INSERT'} ON public.${table}
          FOR EACH ROW EXECUTE FUNCTION public.n8_budget_fault();`);
        try {
            const response = await send(f, 'budget', 100, `fault-${table}`);
            assert.equal(response.status, 500);
            assert.deepEqual(snapshot(f), state, 'ledger, campaign and receipt must all roll back');
        } finally { owned.script(`DROP TRIGGER n8_budget_fault ON public.${table}; DROP FUNCTION public.n8_budget_fault();`); }
        assert.equal((await send(f, 'budget', 100, `fault-${table}`)).status, 200, 'a failed transaction must not leave a success receipt');
        conserved(f);
    }
});

function catalogState() {
    return owned.psql(`SELECT jsonb_agg(jsonb_build_object('oid',p.oid,'definition',pg_get_functiondef(p.oid),
      'owner',p.proowner,'acl',p.proacl::text,'defaults',pg_get_expr(p.proargdefaults,0),
      'names',p.proargnames,'types',p.proargtypes::text,'kind',p.prokind,'set',p.proretset,
      'config',p.proconfig) ORDER BY p.oid)
      FROM pg_proc p WHERE p.oid IN (${q(allocationSignature)}::regprocedure,${q(releaseSignature)}::regprocedure);`);
}
function completeFinancialState(f: Fixture) {
    return owned.psql(`SELECT jsonb_build_object(
      'accounts',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM ad_credit_accounts a WHERE site_id=${q(f.siteId)}::uuid),
      'campaigns',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM ad_campaigns a WHERE site_id=${q(f.siteId)}::uuid),
      'entitlement_ledger_and_receipts',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM ad_credit_ledger_entries a WHERE site_id=${q(f.siteId)}::uuid),
      'billing',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM billing_history a WHERE site_id=${q(f.siteId)}::uuid),
      'money_accounts',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM ledger_accounts a WHERE site_id=${q(f.siteId)}::uuid),
      'money_transactions',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM ledger_transactions a WHERE site_id=${q(f.siteId)}::uuid),
      'money_entries',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM ledger_entries a WHERE site_id=${q(f.siteId)}::uuid));`);
}
function innerMigration(sql: string) {
    assert.equal((sql.match(/^BEGIN;$/gm) || []).length, 1);
    assert.equal((sql.match(/^COMMIT;$/gm) || []).length, 1);
    return sql.replace(/^BEGIN;$/m, '').replace(/^COMMIT;$/m, '');
}
async function waitForSql(sql: string, message: string) {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
        if (owned.psql(sql) === 't') return;
        await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert.fail(message);
}

test('355 apply/reapply/rollback/reapply preserves exact funded rows, receipts and function owner/ACL', async () => {
    const f = fixture();
    assert.equal((await send(f, 'budget', 600, '355-roundtrip-allocation')).status, 200);
    assert.equal((await send(f, 'release', 100, '355-roundtrip-release')).status, 200);
    await gateway.settle();
    const financial = completeFinancialState(f), installed = catalogState();
    owned.script(forward355);
    assert.equal(completeFinancialState(f), financial);
    assert.equal(catalogState(), installed);
    try {
        owned.script(rollback355);
        assert.equal(completeFinancialState(f), financial, 'rollback must retain every funded row and durable receipt');
        assert.notEqual(catalogState(), installed);
        // Real predecessor negative control is fully aborted; it must not mint
        // or forget entitlement while proving the retired missing-GUC gap.
        const witness = owned.script(`BEGIN; SET LOCAL ROLE app_tenant;
          SELECT set_config('app.user_id',${q(f.owner.id)},true);
          ${rpc(f, 'allocate', 100, '355-aborted-predecessor-witness')} ROLLBACK;`);
        assert.match(witness, /"allocated": true/);
        assert.equal(completeFinancialState(f), financial);
    } finally { owned.script(forward355); }
    assert.equal(catalogState(), installed);
    assert.equal(completeFinancialState(f), financial);
    assert.equal((await send(f, 'budget', 600, '355-roundtrip-allocation')).json?.data?.replayed, true);
    assert.equal(completeFinancialState(f), financial);
});

const allocationDefinition = forward355.match(/CREATE OR REPLACE FUNCTION public\.allocate_ad_campaign_budget\([\s\S]*?\n\$\$;/)![0];
const parameters355 = 'p_site_id uuid,p_campaign_id uuid,p_amount_minor bigint,p_idempotency_key text,p_request_id text DEFAULT NULL,p_actor_id uuid DEFAULT NULL';
const drifts355 = [
    ['missing function', `DROP FUNCTION ${allocationSignature};`],
    ['unknown extra overload', 'CREATE FUNCTION public.allocate_ad_campaign_budget(uuid,uuid,bigint,text,text,uuid,integer) RETURNS jsonb LANGUAGE sql AS $$ SELECT \'{}\'::jsonb $$;'],
    ['changed input name', `DROP FUNCTION ${allocationSignature}; ${allocationDefinition.replaceAll('p_actor_id', 'p_unreviewed_actor')}`],
    ['changed result type', `DROP FUNCTION ${allocationSignature}; CREATE FUNCTION public.allocate_ad_campaign_budget(${parameters355}) RETURNS text LANGUAGE sql AS $$ SELECT 'synthetic'::text $$;`],
    ['set-returning ABI', `DROP FUNCTION ${allocationSignature}; CREATE FUNCTION public.allocate_ad_campaign_budget(${parameters355}) RETURNS SETOF jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;`],
    ['procedure kind', `DROP FUNCTION ${allocationSignature}; CREATE PROCEDURE public.allocate_ad_campaign_budget(${parameters355}) LANGUAGE plpgsql AS $$ BEGIN NULL; END $$;`],
    ['changed same-count defaults', allocationDefinition.replace('p_request_id text DEFAULT NULL', "p_request_id text DEFAULT 'synthetic-default-drift'")],
    ['newer unreviewed body', allocationDefinition.replace('\n$$;', () => '\n-- synthetic unreviewed source\n$$;')],
    ['foreign owner', `ALTER FUNCTION ${allocationSignature} OWNER TO service_role;`],
    ['named Data API grant', `GRANT EXECUTE ON FUNCTION ${allocationSignature} TO authenticated;`],
    ['backend grant option', `GRANT EXECUTE ON FUNCTION ${allocationSignature} TO app_tenant WITH GRANT OPTION;`],
    ['changed security profile', `ALTER FUNCTION ${allocationSignature} SECURITY INVOKER;`],
    ['changed search path', `ALTER FUNCTION ${allocationSignature} SET search_path=pg_catalog,public;`],
    ['changed cost profile', `ALTER FUNCTION ${allocationSignature} COST 123;`],
    ['changed strict profile', `ALTER FUNCTION ${allocationSignature} STRICT;`],
] as const;
for (const [label, drift] of drifts355) {
    test(`355 refuses ${label} before either forward or rollback mutation`, () => {
        const before = catalogState();
        for (const sql of [forward355, rollback355]) {
            const error = owned.psqlExpectError(`BEGIN; ${drift} ${innerMigration(sql)} ROLLBACK;`);
            assert.match(error, /355 refuses/, label);
            assert.equal(catalogState(), before, 'failed transaction must restore the exact original definitions, OIDs, defaults and grants');
        }
    });
}

test('355 context matrix denies missing/malformed/contradictory identity and backend fallback without money change', () => {
    const f = fixture();
    const valid = rpc(f, 'allocate', 100, '355-current-role-positive');
    owned.script(tenantSql(f, valid).replace('ROLE app_tenant', 'ROLE service_role'));
    const state = completeFinancialState(f);
    const cases = [
        `BEGIN; SET LOCAL ROLE app_tenant; SELECT set_config('app.site_id',${q(f.siteId)},true); ${rpc(f, 'allocate', 50, '355-no-actor-context')} COMMIT;`,
        `BEGIN; SET LOCAL ROLE app_tenant; SELECT set_config('app.site_id','invalid-site',true); SELECT set_config('app.user_id',${q(f.owner.id)},true); ${rpc(f, 'allocate', 50, '355-bad-site-context')} COMMIT;`,
        `BEGIN; SET LOCAL ROLE app_tenant; SELECT set_config('app.site_id',${q(f.siteId)},true); SELECT set_config('app.user_id','invalid-actor',true); ${rpc(f, 'allocate', 50, '355-bad-actor-context')} COMMIT;`,
        `BEGIN; SET LOCAL ROLE service_role; ${rpc(f, 'allocate', 50, '355-backend-no-context')} COMMIT;`,
        tenantSql(f, rpc(f, 'allocate', 50, '355-null-actor').replace(/,'[^']+'::uuid\);$/, ',NULL::uuid);')),
    ];
    for (const sql of cases) {
        assert.match(owned.psqlExpectError(sql), /actor|context|tenant|site/i);
        assert.equal(completeFinancialState(f), state);
    }
    conserved(f);
});

test('canonical custom owner and legacy same-ID owner remain legitimate while deleted site denies', async () => {
    for (const column of ['user_id', 'custom_user_id']) {
        const f = fixture();
        owned.script(`UPDATE sites SET ${column}=NULL WHERE id=${q(f.siteId)}::uuid;`);
        const result = await send(f, 'budget', 100, '355-owner-compatibility');
        assert.equal(result.status, 200, result.text);
        const state = snapshot(f);
        owned.script(`UPDATE sites SET deleted_at=now() WHERE id=${q(f.siteId)}::uuid;`);
        assert.equal((await send(f, 'budget', 100, '355-deleted-site-denial')).status, 403);
        assert.match(owned.psqlExpectError(tenantSql(f, rpc(f, 'allocate', 100, '355-deleted-site-direct'))), /owner|authoriz/i);
        assert.deepEqual(snapshot(f), state);
    }
});

test('355 serializes an actual concurrent catalog writer and refuses its unknown overload without changing entitlement', async () => {
    const f = fixture(), state = completeFinancialState(f), before = catalogState();
    const key = BigInt('0x' + randomUUID().replaceAll('-', '').slice(0, 12)).toString();
    const gateName = 'n8-ddl-gate-' + randomUUID().slice(0, 8), ddlName = 'n8-ddl-' + randomUUID().slice(0, 8), migrationName = 'n8-migration-' + randomUUID().slice(0, 8);
    const gate = owned.psqlAsync(`SET application_name=${q(gateName)}; SELECT pg_advisory_lock(${key}); SELECT pg_sleep(3);`);
    await waitForSql(`SELECT EXISTS(SELECT 1 FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.application_name=${q(gateName)} AND l.locktype='advisory' AND l.granted);`, 'owned gate did not acquire its advisory lock');
    const ddl = owned.psqlAsync(`SET application_name=${q(ddlName)}; BEGIN; LOCK TABLE pg_catalog.pg_proc IN ROW EXCLUSIVE MODE; ${drifts355[1][1]} SELECT pg_advisory_xact_lock(${key}); COMMIT;`);
    let migration: Promise<string> | undefined;
    try {
    await waitForSql(`SELECT EXISTS(SELECT 1 FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.application_name=${q(ddlName)} AND l.relation='pg_catalog.pg_proc'::regclass AND l.mode='RowExclusiveLock' AND l.granted);`, 'actual DDL did not hold the catalog lock');
    migration = owned.psqlAsync(`SET application_name=${q(migrationName)}; ${forward355}`).then(() => '', error => String(error.message));
        await waitForSql(`SELECT EXISTS(SELECT 1 FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.application_name=${q(migrationName)} AND l.relation='pg_catalog.pg_proc'::regclass AND l.mode='ShareRowExclusiveLock' AND NOT l.granted);`, 'migration must wait behind the actual catalog writer');
        await gate; await ddl;
        assert.match(await migration, /355 refuses.*overload/);
        assert.equal(completeFinancialState(f), state);
        assert.equal(catalogState(), before);
    } finally {
        await Promise.allSettled([gate, ddl, migration]);
        owned.script('DROP FUNCTION IF EXISTS public.allocate_ad_campaign_budget(uuid,uuid,bigint,text,text,uuid,integer);');
    }
    owned.script(forward355);
    assert.equal(completeFinancialState(f), state);
});

test('355 refuses an actual uncommitted DDL transaction even after statement catalog locks are released', async () => {
    const f = fixture(), state = completeFinancialState(f), before = catalogState();
    const key = BigInt('0x' + randomUUID().replaceAll('-', '').slice(0, 12)).toString();
    const gateName = 'n8-ddl-xid-gate-' + randomUUID().slice(0, 8), ddlName = 'n8-ddl-xid-' + randomUUID().slice(0, 8);
    const gate = owned.psqlAsync(`SET application_name=${q(gateName)}; SELECT pg_advisory_lock(${key}); SELECT pg_sleep(3);`);
    await waitForSql(`SELECT EXISTS(SELECT 1 FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.application_name=${q(gateName)} AND l.locktype='advisory' AND l.granted);`, 'DDL transaction gate did not acquire');
    const ddl = owned.psqlAsync(`SET application_name=${q(ddlName)}; BEGIN; ${drifts355[1][1]} SELECT pg_advisory_xact_lock(${key}); ROLLBACK;`);
    try {
        await waitForSql(`SELECT EXISTS(SELECT 1 FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.application_name=${q(ddlName)} AND l.locktype='advisory' AND NOT l.granted);`, 'actual uncommitted DDL transaction must be held');
        assert.match(owned.psqlExpectError(forward355), /355 refuses concurrent\/prepared writes/);
        assert.equal(completeFinancialState(f), state); assert.equal(catalogState(), before);
    } finally { await Promise.allSettled([gate, ddl]); }
    owned.script(forward355);
    assert.equal(completeFinancialState(f), state); assert.equal(catalogState(), before);
});

test('355 waits for a real Gateway financial writer and retains exactly its one committed effect', async () => {
    const f = fixture();
    const key = BigInt('0x' + randomUUID().replaceAll('-', '').slice(0, 12)).toString();
    const gateName = 'n8-money-gate-' + randomUUID().slice(0, 8), migrationName = 'n8-money-migration-' + randomUUID().slice(0, 8);
    const gate = owned.psqlAsync(`SET application_name=${q(gateName)}; SELECT pg_advisory_lock(${key}); SELECT pg_sleep(3);`);
    await waitForSql(`SELECT EXISTS(SELECT 1 FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.application_name=${q(gateName)} AND l.locktype='advisory' AND l.granted);`, 'money gate did not acquire its lock');
    owned.script(`CREATE FUNCTION public.n8_budget_writer_gate() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.site_id=${q(f.siteId)}::uuid AND NEW.entry_type='allocated' THEN PERFORM pg_advisory_xact_lock(${key}); END IF; RETURN NEW; END $$;
      CREATE TRIGGER n8_budget_writer_gate BEFORE INSERT ON ad_credit_ledger_entries FOR EACH ROW EXECUTE FUNCTION public.n8_budget_writer_gate();`);
    const writer = send(f, 'budget', 100, '355-held-financial-writer');
    await waitForSql(`SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND NOT granted);`, 'real Gateway writer must be held at its ledger boundary');
    const migration = owned.psqlAsync(`SET application_name=${q(migrationName)}; ${forward355}`).then(() => '', error => String(error.message));
    try {
        await waitForSql(`SELECT EXISTS(SELECT 1 FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.application_name=${q(migrationName)} AND l.relation='public.ad_credit_ledger_entries'::regclass AND l.mode='AccessExclusiveLock' AND NOT l.granted);`, 'migration must wait for the actual financial effect before its source checks');
        await gate;
        const response = await writer; assert.equal(response.status, 200, response.text);
        const refusal = await migration;
        assert.ok(refusal === '' || /355 refuses concurrent/.test(refusal), `only an explicit current-writer refusal is allowed: ${refusal}`);
        await gateway.settle();
    } finally {
        await Promise.allSettled([gate, writer, migration]);
        owned.script('DROP TRIGGER n8_budget_writer_gate ON ad_credit_ledger_entries; DROP FUNCTION public.n8_budget_writer_gate();');
    }
    assert.equal(conserved(f).entries, 2); assert.equal(conserved(f).balance, 900);
    const state = completeFinancialState(f); owned.script(forward355);
    assert.equal(completeFinancialState(f), state);
});

test('lost actual HTTP reply and pooled transport restart replay the same durable operation after current authority checks', async () => {
    const f = fixture();
    let dropReply = true;
    const bridge = createServer(async (request, response) => {
        try {
            const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
            const headers = new Headers();
            for (const [name, value] of Object.entries(request.headers)) if (typeof value === 'string') headers.set(name, value);
            const result = await gateway.request(request.url || '/', { method: request.method, headers, body: Buffer.concat(chunks).toString() });
            if (dropReply && result.status === 200) { dropReply = false; response.destroy(); return; }
            response.writeHead(result.status, Object.fromEntries(result.headers)); response.end(result.text);
        } catch { response.destroy(); }
    });
    await new Promise<void>(resolve => bridge.listen(0, '127.0.0.1', resolve));
    const address = bridge.address(); assert.ok(address && typeof address !== 'string');
    const url = `http://127.0.0.1:${address.port}/v1/ads/campaigns/${f.campaignId}/budget`;
    const request = async () => fetch(url, { method: 'POST', headers: await signedIdentityHeaders(f.owner.id, f.owner.email, f.siteId),
        body: JSON.stringify({ store_id: f.siteId, amount_minor: 100, idempotency_key: '355-lost-reply-stable-key' }) });
    try {
        await assert.rejects(request(), TypeError);
        await gateway.settle();
        const committed = completeFinancialState(f); assert.equal(conserved(f).entries, 2);
        await closePooledSqlClients();
        gateway = new Gateway(gatewayEnv(owned, keys, proxy.env()));
        const replay = await request(); assert.equal(replay.status, 200);
        assert.equal((await replay.json() as { data: { replayed: boolean } }).data.replayed, true);
        assert.equal(completeFinancialState(f), committed);
        owned.script(`UPDATE sites SET user_id=${q(f.stranger.id)}::uuid,custom_user_id=${q(f.stranger.id)}::uuid WHERE id=${q(f.siteId)}::uuid;`);
        assert.equal((await request()).status, 403, 'a durable retry still checks current owner authority');
        assert.equal(completeFinancialState(f), committed);
    } finally {
        bridge.closeAllConnections(); await new Promise<void>((resolve, reject) => bridge.close(error => error ? reject(error) : resolve()));
    }
});
