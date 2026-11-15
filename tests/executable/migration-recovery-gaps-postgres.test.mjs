// Historical recovery must preserve retained rows and must never report a false
// reversal of an irreversible pricing, money, auth or outbox change. All DDL below
// runs only inside the executable runner's disposable cluster, never a shared DB.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import test, {before} from 'node:test';
import {SUPABASE_FAITHFUL_BOOTSTRAP_SQL} from './supabase-faithful-bootstrap.mjs';
import {functionDefinitions, sqlStatements, tokenText} from '../../scripts/governance/definer-role-closure.mjs';
import {
    DEFAULT_IMAGE, FIXTURE_LABEL, OWNER_PID_LABEL, RUN_ID_LABEL, ROLE_LABEL,
    createNetwork, createVolume, inspectContainer, removeContainer,
    removeNetwork, removeVolume, startCluster, waitUntilAccepting,
} from '../../scripts/governance/executable-pg-fixture.mjs';

const root = new URL('../../', import.meta.url);
const container = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER;
const database = process.env.LETBUYY_EXECUTABLE_PG_DATABASE;
assert.match(container ?? '', /^letbuyy-exec-[a-zA-Z0-9.-]+$/, 'use the owned executable runner');
assert.match(database ?? '', /^letbuyy_exec_[a-z0-9_]+$/, 'a per-suite owned database is required');
const snapshots = new Map();
const reversible = new Map([
    [138, ['store_metafield_definitions', 'store_metafield_values']],
    [140, ['cod_reconciliation_entries']],
    [157, ['metadata']], [182, ['timezone']], [187, ['site_settings']],
    [194, ['demo_requests']], [261, ['privacy']], [262, ['support_tickets_privacy_open_request_uidx']],
]);
const forwardOnly = [170, 175, 179, 183, 184, 186];
const restorationFamilies = [434, 435, 436, 437, 438, 440];
const names = readdirSync(new URL('database/supabase/migrations/', root))
    .filter(name => /^\d+_.*\.sql$/.test(name)).sort((a, b) => parseInt(a) - parseInt(b));
const nameFor = number => names.find(name => parseInt(name) === number);
const read = (directory, number) => readFileSync(new URL(`database/supabase/${directory}/${nameFor(number).replace(/\.sql$/, directory === 'rollback' ? '.rollback.sql' : '.sql')}`, root), 'utf8')
    .replace(/^SET transaction_timeout = 0;\s*$/m, '');
const docker = (args, input, encoding = 'utf8') => execFileSync('docker', ['exec', '-i', container, ...args],
    {input, encoding, maxBuffer: 512 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe']});
const sql = (query, db = database) => docker(['psql', '-U', 'postgres', '-d', db, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], query).trim();
const hash = input => createHash('sha256').update(input).digest('hex');
const schemaDigest = db => hash(docker(['pg_dump', '-U', 'postgres', '-d', db, '--schema-only'])
    .split('\n').filter(line => !/^--|^\\(?:un)?restrict\b|^\s*$/.test(line)).join('\n'));
const refused = (query, db, expected) => {
    let failure = '';
    try { sql(query, db); } catch (error) { failure = String(error.stderr ?? error.message); }
    assert.match(failure, expected, 'recovery must refuse with its documented reason');
};
const seedSite = db => {
    const id = randomUUID();
    sql(`INSERT INTO public.sites(id,name,store_name,site_type,subdomain)
      VALUES ('${id}','Synthetic recovery proof','Synthetic recovery proof','store','syn-recovery-${id.slice(0,8)}');`, db);
    return id;
};
const seedRetained = (number, db) => {
    if (number === 194) {
        sql(`INSERT INTO public.demo_requests(full_name,email,phone)
          VALUES ('Synthetic lead','recovery@example.invalid','9000000000');`, db);
        return 'SELECT to_jsonb(t)::text FROM public.demo_requests t ORDER BY id;';
    }
    if (number === 261 || number === 262) {
        sql(`INSERT INTO public.support_tickets(ticket_ref,subject,topic,requester_user_id,metadata)
          VALUES ('SYN-RECOVERY','Synthetic privacy request','privacy','${randomUUID()}',
          '{"privacy_request_type":"access"}'::jsonb);`, db);
        return 'SELECT to_jsonb(t)::text FROM public.support_tickets t ORDER BY id;';
    }
    const site = seedSite(db);
    if (number === 138) {
        sql(`INSERT INTO public.store_metafield_definitions(store_id,owner_type,key,name,value_type)
          VALUES ('${site}','product','synthetic','Synthetic specification','single_line_text');`, db);
        return 'SELECT to_jsonb(t)::text FROM public.store_metafield_definitions t ORDER BY id;';
    }
    if (number === 140) {
        sql(`INSERT INTO public.wallet_ledger_entries(site_id,entry_type,direction,amount_minor)
          VALUES ('${site}','cod_remittance_credit','credit',12345);`, db);
        return 'SELECT to_jsonb(t)::text FROM public.wallet_ledger_entries t ORDER BY id;';
    }
    if (number === 157) {
        sql(`INSERT INTO public.products(store_id,site_id,name,price,metadata)
          VALUES ('${site}','${site}','Synthetic metadata',123.45,'{"origin":"synthetic"}'::jsonb);`, db);
        return 'SELECT to_jsonb(t)::text FROM public.products t ORDER BY id;';
    }
    sql(number === 182 ? `UPDATE public.sites SET timezone='UTC' WHERE id='${site}';`
        : `UPDATE public.sites SET site_settings='{"primary_color":"#123456"}'::jsonb WHERE id='${site}';`, db);
    return 'SELECT to_jsonb(t)::text FROM public.sites t ORDER BY id;';
};

before(() => {
    sql(SUPABASE_FAITHFUL_BOOTSTRAP_SQL);
    for (const name of names) {
        const number = parseInt(name);
        sql(read('migrations', number));
        if (reversible.has(number) || restorationFamilies.includes(number)) {
            const snapshot = `${database.slice(0, 48)}_at_${number}`;
            sql(`CREATE DATABASE "${snapshot}" TEMPLATE "${database}";`, 'postgres');
            snapshots.set(number, snapshot);
        }
        // Exercise a real retained merchant through the KYC 440 -> 444 upgrade.
        if (number === 440) {
            const id = seedSite(database);
            sql(`CREATE SCHEMA recovery_probe;
              CREATE TABLE recovery_probe.expected_site AS
              SELECT to_jsonb(s) AS row FROM public.sites s WHERE id='${id}';`);
        }
    }
}, {timeout: 180_000});

test('every migration >=138 has one paired recovery file and unique sequential identity', () => {
    const numbers = names.map(name => parseInt(name));
    assert.equal(new Set(numbers).size, numbers.length);
    const active = numbers.filter(number => number >= 73);
    for (let i = 1; i < active.length; i++) assert.equal(active[i], active[i - 1] + 1);
    for (const number of numbers.filter(number => number >= 138)) assert.ok(read('rollback', number).trim());
    assert.equal(sql(`SELECT count(*) FROM public.sites s
      JOIN recovery_probe.expected_site e ON to_jsonb(s)=e.row;`), '1', '440 retained merchant survives 441–444 exactly');
});

for (const [number] of reversible) test(`migration ${number}: pre-use reverse/reapply works, retained-data reverse refuses atomically`, () => {
    const db = snapshots.get(number);
    sql(read('rollback', number), db);
    sql(read('migrations', number), db);
    const retainedQuery = seedRetained(number, db);
    const retained = sql(retainedQuery, db);
    const schema = schemaDigest(db);
    refused(read('rollback', number), db, new RegExp(`rollback ${number} refuses`));
    assert.equal(sql(retainedQuery, db), retained, 'retained rows are unchanged');
    assert.equal(schemaDigest(db), schema, 'DDL/ACL/RLS and functions are unchanged after refusal');
});

for (const number of forwardOnly) test(`migration ${number}: destructive or correctness-regressing reverse fails closed`, () => {
    const schema = schemaDigest(database);
    refused(read('rollback', number), database, new RegExp(`rollback ${number} refuses`));
    assert.equal(schemaDigest(database), schema);
});

const functionState = db => sql(`SELECT md5(coalesce(jsonb_agg(jsonb_build_object(
  'signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),
  'owner',p.proowner::regrole::text,'acl',p.proacl::text)ORDER BY p.oid::regprocedure::text),'[]'::jsonb)::text)
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'AND p.prokind='f';`, db);
const transactionBody = source => {
    const statements = sqlStatements(source);
    assert.equal(tokenText(statements[0]), 'begin ;');
    assert.equal(tokenText(statements.at(-1)), 'commit ;');
    assert.ok(!statements.slice(1,-1).some(statement => ['begin','commit','rollback','savepoint'].includes(statement[0]?.value)));
    return source.slice(statements[0].at(-1).end, statements.at(-1)[0].start);
};
for (const number of restorationFamilies) test(`migration ${number}: every restored signature rejects real overload, result, name and execution-profile drift before mutation`, {timeout: 180_000}, () => {
    const db = snapshots.get(number), down = read('rollback', number);
    const original = functionState(db);
    sql(down, db); sql(read('migrations', number), db);
    assert.equal(functionState(db), original, 'pre-use down/up restores all public function bodies, owners and ACLs');
    const body = transactionBody(down), schema = schemaDigest(db);
    let signatures = 0;
    for (const fn of functionDefinitions(down)) {
        const live = JSON.parse(sql(`SELECT jsonb_build_object('definition',pg_get_functiondef(p.oid),
          'result',format_type(p.prorettype,NULL),'definer',p.prosecdef,
          'arguments',(SELECT string_agg(format('%I %s',p.proargnames[i+1],format_type(p.proargtypes[i],NULL)),','ORDER BY i)
            FROM generate_series(0,p.pronargs-1)i))FROM pg_proc p WHERE p.oid='${fn.identity}'::regprocedure;`, db));
        const stub = `CREATE FUNCTION public.${fn.name}(synthetic_argument bytea)RETURNS integer LANGUAGE sql AS $$SELECT 1$$;`;
        const alternate = live.result === 'text' ? 'integer' : 'text';
        const value = alternate === 'text' ? "'synthetic ABI drift'" : '1';
        const resultDrift = `DROP FUNCTION ${fn.identity} CASCADE;
          CREATE FUNCTION public.${fn.name}(${live.arguments ?? ''})RETURNS ${alternate} LANGUAGE sql
          ${live.definer ? 'SECURITY DEFINER' : 'SECURITY INVOKER'} AS $$SELECT ${value}$$;
          REVOKE ALL ON FUNCTION ${fn.identity} FROM PUBLIC,anon,authenticated;`;
        const mutations = [stub, `DROP FUNCTION ${fn.identity} CASCADE;${stub}`, resultDrift];
        if (fn.inputNames.length) mutations.push(`DROP FUNCTION ${fn.identity} CASCADE;` +
            live.definition.replace(new RegExp(`\\b${fn.inputNames[0]}\\b`, 'g'), 'synthetic_renamed_input') + ';');
        for (const mutation of mutations) {
            refused(`BEGIN;${mutation}\n${body}\nCOMMIT;`, db, new RegExp(`rollback ${number} refuses to run: input names or typed ABI changed`));
            assert.equal(functionState(db), original, fn.identity + ': refusal rolls back all drift and effects');
        }
        signatures++;
    }
    assert.ok(signatures > 0);
    assert.equal(schemaDigest(db), schema, 'complete schema/ACL/RLS profile stays unchanged after every mutant');
});

test('436 admits equivalent ACL ordering, restores the exact raw preimage, and refuses changed authority', {timeout: 180_000}, () => {
    const up = read('migrations', 436), down = read('rollback', 436), body = transactionBody(up);
    const originals = functionDefinitions(down);
    assert.equal(originals.length, 13, 'all original inventory restoration signatures are covered');
    for (const cohort of ['legacy', 'appfirst']) {
        const db = `${database.slice(0, 40)}_acl_${cohort}`;
        sql(`CREATE DATABASE "${db}" TEMPLATE "${snapshots.get(435)}";`, 'postgres');
        try {
            const prior = functionState(db);
            if (cohort === 'appfirst') {
                let reordered = 0;
                for (const fn of originals) {
                    const both = sql(`SELECT has_function_privilege('service_role','${fn.identity}','EXECUTE')
                        AND has_function_privilege('app_tenant','${fn.identity}','EXECUTE');`, db);
                    if (both !== 't') continue;
                    sql(`REVOKE EXECUTE ON FUNCTION ${fn.identity} FROM service_role,app_tenant;
                         GRANT EXECUTE ON FUNCTION ${fn.identity} TO app_tenant;
                         GRANT EXECUTE ON FUNCTION ${fn.identity} TO service_role;`, db);
                    reordered++;
                }
                assert.ok(reordered > 0);
                assert.notEqual(functionState(db), prior, 'the alternate raw ACL order must actually differ');
            }
            const before = functionState(db), schema = schemaDigest(db);
            sql(up, db); sql(down, db);
            assert.equal(functionState(db), before, `${cohort}: bodies, owners and raw ACL ordering return exactly`);
            assert.equal(schemaDigest(db), schema, `${cohort}: the entire schema, policies and grants return exactly`);
            for (const fn of originals) {
                refused(`BEGIN;GRANT EXECUTE ON FUNCTION ${fn.identity} TO anon;${body}COMMIT;`, db,
                    /migration436 refuses changed original function/);
                assert.equal(functionState(db), before, `${fn.identity}: an extra API grant is refused atomically`);
            }
            const signature = 'public.commit_inventory_reservation(uuid,uuid,text,uuid,text)';
            for (const mutation of [
                `REVOKE EXECUTE ON FUNCTION ${signature} FROM app_tenant;`,
                `GRANT EXECUTE ON FUNCTION ${signature} TO service_role WITH GRANT OPTION;`,
                `ALTER FUNCTION ${signature} OWNER TO authenticated;`,
            ]) {
                refused(`BEGIN;${mutation}${body}COMMIT;`, db, /migration436 refuses changed original function/);
                assert.equal(functionState(db), before, `${cohort}: changed owner, grant option or missing grant cannot be admitted`);
            }
        } finally {
            sql(`DROP DATABASE "${db}" WITH (FORCE);`, 'postgres');
        }
    }
});

const dataDigestSql = `CREATE OR REPLACE FUNCTION pg_temp.recovery_data_digest() RETURNS text
LANGUAGE plpgsql AS $fn$ DECLARE t record; d text; result text := ''; BEGIN
  FOR t IN SELECT n.nspname, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','p') AND n.nspname NOT LIKE 'pg_%'
      AND n.nspname NOT IN ('information_schema') ORDER BY n.nspname,c.relname
  LOOP EXECUTE format('SELECT count(*)::text || chr(58) || coalesce(md5(string_agg(h, chr(44) ORDER BY h)), md5(chr(0+32))) FROM (SELECT md5(to_jsonb(r)::text) h FROM %I.%I r) s',t.nspname,t.relname) INTO d;
    result := result || t.nspname || '.' || t.relname || ':' || d || ';';
  END LOOP; RETURN md5(result); END $fn$; SELECT pg_temp.recovery_data_digest();`;

test('plain logical restore is refused when catalog identity witnesses cannot survive new object IDs', {timeout: 180_000}, () => {
    const restored = `${database.slice(0, 48)}_restored`;
    const data = sql(dataDigestSql);
    const archive = docker(['pg_dump', '-U', 'postgres', '-d', database, '--format=custom'], undefined, 'buffer');
    assert.ok(archive.length > 10_000, 'a real populated database backup is required');
    sql(`CREATE DATABASE "${restored}";`, 'postgres');
    try {
        assert.throws(() => docker(['pg_restore', '-U', 'postgres', '-d', restored, '--exit-on-error'], archive),
            error => /360 refuses changed historical custody verifier identity or definition/.test(String(error.stderr)));
        assert.equal(sql(dataDigestSql), data, 'a refused logical rehearsal does not mutate its source');
    } finally {
        sql(`DROP DATABASE "${restored}" WITH (FORCE);`, 'postgres');
    }
});

test('a verified physical base backup restores all retained data and catalog guards with the original identities', {timeout: 180_000}, async () => {
    // These exact historical scratch databases belong only to this suite. Remove
    // them before the full-cluster backup to bound disk and memory consumption.
    for (const snapshot of snapshots.values()) sql(`DROP DATABASE "${snapshot}";`, 'postgres');
    const runId = process.env.LETBUYY_EXECUTABLE_RUN_ID;
    assert.match(runId ?? '', /^[a-f0-9]{12}$/);
    const source = inspectContainer(container);
    assert.equal(source?.Config?.Labels?.[FIXTURE_LABEL], '1');
    assert.equal(source?.Config?.Labels?.[RUN_ID_LABEL], runId);
    const name = `${container}-physical`;
    const network = `${name}-net`, volume = `${name}-data`;
    const cleanup = [];
    let createdNetwork = false, createdVolume = false, started = false;
    const data = sql(dataDigestSql), schema = schemaDigest(database);
    docker(['pg_basebackup', '-U', 'postgres', '--pgdata=/tmp/recovery-base',
        '--format=tar', '--gzip', '--wal-method=fetch', '--checkpoint=fast']);
    const archive = docker(['cat', '/tmp/recovery-base/base.tar.gz'], undefined, 'buffer');
    assert.ok(archive.length > 10_000);
    try {
        createNetwork({name: network, runId}); createdNetwork = true;
        createVolume({name: volume, runId}); createdVolume = true;
        execFileSync('docker', ['run', '--rm', '-i', '--pull', 'never', '--name', `${name}-load`,
            '--label', `${FIXTURE_LABEL}=1`, '--label', `${OWNER_PID_LABEL}=${process.pid}`,
            '--label', `${RUN_ID_LABEL}=${runId}`, '--label', `${ROLE_LABEL}=postgres`,
            '--network', 'none', '--memory', '256m', '--memory-swap', '256m', '--cpus', '1', '--pids-limit', '64',
            '--mount', `type=volume,source=${volume},target=/restore`, '--entrypoint', 'tar', DEFAULT_IMAGE,
            '-xzf', '-', '-C', '/restore'], {input: archive, maxBuffer: 1024 * 1024});
        startCluster({name, database, runId, network, volume, disableJit: true, disableAutovacuum: true}); started = true;
        await waitUntilAccepting(name);
        const restoredSql = query => execFileSync('docker', ['exec', '-i', name, 'psql', '-U', 'postgres', '-d', database,
            '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], {input: query, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024}).trim();
        assert.equal(restoredSql(dataDigestSql), data, 'all user-table row counts and hashes match');
        const restoredSchema = execFileSync('docker', ['exec', name, 'pg_dump', '-U', 'postgres', '-d', database, '--schema-only'],
            {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
        assert.equal(hash(restoredSchema.split('\n').filter(line => !/^--|^\\(?:un)?restrict\b|^\s*$/.test(line)).join('\n')), schema,
            'owners, ACLs, RLS, constraints, triggers and function bodies match');
        assert.equal(restoredSql(`SELECT count(*) FROM public.sites s JOIN recovery_probe.expected_site e ON to_jsonb(s)=e.row;`), '1');
        // This DDL hit the identity guard in the logical rehearsal; it must work
        // after a physical restore, with the guard still enabled.
        restoredSql('REFRESH MATERIALIZED VIEW public.commerce_analytics_daily_mv;');
        console.log(`physical recovery proof: archiveBytes=${archive.length} archiveSha256=${hash(archive)} allUserRowsMatch=true schemaMatch=true guardedRefresh=true`);
    } finally {
        if (inspectContainer(`${name}-load`)) cleanup.push(removeContainer(`${name}-load`));
        if (started || inspectContainer(name)) cleanup.push(removeContainer(name));
        if (createdVolume) cleanup.push(removeVolume(volume));
        if (createdNetwork) cleanup.push(removeNetwork(network));
        assert.ok(cleanup.every(result => result.removed), 'every physical restore resource is removed and verified');
    }
});
