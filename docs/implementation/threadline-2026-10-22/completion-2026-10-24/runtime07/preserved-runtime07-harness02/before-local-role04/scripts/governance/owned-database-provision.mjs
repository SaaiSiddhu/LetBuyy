// Provisioning of the gateway database lane's databases inside an owned cluster.
//
// The gateway's database suites need the FULL schema (every migration), a fixture that answers the way Supabase
// does (supabase-faithful-bootstrap.mjs) and the REST layer's roles. Replaying 190-odd migrations costs about twenty
// seconds, so a cluster builds that once, as a pristine template database, and every suite gets its own database
// cloned from it:
//
//   isolation   each suite runs in a database no other suite has touched, and it is dropped when the suite ends.
//               "Reset" is not a sequence of DELETEs: the database is thrown away, so the immutable records the tests
//               create (GST invoices, the gift-card ledger) are never removed by hand and no trigger is bypassed.
//   ownership   the clone carries a database-level setting, letbuyy.fixture_run_id, written by the runner at
//               creation. The REST sidecar and the suites read it back (letbuyy_fixture.run_id()), which is how a
//               database is shown to be this run's and not merely a database with a plausible name.
//
// CREATE DATABASE ... TEMPLATE copies the catalogs and data but not `ALTER DATABASE ... SET` settings, so the
// bootstrap's search_path (which puts `extensions` on it, as Supabase does) is re-applied to every clone.

import { readFileSync, readdirSync, openSync, closeSync, fstatSync, lstatSync, realpathSync, constants, mkdirSync, writeFileSync, writeSync, fsyncSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { join, dirname, resolve, isAbsolute } from 'node:path';
import { SUPABASE_FAITHFUL_BOOTSTRAP_SQL } from './supabase-faithful-bootstrap.mjs';
import { RUN_ID_PATTERN, dockerAsync, inspectContainer, DEFAULT_IMAGE, DEFAULT_REST_IMAGE, FIXTURE_LABEL, OWNER_PID_LABEL, RUN_ID_LABEL, ROLE_LABEL, PRESERVATION_LABEL, PRESERVATION_VALUE } from './executable-pg-fixture.mjs';

export const PRESERVED_WITNESS_METHOD='runtime07-logical-sequence-trigger-profile-v2';
export const PRESERVED_THEME_SUITE = 'tests/owned-db/theme-completion-razorpay-browser.manual.ts';
export const PRESERVED_RUNTIME07 = Object.freeze({ fixtureId:'49ada80bc494', siteId:'02049de4-41c3-4b10-b5b2-a60a6b5e82bf', locationId:'6e4baabc-b0c7-46ce-8be0-98395d9ef30c', subdomain:'syn-threadline-ui-ae3f0477',
    cookieDomain:'threadline-49ada80bc494.localhost', identityOrigin:'http://accounts.threadline-49ada80bc494.localhost:64593', merchantOrigin:'http://admin.threadline-49ada80bc494.localhost:64594',
    commerceOrigin:'http://syn-threadline-ui-ae3f0477.localhost:64595', checkoutOrigin:'https://checkout.localhost:64597', apiOrigin:'http://127.0.0.1:64598', receiverOrigin:'http://127.0.0.1:65314',
    ports:Object.freeze({identity:64593,merchant:64594,commerce:64595,checkout:64597,api:64598,receiver:65314}) });
const archiveRoots = ['/private/tmp/letbuyy-runtime07-backups','/Volumes/Projects/LetBuyy/.letbuyy-private/runtime07'];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const check = (value, code) => { if (!value) throw new Error(`preserved fixture refused [${code}]`); };
const hash = value => typeof value==='string' && /^[a-f0-9]{64}$/.test(value);
const uuid = value => typeof value==='string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(value);
const same = (a,b) => JSON.stringify(a)===JSON.stringify(b);
const plain = value => value && typeof value==='object' && !Array.isArray(value) && Object.getPrototypeOf(value)===Object.prototype;
const exact = (value, keys, code) => check(plain(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k)),code);
export function parsePreservedJson(bytes) { try{return JSON.parse(bytes.toString('utf8'));}catch{throw new Error('preserved fixture refused [PRIVATE_JSON]');} }

/** No-follow, descriptor-bound private bytes. Generic helper is tested using synthetic temporary files only. */
export function readPreservedPrivateFile(path, { maxBytes=262144, expectedSha256, uid=process.getuid(), privateParent=true }={}) {
    check(typeof path==='string'&&isAbsolute(path)&&!path.includes('\0')&&realpathSync(dirname(path))===dirname(path),'PRIVATE_PATH');
    const parent=lstatSync(dirname(path)); check(parent.isDirectory()&&!parent.isSymbolicLink()&&parent.uid===uid&&(!privateParent||(parent.mode&0o777)===0o700),'PRIVATE_PARENT');
    const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);
    try {
        const before=fstatSync(fd);check(before.isFile()&&before.uid===uid&&(before.mode&0o777)===0o600&&before.nlink===1&&before.size>0&&before.size<=maxBytes,'PRIVATE_FILE');
        const bytes=readFileSync(fd),after=fstatSync(fd),named=lstatSync(path);
        check(before.dev===after.dev&&before.ino===after.ino&&before.size===after.size&&before.mtimeMs===after.mtimeMs&&!named.isSymbolicLink()&&named.ino===after.ino&&named.dev===after.dev,'PRIVATE_CHANGED');
        if(expectedSha256!==undefined)check(hash(expectedSha256)&&digest(bytes)===expectedSha256,'PRIVATE_DIGEST');
        return bytes;
    } finally { closeSync(fd); }
}

/** Pure fixed QA scope. This is tooling metadata, not another identity or business-data authority. */
export function validatePreservedCapsule(c, expected) {
    exact(c,['version','kind','expiresAt','source','sourceBundle','archive','fence','application','origins','roles','witness','qa','tls','provider'],'CAPSULE_FIELDS');
    check(c.version===1&&c.kind==='preserved-runtime07'&&Date.parse(c.expiresAt)>expected.now,'CAPSULE_EXPIRY');
    check(expected.suitePath===PRESERVED_THEME_SUITE&&expected.noReap===true&&expected.jobs===1,'ENTRY_SCOPE');
    exact(c.source,['resourceRunId','runnerPid','container','database','volume','postgresImage','restImage','imageId','roleProfileSha256'],'SOURCE_FIELDS');
    check(c.source.resourceRunId===PRESERVED_RUNTIME07.fixtureId&&c.source.runnerPid===54685&&c.source.container==='letbuyy-exec-54685-mvmssydy-fe81e9'&&c.source.database==='letbuyy_exec_theme_completion_razorpay_browser_manual_ts'&&c.source.volume==='letbuyy-exec-49ada80bc494-1-data','SOURCE_BINDING');
    check(c.source.postgresImage===DEFAULT_IMAGE&&c.source.restImage===DEFAULT_REST_IMAGE&&/^sha256:[a-f0-9]{64}$/.test(c.source.imageId),'IMAGE_BINDING');
    exact(c.sourceBundle,['root','manifestPath','manifestSha256'],'SOURCE_BUNDLE');
    check(c.sourceBundle.root===expected.repoRoot&&c.sourceBundle.root.startsWith('/private/tmp/letbuyy-')&&hash(c.sourceBundle.manifestSha256)&&typeof c.sourceBundle.manifestPath==='string'&&resolve(c.sourceBundle.manifestPath).startsWith(c.sourceBundle.root+'/'),'SOURCE_ROOT');
    exact(c.archive,['path','bytes','sha256','format'],'ARCHIVE_FIELDS');
    check(c.archive.format==='custom'&&hash(c.archive.sha256)&&Number.isSafeInteger(c.archive.bytes)&&c.archive.bytes>5&&c.archive.bytes<=512*1024*1024&&archiveRoots.some(root=>dirname(c.archive.path)===root)&&/^[A-Za-z0-9._-]+\.dump$/.test(c.archive.path.split('/').at(-1)),'ARCHIVE_BINDING');
    exact(c.fence,['final','editorReturned','leaseId','snapshotAt','lastAcceptedAt','receiptPath','receiptSha256','witnessSha256'],'FENCE_FIELDS');
    check(c.fence.final===true&&c.fence.editorReturned===true&&typeof c.fence.leaseId==='string'&&c.fence.leaseId.length>=12&&Date.parse(c.fence.lastAcceptedAt)<=Date.parse(c.fence.snapshotAt)&&Date.parse(c.fence.snapshotAt)<=expected.now&&hash(c.fence.receiptSha256)&&hash(c.fence.witnessSha256),'FINAL_FENCE_REQUIRED');
    exact(c.application,['fixtureId','site','ownerId','email','password','products','collections','editorCatalog'],'APPLICATION_FIELDS');
    check(c.application.fixtureId===PRESERVED_RUNTIME07.fixtureId&&plain(c.application.site)&&c.application.site.siteId===PRESERVED_RUNTIME07.siteId&&c.application.site.subdomain===PRESERVED_RUNTIME07.subdomain&&c.application.site.locationId===PRESERVED_RUNTIME07.locationId&&c.application.site.tag==='threadline-ui'&&uuid(c.application.ownerId),'SITE_BINDING');
    check(/^syn-threadline-[a-f0-9-]+@example\.invalid$/.test(c.application.email)&&typeof c.application.password==='string'&&c.application.password.length>=12,'PERSISTENT_ACCOUNT');
    for(const ids of [c.application.products,c.application.collections])check(Array.isArray(ids)&&ids.length>0&&ids.length<=1000&&ids.every(uuid)&&new Set(ids).size===ids.length,'ENTITY_IDS');
    check(same(c.origins,{identityOrigin:PRESERVED_RUNTIME07.identityOrigin,merchantOrigin:PRESERVED_RUNTIME07.merchantOrigin,commerceOrigin:PRESERVED_RUNTIME07.commerceOrigin,checkoutOrigin:PRESERVED_RUNTIME07.checkoutOrigin,apiOrigin:PRESERVED_RUNTIME07.apiOrigin,receiverOrigin:PRESERVED_RUNTIME07.receiverOrigin,cookieDomain:PRESERVED_RUNTIME07.cookieDomain,ports:PRESERVED_RUNTIME07.ports}),'ORIGIN_PORT_SCOPE');
    exact(c.roles,['definitions','memberships'],'ROLE_FIELDS');check(Array.isArray(c.roles.definitions)&&Array.isArray(c.roles.memberships)&&c.roles.definitions.length<=200&&c.roles.memberships.length<=400,'ROLE_LIMIT');
    check(hash(c.source.roleProfileSha256)&&digest(JSON.stringify(c.roles))===c.source.roleProfileSha256,'ROLE_PROFILE');
    const names=new Set();
    for(const r of c.roles.definitions){exact(r,['name','login','superuser','inherit','createRole','createDb','replication','bypassRls','connectionLimit','passwordHash','validUntil','settings'],'ROLE_DEFINITION');check(/^[a-z_][a-z0-9_]{0,62}$/.test(r.name)&&!names.has(r.name),'ROLE_NAME');names.add(r.name);for(const k of ['login','superuser','inherit','createRole','createDb','replication','bypassRls'])check(typeof r[k]==='boolean','ROLE_ATTRIBUTE');check(!r.superuser||['postgres','supabase_admin'].includes(r.name),'ROLE_SUPERUSER');check(Number.isSafeInteger(r.connectionLimit)&&r.connectionLimit>=-1&&Array.isArray(r.settings),'ROLE_ATTRIBUTE');check(r.passwordHash===null||/^md5[a-f0-9]{32}$/.test(r.passwordHash)||/^SCRAM-SHA-256\$[A-Za-z0-9+/=$:.-]{20,512}$/.test(r.passwordHash),'ROLE_PASSWORD_FORMAT');check(r.validUntil===null||typeof r.validUntil==='string'&&(Number.isFinite(Date.parse(r.validUntil))||['infinity','-infinity'].includes(r.validUntil)),'ROLE_VALID_UNTIL');for(const setting of r.settings)check(/^(search_path|statement_timeout|lock_timeout|idle_in_transaction_session_timeout|TimeZone)=.{1,300}$/.test(setting),'ROLE_SETTING');}
    check(['postgres','anon','authenticated','service_role','authenticator','app_tenant','supabase_admin'].every(name=>names.has(name)),'CANONICAL_ROLES_REQUIRED');
    for(const m of c.roles.memberships){exact(m,['role','member','grantor','admin','inherit','set'],'MEMBERSHIP');check(names.has(m.role)&&names.has(m.member)&&names.has(m.grantor)&&['admin','inherit','set'].every(k=>typeof m[k]==='boolean'),'MEMBERSHIP');}
    exact(c.witness,['method','path','sha256','dataSha256','profileSha256','sequenceSha256','acceptedOrderIds'],'WITNESS_FIELDS');check(c.witness.method===PRESERVED_WITNESS_METHOD&&['sha256','dataSha256','profileSha256','sequenceSha256'].every(k=>hash(c.witness[k]))&&c.witness.sha256===c.fence.witnessSha256&&Array.isArray(c.witness.acceptedOrderIds)&&c.witness.acceptedOrderIds.length>=7&&c.witness.acceptedOrderIds.every(uuid)&&new Set(c.witness.acceptedOrderIds).size===c.witness.acceptedOrderIds.length,'WITNESS_REQUIRED');
    exact(c.qa,['mode','oldSessionsPreserved','allowIssuerAndCookieRefresh','allowCheckoutRefresh','pendingIntentsReconciled','pendingIntentWitnessSha256','retainedBinding'],'QA_FIELDS');
    check(['retained','refresh'].includes(c.qa.mode)&&typeof c.qa.oldSessionsPreserved==='boolean','QA_MODE');
    if(c.qa.mode==='refresh')check(c.qa.oldSessionsPreserved===false&&c.qa.allowIssuerAndCookieRefresh===true&&c.qa.allowCheckoutRefresh===true&&c.qa.pendingIntentsReconciled===true&&hash(c.qa.pendingIntentWitnessSha256),'EXPLICIT_QA_REFRESH');
    else check(plain(c.qa.retainedBinding)&&hash(c.qa.retainedBinding.sha256)&&typeof c.qa.retainedBinding.path==='string'&&archiveRoots.some(root=>dirname(c.qa.retainedBinding.path)===root),'RETAINED_BINDING_REQUIRED');
    for(const [value,keys]of [[c.tls,['certPath','certSha256','keyPath','keySha256']],[c.provider,['csvPath','csvSha256','webhookSecretPath','webhookSecretSha256']]]){exact(value,keys,'PRIVATE_REFERENCE_FIELDS');for(const key of keys)check(key.endsWith('Sha256')?hash(value[key]):typeof value[key]==='string'&&isAbsolute(value[key]),'PRIVATE_REFERENCE');}
    return c;
}

export function loadPreservedCapsule(path, sha256, expected, { readPrivate=readPreservedPrivateFile }={}) {
    check(hash(sha256)&&archiveRoots.some(root=>dirname(path)===root),'CAPSULE_PATH');
    const c=validatePreservedCapsule(parsePreservedJson(readPrivate(path,{expectedSha256:sha256})),expected);
    check(realpathSync(c.sourceBundle.manifestPath).startsWith(realpathSync(expected.repoRoot)+'/'),'SOURCE_MANIFEST_PATH');
    const sourceBytes=readFileSync(c.sourceBundle.manifestPath);check(digest(sourceBytes)===c.sourceBundle.manifestSha256,'SOURCE_MANIFEST_DIGEST');
    const source=parsePreservedJson(sourceBytes);check(Array.isArray(source.files)&&source.files.length>0,'SOURCE_MANIFEST_FORMAT');
    for(const file of source.files){check(typeof file.path==='string'&&!isAbsolute(file.path)&&!file.path.split('/').includes('..')&&!file.path.includes('node_modules')&&!file.path.split('/').some(p=>p.includes('.env')||p.includes('.dev.vars'))&&hash(file.sha256),'SOURCE_FILE_PATH');const absolute=resolve(expected.repoRoot,file.path);check(realpathSync(absolute).startsWith(realpathSync(expected.repoRoot)+'/')&&digest(readFileSync(absolute))===file.sha256,'SOURCE_FILE_DIGEST');}
    for(const path of [c.fence.receiptPath,c.witness.path,c.tls.certPath,c.tls.keyPath,c.provider.csvPath,c.provider.webhookSecretPath])check(typeof path==='string'&&archiveRoots.some(root=>dirname(path)===root),'PRIVATE_REFERENCE_SCOPE');
    const fence=parsePreservedJson(readPrivate(c.fence.receiptPath,{expectedSha256:c.fence.receiptSha256}));
    check(fence.status==='FINAL_EDITOR_WRITE_FENCE'&&fence.leaseId===c.fence.leaseId&&fence.latestAcceptedAt===c.fence.lastAcceptedAt&&fence.archiveSha256===c.archive.sha256&&fence.witnessSha256===c.witness.sha256&&fence.applicationFixtureId===c.application.fixtureId&&fence.noLaterAcceptedWork===true&&fence.databaseWriteFenceConfirmed===true&&fence.providerCallbacksSettled===true,'STALE_FENCE');
    const witnessBytes=readPrivate(c.witness.path,{expectedSha256:c.witness.sha256});const witness=parsePreservedJson(witnessBytes);
    check(witness.method===PRESERVED_WITNESS_METHOD&&witness.dataSha256===c.witness.dataSha256&&witness.profileSha256===c.witness.profileSha256&&witness.sequenceSha256===c.witness.sequenceSha256&&same(witness.acceptedOrderIds,c.witness.acceptedOrderIds),'WITNESS_BINDING');
    if(c.qa.mode==='refresh')check(witness.pendingIntentsReconciled===true&&witness.pendingIntentWitnessSha256===c.qa.pendingIntentWitnessSha256,'PENDING_INTENT_WITNESS');
    const archive=readPrivate(c.archive.path,{maxBytes:512*1024*1024,expectedSha256:c.archive.sha256});check(archive.length===c.archive.bytes&&archive.subarray(0,5).toString()==='PGDMP','ARCHIVE_FORMAT');
    return Object.freeze({capsule:c,capsuleSha256:sha256,archive});
}

export function validatePreservedTarget(cluster, database, saved, inspected, runnerPid=process.pid) {
    const c=saved.capsule;check(RUN_ID_PATTERN.test(cluster.runId)&&cluster.runId!==c.source.resourceRunId&&cluster.containerStarted&&cluster.networkCreated&&cluster.volumeCreated&&cluster.name!==c.source.container&&cluster.volume!==c.source.volume&&database==='letbuyy_exec_theme_completion_razorpay_browser_manual_ts','NEW_EMPTY_TARGET_ONLY');
    const labels=inspected?.Config?.Labels;check(inspected?.State?.Running===true&&inspected.Config.Image===c.source.postgresImage&&inspected.Image===c.source.imageId&&labels?.[FIXTURE_LABEL]==='1'&&labels[RUN_ID_LABEL]===cluster.runId&&labels[OWNER_PID_LABEL]===String(runnerPid)&&labels[ROLE_LABEL]==='postgres'&&labels[PRESERVATION_LABEL]===PRESERVATION_VALUE,'TARGET_OWNERSHIP');
    check(!inspected.HostConfig?.Privileged&&inspected.HostConfig?.NetworkMode!=='host'&&!inspected.HostConfig?.Binds?.length&&!Object.keys(inspected.NetworkSettings?.Ports??{}).some(k=>inspected.NetworkSettings.Ports[k]?.length)&&same(Object.keys(inspected.NetworkSettings?.Networks??{}),[cluster.network]),'TARGET_NETWORK');
    check(inspected.Mounts?.length===1&&inspected.Mounts[0].Type==='volume'&&inspected.Mounts[0].Name===cluster.volume&&inspected.Mounts[0].Destination==='/var/lib/postgresql/data','TARGET_VOLUME');
}

const identifier = value => `"${value.replaceAll('"','""')}"`;
const literal = value => `'${value.replaceAll("'","''")}'`;
export function preservedRoleSql(saved, restPassword) {
    check(/^[a-f0-9]{32,}$/.test(restPassword),'REST_PASSWORD');const statements=[];
    for(const r of saved.capsule.roles.definitions){if(r.name.startsWith('pg_'))continue;const name=identifier(r.name);statements.push(`DO $role$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=${literal(r.name)})THEN CREATE ROLE ${name};END IF;END $role$;`);
        const flags=[['LOGIN',r.login],['SUPERUSER',r.superuser],['INHERIT',r.inherit],['CREATEROLE',r.createRole],['CREATEDB',r.createDb],['REPLICATION',r.replication],['BYPASSRLS',r.bypassRls]].map(([name,yes])=>yes?name:'NO'+name).join(' ');
        statements.push(`ALTER ROLE ${name} ${flags} CONNECTION LIMIT ${r.connectionLimit}${r.name==='authenticator'?` PASSWORD ${literal(restPassword)}`:r.passwordHash?` PASSWORD ${literal(r.passwordHash)}`:' PASSWORD NULL'}${r.validUntil?` VALID UNTIL ${literal(r.validUntil)}`:''};`);
        for(const setting of r.settings){const at=setting.indexOf('=');statements.push(`ALTER ROLE ${name} SET ${identifier(setting.slice(0,at))} TO ${literal(setting.slice(at+1))};`);}}
    for(const m of saved.capsule.roles.memberships)statements.push(`GRANT ${identifier(m.role)} TO ${identifier(m.member)} WITH ADMIN ${m.admin?'TRUE':'FALSE'}, INHERIT ${m.inherit?'TRUE':'FALSE'}, SET ${m.set?'TRUE':'FALSE'} GRANTED BY ${identifier(m.grantor)};`);
    return statements.join('\n');
}

/** Only called by the ordinary fresh-owned runner after explicit fixed-suite admission. No adoption or bootstrap replay. */
export async function createPreservedSuiteDatabase(cluster,database,runId,saved) {
    check(runId===cluster.runId,'RESOURCE_RUN');validatePreservedTarget(cluster,database,saved,inspectContainer(cluster.name));
    await preservedQuery(cluster,'postgres',`CREATE DATABASE ${identifier(database)} TEMPLATE template0;`,'creating new preserved database');cluster.preservedDatabaseCreated=database;cluster.preservedSafetyRequired=true;
    const empty=await preservedQuery(cluster,database,`SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema';`,'verifying empty restore target');check(empty.trim()==='0','TARGET_NOT_EMPTY');
    await preservedQuery(cluster,'postgres',preservedRoleSql(saved,cluster.restPassword),'restoring admitted role definitions');
    await preservedQuery(cluster,database,'DROP SCHEMA IF EXISTS public;','removing only empty default schema');
    validatePreservedTarget(cluster,database,saved,inspectContainer(cluster.name));
    const restored=await dockerAsync(['exec','-i',cluster.name,'pg_restore','-U','postgres','-d',database,'--exit-on-error','--single-transaction'],{input:saved.archive,allowFailure:true});check(restored.status===0,'RESTORE_FAILED');
    await preservedQuery(cluster,'postgres',`ALTER DATABASE ${identifier(database)} SET search_path=public,extensions;ALTER DATABASE ${identifier(database)} SET letbuyy.fixture_run_id=${literal(runId)};`,'binding new tool marker');
    const witness=await measurePreservedDatabase(sql=>preservedQuery(cluster,database,sql,'verifying restored protected state'));
    check(witness.dataSha256===saved.capsule.witness.dataSha256&&witness.profileSha256===saved.capsule.witness.profileSha256&&witness.sequenceSha256===saved.capsule.witness.sequenceSha256&&same(witness.acceptedOrderIds,saved.capsule.witness.acceptedOrderIds),'RESTORE_PARITY_FAILED');
    cluster.migrationEvidence={classification:'RESTORED_SOURCE_PROFILE',throughMigration:null,applied:[],archiveSha256:saved.capsule.archive.sha256,originalApplicationFixtureId:saved.capsule.application.fixtureId,newResourceRunId:runId};
    return cluster.migrationEvidence;
}

async function preservedQuery(cluster,database,sql,what) {
    const result=await dockerAsync(['exec','-i',cluster.name,'psql','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-q','-A','-t'],{input:sql,allowFailure:true});
    check(result.status===0,'PROTECTED_QUERY_FAILED');return result.stdout;
}

/** Only physical WAL allocation log_cnt is excluded. Logical values and definition remain exact. */
export function preservedLogicalSequence(value) {
    exact(value,['sequence','last_value','is_called','log_cnt','definition'],'SEQUENCE_FIELDS');
    const integer=v=>typeof v==='string'&&/^-?\d+$/.test(v)&&BigInt(v)>=-9223372036854775808n&&BigInt(v)<=9223372036854775807n;
    check(typeof value.sequence==='string'&&value.sequence.length>2&&integer(value.last_value)&&integer(value.log_cnt)&&typeof value.is_called==='boolean','SEQUENCE_STATE');
    exact(value.definition,['start','increment','min','max','cache','cycle','type','owner','acl'],'SEQUENCE_DEFINITION');
    for(const key of ['start','increment','min','max','cache'])check(integer(value.definition[key]),'SEQUENCE_DEFINITION');
    check(typeof value.definition.cycle==='boolean'&&['smallint','integer','bigint'].includes(value.definition.type)&&typeof value.definition.owner==='string'&&(value.definition.acl===null||typeof value.definition.acl==='string'),'SEQUENCE_DEFINITION');
    return {sequence:value.sequence,last_value:value.last_value,is_called:value.is_called,definition:value.definition};
}

/** Generated physical OID naming is normalized; every enforcement field/count and user name stays exact. */
export function preservedLogicalTrigger(value) {
    exact(value,['physicalOid','relation','name','internal','constraint','referencedRelation','constraintIndex','function','eventType','deferrable','initiallyDeferred','enabled','definition','arguments','when','columns','oldTable','newTable','parent'],'TRIGGER_FIELDS');
    check(typeof value.physicalOid==='string'&&/^[1-9]\d*$/.test(value.physicalOid)&&BigInt(value.physicalOid)<=4294967295n,'TRIGGER_PHYSICAL_ID');
    check(['relation','name','function','definition'].every(k=>typeof value[k]==='string')&&typeof value.internal==='boolean'&&Number.isInteger(value.eventType)&&typeof value.deferrable==='boolean'&&typeof value.initiallyDeferred==='boolean'&&['O','D','R','A'].includes(value.enabled),'TRIGGER_SEMANTICS');
    const logical={...value};delete logical.physicalOid;
    if(value.parent!==null){const parent={...value.parent};check(typeof parent.name==='string'&&typeof parent.internal==='boolean'&&typeof parent.physicalOid==='string'&&/^[1-9]\d*$/.test(parent.physicalOid),'TRIGGER_PARENT');if(parent.internal&&parent.name.endsWith('_'+parent.physicalOid))parent.name=parent.name.slice(0,-parent.physicalOid.length-1);delete parent.physicalOid;logical.parent=parent;}
    if(value.internal&&value.name.endsWith('_'+value.physicalOid)){
        const base=value.name.slice(0,-value.physicalOid.length-1);check(base.length>0,'TRIGGER_GENERATED_NAME');
        const quoted=identifier(value.name),tokens=[quoted,value.name],prefixes=tokens.flatMap(token=>[`CREATE CONSTRAINT TRIGGER ${token} `,`CREATE TRIGGER ${token} `]);
        const prefix=prefixes.find(p=>value.definition.startsWith(p));check(prefix,'TRIGGER_DEFINITION_NAME');
        logical.name=base;logical.definition=prefix.slice(0,prefix.indexOf('TRIGGER ')+8)+identifier(base)+ ' '+value.definition.slice(prefix.length);
    }else if(value.internal&&value.constraint?.type==='f')check(false,'TRIGGER_FK_GENERATED_ID');
    return logical;
}
export function preservedTriggerInventory(rows) {
    check(Array.isArray(rows),'TRIGGER_INVENTORY');
    return rows.map(preservedLogicalTrigger).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

/** Same deterministic witness is captured at final fence and on the fresh clone. No row/secret values leave SQL. */
export async function measurePreservedDatabase(query) {
    const list=parsePreservedJson(Buffer.from(await query(`SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind) ORDER BY n.nspname,c.relname),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname NOT IN('information_schema','letbuyy_fixture') AND c.relkind IN('r','p','m','S','f');`)));
    check(Array.isArray(list)&&list.length>100&&list.every(r=>r.kind!=='f'),'COMPLETE_DATA_WITNESS');
    const statements=list.map(r=>`SELECT jsonb_build_object('relation',${literal(r.schema+'.'+r.name)},'count',count(*),'digest',encode(sha256(convert_to(coalesce(string_agg(encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex'),'' ORDER BY encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex')),''),'UTF8')),'hex')) value FROM ${identifier(r.schema)}.${identifier(r.name)} t`);
    const data=await query(`SELECT coalesce(jsonb_agg(value ORDER BY value->>'relation'),'[]') FROM (${statements.filter((_,i)=>list[i].kind!=='S').join(' UNION ALL ')}) all_rows;`);
    const sequences=list.filter(r=>r.kind==='S').map(r=>`SELECT jsonb_build_object('sequence',${literal(r.schema+'.'+r.name)},'last_value',s.last_value::text,'is_called',s.is_called,'log_cnt',s.log_cnt::text,'definition',jsonb_build_object('start',q.seqstart::text,'increment',q.seqincrement::text,'min',q.seqmin::text,'max',q.seqmax::text,'cache',q.seqcache::text,'cycle',q.seqcycle,'type',format_type(q.seqtypid,NULL),'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text)) value FROM ${identifier(r.schema)}.${identifier(r.name)} s CROSS JOIN pg_sequence q JOIN pg_class c ON c.oid=q.seqrelid WHERE q.seqrelid=${literal(identifier(r.schema)+'.'+identifier(r.name))}::regclass`);
    const sequenceRows=sequences.length?parsePreservedJson(Buffer.from(await query(`SELECT jsonb_agg(value ORDER BY value->>'sequence') FROM (${sequences.join(' UNION ALL ')}) all_sequences;`))):[];
    const sequence=JSON.stringify(sequenceRows.map(preservedLogicalSequence));
    const largeObjects=await query(`SELECT coalesce(jsonb_agg(jsonb_build_object('oid',m.oid,'owner',pg_get_userbyid(m.lomowner),'acl',m.lomacl::text,'pages',(SELECT encode(sha256(convert_to(coalesce(string_agg(p.pageno::text||encode(sha256(p.data),'hex'),'' ORDER BY p.pageno),''),'UTF8')),'hex') FROM pg_largeobject p WHERE p.loid=m.oid)) ORDER BY m.oid),'[]') FROM pg_largeobject_metadata m;`);
    const profileRaw=parsePreservedJson(Buffer.from(await query(`SELECT jsonb_build_object(
      'schemas',(SELECT jsonb_agg(jsonb_build_object('name',nspname,'owner',pg_get_userbyid(nspowner),'acl',nspacl::text) ORDER BY nspname) FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname NOT IN('information_schema','letbuyy_fixture')),
      'views',(SELECT jsonb_agg(jsonb_build_object('name',n.nspname||'.'||c.relname,'definition',pg_get_viewdef(c.oid,true)) ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN('v','m') AND n.nspname NOT LIKE 'pg_%' AND n.nspname NOT IN('information_schema','letbuyy_fixture')),
      'types',(SELECT jsonb_agg(jsonb_build_object('name',n.nspname||'.'||t.typname,'kind',t.typtype,'owner',pg_get_userbyid(t.typowner),'acl',t.typacl::text,'base',format_type(t.typbasetype,t.typtypmod),'notnull',t.typnotnull,'default',t.typdefault,'enum',(SELECT jsonb_agg(enumlabel ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid=t.oid)) ORDER BY n.nspname,t.typname) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname NOT IN('information_schema','letbuyy_fixture')),
      'extensions',(SELECT jsonb_agg(jsonb_build_object('name',extname,'version',extversion,'schema',extnamespace::regnamespace::text,'owner',pg_get_userbyid(extowner)) ORDER BY extname) FROM pg_extension),
      'database',(SELECT jsonb_build_object('owner',pg_get_userbyid(datdba),'encoding',pg_encoding_to_char(encoding),'collation',datcollate,'ctype',datctype,'acl',datacl::text) FROM pg_database WHERE datname=current_database()),
      'functions',(SELECT jsonb_agg(jsonb_build_object('name',n.nspname||'.'||p.proname,'args',pg_get_function_identity_arguments(p.oid),'definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname NOT IN('information_schema','letbuyy_fixture') AND p.prokind IN('f','p','w')),
      'relations',(SELECT jsonb_agg(jsonb_build_object('name',n.nspname||'.'||c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'options',c.reloptions,'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'acl',a.attacl::text,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped)) ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname NOT IN('information_schema','letbuyy_fixture')),
      'constraints',(SELECT jsonb_agg(jsonb_build_object('relation',c.conrelid::regclass::text,'name',c.conname,'definition',pg_get_constraintdef(c.oid)) ORDER BY c.conrelid::regclass::text,c.conname) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname NOT IN('information_schema','letbuyy_fixture')),
      'triggers',(SELECT jsonb_agg(jsonb_build_object('physicalOid',t.oid::text,'relation',t.tgrelid::regclass::text,'name',t.tgname,'internal',t.tgisinternal,'constraint',CASE WHEN k.oid IS NULL THEN NULL ELSE jsonb_build_object('schema',kn.nspname,'relation',k.conrelid::regclass::text,'name',k.conname,'type',k.contype,'definition',pg_get_constraintdef(k.oid)) END,'referencedRelation',nullif(t.tgconstrrelid,0)::regclass::text,'constraintIndex',nullif(t.tgconstrindid,0)::regclass::text,'function',t.tgfoid::regprocedure::text,'eventType',t.tgtype,'deferrable',t.tgdeferrable,'initiallyDeferred',t.tginitdeferred,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid),'arguments',encode(t.tgargs,'hex'),'when',pg_get_expr(t.tgqual,t.tgrelid),'columns',(SELECT jsonb_agg(a.attname ORDER BY u.ordinality) FROM unnest(t.tgattr) WITH ORDINALITY u(attnum,ordinality) JOIN pg_attribute a ON a.attrelid=t.tgrelid AND a.attnum=u.attnum),'oldTable',t.tgoldtable,'newTable',t.tgnewtable,'parent',(SELECT jsonb_build_object('relation',pt.tgrelid::regclass::text,'constraint',pk.conname,'function',pt.tgfoid::regprocedure::text,'eventType',pt.tgtype,'name',pt.tgname,'internal',pt.tgisinternal,'physicalOid',pt.oid::text) FROM pg_trigger pt LEFT JOIN pg_constraint pk ON pk.oid=pt.tgconstraint WHERE pt.oid=t.tgparentid)) ORDER BY t.tgrelid::regclass::text,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_constraint k ON k.oid=t.tgconstraint LEFT JOIN pg_namespace kn ON kn.oid=k.connamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname NOT IN('information_schema','letbuyy_fixture')),
      'policies',(SELECT jsonb_agg(jsonb_build_object('relation',p.polrelid::regclass::text,'name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,'roles',(SELECT jsonb_agg(CASE WHEN r=0 THEN 'PUBLIC' ELSE pg_get_userbyid(r) END ORDER BY CASE WHEN r=0 THEN 'PUBLIC' ELSE pg_get_userbyid(r) END) FROM unnest(p.polroles)r),'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY p.polrelid::regclass::text,p.polname) FROM pg_policy p),
      'indexes',(SELECT jsonb_agg(pg_get_indexdef(i.indexrelid) ORDER BY i.indexrelid::regclass::text) FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname NOT IN('information_schema','letbuyy_fixture')),
      'roles',(SELECT jsonb_agg(jsonb_build_object('name',rolname,'super',rolsuper,'login',rolcanlogin,'inherit',rolinherit,'createrole',rolcreaterole,'createdb',rolcreatedb,'replication',rolreplication,'bypass',rolbypassrls,'limit',rolconnlimit,'validUntil',rolvaliduntil,'settings',s.setconfig,'passwordHash',CASE WHEN rolname='authenticator' THEN 'NEW_TOOL_TRANSPORT' ELSE encode(sha256(convert_to(coalesce(rolpassword,''),'UTF8')),'hex') END) ORDER BY rolname) FROM pg_authid a LEFT JOIN pg_db_role_setting s ON s.setrole=a.oid AND s.setdatabase=0),
      'memberships',(SELECT jsonb_agg(jsonb_build_object('role',pg_get_userbyid(roleid),'member',pg_get_userbyid(member),'grantor',pg_get_userbyid(grantor),'admin',admin_option,'inherit',inherit_option,'set',set_option) ORDER BY pg_get_userbyid(roleid),pg_get_userbyid(member),pg_get_userbyid(grantor)) FROM pg_auth_members),
      'defaults',(SELECT jsonb_agg(jsonb_build_object('role',pg_get_userbyid(defaclrole),'schema',CASE WHEN defaclnamespace=0 THEN '' ELSE defaclnamespace::regnamespace::text END,'type',defaclobjtype,'acl',defaclacl::text) ORDER BY pg_get_userbyid(defaclrole),defaclnamespace::regnamespace::text,defaclobjtype) FROM pg_default_acl));`)));
    profileRaw.triggers=preservedTriggerInventory(profileRaw.triggers??[]);const profile=JSON.stringify(profileRaw);
    const ids=parsePreservedJson(Buffer.from(await query(`SELECT coalesce(jsonb_agg(id::text ORDER BY id),'[]') FROM public.orders WHERE store_id='${PRESERVED_RUNTIME07.siteId}';`)));
    return {method:PRESERVED_WITNESS_METHOD,dataSha256:digest(data.trim()+'\n'+largeObjects.trim()),profileSha256:digest(profile.trim()),sequenceSha256:digest(sequence.trim()),acceptedOrderIds:ids};
}

/** Cluster-global roles are outside pg_dump; raw password hashes stay in private files only. */
export async function capturePreservedRoleProfile(query) {
    return parsePreservedJson(Buffer.from(await query(`SELECT jsonb_build_object(
      'definitions',(SELECT jsonb_agg(jsonb_build_object('name',rolname,'login',rolcanlogin,'superuser',rolsuper,'inherit',rolinherit,'createRole',rolcreaterole,'createDb',rolcreatedb,'replication',rolreplication,'bypassRls',rolbypassrls,'connectionLimit',rolconnlimit,'passwordHash',rolpassword,'validUntil',rolvaliduntil,'settings',coalesce(to_jsonb(s.setconfig),'[]')) ORDER BY rolname) FROM pg_authid a LEFT JOIN pg_db_role_setting s ON s.setrole=a.oid AND s.setdatabase=0),
      'memberships',(SELECT coalesce(jsonb_agg(jsonb_build_object('role',pg_get_userbyid(roleid),'member',pg_get_userbyid(member),'grantor',pg_get_userbyid(grantor),'admin',admin_option,'inherit',inherit_option,'set',set_option) ORDER BY pg_get_userbyid(roleid),pg_get_userbyid(member),pg_get_userbyid(grantor)),'[]') FROM pg_auth_members));`)));
}

const checkpointPromises=new WeakMap();
const checkpointIo={open:openSync,close:closeSync,write:writeSync,sync:fsyncSync,stat:lstatSync};
function writeCheckpointBytes(io,fd,bytes) {
    let offset=0;while(offset<bytes.length){const written=io.write(fd,bytes,offset,bytes.length-offset);check(Number.isInteger(written)&&written>0&&written<=bytes.length-offset,'CHECKPOINT_SHORT_WRITE');offset+=written;}
}
function exportCheckpointArchive(cluster,database,writeChunk) {
    return new Promise((done,reject)=>{
        const child=spawn('docker',['exec',cluster.name,'pg_dump','-U','postgres','-Fc',database],{stdio:['ignore','pipe','pipe']});let failure;
        const timer=setTimeout(()=>{failure=new Error('preserved fixture refused [CHECKPOINT_TIMEOUT]');child.kill('SIGKILL');},120000);
        child.stdout.on('data',chunk=>{try{writeChunk(chunk);}catch(error){failure=error;child.kill('SIGKILL');}});child.stderr.resume();
        child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('close',status=>{clearTimeout(timer);if(failure)reject(failure);else if(status!==0)reject(new Error('preserved fixture refused [CHECKPOINT_FAILED]'));else done();});
    });
}
/** Stop-time archive and global roles. IO/transport seams are recording-test only, never CLI/environment inputs.
 * No safe flag until every file FD and parent directory has synchronized AND closed successfully.
 */
export function checkpointPreservedDatabase(cluster,database,saved,deps={}) {
    if(checkpointPromises.has(cluster))return checkpointPromises.get(cluster);
    const promise=(async()=>{
        const io={...checkpointIo,...deps.io};
        (deps.validateTarget??(()=>validatePreservedTarget(cluster,database,saved,inspectContainer(cluster.name))))();
        const query=sql=>preservedQuery(cluster,database,sql,'checkpoint private query');
        const directory=deps.directory??archiveRoots[1],stat=io.stat(directory);
        check(stat.isDirectory()&&!stat.isSymbolicLink()&&stat.uid===process.getuid()&&(stat.mode&0o777)===0o700,'CHECKPOINT_DIRECTORY');
        const captureRoles=deps.roles??(()=>capturePreservedRoleProfile(query));const roles=await captureRoles();
        const witness=deps.witness??(()=>measurePreservedDatabase(query));const before=await witness();
        const path=join(directory,`preserved-${cluster.runId}-exit.dump`),fd=io.open(path,constants.O_CREAT|constants.O_EXCL|constants.O_RDWR|constants.O_NOFOLLOW,0o600);let bytes=0;
        try {
            await(deps.archive??(write=>exportCheckpointArchive(cluster,database,write)))(chunk=>{bytes+=chunk.length;check(bytes<=512*1024*1024,'CHECKPOINT_LIMIT');writeCheckpointBytes(io,fd,chunk);});
            io.sync(fd);
        }finally{io.close(fd);}
        const archive=readPreservedPrivateFile(path,{maxBytes:512*1024*1024});check(archive.subarray(0,5).toString()==='PGDMP','CHECKPOINT_FORMAT');
        if(deps.fullRead)await deps.fullRead(archive);else{const result=await dockerAsync(['exec','-i',cluster.name,'pg_restore','--file=/dev/null'],{input:archive,allowFailure:true});check(result.status===0,'CHECKPOINT_FULL_READ');}
        const after=await witness();check(same(before,after),'CHECKPOINT_WRITES_NOT_FENCED');check(same(roles,await captureRoles()),'CHECKPOINT_ROLES_CHANGED');
        const rolesPath=path+'.roles.json',rolesBytes=Buffer.from(JSON.stringify(roles));
        const receipt={rolesPath,rolesSha256:digest(rolesBytes),status:'EXIT_SAFETY_ARCHIVE_FULL_READ_NOT_NEW_RESTORE_ADMISSION',resourceRunId:cluster.runId,applicationFixtureId:saved.capsule.application.fixtureId,path,bytes:archive.length,sha256:digest(archive),witness:after,sourceCapsuleSha256:saved.capsuleSha256};
        for(const [file,content]of [[rolesPath,rolesBytes],[path+'.json',Buffer.from(JSON.stringify(receipt))]]){
            const handle=io.open(file,constants.O_CREAT|constants.O_EXCL|constants.O_RDWR|constants.O_NOFOLLOW,0o600);
            try{writeCheckpointBytes(io,handle,content);io.sync(handle);}finally{io.close(handle);}
            readPreservedPrivateFile(file,{expectedSha256:digest(content)});
        }
        const parent=io.open(directory,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
        try{io.sync(parent);}finally{io.close(parent);}
        cluster.preservedSafeToCleanup=true;return receipt;
    })();checkpointPromises.set(cluster,promise);return promise;
}

/** New private binding file only, never an old state-file overwrite or a claim that refreshed QA sessions survive. */
export function writePreservedBinding(runId,value) {
    check(RUN_ID_PATTERN.test(runId)&&plain(value),'BINDING_SCOPE');validatePreservedBinding(value,{runId,capsuleSha256:value.capsuleSha256});const directory=`/private/tmp/letbuyy-preserved-runtime07-${runId}`;
    try{mkdirSync(directory,{mode:0o700});}catch(error){if(error.code!=='EEXIST')throw error;}
    const stat=lstatSync(directory);check(stat.isDirectory()&&!stat.isSymbolicLink()&&stat.uid===process.getuid()&&(stat.mode&0o777)===0o700,'BINDING_DIRECTORY');
    const path=join(directory,'bindings.json');const bytes=Buffer.from(JSON.stringify(value));writeFileSync(path,bytes,{flag:'wx',mode:0o600});return{path,sha256:digest(bytes)};
}

export function validatePreservedBinding(value,{runId,capsuleSha256,retained=false}) {
    exact(value,['version','kind','resourceRunId','applicationFixtureId','issuer','cookieDomain','capsuleSha256','identityPrivateJwk','publicJwks','cookieSecret','checkoutSigningSecret','oldSessionsPreserved'],'BINDING_FIELDS');
    check(value.version===1&&value.kind==='preserved-runtime07-bindings'&&RUN_ID_PATTERN.test(value.resourceRunId)&&value.applicationFixtureId===PRESERVED_RUNTIME07.fixtureId&&value.issuer===PRESERVED_RUNTIME07.identityOrigin&&value.cookieDomain===PRESERVED_RUNTIME07.cookieDomain&&hash(value.capsuleSha256),'BINDING_SCOPE');
    if(!retained)check(value.resourceRunId===runId&&value.capsuleSha256===capsuleSha256&&value.oldSessionsPreserved===false,'BINDING_RUN');
    const key=value.identityPrivateJwk;check(plain(key)&&key.kty==='EC'&&key.crv==='P-256'&&key.alg==='ES256'&&['d','x','y'].every(k=>/^[A-Za-z0-9_-]{40,90}$/.test(key[k]||''))&&/^[A-Za-z0-9_-]{1,100}$/.test(key.kid||''),'BINDING_KEY');
    check(typeof value.publicJwks==='string'&&value.publicJwks.length<=4096,'BINDING_PUBLIC_KEY');
    const publicSet=parsePreservedJson(Buffer.from(value.publicJwks));check(Array.isArray(publicSet.keys)&&publicSet.keys.length===1&&!Object.hasOwn(publicSet.keys[0],'d')&&['x','y','kid','kty','crv'].every(k=>publicSet.keys[0][k]===key[k]),'BINDING_PUBLIC_KEY');
    check([value.cookieSecret,value.checkoutSigningSecret].every(v=>typeof v==='string'&&v.length>=48&&v.length<=256),'BINDING_SECRET');return value;
}
export function readPreservedBinding(saved,runId) {
    const retained=saved.capsule.qa.mode==='retained';const reference=retained?saved.capsule.qa.retainedBinding:{path:`/private/tmp/letbuyy-preserved-runtime07-${runId}/bindings.json`};
    try {const bytes=readPreservedPrivateFile(reference.path,{expectedSha256:reference.sha256});return {value:validatePreservedBinding(parsePreservedJson(bytes),{runId,capsuleSha256:saved.capsuleSha256,retained}),path:reference.path,sha256:digest(bytes)};}
    catch(error){if(!retained&&error.code==='ENOENT')return null;throw error;}
}
export function preservedCutoverPermitPath(runId) {check(RUN_ID_PATTERN.test(runId),'RESOURCE_RUN');return `/private/tmp/letbuyy-preserved-runtime07-${runId}/cutover.json`;}
export function validatePreservedCutoverPermit(permit,saved,runId,binding,stages,now=Date.now()) {
    exact(permit,['version','status','resourceRunId','applicationFixtureId','siteId','capsuleSha256','archiveSha256','sourceManifestSha256','fenceReceiptSha256','witnessSha256','bindingSha256','stages','oldListenersRetired','noLaterAcceptedWork','expiresAt'],'CUTOVER_FIELDS');const c=saved.capsule;
    check(permit.version===1&&permit.status==='ROOT_APPROVED_PRESERVED_RUNTIME07_CUTOVER'&&permit.resourceRunId===runId&&permit.applicationFixtureId===c.application.fixtureId&&permit.siteId===c.application.site.siteId&&permit.capsuleSha256===saved.capsuleSha256&&permit.archiveSha256===c.archive.sha256&&permit.sourceManifestSha256===c.sourceBundle.manifestSha256&&permit.fenceReceiptSha256===c.fence.receiptSha256&&permit.witnessSha256===c.witness.sha256&&permit.bindingSha256===binding.sha256&&same(permit.stages,stages)&&permit.oldListenersRetired===true&&permit.noLaterAcceptedWork===true&&Date.parse(permit.expiresAt)>now&&Date.parse(permit.expiresAt)<=now+10*60_000,'CUTOVER_BINDING');return permit;
}
export function writePreservedProgress(runId,phase,value) {
    check(RUN_ID_PATTERN.test(runId)&&['staged','serving'].includes(phase)&&plain(value),'PROGRESS_SCOPE');const directory=`/private/tmp/letbuyy-preserved-runtime07-${runId}`;const stat=lstatSync(directory);check(stat.isDirectory()&&!stat.isSymbolicLink()&&stat.uid===process.getuid()&&(stat.mode&0o777)===0o700,'PROGRESS_DIRECTORY');writeFileSync(join(directory,phase+'.json'),JSON.stringify({version:1,resourceRunId:runId,...value}),{mode:0o600,flag:'wx'});
}

export const GATEWAY_TEMPLATE_DATABASE = 'letbuyy_tpl_gateway';

const stripUnsupportedPg17Guc = (sql) => sql.replace(/^SET transaction_timeout = 0;\s*$/m, '');

export function parseMigrationCeiling(raw) {
    if (raw === undefined) return undefined;
    if (typeof raw !== 'string' || !/^[1-9]\d{0,5}$/.test(raw)) throw new Error('--through-migration must be a positive integer from 1 to 999999');
    return Number(raw);
}

export function listMigrations(repoRoot, { throughMigration } = {}) {
    if (throughMigration !== undefined && (!Number.isInteger(throughMigration) || throughMigration < 1 || throughMigration > 999999)) throw new Error('Invalid migration ceiling');
    return readdirSync(join(repoRoot, 'database/supabase/migrations'))
        .filter((name) => name.endsWith('.sql') && (throughMigration === undefined || parseInt(name, 10) <= throughMigration))
        .sort((a, b) => {
            const na = parseInt(a.match(/^(\d+)/)?.[1] ?? '0', 10);
            const nb = parseInt(b.match(/^(\d+)/)?.[1] ?? '0', 10);
            return na - nb || a.localeCompare(b);
        });
}

/** Runs a script in one database of a cluster through psql's stdin; a failure names the first error line only. */
export async function psqlScript(cluster, database, sql, what) {
    const result = await dockerAsync(
        ['exec', '-i', cluster.name, 'psql', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-q'],
        { input: `SET client_min_messages TO warning;\n${sql}`, allowFailure: true },
    );
    if (result.status !== 0) {
        const firstError = `${result.stderr}`.split('\n').find((line) => /ERROR|FATAL/.test(line)) ?? `${result.stderr}`.split('\n').find(Boolean) ?? 'unknown error';
        throw new Error(`${what} failed in ${cluster.name}/${database}: ${firstError.trim().slice(0, 300)}`);
    }
    return result.stdout;
}

const quoted = (identifier) => `"${String(identifier).replaceAll('"', '""')}"`;

/**
 * Builds the pristine template once per cluster: faithful bootstrap, every migration in numeric order, with the REST
 * layer's roles established first, then the fixture schema. Returns the seconds it took.
 */
export async function buildGatewayTemplate(cluster, { repoRoot, restPassword, throughMigration }) {
    // The password is written into SQL text, so it is checked to be what the runner generates (hex), nothing else.
    if (!/^[0-9a-f]{32,}$/.test(restPassword)) throw new Error('the REST role password must be a hex string');
    const started = Date.now();
    await psqlScript(cluster, 'postgres', `CREATE DATABASE ${quoted(GATEWAY_TEMPLATE_DATABASE)};`, 'creating the template database');
    await psqlScript(cluster, GATEWAY_TEMPLATE_DATABASE, SUPABASE_FAITHFUL_BOOTSTRAP_SQL, 'the faithful bootstrap');
    // REST transport memberships must exist before migrations freeze their authority profile.
    await psqlScript(cluster, GATEWAY_TEMPLATE_DATABASE, `
        DO $role$
        BEGIN
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
            CREATE ROLE authenticator LOGIN NOINHERIT;
          END IF;
        END
        $role$;
        ALTER ROLE authenticator PASSWORD '${restPassword}';
        GRANT anon, authenticated, service_role TO authenticator;

    `, 'the REST roles');
    cluster.migrationEvidence = { throughMigration: throughMigration ?? null, applied: [] };
    for (const name of listMigrations(repoRoot, { throughMigration })) {
        const source = readFileSync(join(repoRoot, 'database/supabase/migrations', name), 'utf8');
        await psqlScript(
            cluster,
            GATEWAY_TEMPLATE_DATABASE,
            stripUnsupportedPg17Guc(source),
            `migration ${name}`,
        );
        cluster.migrationEvidence.applied.push({ name, prefix: parseInt(name, 10), sha256: createHash('sha256').update(source).digest('hex') });
    }
    await psqlScript(cluster, GATEWAY_TEMPLATE_DATABASE, `

        -- The run's identity, readable through the REST layer: schema letbuyy_fixture is exposed only by this lane's
        -- sidecar, and only the service role may call it.
        CREATE SCHEMA IF NOT EXISTS letbuyy_fixture;
        GRANT USAGE ON SCHEMA letbuyy_fixture TO service_role;
        CREATE OR REPLACE FUNCTION letbuyy_fixture.run_id() RETURNS text LANGUAGE sql STABLE
          AS $fn$ SELECT current_setting('letbuyy.fixture_run_id', true) $fn$;
        GRANT EXECUTE ON FUNCTION letbuyy_fixture.run_id() TO service_role;
    `, 'the fixture schema');
    // Nobody connects to a template while it is cloned; keeping connections off makes that a rule and not a habit.
    await psqlScript(cluster, 'postgres', `ALTER DATABASE ${quoted(GATEWAY_TEMPLATE_DATABASE)} WITH ALLOW_CONNECTIONS false;`, 'sealing the template');
    return Math.round((Date.now() - started) / 100) / 10;
}

/** One suite's database, cloned from the template and marked as this run's. */
export async function createSuiteDatabase(cluster, database, runId) {
    if (!RUN_ID_PATTERN.test(runId)) throw new Error('the run id must be 12 hex characters');
    await psqlScript(cluster, 'postgres', `CREATE DATABASE ${quoted(database)} TEMPLATE ${quoted(GATEWAY_TEMPLATE_DATABASE)};`, 'cloning the template');
    await psqlScript(cluster, 'postgres', `ALTER DATABASE ${quoted(database)} SET search_path = public, extensions;`, 'setting the search_path');
    await psqlScript(cluster, 'postgres', `ALTER DATABASE ${quoted(database)} SET letbuyy.fixture_run_id = '${runId}';`, 'marking the database');
}

export async function dropSuiteDatabase(cluster, database) {
    const result = await dockerAsync(
        ['exec', '-i', cluster.name, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-c', `DROP DATABASE IF EXISTS ${quoted(database)} WITH (FORCE);`],
        { allowFailure: true },
    );
    return result.status === 0;
}
