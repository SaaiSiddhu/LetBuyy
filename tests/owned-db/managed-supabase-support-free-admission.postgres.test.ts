import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {requireOwnedDatabase,createOwnedManagedSupabaseFixture} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {compileManagedMigration,compileManagedMigrationBatch,compileManagedJournalBatch,MANAGED_HISTORY_DIGEST_SQL} from '../../scripts/supabase/managed-migration-artifact.mjs';
import {newSyntheticTenant,seedSyntheticTenant} from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
import {buildLiquidThemePackagePersistencePayload} from '../../packages/theme-engine/src/theme-bundle';

const parent=requireOwnedDatabase();
const root='database/supabase/migrations';
const files=readdirSync(root).filter(p=>p.endsWith('.sql')).sort();
const read=(name:string)=>readFileSync(root+'/'+name,'utf8');
const entries=(from:number,through:number)=>files.filter(name=>Number(name.slice(0,3))>=from&&Number(name.slice(0,3))<=through).map(name=>({name,source:read(name)}));
const batch=(from:number,through:number)=>compileManagedMigrationBatch(entries(from,through),randomUUID());
const name353='353_approved_platform_job_recovery.sql';

test('support-free admission works as managed postgres without a provider helper, retaining permission and data safeguards', {timeout:360_000}, async t=>{
    const fixture=await createOwnedManagedSupabaseFixture(parent);
    const {psql,admin}=fixture;
    const denied=(sql:string,pattern:RegExp)=>assert.match(fixture.psqlExpectError(sql),pattern);
    try {
        assert.equal(psql("SELECT current_user='postgres' AND session_user='postgres' AND NOT rolsuper FROM pg_roles WHERE rolname=current_user;"),'t');
        assert.equal(psql("SELECT current_setting('server_version_num')::integer/10000;"),'17');
        assert.equal(psql("SELECT current_setting('supautils.superuser')='supabase_admin';"),'t');
        admin('ALTER ROLE postgres SET search_path=public,extensions;');
        psql('CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;');
        psql(entries(0,346).map(e=>'SET search_path=public,extensions;\n'+e.source).join('\n'));
        const provider=JSON.parse(readFileSync('tests/fixtures/supabase-provider-events-17.6.json','utf8')) as {functions:Array<{owner:string;definition:string}>};
        for(const role of ['supabase_admin','postgres']) {
            const sql=provider.functions.filter(e=>e.owner===role).map(e=>e.definition+';').join('\n');
            if(role==='supabase_admin')admin(sql);else psql(sql);
        }
        psql("CREATE EVENT TRIGGER ensure_rls ON ddl_command_end WHEN TAG IN('CREATE TABLE','CREATE TABLE AS','SELECT INTO') EXECUTE FUNCTION public.rls_auto_enable();");
        psql(entries(347,352).map(e=>'SET search_path=public,extensions;\n'+e.source).join('\n'));
        const absent=()=>psql("SELECT to_regnamespace('letbuyy_maintenance') IS NULL;");
        assert.equal(absent(),'t');

        await t.test('original migration reproduces the blocker; a loose advisory lock does not bypass it',()=>{
            denied('BEGIN; SELECT pg_advisory_xact_lock(42); '+read(name353),/LETBUYY_PROVIDER_ADMIN_CATALOG_FENCE_REQUIRED/);
            assert.equal(psql("SELECT to_regprocedure('public.console_platform_job_snapshot_v1(uuid)') IS NULL;"),'t');
        });
        await t.test('application roles cannot create/replace/own public functions or assume the migrator',()=>{
            for(const role of ['anon','authenticated','service_role','authenticator','app_tenant']) {
                denied(`SET ROLE ${role}; CREATE FUNCTION public.syn_managed_forbidden() RETURNS int LANGUAGE sql AS 'SELECT 1';`,/permission denied/);
            }
            assert.equal(fixture.application("SELECT session_user='authenticator' AND current_user='authenticator';"),'t');
            assert.throws(()=>fixture.application('SET ROLE postgres;'),/permission denied/);
            assert.equal(psql("SELECT to_regprocedure('public.syn_managed_forbidden()') IS NULL;"),'t');
        });
        await t.test('missing window/lease refuses even a privileged direct call',()=>{
            const guard=readFileSync('database/supabase/deploy/managed-migration-admission-v1.sql','utf8');
            denied('BEGIN; '+guard,/LETBUYY_MANAGED_MAINTENANCE_WINDOW_REQUIRED/);
            denied("BEGIN; SET letbuyy.managed_migration_window='trusted-admin-v1:"+randomUUID()+"'; SELECT set_config('letbuyy.managed_migration_deadline',(clock_timestamp()+interval '30 minutes')::text,true); "+guard,/LETBUYY_MANAGED_MIGRATION_LEASE_REQUIRED/);
        });
        await t.test('unknown indirect DDL authority is refused without silently changing it',()=>{
            psql('CREATE ROLE syn_managed_ddl_parent NOLOGIN; GRANT CREATE ON SCHEMA public TO syn_managed_ddl_parent; GRANT syn_managed_ddl_parent TO authenticator;');
            try {
                denied(batch(353,353).sql,/LETBUYY_MANAGED_UNTRUSTED_DDL_AUTHORITY/);
                assert.equal(psql("SELECT pg_has_role('authenticator','syn_managed_ddl_parent','MEMBER') AND has_schema_privilege('syn_managed_ddl_parent','public','CREATE');"),'t');
            } finally {psql('REVOKE syn_managed_ddl_parent FROM authenticator; REVOKE CREATE ON SCHEMA public FROM syn_managed_ddl_parent; DROP ROLE syn_managed_ddl_parent;');}
        });
        await t.test('an unknown object owner refuses admission even without CREATE authority',()=>{
            psql("CREATE ROLE syn_managed_object_owner NOLOGIN; GRANT syn_managed_object_owner TO postgres; GRANT CREATE ON SCHEMA public TO syn_managed_object_owner; CREATE FUNCTION public.syn_managed_owned() RETURNS int LANGUAGE sql AS 'SELECT 1'; ALTER FUNCTION public.syn_managed_owned() OWNER TO syn_managed_object_owner; REVOKE CREATE ON SCHEMA public FROM syn_managed_object_owner;");
            try {denied(batch(353,353).sql,/LETBUYY_MANAGED_UNTRUSTED_OBJECT_OWNER/);}
            finally {psql('DROP FUNCTION public.syn_managed_owned(); REVOKE syn_managed_object_owner FROM postgres; DROP ROLE syn_managed_object_owner;');}
        });
        await t.test('unknown function-family state still refuses before any platform recovery authority appears',()=>{
            psql("CREATE FUNCTION public.console_platform_job_snapshot_v1(text) RETURNS jsonb LANGUAGE sql AS 'SELECT ''{}''::jsonb';");
            try {denied(batch(353,353).sql,/unexpected platform job recovery function family/);}
            finally {psql('DROP FUNCTION public.console_platform_job_snapshot_v1(text);');}
        });
        await t.test('competing runners refuse, application writes block, and interrupted work rolls back',async()=>{
            const connection=fixture.session();
            const artifact=batch(353,353),beforeCommit=artifact.sql.lastIndexOf('COMMIT;');
            try {
                await connection.query(artifact.sql.slice(0,beforeCommit));
                denied(batch(353,353).sql,/LETBUYY_MANAGED_MIGRATION_RUNNER_BUSY/);
                denied("SET lock_timeout='300ms'; UPDATE public.users_custom SET updated_at=now();",/lock timeout/);
                assert.equal(psql("SELECT count(*)>0 FROM pg_locks WHERE locktype='relation' AND mode='ShareRowExclusiveLock' AND granted AND pid<>pg_backend_pid() AND relation='public.users_custom'::regclass;"),'t');
                assert.equal(psql("SELECT count(*) FROM pg_locks WHERE locktype='relation' AND mode='ShareRowExclusiveLock' AND granted AND pid<>pg_backend_pid() AND relation='pg_catalog.pg_proc'::regclass;"),'0');
            } finally {connection.close();await connection.stopped();}
            assert.equal(psql("SELECT to_regprocedure('public.console_platform_job_snapshot_v1(uuid)') IS NULL;"),'t');
            assert.equal(psql("SELECT pg_try_advisory_lock(1818388845,1);"),'t','connection loss releases the lease');
        });
        await t.test('a backend with an existing lease refuses reentrant execution',()=>{
            denied('SELECT pg_advisory_lock(1818388845,1); '+batch(353,353).sql,/LETBUYY_MANAGED_MIGRATION_REENTRANT_SESSION/);
            assert.equal(psql("SELECT pg_try_advisory_lock(1818388845,1);"),'t','refused client termination releases the original lease');
        });
        await t.test('foreign assigned and prepared writers refuse without discarding their records',async()=>{
            const connection=fixture.session(),id=randomUUID();
            try {
                await connection.query(`BEGIN; INSERT INTO users_custom(id,email) VALUES('${id}','syn-${id}@example.invalid');`);
                denied(batch(353,353).sql,/LETBUYY_MANAGED_FOREIGN_WRITER_OR_PREPARED_TRANSACTION/);
                assert.equal(await connection.query(`SELECT count(*) FROM users_custom WHERE id='${id}';`),'1');
                await connection.query('ROLLBACK;');
            } finally {connection.close();await connection.stopped();}
            const gid='syn_managed_'+randomUUID();
            psql(`BEGIN; INSERT INTO users_custom(id,email) VALUES('${id}','syn-${id}@example.invalid'); PREPARE TRANSACTION '${gid}';`);
            try {denied(batch(353,353).sql,/LETBUYY_MANAGED_FOREIGN_WRITER_OR_PREPARED_TRANSACTION/);}
            finally {psql(`ROLLBACK PREPARED '${gid}';`);}
            assert.equal(psql(`SELECT count(*) FROM users_custom WHERE id='${id}';`),'0');
        });
        await t.test('postcondition rolls back an accidental application DDL grant',()=>{
            const source=read(name353).replace('COMMIT;','GRANT CREATE ON SCHEMA public TO authenticated;\nCOMMIT;');
            denied(compileManagedMigrationBatch([{name:name353,source}],randomUUID()).sql,/LETBUYY_MANAGED_UNTRUSTED_DDL_AUTHORITY/);
            assert.equal(psql("SELECT has_schema_privilege('authenticated','public','CREATE');"),'f');
            assert.equal(psql("SELECT to_regprocedure('public.console_platform_job_snapshot_v1(uuid)') IS NULL;"),'t');
        });
        await t.test('the fixed CLI identity requires a short expiry and exact provider-issued SET-only membership',()=>{
            admin("DO $cli$ BEGIN EXECUTE format('CREATE ROLE cli_login_postgres LOGIN NOINHERIT VALID UNTIL %L',clock_timestamp()+interval '1 day'); END $cli$; GRANT postgres TO cli_login_postgres WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;");
            denied(batch(353,353).sql,/LETBUYY_MANAGED_CLI_ROLE_PROFILE_REQUIRED/);
            admin("DO $cli$ BEGIN EXECUTE format('ALTER ROLE cli_login_postgres VALID UNTIL %L',clock_timestamp()+interval '15 minutes'); END $cli$;");
            assert.equal(psql("SELECT pg_has_role('cli_login_postgres','postgres','MEMBER') AND NOT has_schema_privilege('cli_login_postgres','public','CREATE');"),'t');
        });
        await t.test('managed postgres applies 353 through 396 and installs all ten catalog themes without provider provisioning',()=>{
            const artifact=batch(353,396);
            assert.equal(fixture.migrator("SELECT session_user='cli_login_postgres' AND current_user='postgres';"),'t');
            fixture.migrator(artifact.sql);
            assert.equal(absent(),'t');
            assert.equal(psql("SELECT count(*) FROM themes WHERE is_active AND catalog_visible AND NOT is_site_private AND owned_by_site_id IS NULL;"),'10');
            assert.equal(psql("SELECT name FROM themes WHERE slug='letbuyy-forge';"),'Circuit');
            assert.equal(psql("SELECT to_regprocedure('public.guard_subscription_tax_ddl_360()') IS NOT NULL;"),'t');
            assert.equal(psql("SELECT NOT prosecdef AND pronargs=8 AND proconfig=ARRAY['search_path=pg_catalog, public']::text[] FROM pg_proc WHERE oid='public.install_owned_theme_v1(uuid,uuid,text,jsonb,jsonb,uuid,integer,text)'::regprocedure;"),'t');
            assert.ok(artifact.manifest.migrations.every(m=>m.applicationTableLocks));
        });
        await t.test('all ten themes install into an owned library and replay without changing the store or publishing it',()=>{
            // 382 updates Threadline's catalog; the canonical schema endpoint
            // materializes its immutable version on first use. The existing
            // mounted Gateway suite tests that endpoint. For this SQL-only,
            // network-disabled provider fixture use the same canonical payload
            // builder, without inventing another schema or a migration version.
            const bundle=JSON.parse(psql("SELECT (default_template->'liquidBundle')::text FROM themes WHERE slug='letbuyy-sense';")) as Parameters<typeof buildLiquidThemePackagePersistencePayload>[0];
            const capture=buildLiquidThemePackagePersistencePayload(bundle);
            const insert=(table:'theme_packages'|'theme_package_versions'|'theme_schema_manifests'|'theme_renderer_manifests',payload:Record<string,unknown>)=>{
                const keys=Object.keys(payload);assert.ok(keys.every(key=>/^[a-z_]+$/.test(key)));
                const columns=keys.map(key=>'"'+key+'"').join(','),fields=keys.map(key=>'x."'+key+'"').join(',');
                const quoted="'"+JSON.stringify(payload).replaceAll("'","''")+"'::jsonb";
                return psql(`INSERT INTO public.${table}(${columns}) SELECT ${fields} FROM jsonb_populate_record(NULL::public.${table},${quoted}) x RETURNING id;`);
            };
            const themeId=psql("SELECT id FROM themes WHERE slug='letbuyy-sense';");
            const packageId=insert('theme_packages',{...capture.themePackage,legacy_theme_id:themeId});
            const versionId=insert('theme_package_versions',{...capture.themePackageVersion,theme_package_id:packageId,published_at:new Date().toISOString()});
            insert('theme_schema_manifests',{...capture.schemaManifest,theme_package_version_id:versionId});
            insert('theme_renderer_manifests',{...capture.rendererManifest,theme_package_version_id:versionId});
            const actor=randomUUID(),site=newSyntheticTenant('managed-catalog');
            psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${actor}','syn-${actor}@example.invalid',true);`);
            seedSyntheticTenant(psql,site);
            psql(`UPDATE sites SET custom_user_id='${actor}' WHERE id='${site.siteId}';`);
            const snapshot=()=>psql(`SELECT md5(to_jsonb(s)::text) FROM sites s WHERE id='${site.siteId}';`);
            const before=snapshot();
            const install=`DO $install$ DECLARE selected record; result jsonb; BEGIN
             FOR selected IN SELECT t.slug,t.default_template,p.id package_id,v.id version_id FROM themes t
              JOIN theme_packages p ON p.slug=t.slug AND p.deleted_at IS NULL
              JOIN theme_package_versions v ON v.theme_package_id=p.id AND v.version=t.version AND v.release_status='published' AND v.deleted_at IS NULL
              WHERE t.is_active AND t.catalog_visible AND NOT t.is_site_private AND t.owned_by_site_id IS NULL ORDER BY t.id
             LOOP
              result:=public.install_owned_theme_v1('${actor}','${site.siteId}',selected.slug,selected.default_template,
               jsonb_build_object('theme_package_id',selected.package_id,'theme_package_version_id',selected.version_id),'${site.siteId}',NULL,'synthetic-managed-install');
              IF result->>'theme_instance_id' IS NULL THEN RAISE EXCEPTION 'missing installed theme receipt'; END IF;
             END LOOP;
            END $install$;`;
            fixture.application('SET ROLE service_role; '+install);
            const library=()=>psql(`SELECT md5(jsonb_build_object('instances',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM theme_instances i WHERE store_id='${site.siteId}'),'drafts',(SELECT jsonb_agg(to_jsonb(d) ORDER BY id) FROM theme_instance_drafts d WHERE store_id='${site.siteId}'),'events',(SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM outbox_events e WHERE store_id='${site.siteId}'))::text);`);
            assert.equal(psql(`SELECT count(*) FROM theme_instances WHERE store_id='${site.siteId}' AND deleted_at IS NULL;`),'10');
            assert.equal(psql(`SELECT count(*) FROM theme_releases WHERE store_id='${site.siteId}';`),'0');
            assert.equal(snapshot(),before);
            const installed=library();fixture.application('SET ROLE service_role; '+install);
            assert.equal(library(),installed,'replay preserves every installed instance, draft and outbox event');
            assert.equal(snapshot(),before);
            for(const migration of ['393_theme_publisher_tenant_execute','387_theme_install_version_precondition']) {
                const downName=migration+'.rollback.sql',upName=migration+'.sql';
                const down=readFileSync('database/supabase/rollback/'+downName,'utf8');
                psql(compileManagedMigrationBatch([{name:downName,source:down}],randomUUID()).sql);
                psql(compileManagedMigrationBatch([{name:upName,source:read(upName)}],randomUUID()).sql);
                assert.equal(library(),installed,'paired rollback/reapply conserves the installed library');
                assert.equal(snapshot(),before);
            }
        });
        await t.test('financial source custody and app-role denial remain enforced after the new admission ends',()=>{
            denied("CREATE FUNCTION public.claim_merchant_subscription_checkout_v1(text) RETURNS jsonb LANGUAGE sql AS 'SELECT ''{}''::jsonb';",/changed known function source\/ABI\/owner\/grants\/history/);
            denied('SET ROLE authenticated; UPDATE public.migration_privilege_journal SET object_oid=0;',/permission denied/);
            assert.equal(psql("SELECT count(*) FROM public.migration_privilege_journal j JOIN pg_proc p ON p.oid=j.object_oid WHERE j.migration='360' AND j.object_signature='public.guard_subscription_tax_ddl_360()' AND j.object_definition_hash=encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex');"),'1');
        });
        await t.test('history is truthful, atomic and resumable, including exact paired rollback',()=>{
            psql(`CREATE SCHEMA IF NOT EXISTS supabase_migrations;
             CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations(version text PRIMARY KEY,statements text[],name text);
             INSERT INTO supabase_migrations.schema_migrations VALUES('20260101000176',ARRAY['-- synthetic retained provider history'],'synthetic_retained');`);
            const digest=()=>psql(MANAGED_HISTORY_DIGEST_SQL+';');
            const entry={name:'393_theme_publisher_tenant_execute.sql',source:read('393_theme_publisher_tenant_execute.sql')};
            const old=digest();
            const up=compileManagedJournalBatch([entry],randomUUID(),{expectedHistorySha256:old});
            fixture.migrator(up.sql);
            assert.equal(psql("SELECT count(*) FROM supabase_migrations.schema_migrations;"),'2');
            assert.equal(psql("SELECT statements[1] FROM supabase_migrations.schema_migrations WHERE version='393';"),compileManagedMigration(entry.source,entry.name).sql.trim());
            assert.match(psql("SELECT statements[2] FROM supabase_migrations.schema_migrations WHERE version='393';"),/^-- LETBUYY_MANAGED_EXECUTION_V1 /);
            denied(up.sql,/LETBUYY_MANAGED_HISTORY_SNAPSHOT_CHANGED/);
            denied(compileManagedJournalBatch([entry],randomUUID(),{expectedHistorySha256:digest()}).sql,/LETBUYY_MANAGED_HISTORY_VERSION_EXISTS/);
            const failed={name:'395_synthetic_journal_failure.sql',source:'BEGIN; CREATE TABLE public.syn_managed_journal_marker(id int); SELECT 1/0; COMMIT;'};
            const beforeFailure=digest();
            denied(compileManagedJournalBatch([failed],randomUUID(),{expectedHistorySha256:beforeFailure}).sql,/division by zero/);
            assert.equal(digest(),beforeFailure);
            assert.equal(psql("SELECT to_regclass('public.syn_managed_journal_marker') IS NULL;"),'t');
            const rollbackName=entry.name.replace('.sql','.rollback.sql');
            const down=compileManagedJournalBatch([{name:rollbackName,source:readFileSync('database/supabase/rollback/'+rollbackName,'utf8')}],randomUUID(),{
                expectedHistorySha256:digest(),direction:'down',forwardEntries:[entry]});
            fixture.migrator(down.sql);
            assert.equal(digest(),old,'rollback removes only its verified execution receipt, preserving older history');
            psql(compileManagedJournalBatch([entry],randomUUID(),{expectedHistorySha256:old}).sql);
            assert.equal(psql("SELECT count(*) FROM supabase_migrations.schema_migrations;"),'2');
        });
        await t.test('managed cli migrator applies397–401 and reverses included-theme policy without support or data loss',()=>{
            const library=()=>psql("SELECT md5(jsonb_build_object('instances',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM theme_instances i),'drafts',(SELECT jsonb_agg(to_jsonb(d) ORDER BY id) FROM theme_editor_drafts d),'releases',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM theme_releases r))::text);");
            const before=library();
            fixture.migrator(batch(397,401).sql);
            assert.equal(absent(),'t'); assert.equal(psql('SELECT count(*) FROM included_theme_packages_v1();'),'10'); assert.equal(library(),before);
            const downName='401_included_theme_library_allowance.rollback.sql';
            fixture.migrator(compileManagedMigrationBatch([{name:downName,source:readFileSync('database/supabase/rollback/'+downName,'utf8')}],randomUUID()).sql);
            assert.equal(psql("SELECT to_regprocedure('public.included_theme_packages_v1()') IS NULL;"),'t'); assert.equal(library(),before);
            fixture.migrator(batch(401,401).sql);
            assert.equal(psql('SELECT count(*) FROM included_theme_packages_v1();'),'10'); assert.equal(library(),before);
            for(const role of ['anon','authenticated','app_tenant']) denied(`SET ROLE ${role};SELECT included_theme_packages_v1();`,/permission denied/);
        });
    } finally {await fixture.close();}
});
