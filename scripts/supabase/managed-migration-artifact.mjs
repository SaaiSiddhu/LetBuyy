import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {basename} from 'node:path';
import {sqlStatements, sqlTokens, tokenText} from '../governance/definer-role-closure.mjs';
import {verifiedManagedCatalogFences} from '../governance/managed-catalog-fence.mjs';

export const MANAGED_MIGRATION_PROFILE = 'trusted-admin-maintenance-v1';
const hash = text => createHash('sha256').update(text).digest('hex');
const admission = readFileSync(new URL('../../database/supabase/deploy/managed-migration-admission-v1.sql',import.meta.url),'utf8');
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const legacyBackendRoleCheck=`IF EXISTS(SELECT 1 FROM pg_roles r WHERE NOT r.rolsuper AND r.rolname NOT IN('app_tenant','service_role','authenticator','postgres')
   AND (pg_has_role(r.oid,'app_tenant','MEMBER') OR pg_has_role(r.oid,'service_role','MEMBER'))) THEN
   RAISE EXCEPTION '388 refuses unrecognized backend role membership'; END IF;`;
const managedBackendRoleCheck=legacyBackendRoleCheck.replace("'authenticator','postgres')","'authenticator','postgres','dashboard_user','supabase_auth_admin','supabase_storage_admin','cli_login_postgres')");
const legacyCollectionRoleFilter=`(parent.rolname IN('postgres','app_tenant','anon','authenticated','service_role') OR member.rolname IN('anon','authenticated','service_role','app_tenant','authenticator')) AND NOT(`;
const managedCollectionRoleFilter=legacyCollectionRoleFilter.replace(' AND NOT(',` AND NOT(parent.rolname='postgres' AND member.rolname='cli_login_postgres'
 AND m.grantor=to_regrole('supabase_admin') AND NOT m.admin_option AND NOT m.inherit_option AND m.set_option) AND NOT(`);

function managedRoleAdmissionEdits(source,name,statements) {
    let original,replacement;
    if(name==='388_cart_order_fact_snapshots.sql') {
        original=legacyBackendRoleCheck;replacement=managedBackendRoleCheck;
    } else if(['361_collection_membership.sql','361_collection_membership.rollback.sql'].includes(name)) {
        original=legacyCollectionRoleFilter;replacement=managedCollectionRoleFilter;
    } else return [];
    const expected=sqlTokens(original),edits=[];
    for(const statement of statements) {
        if(statement[0]?.value!=='do'||statement[1]?.kind!=='body')continue;
        const body=statement[1].value,tokens=sqlTokens(body),bodyStart=source.indexOf(body,statement[1].start);
        for(let i=0;i<=tokens.length-expected.length;i++) {
            if(!expected.every((t,j)=>t.kind===tokens[i+j].kind&&t.value===tokens[i+j].value))continue;
            edits.push({from:bodyStart+tokens[i].start,to:bodyStart+tokens[i+expected.length-1].end,text:replacement});
        }
    }
    if(edits.length!==1)throw new Error('Unreviewed backend-role admission in '+name);
    return edits;
}

/** Only complete reviewed fences may be adapted. Historical SQL remains the
 * canonical source; the receipt explicitly identifies the changed admission.
 * Business definitions, preconditions and journal writes are copied verbatim.
 */
export function compileManagedMigration(source, name) {
    if(typeof source!=='string' || basename(name)!==name || !/^\d{3}_[a-z0-9_]+(?:\.rollback)?\.sql$/.test(name)) {
        throw new Error('A canonical migration basename and SQL source are required');
    }
    const statements=sqlStatements(source), fences=verifiedManagedCatalogFences(source);
    const recognized=new Set(fences.map(f=>f.from));
    for(const statement of statements) {
        const body=statement.find(t=>t.kind==='body')?.value;
        const tokens=body?sqlTokens(body):statement;
        const catalogLock=tokens.some((t,i)=>t.value==='lock'&&tokens[i+1]?.value==='table'&&tokens[i+2]?.value==='pg_catalog');
        const helper=tokens.some(t=>t.kind==='string'&&t.value==='letbuyy_maintenance.lock_catalogs_v1()');
        if((catalogLock||helper)&&!recognized.has(statement[0].start)) {
            throw new Error('Unreviewed catalog-admission block in '+name);
        }
    }
    const roleEdits=managedRoleAdmissionEdits(source,name,statements);
    let sql=source;
    const controlled=fences.length>0||Number(name.slice(0,3))>=353;
    if(controlled) {
        const begins=statements.filter(s=>s[0]?.value==='begin'),commits=statements.filter(s=>s[0]?.value==='commit');
        const otherTransactions=statements.filter(s=>['rollback','savepoint','end','start'].includes(s[0]?.value));
        if(!begins.length&&!commits.length&&!otherTransactions.length&&!fences.length) {
            // The two historical catalog refreshes have no transaction wrapper.
            // Their original SQL is still copied verbatim within a new one.
            sql='BEGIN;\n'+admission+'\n'+source+'\n'+admission+'\nCOMMIT;\n';
        } else {
        const commitStatement=commits[0],commitIndex=statements.indexOf(commitStatement);
        const trailing=statements.slice(commitIndex+1);
        if(tokenText(statements[0])!=='begin ;'||begins.length!==1||commits.length!==1||otherTransactions.length
          ||trailing.some(s=>tokenText(s)!=="notify pgrst , 'reload schema' ;")) {
            throw new Error('A guarded migration must own exactly one complete transaction');
        }
        // Postcondition runs before commit. No executable application statement
        // is reordered or rewritten, and all original refusal checks remain.
        const commit=commitStatement[0].start;
        const edits=[...roleEdits,...fences.map(f=>({from:f.from,to:f.to,text:admission})),{from:commit,to:commit,text:admission+'\n'}];
        if(!fences.length)edits.push({from:begins[0].at(-1).end,to:begins[0].at(-1).end,text:'\n'+admission+'\n'});
        for(const edit of edits.sort((a,b)=>b.from-a.from))sql=sql.slice(0,edit.from)+edit.text+sql.slice(edit.to);
        }
    }
    return Object.freeze({sql,receipt:Object.freeze({profile:MANAGED_MIGRATION_PROFILE,name,
        sourceSha256:hash(source),executedSha256:hash(sql),admissionSha256:hash(admission),
        adaptedFences:fences.length,adaptedRoleChecks:roleEdits.map(edit=>({sourceSha256:hash(source.slice(edit.from,edit.to)),executedSha256:hash(edit.text)})),
        nativeCatalogExclusion:false,applicationTableLocks:controlled})});
}

/** One connection executes the entire batch. Its session lease spans the
 * original per-file COMMITs and is released on completion or connection loss.
 * Credentials, SQL execution and migration-history ownership stay in the caller.
 */
export function compileManagedMigrationBatch(entries, windowId) {
    if(!uuidV4.test(windowId)||!Array.isArray(entries)||!entries.length)throw new Error('A fresh maintenance UUID and nonempty migration batch are required');
    const names=entries.map(e=>e.name);
    if(new Set(names).size!==names.length)throw new Error('Duplicate migration artifact');
    const compiled=entries.map(entry=>compileManagedMigration(entry.source,entry.name));
    const start=`SET search_path=public,extensions;
SET standard_conforming_strings=on;
SET check_function_bodies=on;
SET row_security=on;
SET lock_timeout='5s';
SET statement_timeout='25min';
SET idle_in_transaction_session_timeout='60s';
DO $managed_migration_window_v1$
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres'
  OR (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user)
  OR pg_catalog.current_setting('role') NOT IN ('none','postgres') THEN
  RAISE EXCEPTION 'LETBUYY_MANAGED_MIGRATION_SESSION_REQUIRED';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_locks WHERE locktype='advisory'
  AND pid=pg_catalog.pg_backend_pid() AND classid=1818388845::oid AND objid=1::oid AND objsubid=2 AND granted) THEN
  RAISE EXCEPTION 'LETBUYY_MANAGED_MIGRATION_REENTRANT_SESSION';
 END IF;
 IF NOT pg_catalog.pg_try_advisory_lock(1818388845,1) THEN
  RAISE EXCEPTION 'LETBUYY_MANAGED_MIGRATION_RUNNER_BUSY';
 END IF;
 PERFORM pg_catalog.set_config('letbuyy.managed_migration_window','trusted-admin-v1:${windowId}',false);
 PERFORM pg_catalog.set_config('letbuyy.managed_migration_deadline',(pg_catalog.clock_timestamp()+interval '30 minutes')::text,false);
END
$managed_migration_window_v1$;
`;
    const finish=`DO $managed_migration_finish_v1$ BEGIN
 IF NOT pg_catalog.pg_advisory_unlock(1818388845,1) THEN RAISE EXCEPTION 'LETBUYY_MANAGED_MIGRATION_LEASE_LOST'; END IF;
 PERFORM pg_catalog.set_config('letbuyy.managed_migration_window','',false);
 PERFORM pg_catalog.set_config('letbuyy.managed_migration_deadline','',false);
END $managed_migration_finish_v1$;
`;
    const sql=start+compiled.map(c=>c.sql).join('\n')+'\n'+finish;
    return Object.freeze({sql,manifest:Object.freeze({profile:MANAGED_MIGRATION_PROFILE,windowId,
        batchSha256:hash(sql),admissionSha256:hash(admission),migrations:compiled.map(c=>c.receipt),
        requiresSingleBackend:true,privilegedAdministratorDdlExcludedOperationally:true})});
}

// Hashes the original provider history without returning SQL or retained data.
// Use the same PostgreSQL JSONB serialization in the observation and preflight.
export const MANAGED_HISTORY_DIGEST_SQL = `SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
 coalesce(jsonb_agg(jsonb_build_array(version,name,statements) ORDER BY version),'[]'::jsonb)::text,'UTF8')),'hex')
 FROM supabase_migrations.schema_migrations`;
const literal = value => "'"+value.replaceAll("'","''")+"'";

/** History stores the actual adapted payload, not a claim that original source
 * bytes ran. Its insert/delete is in the same transaction as application DDL.
 * A failed or uncertain response requires readback, never blind resubmission.
 */
export function compileManagedJournalBatch(entries,windowId,{expectedHistorySha256,direction='up',forwardEntries=[]}) {
    if(!/^[a-f0-9]{64}$/.test(expectedHistorySha256??'')||!['up','down'].includes(direction)) {
        throw new Error('A fresh observed migration-history SHA256 and direction are required');
    }
    const versions=entries.map(e=>e.name.slice(0,3));
    if(new Set(versions).size!==versions.length)throw new Error('Duplicate migration history version');
    const receipts=[];
    const journalEntries=entries.map(entry=>{
        if(entry.name.endsWith('.rollback.sql')!==(direction==='down'))throw new Error('Migration direction does not match the source name');
        const compiled=compileManagedMigration(entry.source,entry.name),version=entry.name.slice(0,3);
        const upName=entry.name.replace('.rollback.sql','.sql');
        let forward=compiled;
        if(direction==='down') {
            const candidates=forwardEntries.filter(e=>e.name===upName);
            if(candidates.length!==1)throw new Error('Rollback requires its exact original forward source');
            forward=compileManagedMigration(candidates[0].source,upName);
        }
        const migrationName=upName.slice(4,-4);
        const statement=literal(forward.sql);
        const receipt=literal('-- LETBUYY_MANAGED_EXECUTION_V1 '+JSON.stringify(forward.receipt));
        const expected=`version=${literal(version)} AND name=${literal(migrationName)} AND statements=ARRAY[${statement},${receipt}]::text[]`;
        const check=direction==='up'
            ? `IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version=${literal(version)}) THEN RAISE EXCEPTION 'LETBUYY_MANAGED_HISTORY_VERSION_EXISTS'; END IF;`
            : `IF NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE ${expected}) THEN RAISE EXCEPTION 'LETBUYY_MANAGED_HISTORY_ROLLBACK_MISMATCH'; END IF;`;
        const mutation=direction==='up'
            ? `INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES(${literal(version)},${literal(migrationName)},ARRAY[${statement},${receipt}]::text[]);`
            : `DELETE FROM supabase_migrations.schema_migrations WHERE ${expected};`;
        const before=`LOCK TABLE supabase_migrations.schema_migrations IN SHARE ROW EXCLUSIVE MODE NOWAIT;
DO $managed_history_entry_v1$ BEGIN ${check} END $managed_history_entry_v1$;\n`;
        let sql=compiled.sql;
        const statements=sqlStatements(sql),begins=statements.filter(s=>s[0]?.value==='begin'),commits=statements.filter(s=>s[0]?.value==='commit');
        if(!begins.length&&!commits.length)sql='BEGIN;\n'+before+sql+'\n'+mutation+'\nCOMMIT;\n';
        else {
            if(begins.length!==1||commits.length!==1||tokenText(statements[0])!=='begin ;'
             ||statements.slice(statements.indexOf(commits[0])+1).some(s=>tokenText(s)!=="notify pgrst , 'reload schema' ;")) {
                throw new Error('Journal requires one complete application transaction');
            }
            const begin=begins[0].at(-1).end,commit=commits[0][0].start;
            sql=sql.slice(0,commit)+mutation+'\n'+sql.slice(commit);
            sql=sql.slice(0,begin)+'\n'+before+sql.slice(begin);
        }
        receipts.push({...compiled.receipt,historyVersion:version,historyName:migrationName,journalSha256:hash(sql)});
        return {name:entry.name,source:sql};
    });
    // Do not run the source admission adapter twice. Compile only the window
    // envelope using a pre-353 sentinel, then replace that exact sentinel.
    const sentinel='-- LETBUYY_MANAGED_JOURNAL_BATCH_SENTINEL\n';
    const envelope=compileManagedMigrationBatch([{name:'000_managed_journal_envelope.sql',source:sentinel}],windowId);
    const preflight=`BEGIN;
LOCK TABLE supabase_migrations.schema_migrations IN SHARE ROW EXCLUSIVE MODE NOWAIT;
DO $managed_history_snapshot_v1$ DECLARE observed text; BEGIN
 ${MANAGED_HISTORY_DIGEST_SQL.replace(/\n FROM /,' INTO observed\n FROM ')};
 IF observed<>${literal(expectedHistorySha256)} THEN RAISE EXCEPTION 'LETBUYY_MANAGED_HISTORY_SNAPSHOT_CHANGED'; END IF;
END $managed_history_snapshot_v1$;
COMMIT;
`;
    const sql=envelope.sql.replace(sentinel,()=>preflight+journalEntries.map(e=>e.source).join('\n'));
    return Object.freeze({sql,manifest:Object.freeze({...envelope.manifest,batchSha256:hash(sql),migrations:receipts,
        journaled:true,direction,expectedHistorySha256,historyRecordsAdaptedPayload:true})});
}
