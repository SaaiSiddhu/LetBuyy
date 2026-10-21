// A separate, fresh official provider image: no recovery data, hosted endpoint,
// developer configuration or superuser-shaped application migration session.
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { requireOwnedDatabase, createOwnedManagedSupabaseFixture } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
import { planSubscriptionTaxSnapshot } from '@letbuyy/billing-core';

const parent = requireOwnedDatabase();
const migrationRoot = 'database/supabase/migrations';
const read = (path: string) => readFileSync(path, 'utf8');
const literal = (value: unknown) => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
const helper = 'letbuyy_maintenance.lock_catalogs_v1()';

test('managed migrations require provider-admin provisioning and retain native locks, source custody and tax receipts', { timeout: 180_000 }, async t => {
    assert.ok(parent.database, 'the standard runner first proves ownership');
    const fixture = await createOwnedManagedSupabaseFixture(parent);
    const { psql, admin, session } = fixture;
    const denied = (sql: string, reason: RegExp) => assert.match(fixture.psqlExpectError(sql), reason);
    const sessions: Array<ReturnType<typeof session>> = [];
    let migrator: ReturnType<typeof session> | undefined;
    try {
        assert.equal(psql("SELECT rolsuper FROM pg_roles WHERE rolname=current_user;"), 'f');
        assert.equal(psql("SELECT current_setting('server_version_num')::int/10000;"), '17');
        assert.equal(psql("SELECT has_parameter_privilege(current_user,'letbuyy.subscription_checkout_version','SET');"), 'f');
        assert.equal(psql("SELECT to_regclass('public.sites') IS NULL;"), 't');
        assert.equal(psql("SELECT current_setting('supautils.superuser')='supabase_admin' AND current_setting('supautils.privileged_role')='supabase_privileged_role' AND current_setting('session_preload_libraries') LIKE '%supautils%';"), 't');
        // This image adds auth to postgres's default search path; hosted LetBuyy
        // uses the verified canonical public/extensions profile. Match that
        // deployment setting in the owned fixture without relaxing 311/361.
        admin('ALTER ROLE postgres SET search_path=public,extensions;');
        psql('CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;');
        const files = readdirSync(migrationRoot).filter(path => path.endsWith('.sql')).sort();
        const replay = (from: number, through: number) => files.filter(path => { const n = Number(path.split('_')[0]); return n >= from && n <= through; }).map(path => `SET search_path=public,extensions; SET check_function_bodies=on; SET row_security=on;\n` + read(`${migrationRoot}/${path}`)).join('\n');
        psql(replay(0, 346));
        const provider = JSON.parse(read('tests/fixtures/supabase-provider-events-17.6.json'));
        for (const role of ['supabase_admin', 'postgres'] as const) {
            const statements = provider.functions.filter((entry: { owner: string }) => entry.owner === role).map((entry: { definition: string }) => entry.definition + ';');
            if (role === 'supabase_admin') admin(statements.join('\n')); else psql(statements.join('\n'));
        }
        psql("CREATE EVENT TRIGGER ensure_rls ON ddl_command_end WHEN TAG IN('CREATE TABLE','CREATE TABLE AS','SELECT INTO') EXECUTE FUNCTION public.rls_auto_enable();");
        const expectedProvider = JSON.parse(read('database/supabase/deploy/provider-event-profile-17.6.json'));
        for (const event of expectedProvider.events) assert.equal(psql(`SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc WHERE oid='${event.function}'::regprocedure;`), event.body_sha256, event.name);

        const owner = randomUUID(), site = newSyntheticTenant('managed-admission');
        psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${owner}','syn-managed-${owner}@example.invalid',true);`);
        seedSyntheticTenant(psql, site);
        psql(`UPDATE sites SET custom_user_id='${owner}' WHERE id='${site.siteId}';`);
        const bootstrap = read('database/supabase/deploy/provider-admin-catalog-fence.sql');
        const retirement = read('database/supabase/deploy/provider-admin-catalog-fence.rollback.sql');
        const fence = replay(353, 353).match(/DO \$managed_catalog_fence\$[\s\S]*?END \$managed_catalog_fence\$;/)![0];
        await t.test('347 uses exact function-scoped markers, denies unknown versions and restores the caller setting on the same backend', () => {
            psql(replay(347, 352));
            assert.match(psql("SELECT proconfig FROM pg_proc WHERE oid='public.claim_merchant_subscription_checkout_v1(uuid,uuid,text,jsonb,jsonb)'::regprocedure;"), /application_name=claim_merchant_subscription_checkout_v1:347/);
            for (const role of ['anon', 'authenticated', 'app_tenant']) denied(`SET ROLE ${role}; SELECT public.claim_merchant_subscription_checkout_v1(NULL,NULL,NULL,'{}');`, /permission denied for function/);
            assert.equal(psql("SELECT has_parameter_privilege(current_user,'letbuyy.subscription_checkout_version','SET');"), 'f');
            assert.equal(psql("SET application_name='synthetic-caller'; SELECT public.claim_merchant_subscription_checkout_v1(NULL,NULL,NULL,'{}')->>'code'; SELECT current_setting('application_name');"), 'SUBSCRIPTION_OWNER_REQUIRED\nsynthetic-caller');
            psql(`INSERT INTO plans(site_type,slug,name,price_monthly_inr,price_yearly_inr,products_limit,is_active,trial_days,status,purchasable) VALUES('store','free','Synthetic managed free',0,0,25,true,0,'available',true) ON CONFLICT(site_type,slug) DO NOTHING;`);
            const claim = (key: string) => `DO $probe$ DECLARE p public.plans%ROWTYPE; result jsonb; BEGIN
                SELECT * INTO p FROM plans WHERE site_type='store' AND slug='free';
                result:=public.claim_merchant_subscription_checkout_v1('${owner}','${site.siteId}','${key}',
                  jsonb_build_object('plan_slug','free','site_type','store','billing_period','monthly'),
                  jsonb_build_object('mode','free_activation','amount_minor',0,'currency','INR','plan',to_jsonb(p),
                   'response',jsonb_build_object('checkout_mode','free_activation','amount',0,'currency','INR','billing_period','monthly','recurring',false,'is_promo',false)));
                IF result->>'code' IS DISTINCT FROM 'SUBSCRIPTION_CONTEXT_INVALID' THEN RAISE EXCEPTION 'unknown marker was admitted: %',result; END IF;
                END $probe$;`;
            for (const suffix of ['3479', '347:unknown', '346']) {
                psql(`BEGIN; ALTER FUNCTION public.claim_merchant_subscription_checkout_v1(uuid,uuid,text,jsonb,jsonb) SET application_name='claim_merchant_subscription_checkout_v1:${suffix}'; ${claim(randomUUID())} ROLLBACK;`);
            }
            const activationInput = { user_id: owner, store_id: site.siteId,
                plan_id: psql("SELECT id FROM plans WHERE site_type='store' AND slug='free';"),
                plan_slug: 'free', plan_name: 'Synthetic managed free', billing_period: 'monthly', amount_paid: 0,
                payment_gateway: null, period_start: '2026-10-01T00:00:00Z', period_end: '2026-11-01T00:00:00Z',
                products_limit: 25, invoice_number: 'SYN-MANAGED', invoice_description: 'Synthetic marker admission',
                tax_amount: 0, total_amount: 0, subscription_checkout_id: randomUUID(), subscription_checkout_key: randomUUID(),
                subscription_checkout_request: { plan_slug: 'free', site_type: 'store', billing_period: 'monthly' } };
            const activation = `SELECT public.activate_merchant_subscription_v1(${literal(activationInput)})->>'code';`;
            assert.equal(psql(activation), 'SUBSCRIPTION_CHECKOUT_CONFLICT', 'known catalog version reaches the missing receipt check');
            for (const suffix of ['3479', '347:unknown', '346']) {
                assert.equal(psql(`BEGIN; ALTER FUNCTION public.activate_merchant_subscription_v1(jsonb) SET application_name='activate_merchant_subscription_v1:${suffix}'; ${activation} ROLLBACK;`), 'SUBSCRIPTION_CONTEXT_INVALID');
            }
            assert.equal(psql(`SELECT count(*) FROM billing_history WHERE site_id='${site.siteId}';`), '0');
        });
        await t.test('managed account cannot self-install; absent helper and a forged advisory lease fail closed', () => {
            denied(bootstrap, /LETBUYY_PROVIDER_ADMIN_INSTALL_REQUIRED/);
            denied('BEGIN; SELECT pg_advisory_xact_lock(42); ' + fence, /LETBUYY_PROVIDER_ADMIN_CATALOG_FENCE_REQUIRED/);
            assert.equal(psql("SELECT to_regnamespace('letbuyy_maintenance') IS NULL;"), 't');
        });
        // This is the ONLY privileged provisioning step, in an owned synthetic
        // cluster. Hosted use remains blocked until the provider installs it.
        admin(bootstrap);
        await t.test('application roles cannot invoke, replace, drop, regrant or own the admin helper', () => {
            for (const role of ['anon', 'authenticated', 'app_tenant', 'service_role']) denied(`SET ROLE ${role}; SELECT ${helper};`, /permission denied for schema/);
            denied(`ALTER FUNCTION ${helper} SECURITY INVOKER;`, /must be owner/);
            denied(`DROP FUNCTION ${helper};`, /must be owner/);
            denied(`CREATE OR REPLACE FUNCTION ${helper} RETURNS void LANGUAGE plpgsql AS 'BEGIN RETURN; END';`, /permission denied for schema|must be owner/);
            psql(`GRANT EXECUTE ON FUNCTION ${helper} TO service_role;`);
            assert.equal(psql(`SELECT has_function_privilege('service_role','${helper}','EXECUTE');`), 'f', 'warning-only GRANT must not confer authority');
        });
        migrator = session(); sessions.push(migrator);
        await migrator.query('SET search_path=public,extensions; SET lock_timeout=\'5s\';');
        const unknownRole = 'syn_managed_parent_' + randomBytes(5).toString('hex');
        psql(`CREATE ROLE ${unknownRole}; CREATE FUNCTION public.syn_event() RETURNS event_trigger LANGUAGE plpgsql AS 'BEGIN RETURN; END'; CREATE EVENT TRIGGER syn_event ON ddl_command_start EXECUTE FUNCTION public.syn_event();`);
        await migrator.query(`BEGIN; SELECT ${helper};`);
        await t.test('native catalog locks survive definer return and block skipped-trigger, role and event races', () => {
            const held = JSON.parse(psql(`SELECT jsonb_agg(c.relname ORDER BY c.relname) FROM pg_locks l JOIN pg_class c ON c.oid=l.relation WHERE l.mode='ShareRowExclusiveLock' AND l.granted AND l.pid<>pg_backend_pid() AND c.relnamespace='pg_catalog'::regnamespace;`));
            const profile = JSON.parse(read('database/supabase/deploy/provider-admin-catalog-fence-profile.json'));
            assert.deepEqual(held, profile.catalogs);
            const probes = [
                'CREATE TABLE public.syn_foreign_ddl(id uuid);',
                "CREATE FUNCTION public.syn_foreign_ddl() RETURNS int LANGUAGE sql AS 'SELECT 1';",
                'ALTER ROLE app_tenant LOGIN;', `GRANT ${unknownRole} TO app_tenant;`,
                'ALTER EVENT TRIGGER syn_event DISABLE;',
                "SET session_replication_role='replica'; CREATE TABLE public.syn_replica(id uuid);",
                'CREATE EXTENSION hstore WITH SCHEMA public;', 'CREATE PUBLICATION syn_publication;',
            ];
            for (const sql of probes) denied("SET lock_timeout='350ms'; " + sql, /lock timeout/);
            assert.equal(psql("SELECT to_regclass('public.syn_foreign_ddl') IS NULL AND to_regprocedure('public.syn_foreign_ddl()') IS NULL AND NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname='hstore') AND NOT EXISTS(SELECT 1 FROM pg_publication WHERE pubname='syn_publication');"), 't');
        });
        await migrator.query('ROLLBACK;');
        psql(`DROP EVENT TRIGGER syn_event; DROP FUNCTION public.syn_event(); DROP ROLE ${unknownRole};`);
        await t.test('prior uncommitted DDL fails writer admission; rollback and interrupted connection release native locks', async () => {
            const neighbor = session(); sessions.push(neighbor);
            await neighbor.query('BEGIN; CREATE TABLE public.syn_prior_ddl(id uuid);');
            try { denied(replay(353, 353), /concurrent\/prepared writes/); }
            finally { await neighbor.query('ROLLBACK;'); }
            await neighbor.query(`BEGIN; SELECT ${helper};`);
            denied(`BEGIN; SELECT ${helper};`, /could not obtain lock/);
            neighbor.close(); await neighbor.stopped();
            psql('BEGIN; CREATE TABLE public.syn_after_interrupt(id uuid); ROLLBACK;');
            assert.equal(psql("SELECT to_regclass('public.syn_prior_ddl') IS NULL AND to_regclass('public.syn_after_interrupt') IS NULL;"), 't');
        });
        await t.test('changed admin-helper metadata refuses admission without normalizing it', () => {
            admin(`ALTER FUNCTION ${helper} SET search_path=pg_catalog;`);
            try { denied('BEGIN; ' + fence, /LETBUYY_PROVIDER_ADMIN_CATALOG_FENCE_REQUIRED/); }
            finally { admin(`ALTER FUNCTION ${helper} SET search_path=pg_catalog,pg_temp;`); }
        });
        await migrator.query(replay(353, 359));
        const probe360 = () => replay(360, 360);
        await t.test('assigned and prepared foreign writers refuse admission without deleting their state', async () => {
            const writer = session(); sessions.push(writer); const id = randomUUID();
            await writer.query(`BEGIN; INSERT INTO users_custom(id,email) VALUES('${id}','syn-uncommitted-${id}@example.invalid');`);
            denied(probe360(), /foreign assigned or prepared transactions/);
            await writer.query('ROLLBACK;');
            const gid = 'syn_managed_' + randomBytes(8).toString('hex');
            psql(`BEGIN; INSERT INTO users_custom(id,email) VALUES('${id}','syn-prepared-${id}@example.invalid'); PREPARE TRANSACTION '${gid}';`);
            try { denied(probe360(), /foreign assigned or prepared transactions/); assert.equal(psql(`SELECT count(*) FROM pg_prepared_xacts WHERE gid='${gid}';`), '1'); }
            finally { psql(`ROLLBACK PREPARED '${gid}';`); }
            assert.equal(psql(`SELECT count(*) FROM users_custom WHERE id='${id}';`), '0');
        });
        await t.test('unknown role membership is refused and not silently normalized', () => {
            const role = 'syn_managed_unknown_' + randomBytes(5).toString('hex');
            psql(`CREATE ROLE ${role}; GRANT app_tenant TO ${role};`);
            try { denied(probe360(), /unknown critical role or membership profile/); assert.equal(psql(`SELECT pg_has_role('${role}','app_tenant','MEMBER');`), 't'); }
            finally { psql(`REVOKE app_tenant FROM ${role}; DROP ROLE ${role};`); }
        });
        await t.test('unknown custody ACL is refused and remains observable until explicitly removed', () => {
            psql('GRANT UPDATE ON public.migration_privilege_journal TO authenticated;');
            try {
                denied(probe360(), /unknown private journal ACL/);
                assert.equal(psql("SELECT has_table_privilege('authenticated','public.migration_privilege_journal','UPDATE');"), 't');
            } finally { psql('REVOKE UPDATE ON public.migration_privilege_journal FROM authenticated;'); }
        });
        await migrator.query(replay(360, 360));
        await t.test('source custody is sealed by the historical full-definition receipt and app roles retain no journal writes', () => {
            assert.equal(psql("SELECT count(*) FROM public.migration_privilege_journal j JOIN pg_proc p ON p.oid=j.object_oid WHERE j.migration='360' AND j.object_signature='public.guard_subscription_tax_ddl_360()' AND j.object_definition_hash=encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex');"), '1');
            assert.equal(psql("SELECT prosrc LIKE '%/*TAX360_BINDING_BASE64:%' FROM pg_proc WHERE oid='public.guard_subscription_tax_ddl_360()'::regprocedure;"), 't');
            assert.equal(psql("SELECT string_agg(privilege_type,',' ORDER BY privilege_type) FROM aclexplode((SELECT relacl FROM pg_class WHERE oid='public.migration_privilege_journal'::regclass))a WHERE grantee='service_role'::regrole;"), 'SELECT');
            assert.equal(psql("SELECT count(*) FROM migration_privilege_journal WHERE migration='360' AND privilege='MAINTAIN' AND action='revoked';"), '1');
        });
        await t.test('empty downgrade and forward reapply preserve the populated tenant and private source authority', async () => {
            const snapshot = psql(`SELECT md5(to_jsonb(s)::text) FROM sites s WHERE id='${site.siteId}';`);
            await migrator!.query(read('database/supabase/rollback/360_subscription_tax_quote_snapshot.rollback.sql'));
            assert.equal(psql("SELECT to_regprocedure('public.guard_subscription_tax_ddl_360()') IS NULL;"), 't');
            assert.equal(psql(`SELECT md5(to_jsonb(s)::text) FROM sites s WHERE id='${site.siteId}';`), snapshot);
            await migrator!.query(replay(360, 360));
        });
        t.diagnostic('MANAGED_ROLE_PROFILE ' + psql("SELECT jsonb_agg(jsonb_build_object('name',rolname,'super',rolsuper,'inherit',rolinherit,'createrole',rolcreaterole,'createdb',rolcreatedb,'login',rolcanlogin,'replication',rolreplication,'bypassrls',rolbypassrls,'connection_limit',rolconnlimit,'has_expiry',rolvaliduntil IS NOT NULL,'config',rolconfig) ORDER BY rolname) FROM pg_roles WHERE rolname IN('postgres','anon','authenticated','app_tenant','service_role','authenticator');"));
        t.diagnostic('MANAGED_ADMISSION_STATE ' + await migrator.query("SELECT jsonb_build_object('settings',(SELECT jsonb_object_agg(name,setting) FROM pg_settings WHERE name IN('check_function_bodies','session_replication_role','default_tablespace','temp_tablespaces','default_table_access_method')),'events',(SELECT jsonb_agg(jsonb_build_object('name',evtname,'event',evtevent,'enabled',evtenabled,'owner',pg_get_userbyid(evtowner),'tags',evttags,'function',p.oid::regprocedure::text,'body_sha256',encode(sha256(convert_to(prosrc,'UTF8')),'hex'),'custody_matches',EXISTS(SELECT 1 FROM migration_privilege_journal j WHERE j.migration='360' AND j.object_oid=p.oid AND j.object_definition_hash=encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex')))) FROM pg_event_trigger e JOIN pg_proc p ON p.oid=e.evtfoid));"));
        await migrator.query(replay(361, 381));
        await t.test('the financial event guard rejects changed custody and unexpected overloads after maintenance ends', () => {
            denied("CREATE FUNCTION public.claim_merchant_subscription_checkout_v1(text) RETURNS jsonb LANGUAGE sql AS 'SELECT ''{}''::jsonb';", /changed known function source\/ABI\/owner\/grants\/history/);
            const definition = psql("SELECT pg_get_functiondef('public.guard_subscription_tax_ddl_360()'::regprocedure);");
            assert.match(definition, /TAX360_BINDING_BASE64:/);
            denied(definition.replace('TAX360_BINDING_BASE64:', 'TAX360_BINDING_BASE64:AAAA'), /changed historical custody verifier|birth bindings|invalid|base64/);
            assert.equal(psql("SELECT pg_get_functiondef('public.guard_subscription_tax_ddl_360()'::regprocedure);"), definition);
        });
        await t.test('a canonical nonzero quote keeps exact tax amounts and prevents populated retirement', async () => {
            const plan = JSON.parse(psql("SELECT to_jsonb(p) FROM plans p WHERE slug='growth' AND site_type='store' AND is_active;"));
            const key = 'syn-managed-' + randomUUID(), request = { plan_slug: 'growth', billing_period: 'monthly' };
            const tax = planSubscriptionTaxSnapshot({
                profile: { schema_version: 1, policy_version: 'D-SUB-TAX-INCLUSIVE-V1', profile_id: 'synthetic-managed-only', profile_version: 1,
                    approval_status: 'approved', approval_reference: 'synthetic-not-live', registration_status: 'registered', supply_category: 'domestic_taxable_saas', rate_bps: 1800,
                    supplier: { name: 'Synthetic Supplier', gstin: '27AAAAA0000A1Z5', state_code: '27', country: 'IN', address: { line1: 'Synthetic', city: 'Mumbai', state: 'Maharashtra', zip: '400001', country: 'IN' } } },
                recipient: { name: 'Synthetic Recipient', gstin: null, state_code: '29', country: 'IN', address: { line1: 'Synthetic', city: 'Bengaluru', state: 'Karnataka', zip: '560001', country: 'IN' } },
                source: { actor_id: owner, site_id: site.siteId, request_key: key, plan_id: plan.id, plan_slug: 'growth', billing_period: 'monthly', price_version: 'synthetic-managed', gross_before_discount_minor: 69900, discount_minor: 0, coupon_code: null }, grossMinor: 69900,
            });
            const quote = { plan, mode: 'razorpay_order', amount_minor: 69900, currency: 'INR', subscription_tax_snapshot: tax,
                response: { amount: 69900, currency: 'INR' }, provider_input: { amount: 69900 } };
            const result = JSON.parse(psql(`SET ROLE service_role; SELECT public.claim_merchant_subscription_checkout_v1('${owner}','${site.siteId}','${key}',${literal(request)},${literal(quote)});`));
            assert.equal(result.accepted, true); assert.equal(result.charge.amount, 69900);
            assert.equal(result.charge.subscription_tax_snapshot.tax_minor, 10663);
            const before = psql(`SELECT md5(to_jsonb(b)::text) FROM billing_history b WHERE id='${result.charge.id}';`);
            denied(read('database/supabase/rollback/360_subscription_tax_quote_snapshot.rollback.sql'), /retained tax evidence/);
            assert.equal(psql(`SELECT md5(to_jsonb(b)::text) FROM billing_history b WHERE id='${result.charge.id}';`), before);
        });
        await t.test('provider-only retirement and reinstall change no retained financial records', () => {
            const before = psql("SELECT md5(jsonb_agg(to_jsonb(b) ORDER BY id)::text) FROM billing_history b;");
            admin(retirement);
            denied('BEGIN; ' + fence, /LETBUYY_PROVIDER_ADMIN_CATALOG_FENCE_REQUIRED/);
            admin(bootstrap);
            assert.equal(psql("SELECT md5(jsonb_agg(to_jsonb(b) ORDER BY id)::text) FROM billing_history b;"), before);
        });
    } finally {
        for (const connection of sessions) connection.close();
        await fixture.close();
    }
});
