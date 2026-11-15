import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {requireOwnedDatabase,createOwnedManagedSupabaseFixture} from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant} from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
import {compileManagedMigration,compileManagedMigrationBatch,compileManagedJournalBatch,MANAGED_HISTORY_DIGEST_SQL} from '../../scripts/supabase/managed-migration-artifact.mjs';

// These are synthetic databases with the actual hosted identity/order profiles.
// No endpoint, provider token, recovery archive or production row is accepted.
const parent=requireOwnedDatabase();
const root='database/supabase/migrations';
const names=readdirSync(root).filter(name=>/^\d{3}_.*\.sql$/.test(name)).sort();
const sourceHead=Math.max(...names.map(name=>Number(name.slice(0,3))));
assert.ok(sourceHead>=418,'this fixture must include the native418 source');
const read=(name:string)=>readFileSync(root+'/'+name,'utf8');
const entries=(from:number,through:number)=>names.filter(name=>Number(name.slice(0,3))>=from&&Number(name.slice(0,3))<=through).map(name=>({name,source:read(name)}));
const quote=(s:string)=>"'"+s.replaceAll("'","''")+"'";
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const registry=JSON.parse(readFileSync('config/supabase/history-aliases.json','utf8')) as {
    aliases:Array<{recorded_name:string;canonical_name:string;recorded_source_sha256:string;recorded_executed_sha256:string;canonical_source_sha256:string}>;
    legacy_timestamp_versions:Record<string,string>;
};

for(const scope of ['complete-source','native418-only'] as const)
for(const environment of ['production-413','staging-415-aliases'] as const) {
    test(environment+' '+scope+' upgrades to '+(scope==='complete-source'?sourceHead:418)+' under managed non-superuser admission without replaying or rewriting historical identities',{timeout:360_000},async t=>{
        const fixture=await createOwnedManagedSupabaseFixture(parent);
        const {psql,admin}=fixture;
        const digest=()=>psql(MANAGED_HISTORY_DIGEST_SQL+';');
        const apply=(selected:Array<{name:string;source:string}>)=>{
            const artifact=compileManagedJournalBatch(selected,randomUUID(),{expectedHistorySha256:digest()});
            psql(artifact.sql);
        };
        try {
            assert.equal(psql("SELECT current_user='postgres' AND session_user='postgres' AND NOT rolsuper FROM pg_roles WHERE rolname=current_user;"),'t');
            assert.equal(psql("SELECT current_setting('server_version_num')::integer/10000;"),'17');
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
            psql('CREATE SCHEMA IF NOT EXISTS supabase_migrations; CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations(version text PRIMARY KEY,statements text[],name text);');
            assert.equal(psql('SELECT count(*) FROM supabase_migrations.schema_migrations;'),'0');
            // Existing timestamp identities are retained, never relabelled.
            for(const entry of entries(73,352)) {
                const prefix=entry.name.slice(0,3);
                const version=Object.entries(registry.legacy_timestamp_versions).find(([,canonical])=>canonical===prefix)?.[0]??prefix;
                psql(`INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES(${quote(version)},${quote(entry.name.slice(4,-4))},ARRAY[${quote(entry.source)}]);`);
            }
            apply(entries(353,413));
            assert.equal(psql('SELECT count(*) FROM supabase_migrations.schema_migrations;'),'341');
            const owner=randomUUID(),site=newSyntheticTenant('history-upgrade');
            psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${owner}','syn-${owner}@example.invalid',true);`);
            seedSyntheticTenant(psql,site);
            psql(`UPDATE sites SET custom_user_id='${owner}' WHERE id='${site.siteId}';`);

            if(environment==='staging-415-aliases') {
                for(const alias of registry.aliases) {
                    const canonical=read(alias.canonical_name);
                    assert.equal(hash(canonical),alias.canonical_source_sha256);
                    // Reconstruct only this hash-pinned historical fixture. The
                    // canonical migration files and hosted journals are untouched.
                    const historical=alias.recorded_name==='414_atomic_warehouse_commands.sql'
                        ?canonical.replaceAll("migration='415'","migration='414'").replaceAll("VALUES('415',","VALUES('414',").replaceAll("SELECT '415',","SELECT '414',")
                        :canonical;
                    assert.equal(hash(historical),alias.recorded_source_sha256);
                    assert.equal(compileManagedMigration(historical,alias.recorded_name).receipt.executedSha256,alias.recorded_executed_sha256);
                    apply([{name:alias.recorded_name,source:historical}]);
                }
                assert.equal(psql('SELECT count(*) FROM supabase_migrations.schema_migrations;'),'343');
            } else if(scope==='complete-source') {
                apply(entries(414,415));
            }

            const command={name:'Synthetic retained location',address:'Synthetic road',city:'Chennai',state:'Tamil Nadu',country:'IN',pincode:'600001',is_default:false};
            const key='syn-history-'+randomUUID();
            const invoke=`BEGIN; SET LOCAL ROLE app_tenant; SET LOCAL app.site_id='${site.siteId}'; SET LOCAL app.actor_id='${owner}';
             SELECT public.apply_warehouse_command_v1('${site.siteId}','${owner}','${key}','location.create',NULL,${quote(JSON.stringify(command))}::jsonb,'synthetic-history-upgrade'); COMMIT;`;
            const warehousePresent=scope==='complete-source'||environment==='staging-415-aliases';
            const acknowledgment=warehousePresent?psql(invoke):undefined;
            if(warehousePresent)assert.ok(JSON.parse(acknowledgment!).command_receipt,'positive control: actual atomic warehouse acknowledgement');

            const protectedTables=['users_custom','sites',...(warehousePresent?['inventory_locations','warehouse_command_receipts']:[])];
            const columns=Object.fromEntries(protectedTables.map(table=>[table,JSON.parse(psql(`SELECT jsonb_agg(column_name ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name='${table}';`)) as string[]]));
            const snapshot=()=>Object.fromEntries(protectedTables.map(table=>[table,psql(`SELECT md5(coalesce(jsonb_agg(to_jsonb(t)-ARRAY(SELECT jsonb_object_keys(to_jsonb(t)) EXCEPT SELECT unnest(ARRAY[${columns[table].map(quote).join(',')}]::text[])) ORDER BY to_jsonb(t)::text),'[]'::jsonb)::text) FROM public.${table} t;`)]));
            const originalRows=snapshot();
            const versions=JSON.parse(psql('SELECT jsonb_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations;')) as string[];
            const historicalDigest=()=>psql(`SELECT encode(sha256(convert_to(jsonb_agg(jsonb_build_array(version,name,statements) ORDER BY version)::text,'UTF8')),'hex') FROM supabase_migrations.schema_migrations WHERE version=ANY(ARRAY[${versions.map(quote).join(',')}]::text[]);`);
            const historyBefore=historicalDigest();
            const provenanceBefore=psql("SELECT md5(jsonb_agg(to_jsonb(j) ORDER BY migration,object_signature,grantee,privilege,action)::text) FROM migration_privilege_journal j WHERE migration IN('414','415');");

            await t.test('existing versions refuse replay without changing their SQL or retained rows',()=>{
                const replay=compileManagedJournalBatch(entries(warehousePresent?414:413,warehousePresent?415:413),randomUUID(),{expectedHistorySha256:digest()});
                assert.match(fixture.psqlExpectError(replay.sql),/LETBUYY_MANAGED_HISTORY_VERSION_EXISTS/);
                assert.equal(historicalDigest(),historyBefore);assert.deepEqual(snapshot(),originalRows);
            });
            if(environment==='staging-415-aliases')await t.test('a canonical warehouse DOWN refuses the different recorded execution identity',()=>{
                const forward=entries(415,415),name='415_atomic_warehouse_commands.rollback.sql';
                const artifact=compileManagedJournalBatch([{name,source:readFileSync('database/supabase/rollback/'+name,'utf8')}],randomUUID(),{expectedHistorySha256:digest(),direction:'down',forwardEntries:forward});
                assert.match(fixture.psqlExpectError(artifact.sql),/LETBUYY_MANAGED_HISTORY_ROLLBACK_MISMATCH/);
                assert.equal(historicalDigest(),historyBefore);assert.deepEqual(snapshot(),originalRows);
            });
            await t.test('each pending entry journals its own DDL atomically with a truthful receipt',()=>{
                const pending=scope==='native418-only'?entries(418,418):entries(416,sourceHead);
                assert.deepEqual(pending.map(entry=>Number(entry.name.slice(0,3))),scope==='native418-only'?[418]:Array.from({length:sourceHead-415},(_,i)=>416+i),'every selected source migration is present exactly once');
                apply(pending);
                assert.equal(psql('SELECT count(*) FROM supabase_migrations.schema_migrations;'),String(versions.length+pending.length));
                if(scope==='native418-only'){
                    assert.equal(psql("SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version IN('416','417');"),'0','unrelated versions are not fabricated');
                    if(environment==='production-413')assert.equal(psql("SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version IN('414','415');"),'0');
                    assert.equal(psql("SELECT to_regclass('public.merchant_mobile_requests') IS NOT NULL;"),'t');
                }
                assert.equal(historicalDigest(),historyBefore);
                assert.deepEqual(snapshot(),originalRows);
                assert.equal(psql("SELECT md5(jsonb_agg(to_jsonb(j) ORDER BY migration,object_signature,grantee,privilege,action)::text) FROM migration_privilege_journal j WHERE migration IN('414','415');"),provenanceBefore);
                for(const entry of pending) {
                    const expected=compileManagedMigration(entry.source,entry.name);
                    const recorded=JSON.parse(psql(`SELECT jsonb_build_array(encode(sha256(convert_to(statements[1],'UTF8')),'hex'),encode(sha256(convert_to(statements[2],'UTF8')),'hex')) FROM supabase_migrations.schema_migrations WHERE version='${entry.name.slice(0,3)}';`)) as string[];
                    assert.equal(recorded[0],hash(expected.sql));
                    assert.equal(recorded[1],hash('-- LETBUYY_MANAGED_EXECUTION_V1 '+JSON.stringify(expected.receipt)));
                }
                assert.equal(psql("SELECT to_regnamespace('letbuyy_maintenance') IS NULL;"),'t');
            });
            if(warehousePresent)await t.test('old acknowledgement replays after upgrade with tenant boundaries intact',()=>{
                assert.equal(psql(invoke),acknowledgment);
                assert.deepEqual(snapshot(),originalRows);
                assert.equal(psql("SELECT has_function_privilege('app_tenant','public.apply_warehouse_command_v1(uuid,uuid,text,text,uuid,jsonb,text)','EXECUTE');"),'t');
                assert.equal(psql("SELECT has_table_privilege('app_tenant','public.warehouse_command_receipts','SELECT');"),'f');
                const wrong=invoke.replaceAll(site.siteId,randomUUID());
                assert.match(fixture.psqlExpectError(wrong),/FORBIDDEN|permission denied/);
                assert.deepEqual(snapshot(),originalRows);
            });
        } finally {await fixture.close();}
    });
}
