import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test,{before} from 'node:test';
import {TENANT_TABLES} from '../../tenant/tenant-tables.registry';
import {requireOwnedDatabase} from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant,seedSyntheticOrder} from './synthetic-tenant';

const owned=requireOwnedDatabase();
const tenant=newSyntheticTenant('final-tenant-a'), rival=newSyntheticTenant('final-tenant-b');
const quote=(value:string)=>`'${value.replaceAll("'","''")}'`;
const identifier=(value:string)=>`"${value.replaceAll('"','""')}"`;
interface Table {table:string;columns:string[];rls:boolean;force:boolean;tenant_select:boolean}
const catalog=():Table[]=>JSON.parse(owned.psql(`SELECT jsonb_agg(jsonb_build_object(
    'table',c.relname,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,
    'tenant_select',has_table_privilege('app_tenant',c.oid,'SELECT'),
    'columns',(SELECT jsonb_agg(a.attname ORDER BY a.attnum) FROM pg_attribute a
        WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped)) ORDER BY c.relname)
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p');`));
const privateEvidenceTables=['payout_statement_source_orders','payout_statement_source_ledger_transactions','product_price_observations'];
// Approval consent is writable backend authority, never a tenant-manufactured row (313).
const backendOnlyTables=[...privateEvidenceTables,'sensitive_action_approvals'];
const appPolicyTables=['app_api_quotas','app_billing_charges','app_partner_agency_seats','app_reviews','app_sandbox_stores',
    'app_uninstall_feedback','app_usage_events','app_usage_meter_rollups','partner_payout_ledger_entries'];
const appActors=[tenant,rival].map(store=>({store,user:randomUUID(),developer:randomUUID(),app:randomUUID(),installation:randomUUID(),charge:randomUUID()}));
before(()=>{
    seedSyntheticTenant(owned.psql,tenant);seedSyntheticTenant(owned.psql,rival);
    seedSyntheticOrder(owned.psql,tenant);seedSyntheticOrder(owned.psql,rival);
    owned.psql(`INSERT INTO public.employees(id,email,role,store_id,status) VALUES
        (${quote(randomUUID())}::uuid,'final-role-staff-a@example.invalid','staff',${quote(tenant.siteId)}::uuid,'active'),
        (${quote(randomUUID())}::uuid,'final-role-staff-b@example.invalid','staff',${quote(rival.siteId)}::uuid,'active');`);
    for(const actor of appActors) {
        const sourceEvent=randomUUID();
        const id=(key:'user'|'developer'|'app'|'installation'|'charge')=>quote(actor[key])+'::uuid';
        const site=quote(actor.store.siteId)+'::uuid',email=quote(`app-policy-${actor.user}@example.invalid`);
        owned.script(`
            INSERT INTO public.users(id,email) VALUES (${id('user')},${email});
            INSERT INTO public.users_custom(id,email,email_verified) VALUES (${id('user')},${email},true);
            INSERT INTO public.app_developers(id,user_id,company_name,slug,status)
                VALUES (${id('developer')},${id('user')},'Synthetic policy developer',${quote('syn-policy-'+actor.developer)},'approved');
            INSERT INTO public.marketplace_apps(id,developer_id,slug,name,status)
                VALUES (${id('app')},${id('developer')},${quote('syn-app-'+actor.app)},'Synthetic policy app','published');
            INSERT INTO public.app_installations(id,app_id,store_id,installed_by)
                VALUES (${id('installation')},${id('app')},${site},${id('user')});
            INSERT INTO public.app_api_quotas(app_id,installation_id,site_id,reset_at)
                VALUES (${id('app')},${id('installation')},${site},now()+interval '1 day');
            INSERT INTO public.app_billing_charges(id,site_id,app_id,partner_id,installation_id,billing_mode,name,amount_minor,partner_amount_minor,platform_fee_minor,idempotency_key)
                VALUES (${id('charge')},${site},${id('app')},${id('developer')},${id('installation')},'recurring','Synthetic policy charge',100,80,20,${quote('syn-policy-charge-'+actor.charge)});
            INSERT INTO public.app_partner_agency_seats(developer_id,site_id) VALUES (${id('developer')},${site});
            INSERT INTO public.app_reviews(app_id,user_id,store_id,site_id,rating,status)
                VALUES (${id('app')},${id('user')},${site},${site},5,'published');
            INSERT INTO public.app_sandbox_stores(developer_id,site_id,name) VALUES (${id('developer')},${site},'Synthetic policy sandbox');
            INSERT INTO public.app_uninstall_feedback(site_id,app_id,installation_id) VALUES (${site},${id('app')},${id('installation')});
            INSERT INTO public.app_usage_events(site_id,app_id,installation_id,meter_name,quantity,period_start,period_end,idempotency_key)
                VALUES (${site},${id('app')},${id('installation')},'synthetic',1,now(),now()+interval '1 day',${quote('syn-policy-usage-'+actor.app)});
            INSERT INTO public.app_usage_meter_rollups(site_id,app_id,installation_id,meter_name,period_start,period_end)
                VALUES (${site},${id('app')},${id('installation')},'synthetic',now(),now()+interval '1 day');
            INSERT INTO public.outbox_events(site_id,store_id,event_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key,status,processed_at)
                VALUES (${site},${site},${quote(sourceEvent)}::uuid,'app',${quote(actor.app)},'app.charge.activated',
                    '{"synthetic_role_fixture":true,"provider_evidence":false}'::jsonb,${quote('syn-policy-event-'+sourceEvent)},'processed',now());
            INSERT INTO public.partner_payout_ledger_entries(partner_id,site_id,app_id,installation_id,charge_id,source_event_id,billing_mode,amount_minor,partner_amount_minor,platform_fee_minor)
                VALUES (${id('developer')},${site},${id('app')},${id('installation')},${id('charge')},${quote(sourceEvent)}::uuid,'recurring',100,80,20);
        `);
    }
});

test('nine app tables remain tenant-readable, reject rival scope/forged developer claims and preserve backend/table grants',()=>{
    for(const table of appPolicyTables) {
        const count=(site:string,subject:string)=>Number(owned.script(`BEGIN; SET LOCAL ROLE app_tenant;
            SELECT set_config('app.site_id',${quote(site)},true);
            SELECT set_config('request.jwt.claims',${quote(JSON.stringify({sub:subject}))},true);
            SELECT count(*) FROM public.${identifier(table)}; COMMIT;`).split('\n').at(-1));
        assert.equal(count(tenant.siteId,appActors[1].user),1,`${table}: a rival developer identity cannot broaden the tenant scope`);
        assert.equal(count(rival.siteId,appActors[0].user),1,`${table}: alternating stores read their own real rows`);
        assert.equal(count(randomUUID(),appActors[0].user),0,`${table}: even the real developer's identity does not replace tenant context`);
        assert.equal(Number(owned.script(`BEGIN; SET LOCAL ROLE service_role; SELECT count(*) FROM public.${identifier(table)}; COMMIT;`)),2,
            `${table}: backend reads remain unchanged`);
        const other=owned.script(`BEGIN; SET LOCAL ROLE app_tenant; SELECT set_config('app.site_id',${quote(tenant.siteId)},true);
            SELECT count(*) FROM public.${identifier(table)} WHERE site_id=${quote(rival.siteId)}::uuid; COMMIT;`);
        assert.equal(other.split('\n').at(-1),'0');
    }
    assert.match(owned.psqlExpectError('BEGIN; SET LOCAL ROLE app_tenant; SELECT * FROM public.app_developers; ROLLBACK;'),/permission denied/,
        'tenant-role repairs must not grant developer profile access');
});

test('312 rollback restores exact original policy bodies/roles and reproduces dependency failures; reapply is concurrent-safe',async()=>{
    const migration=readFileSync('database/supabase/migrations/312_separate_developer_and_tenant_policy_roles.sql','utf8');
    const rollback=readFileSync('database/supabase/rollback/312_separate_developer_and_tenant_policy_roles.rollback.sql','utf8');
    const metadata=()=>owned.psql(`SELECT jsonb_agg(jsonb_build_object('table',c.relname,'owner',c.relowner,
        'acl',c.relacl::text,'policies',(SELECT jsonb_agg(jsonb_build_object('name',p.polname,'roles',p.polroles,
            'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid),'permissive',p.polpermissive,'command',p.polcmd) ORDER BY p.polname)
            FROM pg_policy p WHERE p.polrelid=c.oid)) ORDER BY c.relname)
        FROM pg_class c WHERE c.oid IN (${appPolicyTables.map(table=>quote('public.'+table)+'::regclass').join(',')});`);
    const data=()=>owned.psql(`SELECT jsonb_build_object(${appPolicyTables.flatMap(table=>[quote(table),`(SELECT md5(jsonb_agg(to_jsonb(row) ORDER BY row.id)::text) FROM public.${identifier(table)} row)`]).join(',')});`);
    const otherJournal=()=>owned.psql("SELECT jsonb_agg(to_jsonb(j) ORDER BY migration,object_signature,grantee,privilege,action) FROM public.migration_privilege_journal j WHERE migration<>'312';");
    const developerAccess=()=>owned.psql("SELECT jsonb_build_object('acl',(SELECT relacl::text FROM pg_class WHERE oid='public.app_developers'::regclass),'roles',(SELECT jsonb_object_agg(r,has_table_privilege(r,'public.app_developers','SELECT,INSERT,UPDATE,DELETE')) FROM unnest(ARRAY['anon','authenticated','app_tenant','service_role']) r));");
    const apiViews=()=>['anon','authenticated'].map(role=>owned.script(`BEGIN; SET LOCAL ROLE ${identifier(role)};
        SELECT set_config('request.jwt.claims',${quote(JSON.stringify({sub:appActors[0].user}))},true);
        SELECT count(*) FROM public.app_developers; COMMIT;`).split('\n').at(-1));
    const original=metadata(),rows=data(),journal=otherJournal();
    const developerPrivileges=developerAccess(),views=apiViews();
    const saved=owned.psql("SELECT jsonb_agg(to_jsonb(j) ORDER BY object_signature) FROM public.migration_privilege_journal j WHERE migration='312';");
    assert.equal(owned.psql("SELECT count(*) FROM public.migration_privilege_journal WHERE migration='312';"),'18');
    await Promise.all([owned.psqlAsync(migration),owned.psqlAsync(migration)]);
    assert.equal(owned.psql("SELECT jsonb_agg(to_jsonb(j) ORDER BY object_signature) FROM public.migration_privilege_journal j WHERE migration='312';"),saved);
    owned.script(rollback);
    try {
    for(const table of appPolicyTables)assert.match(owned.psqlExpectError(`BEGIN; SET LOCAL ROLE app_tenant; SELECT * FROM public.${identifier(table)}; ROLLBACK;`),/permission denied for table app_developers/);
    const before=JSON.parse(metadata()),after=JSON.parse(original);
    for(let i=0;i<before.length;i++) {
        assert.equal(before[i].acl,after[i].acl);assert.equal(before[i].owner,after[i].owner);
        for(const policy of before[i].policies) {
            const current=after[i].policies.find((row:{name:string})=>row.name===policy.name);
            assert.ok(current);assert.equal(current.using,policy.using);assert.equal(current.check,policy.check);
            if(policy.using?.includes('app_developers')) {
                assert.deepEqual(policy.roles.map(String),['0']);assert.equal(current.roles.length,3);
            } else assert.deepEqual(current,policy);
        }
    }
    assert.equal(data(),rows);assert.equal(otherJournal(),journal);
    assert.equal(developerAccess(),developerPrivileges);assert.deepEqual(apiViews(),views,'existing API developer-profile behavior is conserved');
    owned.script(migration);assert.equal(metadata(),original);assert.equal(data(),rows);
    assert.equal(otherJournal(),journal);
    for(const altered of [
        'ALTER POLICY app_tenant_312_guc ON public.app_reviews USING(true);',
        'ALTER POLICY app_reviews_site_or_developer_read ON public.app_reviews TO PUBLIC;',
        'ALTER POLICY app_reviews_site_or_developer_read ON public.app_reviews RENAME TO synthetic_changed_policy;',
        "DELETE FROM public.migration_privilege_journal WHERE migration='312' AND object_signature='public.app_reviews.app_tenant_312_guc';",
    ]) {
        assert.match(owned.psqlExpectError('BEGIN;'+altered+rollback),/rollback 312 refuses/);
        assert.equal(metadata(),original);assert.equal(data(),rows);
    }
    assert.match(owned.psqlExpectError('BEGIN; ALTER POLICY app_tenant_312_guc ON public.app_reviews USING(true);'+migration),/migration 312 refuses changed restriction/);
    assert.equal(metadata(),original);
    assert.equal(developerAccess(),developerPrivileges);assert.deepEqual(apiViews(),views);
    } finally { owned.script(migration); }
});

test('final-schema tenant registry includes real base tables and partitions, with no missing scope column',()=>{
    const actual=catalog();
    const tenantTables=actual.filter(row=>row.table==='sites'||row.columns.some(column=>['site_id','store_id','buyer_account_id'].includes(column)));
    assert.deepEqual(TENANT_TABLES.map(row=>row.table).sort(),tenantTables.map(row=>row.table).sort());
    for(const entry of TENANT_TABLES) {
        const row=actual.find(row=>row.table===entry.table);
        assert.ok(row,entry.table);
        for(const column of entry.scopeColumns) assert.ok(row.columns.includes(column),`${entry.table}.${column} must exist`);
    }
});

test('ordinary tenant tables enforce RLS/FORCE; backend-only tables deny every API/tenant role',()=>{
    for(const role of ['anon','authenticated','app_tenant']) {
        assert.equal(owned.psql(`SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=${quote(role)};`),'f',`${role} must not bypass RLS`);
    }
    const actual=catalog();
    for(const entry of TENANT_TABLES) {
        const row=actual.find(row=>row.table===entry.table)!;
        if(backendOnlyTables.includes(entry.table)) {
            for(const role of ['anon','authenticated','app_tenant']) {
                const privileges=owned.psql(`SELECT has_table_privilege(${quote(role)},${quote('public.'+entry.table)},'SELECT,INSERT,UPDATE,DELETE');`);
                assert.equal(privileges,'f',`${entry.table}/${role}: no ordinary privilege may survive`);
                assert.match(owned.psqlExpectError(`BEGIN; SET LOCAL ROLE ${identifier(role)}; SELECT * FROM public.${identifier(entry.table)}; ROLLBACK;`),/permission denied for table/);
            }
            assert.equal(owned.psql(`SELECT has_table_privilege('service_role',${quote('public.'+entry.table)},'INSERT,UPDATE,DELETE');`),
                privateEvidenceTables.includes(entry.table)?'f':'t',`${entry.table}: preserve the existing backend writer boundary`);
            continue;
        }
        assert.equal(row.rls,true,`${entry.table}: RLS required`);
        assert.equal(row.force,true,`${entry.table}: FORCE required`);
    }
    const count=owned.script('BEGIN; SET LOCAL ROLE service_role; SELECT count(*) FROM public.product_price_observations; COMMIT;');
    assert.ok(Number(count)>0,'the private read projection has real observations, not an empty positive control');
});

test('every tenant-readable registered table returns zero rows without tenant context',()=>{
    const actual=catalog();
    const tables=TENANT_TABLES.filter(entry=>actual.find(row=>row.table===entry.table)?.tenant_select);
    assert.ok(tables.length>250,'the probe covers the final catalog, not a small selected sample');
    const counts=JSON.parse(owned.script(`BEGIN;
        CREATE TEMP TABLE synthetic_tenant_probe_results(table_name text, visible_count bigint, refusal text) ON COMMIT DROP;
        GRANT SELECT,INSERT ON synthetic_tenant_probe_results TO app_tenant;
        SET LOCAL ROLE app_tenant;
        SELECT set_config('app.site_id','',true);
        DO $probe$ DECLARE v_table text; v_count bigint;
        BEGIN
            FOREACH v_table IN ARRAY ARRAY[${tables.map(entry=>quote(entry.table)).join(',')}] LOOP
                BEGIN
                    EXECUTE format('SELECT count(*) FROM public.%I',v_table) INTO v_count;
                    INSERT INTO synthetic_tenant_probe_results VALUES (v_table,v_count,NULL);
                EXCEPTION WHEN OTHERS THEN
                    INSERT INTO synthetic_tenant_probe_results VALUES (v_table,NULL,SQLSTATE || ': ' || SQLERRM);
                END;
            END LOOP;
        END $probe$;
        RESET ROLE;
        SELECT jsonb_agg(row ORDER BY table_name) FROM synthetic_tenant_probe_results row;
        COMMIT;`).split('\n').at(-1)!);
    assert.deepEqual(counts.filter((row:{visible_count:number;refusal:string|null})=>row.visible_count!==0||row.refusal),[],
        'absence of context must expose no seeded rows; policy dependency failures remain explicit failures');
});

test('actual app_tenant alternates stores, denies foreign writes and resets local context on one database session',()=>{
    const output=owned.script(`
        BEGIN; SET LOCAL ROLE app_tenant; SELECT set_config('app.site_id',${quote(tenant.siteId)},true);
        SELECT jsonb_build_object('pid',pg_backend_pid(),'sites',(SELECT jsonb_agg(id) FROM public.sites),
            'orders',(SELECT jsonb_agg(store_id) FROM public.orders),'products',(SELECT jsonb_agg(store_id) FROM public.products)); COMMIT;
        BEGIN; SET LOCAL ROLE app_tenant; SELECT set_config('app.site_id',${quote(rival.siteId)},true);
        SELECT jsonb_build_object('pid',pg_backend_pid(),'sites',(SELECT jsonb_agg(id) FROM public.sites),
            'orders',(SELECT jsonb_agg(store_id) FROM public.orders),'products',(SELECT jsonb_agg(store_id) FROM public.products)); COMMIT;
        BEGIN; SET LOCAL ROLE app_tenant;
        SELECT jsonb_build_object('pid',pg_backend_pid(),'site',nullif(current_setting('app.site_id',true),''),'orders',(SELECT count(*) FROM public.orders)); COMMIT;
    `);
    const rows=output.split('\n').filter(line=>line.startsWith('{')).map(line=>JSON.parse(line)) as
        {pid:number;sites?:string[];orders:string[]|number;products?:string[];site?:string|null}[];
    assert.equal(new Set(rows.map(row=>row.pid)).size,1,'all transactions use the same database backend');
    for(const [index,site] of [tenant.siteId,rival.siteId].entries()) {
        assert.deepEqual(rows[index].sites,[site]);
        assert.ok(Array.isArray(rows[index].orders)&&(rows[index].orders as string[]).length>0);
        assert.ok((rows[index].orders as string[]).every(value=>value===site));
        assert.ok(rows[index].products?.length);assert.ok(rows[index].products?.every(value=>value===site));
    }
    assert.equal(rows[2].site,null);assert.equal(rows[2].orders,0);
    const id=randomUUID();
    assert.match(owned.psqlExpectError(`BEGIN; SET LOCAL ROLE app_tenant; SELECT set_config('app.site_id',${quote(tenant.siteId)},true);
        INSERT INTO public.products(id,store_id,site_id,name,price) VALUES (${quote(id)}::uuid,${quote(rival.siteId)}::uuid,${quote(rival.siteId)}::uuid,'Synthetic refused foreign product',1); COMMIT;`),/row-level security/);
    assert.equal(owned.psql(`SELECT count(*) FROM public.products WHERE id=${quote(id)}::uuid;`),'0');
    const foreignUpdate=owned.script(`BEGIN; SET LOCAL ROLE app_tenant; SELECT set_config('app.site_id',${quote(tenant.siteId)},true);
        WITH changed AS (UPDATE public.products SET name='Synthetic refused foreign edit' WHERE store_id=${quote(rival.siteId)}::uuid RETURNING id)
        SELECT count(*) FROM changed; COMMIT;`);
    assert.equal(foreignUpdate.split('\n').at(-1),'0');
});

test('store restriction preserves public/backend reads, rejects drift, and rollback/reapply reproduces then closes visibility',()=>{
    const migration=readFileSync('database/supabase/migrations/310_restrict_tenant_store_visibility.sql','utf8');
    const rollback=readFileSync('database/supabase/rollback/310_restrict_tenant_store_visibility.rollback.sql','utf8');
    const scope=`SELECT set_config('app.site_id',${quote(tenant.siteId)},true);`;
    const count=(role:string)=>Number(owned.script(`BEGIN; SET LOCAL ROLE ${identifier(role)}; ${scope}
        SELECT count(*) FROM public.sites WHERE id IN (${quote(tenant.siteId)}::uuid,${quote(rival.siteId)}::uuid); COMMIT;`).split('\n').at(-1));
    assert.equal(count('app_tenant'),1);
    for(const role of ['anon','authenticated','service_role'])assert.equal(count(role),2,`${role}: existing public/backend visibility is preserved`);
    const policy=()=>owned.psql("SELECT md5(pg_get_expr(polqual,polrelid)||pg_get_expr(polwithcheck,polrelid)||polroles::text||polpermissive::text) FROM pg_policy WHERE polrelid='public.sites'::regclass AND polname='app_tenant_sites_restrictive_guc';");
    const before=policy();owned.script(migration);owned.script(migration);assert.equal(policy(),before);
    assert.match(owned.psqlExpectError("BEGIN; ALTER POLICY app_tenant_sites_restrictive_guc ON public.sites USING(true);"+rollback),/rollback 310 refuses to run/);
    assert.equal(policy(),before);
    assert.match(owned.psqlExpectError("BEGIN; ALTER POLICY app_tenant_sites_restrictive_guc ON public.sites USING(true);"+migration),/migration 310 refuses/);
    assert.equal(policy(),before);
    owned.script(rollback);assert.equal(count('app_tenant'),2,'the old permissive public policy really bypasses the tenant GUC');
    owned.script(migration);assert.equal(count('app_tenant'),1);assert.equal(policy(),before);
    for(const role of ['anon','authenticated','service_role'])assert.equal(count(role),2);
});

test('employee policy reuses canonical admin predicate, preserves scoped rows and refuses stale rollback',async()=>{
    const migration=readFileSync('database/supabase/migrations/311_reuse_canonical_employee_admin_policy.sql','utf8');
    const rollback=readFileSync('database/supabase/rollback/311_reuse_canonical_employee_admin_policy.rollback.sql','utf8');
    const query=`BEGIN; SET LOCAL ROLE app_tenant; SELECT set_config('app.site_id',${quote(tenant.siteId)},true);
        SELECT count(*) FROM public.employees; COMMIT;`;
    assert.equal(owned.script(query).split('\n').at(-1),'1');
    assert.match(owned.psqlExpectError('BEGIN; SET LOCAL ROLE app_tenant; SELECT * FROM public.super_admin_allowlist; ROLLBACK;'),/permission denied/);
    const original=owned.psql('SELECT md5(jsonb_agg(to_jsonb(e) ORDER BY e.id)::text) FROM public.employees e;');
    await Promise.all([owned.psqlAsync(migration),owned.psqlAsync(migration)]);
    owned.script(rollback);
    assert.match(owned.psqlExpectError(query),/permission denied for table super_admin_allowlist/,'the rollback reproduces the private-table dependency');
    owned.script(migration);assert.equal(owned.script(query).split('\n').at(-1),'1');
    assert.match(owned.psqlExpectError('BEGIN; ALTER POLICY super_admin_manage_employees ON public.employees USING(true);'+rollback),/rollback 311 refuses to run/);
    assert.match(owned.psqlExpectError('BEGIN; ALTER POLICY super_admin_manage_employees ON public.employees USING(true);'+migration),/migration 311 refuses/);
    assert.equal(owned.script(query).split('\n').at(-1),'1');
    assert.equal(owned.psql('SELECT md5(jsonb_agg(to_jsonb(e) ORDER BY e.id)::text) FROM public.employees e;'),original);
    assert.equal(owned.psql("SELECT pg_get_functiondef('public.is_super_admin()'::regprocedure) LIKE '%user_id = auth.uid() AND is_active = TRUE%';"),'t',
        'the helper retains the exact original active-user predicate');
});
