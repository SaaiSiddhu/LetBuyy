// Owned scheduled traversal proof; no external network or financial posting.
import assert from 'node:assert/strict';
import test from 'node:test';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireOwnedDatabase, requireOwnedHistoricalSqlDatabase, startOwnedClientRuntime, stopOwnedClientRuntime } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import type { MoneyLedgerReconciliationResult } from '../../services/queue-workers/src/money-ledger-reconciliation';

interface ScheduledObservation { status: string; result?: MoneyLedgerReconciliationResult }
interface TraversalState { revision: number; pass_id: string }

const owned = requireOwnedDatabase();
const root = fileURLToPath(new URL('../../', import.meta.url));
const evidence = process.env.LETBUYY_N7_RECONCILIATION_EVIDENCE_DIR;

async function scheduled(tick: number, loseReply = false): Promise<ScheduledObservation[]> {
    const child = startOwnedClientRuntime(owned, 'money-ledger-scheduled-probe', { env: {
        N7_SCHEDULED_TIME: String(1700000000000 + tick * 900000),
        N7_LOSE_RECONCILIATION_REPLY: loseReply ? '1' : '0',
    } });
    let stdout = '', stderr = '';
    try {
        const code = await new Promise<number | null>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Owned scheduled invocation timed out')), 90000);
            child.stdout.on('data', chunk => {
                stdout += chunk.toString();
                if (Buffer.byteLength(stdout) > 1024 * 1024) reject(new Error('Owned scheduled output exceeded limit'));
            });
            child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-32768); });
            child.once('error', () => { clearTimeout(timer); reject(new Error('Owned scheduled invocation could not start')); });
            child.once('close', code => { clearTimeout(timer); resolve(code); });
        });
        assert.equal(code, 0, `Owned scheduled invocation failed${stderr.trim() ? ': ' + stderr.trim() : ''}`);
        return JSON.parse(stdout) as ScheduledObservation[];
    } finally { await stopOwnedClientRuntime(child); }
}

const literal = (value: unknown) => "'" + String(value).replaceAll("'", "''") + "'";
const parseSql = <T>(output: string): T => JSON.parse(output.split('\n').find(line => line.startsWith('{') || line.startsWith('[') || line === 'null')!);
const state = () => parseSql<TraversalState>(owned.psql('SELECT to_jsonb(t) FROM money_ledger_reconciliation_traversal t;'));
const batchSql = (key: string, limit = 2) => `SET ROLE service_role; SELECT public.run_money_ledger_reconciliation_batch_v1(${literal(key)},${limit}); RESET ROLE;`;
const runBatch = (key: string, limit = 2) => parseSql<MoneyLedgerReconciliationResult>(owned.psql(batchSql(key, limit)));
const batchAsync = async (key: string, limit = 2) => parseSql<MoneyLedgerReconciliationResult>(await owned.psqlAsync(batchSql(key, limit)));
const migration = readFileSync(join(root, 'database/supabase/migrations/349_money_ledger_reconciliation_traversal.sql'), 'utf8');
const rollback = readFileSync(join(root, 'database/supabase/rollback/349_money_ledger_reconciliation_traversal.rollback.sql'), 'utf8');
// Fixture setup owns only this disposable database. Ordinary round trips must
// empty its synthetic operational rows first; retained-data loss is exercised
// exclusively by the mandatory-abort BEFORE probe below.
const clearSyntheticTraversal = () => {
    owned.psql('DROP TRIGGER IF EXISTS n7_receipt_failure ON public.money_ledger_reconciliation_batches; TRUNCATE TABLE public.money_ledger_reconciliation_batches,public.money_ledger_reconciliation_traversal;');
};
const resetTraversal = () => { clearSyntheticTraversal(); owned.psql(rollback); owned.psql(migration); };
const attempted = (pass: string) => parseSql<string[]>(owned.psql(`SELECT coalesce(json_agg(item->>'site_id' ORDER BY (b.result->>'revision')::bigint,ordinality),'[]'::json)
  FROM money_ledger_reconciliation_batches b CROSS JOIN LATERAL jsonb_array_elements(b.result->'results') WITH ORDINALITY AS x(item,ordinality)
  WHERE b.pass_id=${literal(pass)}::uuid;`));
const functionHash = () => createHash('sha256').update(owned.psql("SELECT pg_get_functiondef('public.refresh_money_ledger_site_reconciliation(uuid)'::regprocedure);")).digest('hex');
const protocol: Record<string, unknown> = {};
function record(name: string, observation: unknown) {
    protocol[name] = observation;
    if (evidence) { mkdirSync(evidence, { recursive: true }); writeFileSync(join(evidence, 'protocol-observations.json'), JSON.stringify({ runId: owned.runId, ...protocol }, null, 2) + '\n'); }
}

test('fresh scheduled invocations progress beyond two pages despite tied timestamps and a middle failure', { timeout: 480000 }, async t => {
    const canonicalHash = functionHash();
    const ids = Array.from({ length: 7 }, () => randomUUID()).sort();
    for (const [index, id] of ids.entries()) owned.psql(`INSERT INTO sites(id,name,store_name,site_type,subdomain,published,created_at)
      VALUES('${id}','Synthetic traversal ${index}','Synthetic traversal ${index}','store','syn-n7-traversal-${index}',true,'1900-01-01');`);
    owned.psql(`CREATE FUNCTION public.n7_test_reconciliation_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.site_id='${ids[1]}'::uuid THEN RAISE EXCEPTION 'synthetic middle tenant failure'; END IF; RETURN NEW; END; $$;
      CREATE TRIGGER n7_test_reconciliation_failure BEFORE INSERT OR UPDATE ON public.money_ledger_site_reconciliations
      FOR EACH ROW EXECUTE FUNCTION public.n7_test_reconciliation_failure();`);
    const invocations: ScheduledObservation[][] = [];
    for (let tick = 0; tick < 5; tick++) invocations.push(await scheduled(tick));
    const refreshed = owned.psql(`SELECT json_agg(site_id ORDER BY site_id) FROM money_ledger_site_reconciliations WHERE site_id=ANY(ARRAY[${ids.map(id => `'${id}'::uuid`).join(',')}]);`);
    const seen: string[] = JSON.parse(refreshed || 'null') || [];
    const observed = { runId: owned.runId, invocations, expectedSites: ids, refreshedSites: seen, middleFailure: ids[1], externalRequests: 0 };
    if (evidence) { mkdirSync(evidence, { recursive: true }); writeFileSync(join(evidence, 'scheduled-observations.json'), JSON.stringify(observed, null, 2) + '\n'); }
    assert.deepEqual(seen, ids.filter(id => id !== ids[1]), 'later active tenants must progress across fresh processes despite a middle failure');
    await t.test('durable pass/outcome and original scheduled event replay cannot rewind newer progress', async () => {
        const firstPass = invocations[0][0].result!.pass_id;
        assert.deepEqual(attempted(firstPass), ids);
        assert.equal(invocations[3][0].result!.pass_completed, true);
        assert.equal(invocations[3][0].status, 'failed');
        assert.equal(invocations[3][0].result!.pass_counts.failed, 1);
        assert.equal(invocations[0][0].result!.results[1].variance_minor, null);
        const before = state(), replay = await scheduled(0);
        assert.equal(replay[0].result!.replayed, true); assert.equal(replay[0].result!.pass_id, firstPass);
        assert.deepEqual(state(), before);
        record('scheduledRestartAndReplay', { firstPass, attempted: attempted(firstPass), completedWithFailure: true, olderEventReplayedWithoutRewind: true });
    });
    owned.psql('DROP TRIGGER n7_test_reconciliation_failure ON public.money_ledger_site_reconciliations;');

    await t.test('actual roles cannot invoke or mutate global traversal outside the service RPC', () => {
        for (const role of ['anon', 'authenticated', 'app_tenant']) {
            assert.throws(() => owned.psql(`SET ROLE ${role}; SELECT public.run_money_ledger_reconciliation_batch_v1('denied-${role}',2);`), /permission denied/);
            for (const table of ['money_ledger_reconciliation_traversal', 'money_ledger_reconciliation_batches']) {
                assert.throws(() => owned.psql(`SET ROLE ${role}; SELECT * FROM public.${table};`), /permission denied/);
            }
        }
        assert.throws(() => owned.psql('SET ROLE service_role; UPDATE money_ledger_reconciliation_traversal SET revision=0;'), /permission denied/);
        assert.throws(() => owned.psql('SET ROLE service_role; DELETE FROM money_ledger_reconciliation_batches;'), /permission denied/);
        assert.throws(() => owned.psql(`BEGIN; SET LOCAL ROLE service_role; SELECT set_config('app.site_id','${ids[0]}',true); SELECT public.run_money_ledger_reconciliation_batch_v1('tenant-context-denial',2); COMMIT;`), /refuses tenant-scoped/);
        assert.equal(owned.psql("SELECT count(*) FROM pg_class WHERE relname IN('money_ledger_reconciliation_traversal','money_ledger_reconciliation_batches') AND relrowsecurity AND relforcerowsecurity;"), '2');
        assert.ok(Number(owned.psql('SET ROLE service_role; SELECT count(*) FROM money_ledger_reconciliation_batches;').split('\n').find(line => /^\d+$/.test(line))) > 0);
        record('actualRoles', { denied: ['anon', 'authenticated', 'app_tenant'], directServiceMutationDenied: true, tenantGucDenied: true, forceRls: 2 });
    });

    await t.test('concurrent same-key replay and distinct claims serialize without duplicate page or rewind', async () => {
        resetTraversal();
        const same = await Promise.all([batchAsync('same-event'), batchAsync('same-event')]);
        assert.deepEqual(same.map(row => row.replayed).sort(), [false, true]);
        assert.equal(same[0].revision, 1); assert.equal(same[1].revision, 1);
        assert.deepEqual(same[0].results, same[1].results);
        assert.equal(owned.psql("SELECT count(*) FROM money_ledger_reconciliation_batches WHERE request_key='same-event';"), '1');
        assert.throws(() => runBatch('same-event', 3), /bound to another limit/);
        const winners = await Promise.all([batchAsync('race-a'), batchAsync('race-b')]);
        assert.deepEqual(winners.map(row => row.revision).sort(), [2, 3]);
        assert.equal(new Set(winners.flatMap(row => row.results.map(site => site.site_id))).size, 4);
        const before = state(); runBatch('same-event'); assert.deepEqual(state(), before);
        assert.deepEqual(attempted(before.pass_id), ids.slice(0, 6));
        record('concurrentReplayAndClaims', { sameKeyReceipts: 1, revisions: [1, 2, 3], attempted: attempted(before.pass_id), changedLimitDenied: true, olderReplayCannotRewind: true });
    });

    await t.test('committed HTTP response loss recovers original scheduled receipt after process restart', async () => {
        resetTraversal();
        const lost = await scheduled(100, true); assert.equal(lost[0].status, 'failed');
        const committed = state(); assert.equal(committed.revision, 1);
        assert.equal(owned.psql('SELECT count(*) FROM money_ledger_reconciliation_batches;'), '1');
        const recovered = await scheduled(100); assert.equal(recovered[0].result!.replayed, true);
        assert.deepEqual(state(), committed);
        const next = await scheduled(101); assert.equal(next[0].result!.revision, 2);
        assert.deepEqual(next[0].result!.results.map(row => row.site_id), ids.slice(2, 4));
        record('committedResponseLoss', { lostReportedFailed: true, committedRevision: 1, freshProcessReplay: true, nextRevision: 2 });
    });

    await t.test('receipt persistence failure rolls back every refresh and cursor advance atomically', () => {
        resetTraversal();
        const before = owned.psql('SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY site_id),\'[]\'::jsonb) FROM money_ledger_site_reconciliations r;');
        owned.psql(`CREATE SEQUENCE public.n7_receipt_failure_once; CREATE FUNCTION public.n7_receipt_failure_once() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN IF nextval('public.n7_receipt_failure_once')=1 THEN RAISE EXCEPTION 'synthetic receipt persistence failure'; END IF; RETURN NEW; END; $$;
          CREATE TRIGGER n7_receipt_failure BEFORE INSERT ON money_ledger_reconciliation_batches FOR EACH ROW EXECUTE FUNCTION public.n7_receipt_failure_once();`);
        assert.throws(() => runBatch('receipt-fault'), /synthetic receipt persistence failure/);
        assert.equal(owned.psql('SELECT count(*) FROM money_ledger_reconciliation_traversal;'), '0');
        assert.equal(owned.psql('SELECT count(*) FROM money_ledger_reconciliation_batches;'), '0');
        assert.equal(owned.psql('SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY site_id),\'[]\'::jsonb) FROM money_ledger_site_reconciliations r;'), before);
        const retry = runBatch('receipt-fault'); assert.equal(retry.revision, 1); assert.equal(retry.checked, 2);
        assert.equal(runBatch('receipt-fault').replayed, true);
        record('receiptAtomicity', { failedCommitLeftNoCursorOrReceipt: true, canonicalRefreshRowsRolledBack: true, retryRevision: 1 });
    });

    await t.test('fixed watermark handles deleted tail and new rows behind cursor or above watermark', () => {
        resetTraversal();
        const first = runBatch('boundary-start'), pass = first.pass_id;
        const backdated = randomUUID(), future = randomUUID(), noDate = randomUUID();
        owned.psql(`UPDATE sites SET deleted_at=now() WHERE id IN('${ids[3]}','${ids[6]}');
          INSERT INTO sites(id,name,store_name,site_type,subdomain,published,created_at) VALUES
          ('${backdated}','Synthetic backdated','Synthetic backdated','store','syn-n7-backdated',true,'1899-01-01'),
          ('${future}','Synthetic future','Synthetic future','store','syn-n7-future',true,'2900-01-01'),
          ('${noDate}','Synthetic null date','Synthetic null date','store','syn-n7-null-date',true,NULL);`);
        let current = first;
        for (let page = 0; page < 10 && !current.pass_completed; page++) current = runBatch('boundary-rest-' + page);
        assert.equal(current.pass_completed, true); assert.equal(current.pass_id, pass);
        assert.deepEqual(attempted(pass), ids.filter(id => id !== ids[3] && id !== ids[6]));
        assert.equal(current.watermark.site_id, ids[6], 'deleting watermark tenant must not block completion');
        let fresh = runBatch('boundary-next-start'); const nextPass = fresh.pass_id;
        for (let page = 0; page < 10 && !fresh.pass_completed; page++) fresh = runBatch('boundary-next-' + page);
        assert.equal(fresh.pass_completed, true); assert.notEqual(nextPass, pass);
        assert.deepEqual(new Set(attempted(nextPass)), new Set([...ids.filter(id => id !== ids[3] && id !== ids[6]), backdated, future, noDate]));
        record('insertionDeletionBoundary', { previousPass: attempted(pass), nextPass: attempted(nextPass), deletedWatermarkCompleted: true, nullCreatedAtHandled: true });
    });

    await t.test('canonical safe mismatch remains a break and unsafe paise is durable failure, never a plug', () => {
        resetTraversal();
        owned.psql(`INSERT INTO wallet_ledger_entries(site_id,entry_type,direction,status,currency,amount_minor,amount_minor_bigint,idempotency_key,description) VALUES
          ('${ids[0]}','payout_credit','credit','posted','INR',123,123,'syn-n7-safe-break','Synthetic unexplained variance'),
          ('${ids[1]}','payout_credit','credit','posted','INR',2147483647,9007199254740992,'syn-n7-unsafe-break','Synthetic unsafe transport variance');`);
        const result = runBatch('strict-canonical-paise', 500);
        const mismatch = result.results.find(row => row.site_id === ids[0])!, unsafe = result.results.find(row => row.site_id === ids[1])!;
        assert.equal(mismatch.status, 'mismatch'); assert.equal(mismatch.variance_minor, -123);
        assert.equal(unsafe.status, 'failed'); assert.equal(unsafe.variance_minor, null); assert.equal(unsafe.failure_code, '22003');
        assert.equal(result.status, 'failed'); assert.equal(result.pass_completed, true);
        assert.equal(owned.psql('SELECT count(*) FROM ledger_transactions;'), '0');
        assert.equal(owned.psql('SELECT count(*) FROM ledger_entries;'), '0');
        assert.equal(owned.psql("SELECT sum(amount_minor_bigint)::text FROM wallet_ledger_entries WHERE idempotency_key IN('syn-n7-safe-break','syn-n7-unsafe-break');"), '9007199254741115');
        record('strictCanonicalPaise', { safeMismatch: -123, unsafeOutcome: 'failed', unsafeVariance: null, errorCode: '22003', noCanonicalPostingOrPlug: true });
    });

    await t.test('paired rollback/reapply preserves canonical authority and restores actual service-only execution', () => {
        const before = owned.psql("SELECT jsonb_build_object('reconciliations',(SELECT count(*) FROM money_ledger_site_reconciliations),'wallet',(SELECT count(*) FROM wallet_ledger_entries),'ledger',(SELECT count(*) FROM ledger_transactions));");
        clearSyntheticTraversal();
        owned.psql(rollback);
        assert.equal(owned.psql("SELECT to_regclass('public.money_ledger_reconciliation_batches') IS NULL AND to_regclass('public.money_ledger_reconciliation_traversal') IS NULL AND to_regprocedure('public.run_money_ledger_reconciliation_batch_v1(text,integer)') IS NULL;"), 't');
        assert.equal(owned.psql("SELECT jsonb_build_object('reconciliations',(SELECT count(*) FROM money_ledger_site_reconciliations),'wallet',(SELECT count(*) FROM wallet_ledger_entries),'ledger',(SELECT count(*) FROM ledger_transactions));"), before);
        assert.equal(functionHash(), canonicalHash);
        owned.psql(migration);
        assert.equal(runBatch('after-reapply', 500).pass_completed, true);
        assert.throws(() => owned.psql("SET ROLE anon; SELECT public.run_money_ledger_reconciliation_batch_v1('still-denied',2);"), /permission denied/);
        assert.equal(functionHash(), canonicalHash);
        assert.equal(owned.psql('SELECT count(*) FROM ledger_transactions;'), '0');
        record('rollbackReapply', { pairedRoundTrip: true, canonicalRefreshHashUnchanged: canonicalHash, originalMoneyRowsPreserved: true, actualAnonDeniedAfterReapply: true });
    });

    // Guard/AFTER SOURCE PROPOSAL ONLY. No new SQL has been executed.
    await t.test('AFTER: retained state, unknown catalog and active writers refuse retirement; exact replay/resume and known-empty roundtrip conserve money', async () => {
        assert.equal(createHash('sha256').update(rollback).digest('hex'), 'cbe14f9495820f7a3fd1bd420e32a9c9c4cca1dc03082f79c738974cdf57cbed');
        const moneyTables = ['ledger_accounts', 'ledger_transactions', 'ledger_entries', 'wallet_ledger_entries',
            'payout_statements', 'commission_reconciliation_entries', 'cod_reconciliation_entries',
            'settlements', 'reserves', 'payouts', 'payout_items', 'recon_breaks',
            'payments', 'payment_attempts', 'payment_transactions', 'refunds'];
        const rows = (table: string) => `(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text COLLATE "C"),'[]'::jsonb) FROM public.${table} r)`;
        const finance = `jsonb_build_object(${moneyTables.map(table => `${literal(table)},${rows(table)}`).join(',')})`;
        const relations = ['money_ledger_reconciliation_traversal', 'money_ledger_reconciliation_batches',
            'money_ledger_site_reconciliations', 'sites', ...moneyTables];
        const functionNames = ['run_money_ledger_reconciliation_batch_v1', 'refresh_money_ledger_site_reconciliation',
            'ledger_account_balance_minor', 'post_settlement_ledger_transaction', 'post_ledger_transaction', 'ensure_ledger_account'];
        const catalog = `jsonb_build_object(
          'functions',(SELECT jsonb_agg(jsonb_build_object('oid',p.oid,'signature',p.oid::regprocedure::text,
            'owner',pg_get_userbyid(p.proowner),'owner_oid',p.proowner,'acl',p.proacl,'security_definer',p.prosecdef,
            'config',p.proconfig,'definition',pg_get_functiondef(p.oid),'comment',obj_description(p.oid,'pg_proc')) ORDER BY p.oid)
            FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname=ANY(ARRAY[${functionNames.map(literal).join(',')}])),
          'relations',(SELECT jsonb_agg(jsonb_build_object('oid',c.oid,'name',c.relname,'owner',pg_get_userbyid(c.relowner),
            'owner_oid',c.relowner,'kind',c.relkind,'persistence',c.relpersistence,'acl',c.relacl,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
            'columns',(SELECT jsonb_agg(jsonb_build_object('ordinal',a.attnum,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
              'not_null',a.attnotnull,'dropped',a.attisdropped,'identity',a.attidentity,'generated',a.attgenerated,'collation_oid',a.attcollation,
              'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d
              ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0),
            'constraints',(SELECT jsonb_agg(jsonb_build_object('oid',oid,'name',conname,'definition',pg_get_constraintdef(oid)) ORDER BY oid) FROM pg_constraint WHERE conrelid=c.oid),
            'indexes',(SELECT jsonb_agg(jsonb_build_object('oid',indexrelid,'definition',pg_get_indexdef(indexrelid)) ORDER BY indexrelid) FROM pg_index WHERE indrelid=c.oid),
            'triggers',(SELECT jsonb_agg(jsonb_build_object('oid',oid,'name',tgname,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) ORDER BY oid) FROM pg_trigger WHERE tgrelid=c.oid),
            'policies',(SELECT jsonb_agg(jsonb_build_object('oid',oid,'name',polname,'roles',polroles,'command',polcmd,
              'permissive',polpermissive,'using',pg_get_expr(polqual,polrelid),'check',pg_get_expr(polwithcheck,polrelid)) ORDER BY oid) FROM pg_policy WHERE polrelid=c.oid)) ORDER BY c.oid)
            FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relname=ANY(ARRAY[${relations.map(literal).join(',')}])))`;
        const complete = `jsonb_build_object('traversal',${rows('money_ledger_reconciliation_traversal')},
          'batches',${rows('money_ledger_reconciliation_batches')},'projection',${rows('money_ledger_site_reconciliations')},
          'sites',${rows('sites')},'financial',${finance},'catalog',${catalog})`;
        const snapshot = () => owned.psql(`SELECT ${complete};`);
        const digest = (text: string) => createHash('sha256').update(text).digest('hex');
        const request = 'n7-retention-after-' + randomUUID();
        const first = runBatch(request, 2);
        assert.equal(first.pass_completed, false); assert.equal(first.checked, 2);
        const partial = state(), before = snapshot(), beforeData = JSON.parse(before);
        // Keep raw PostgreSQL JSONB text for exact bigint conservation; parsing
        // financial paise through JavaScript numbers would lose precision.
        const financialBefore = owned.psql(`SELECT ${finance};`);
        assert.ok(beforeData.traversal.length > 0 && beforeData.batches.length > 0);
        assert.ok(beforeData.financial.wallet_ledger_entries.length > 0, 'preserve the prior nonzero compatibility evidence');
        assert.equal(beforeData.financial.ledger_transactions.length, 0, 'this fixture proves no new canonical posting, not a nonempty financial history');
        const expectedNext = parseSql<string[]>(owned.psql(`SELECT coalesce(json_agg(id ORDER BY ordered_created_at,id),'[]'::json) FROM (
          SELECT s.id,coalesce(s.created_at,'-infinity'::timestamptz) ordered_created_at FROM public.sites s
          WHERE s.deleted_at IS NULL AND (coalesce(s.created_at,'-infinity'::timestamptz),s.id)>
            (${literal(first.cursor.created_at)}::timestamptz,${literal(first.cursor.site_id)}::uuid)
          AND (coalesce(s.created_at,'-infinity'::timestamptz),s.id)<=
            (${literal(first.watermark.created_at)}::timestamptz,${literal(first.watermark.site_id)}::uuid)
          ORDER BY coalesce(s.created_at,'-infinity'::timestamptz),s.id LIMIT 2) expected;`));
        assert.equal(expectedNext.length, 2);
        if (evidence) writeFileSync(join(evidence, 'retention-catalog-profile-after.json'), JSON.stringify(beforeData.catalog, null, 2) + '\n');
        // Full SQL is tested unchanged for the primary refusal. Transactional
        // adversaries remove only its pinned outer wrapper so every synthetic
        // mutation and unexpected DROP remains inside a mandatory abort.
        // Assert the native defaults explicitly; the known-empty guard must
        // recognize these without learning a profile from its target.
        const nativeFlags = parseSql<{ check_count: number; key_count: number; exact_constraint_flags: boolean;
            toast_count: number; toast_column_count: number; toast_columns_plain: boolean; bytea_type_storage: string }>(owned.psql(`
          WITH owned_tables AS(SELECT ARRAY['public.money_ledger_reconciliation_traversal'::regclass::oid,'public.money_ledger_reconciliation_batches'::regclass::oid] ids),
          toast_relations AS(SELECT c.reltoastrelid oid FROM pg_class c,owned_tables t WHERE c.oid=ANY(t.ids) AND c.reltoastrelid<>0)
          SELECT jsonb_build_object(
           'check_count',(SELECT count(*) FROM pg_constraint c,owned_tables t WHERE c.conrelid=ANY(t.ids) AND c.contype='c'),
           'key_count',(SELECT count(*) FROM pg_constraint c,owned_tables t WHERE c.conrelid=ANY(t.ids) AND c.contype IN('p','u')),
           'exact_constraint_flags',(SELECT bool_and(c.connoinherit IS NOT DISTINCT FROM(c.contype IN('p','u'))) FROM pg_constraint c,owned_tables t WHERE c.conrelid=ANY(t.ids)),
           'toast_count',(SELECT count(*) FROM toast_relations),
           'toast_column_count',(SELECT count(*) FROM pg_attribute a WHERE a.attrelid IN(SELECT oid FROM toast_relations) AND a.attnum>0),
           'toast_columns_plain',(SELECT bool_and(a.attstorage='p') FROM pg_attribute a WHERE a.attrelid IN(SELECT oid FROM toast_relations) AND a.attnum>0),
           'bytea_type_storage',(SELECT typstorage FROM pg_type WHERE oid='bytea'::regtype));`));
        assert.equal(nativeFlags.check_count, 12); assert.equal(nativeFlags.key_count, 3);
        assert.equal(nativeFlags.exact_constraint_flags, true);
        assert.equal(nativeFlags.toast_count, 1); assert.equal(nativeFlags.toast_column_count, 3);
        assert.equal(nativeFlags.toast_columns_plain, true); assert.equal(nativeFlags.bytea_type_storage, 'x');
        const refusal = owned.psqlExpectError(rollback);
        assert.match(refusal, /ROLLBACK349_RETAINED_STATE/);
        assert.ok(snapshot() === before, 'a refused full rollback must preserve all outside rows and catalog identities');
        const begin = rollback.indexOf('\nBEGIN;\n'), end = rollback.lastIndexOf('COMMIT;');
        assert.ok(begin >= 0 && end > begin && rollback.slice(end).trim() === 'COMMIT;');
        const guardBody = rollback.slice(begin + '\nBEGIN;\n'.length, end);
        assert.doesNotMatch(guardBody, /^\s*(?:COMMIT|ROLLBACK)\s*;/im);
        const matrix: string[] = ['full-retained-traversal-and-receipts'];
        const denyMutation = (name: string, mutation: string, expected: RegExp) => {
            const image = snapshot();
            const error = owned.psqlExpectError(`BEGIN; ${mutation}\n${guardBody}
              DO $unexpected349$ BEGIN RAISE EXCEPTION 'N7_349_UNEXPECTED_RETIREMENT_MUST_ABORT'; END $unexpected349$;`);
            assert.ok(snapshot() === image, `${name}: full outside state must survive even an unexpected guard result`);
            assert.match(error, expected, `${name}: must reach the intended guard refusal`);
            matrix.push(name);
        };
        const empty = 'TRUNCATE TABLE public.money_ledger_reconciliation_batches,public.money_ledger_reconciliation_traversal;';
        denyMutation('only-initial-zero-cursor-traversal', empty + ' INSERT INTO public.money_ledger_reconciliation_traversal DEFAULT VALUES;', /ROLLBACK349_RETAINED_STATE/);
        denyMutation('only-soft-deleted-traversal', empty + ' INSERT INTO public.money_ledger_reconciliation_traversal(deleted_at) VALUES(now());', /ROLLBACK349_RETAINED_STATE/);
        denyMutation('only-soft-deleted-receipts', 'DELETE FROM public.money_ledger_reconciliation_traversal; UPDATE public.money_ledger_reconciliation_batches SET deleted_at=now();', /ROLLBACK349_RETAINED_STATE/);
        denyMutation('unknown-overload', empty + " CREATE FUNCTION public.run_money_ledger_reconciliation_batch_v1(text) RETURNS jsonb LANGUAGE sql AS 'SELECT null::jsonb';", /ROLLBACK349_UNKNOWN_FUNCTION_FAMILY/);
        denyMutation('changed-body', empty + ` CREATE OR REPLACE FUNCTION public.run_money_ledger_reconciliation_batch_v1(p_request_key text,p_limit integer DEFAULT 100)
          RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $changed349$ BEGIN RETURN '{}'::jsonb; END $changed349$;`, /ROLLBACK349_UNKNOWN_SOURCE_SCHEMA_OR_ACL_PROFILE/);
        denyMutation('changed-owner', empty + ' ALTER FUNCTION public.run_money_ledger_reconciliation_batch_v1(text,integer) OWNER TO service_role;', /ROLLBACK349_UNKNOWN_FUNCTION_ABI/);
        denyMutation('direct-execute-acl', empty + ' GRANT EXECUTE ON FUNCTION public.run_money_ledger_reconciliation_batch_v1(text,integer) TO anon;', /ROLLBACK349_UNKNOWN_EFFECTIVE_PRIVILEGES/);
        denyMutation('inherited-execute-and-table-privileges', empty + ' GRANT service_role TO authenticated;', /ROLLBACK349_UNKNOWN_EFFECTIVE_PRIVILEGES/);
        denyMutation('column-update-acl', empty + ' GRANT UPDATE(revision) ON public.money_ledger_reconciliation_traversal TO service_role;', /ROLLBACK349_UNKNOWN_SCHEMA_ATTRIBUTES/);
        denyMutation('check-no-inherit-drift', empty + ' ALTER TABLE public.money_ledger_reconciliation_traversal DROP CONSTRAINT money_ledger_reconciliation_traversal_checked_check; ALTER TABLE public.money_ledger_reconciliation_traversal ADD CONSTRAINT money_ledger_reconciliation_traversal_checked_check CHECK(checked>=0) NO INHERIT;', /ROLLBACK349_UNKNOWN_SCHEMA_ATTRIBUTES/);
        denyMutation('base-column-storage-drift', empty + ' ALTER TABLE public.money_ledger_reconciliation_batches ALTER COLUMN result SET STORAGE PLAIN;', /ROLLBACK349_UNKNOWN_SCHEMA_ATTRIBUTES/);
        denyMutation('unknown-column', empty + ' ALTER TABLE public.money_ledger_reconciliation_traversal ADD COLUMN n7_unknown_note text;', /ROLLBACK349_UNKNOWN_SOURCE_SCHEMA_OR_ACL_PROFILE/);
        denyMutation('changed-index-storage', empty + ' ALTER INDEX public.money_ledger_reconciliation_batches_pass_idx SET(fillfactor=80);', /ROLLBACK349_UNKNOWN_SCHEMA_ATTRIBUTES/);
        denyMutation('disabled-trigger', empty + ' ALTER TABLE public.money_ledger_reconciliation_batches DISABLE TRIGGER money_ledger_reconciliation_batches_updated;', /ROLLBACK349_UNKNOWN_SCHEMA_ATTRIBUTES/);
        denyMutation('unknown-external-view', empty + ' CREATE VIEW public.n7_retention_dependency AS SELECT * FROM public.money_ledger_reconciliation_traversal;', /ROLLBACK349_UNKNOWN_DEPENDENCY_OR_ANNOTATION/);
        denyMutation('unknown-type', empty + ' CREATE TYPE public.money_ledger_reconciliation_unreviewed AS ENUM(\'unknown\');', /ROLLBACK349_UNKNOWN_TYPE_FAMILY/);
        // HEAD's 360 DDL guard refuses this privilege escalation before the
        // older rollback can run. Preserve that stronger current boundary and
        // independently exercise 349 at its reviewed historical schema point.
        denyMutation('changed-schema-privilege-at-head', empty + ' GRANT CREATE ON SCHEMA public TO service_role;', /360 refuses untrusted public CREATE/);
        const historical = requireOwnedHistoricalSqlDatabase(357);
        const historicalAcl = historical.psql("SELECT nspacl::text FROM pg_namespace WHERE nspname='public';");
        const historicalRefusal = historical.psqlExpectError(`BEGIN;
          TRUNCATE public.money_ledger_reconciliation_batches,public.money_ledger_reconciliation_traversal;
          GRANT CREATE ON SCHEMA public TO service_role;
          ${guardBody}
          DO $unexpected349$ BEGIN RAISE EXCEPTION 'N7_349_UNEXPECTED_RETIREMENT_MUST_ABORT'; END $unexpected349$;`);
        assert.match(historicalRefusal, /ROLLBACK349_UNKNOWN_SOURCE_SCHEMA_OR_ACL_PROFILE/);
        assert.equal(historical.psql("SELECT nspacl::text FROM pg_namespace WHERE nspname='public';"), historicalAcl);
        assert.equal(historical.psql("SELECT to_regclass('public.money_ledger_reconciliation_traversal') IS NOT NULL AND to_regclass('public.money_ledger_reconciliation_batches') IS NOT NULL;"),'t');
        matrix.push('changed-schema-privilege-at-historical-357');
        denyMutation('non-read-committed-session', 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;', /ROLLBACK349_UNSAFE_SESSION_OR_WRITER/);
        denyMutation('replica-session', 'SET LOCAL session_replication_role=replica;', /ROLLBACK349_UNSAFE_SESSION_OR_WRITER/);

        // The second connection holds only disposable-fixture changes and
        // always rolls back. Readiness comes from pg_stat_activity, not a blind
        // sleep; the native CREATE test also requires the catalog lock gap.
        const withHeldConnection = async (name: string, sql: string, expected: RegExp, nativeGap = false) => {
            const application = 'n7-retention-' + randomUUID();
            const image = snapshot();
            let childError: unknown;
            const held = owned.psqlAsync(`BEGIN; SET LOCAL application_name=${literal(application)}; ${sql}
              SELECT pg_sleep(6); ROLLBACK;`).catch(error => { childError = error; });
            try {
                const deadline = Date.now() + 4000;
                let ready = false;
                while (Date.now() < deadline) {
                    ready = owned.psql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name=${literal(application)} AND wait_event='PgSleep');`) === 't';
                    if (ready) break;
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
                assert.equal(ready, true, `${name}: held connection must reach its known transactional boundary`);
                if (nativeGap) {
                    assert.equal(owned.psql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity a WHERE a.application_name=${literal(application)} AND a.backend_xid IS NOT NULL
                      AND NOT EXISTS(SELECT 1 FROM pg_locks l WHERE l.pid=a.pid AND l.relation='pg_catalog.pg_proc'::regclass AND l.mode='RowExclusiveLock' AND l.granted));`), 't', 'native CREATE must retain its uncommitted write XID after releasing its pg_proc relation write lock');
                }
                const error = owned.psqlExpectError(rollback);
                assert.match(error, expected, name);
            } finally { await held; }
            if (childError) throw childError;
            assert.ok(snapshot() === image, `${name}: no outside operational/financial/catalog change`);
            matrix.push(name);
        };
        await withHeldConnection('active-operational-writer', 'UPDATE public.money_ledger_reconciliation_traversal SET revision=revision;', /could not obtain lock/);
        await withHeldConnection('active-catalog-writer', 'LOCK TABLE pg_catalog.pg_proc IN ROW EXCLUSIVE MODE;', /could not obtain lock/);
        await withHeldConnection('native-uncommitted-ddl-gap', "CREATE FUNCTION public.run_money_ledger_reconciliation_batch_v2() RETURNS integer LANGUAGE sql AS 'SELECT 1';", /ROLLBACK349_UNSAFE_SESSION_OR_WRITER/, true);
        assert.equal(owned.psql("SELECT to_regclass('public.n7_retention_dependency') IS NULL AND to_regprocedure('public.run_money_ledger_reconciliation_batch_v2()') IS NULL;"), 't');
        assert.ok(snapshot() === before, 'every guard challenge must restore the full retained preimage before exact replay/resume');
        const replay = runBatch(request, 2);
        assert.deepEqual(replay, { ...first, replayed: true }); assert.deepEqual(state(), partial);
        assert.ok(snapshot() === before, 'exact request replay must not alter any outside retained row or schema');
        const next = runBatch(request + '-resume', 2);
        assert.equal(next.pass_id, first.pass_id); assert.equal(next.revision, first.revision + 1);
        assert.deepEqual(next.results.map(row => row.site_id), expectedNext);
        assert.equal(state().revision, next.revision);
        const persisted = parseSql<MoneyLedgerReconciliationResult>(owned.psql(`SELECT result FROM public.money_ledger_reconciliation_batches WHERE request_key=${literal(request + '-resume')};`));
        assert.deepEqual(persisted, next);
        const resumedFinancial = owned.psql(`SELECT ${finance};`);
        assert.ok(resumedFinancial === financialBefore, 'resume must preserve every financial row and exact bigint value');
        assert.equal(functionHash(), canonicalHash);

        // Only verified-owned synthetic operational setup is cleared. The
        // committed production guard is exercised against an empty family;
        // no financial row is cleared, rewritten or manufactured.
        const canonicalOutside = () => owned.psql(`SELECT jsonb_build_object('financial',${finance},'sites',${rows('sites')},'projection',${rows('money_ledger_site_reconciliations')});`);
        const outsideBeforeEmpty = canonicalOutside();
        clearSyntheticTraversal();
        assert.equal(owned.psql('SELECT (SELECT count(*) FROM public.money_ledger_reconciliation_batches)+(SELECT count(*) FROM public.money_ledger_reconciliation_traversal);'), '0');
        owned.psql(rollback);
        assert.equal(owned.psql("SELECT to_regclass('public.money_ledger_reconciliation_batches') IS NULL AND to_regclass('public.money_ledger_reconciliation_traversal') IS NULL AND to_regprocedure('public.run_money_ledger_reconciliation_batch_v1(text,integer)') IS NULL AND to_regclass('public.money_ledger_reconciliation_sites_order_idx') IS NULL;"), 't');
        assert.ok(canonicalOutside() === outsideBeforeEmpty, 'empty retirement must conserve all financial, sites and projection rows exactly');
        assert.equal(functionHash(), canonicalHash);
        owned.psql(migration);
        assert.equal(owned.psql('SELECT (SELECT count(*) FROM public.money_ledger_reconciliation_batches)+(SELECT count(*) FROM public.money_ledger_reconciliation_traversal);'), '0');
        assert.ok(canonicalOutside() === outsideBeforeEmpty, 'forward reapply creates only empty operational schema');
        assert.equal(functionHash(), canonicalHash);
        record('retentionGuardAfter', { matrix, nativeFlags, outsideFullStateConserved: true, requestReplayedExactly: true,
            samePassResumedAtNextSites: true, nextRevision: next.revision, persistedNextReceiptMatches: true,
            financialTables: moneyTables, exactBigintFinancialConservation: true, financialStateSha256: digest(financialBefore),
            knownEmptyCommittedRoundtrip: true, canonicalRowsConservedThroughRoundtrip: true,
            canonicalRefreshUnchanged: true, historicalOidProvenanceProved: false,
            preparedTransactionBranch: 'source reviewed only; fixture does not enable a new prepared-transaction profile',
            boundary: 'local disposable database; original ledger remains empty and existing wallet evidence nonempty; synthetic operational reset is separate from retained-state refusal' });
    });
    await t.test('real prepared canonical writer is identified before locks; only its owned GID is rolled back and full outside state survives', async () => {
        assert.equal(process.env.LETBUYY_EXECUTABLE_PREPARED_TRANSACTIONS, '2', 'this expanded fixture requires an explicit per-command prepared2 profile');
        assert.equal(owned.psql('SHOW max_prepared_transactions;'), '2', 'a disabled PREPARE error is not this proof');
        const database = owned.psql('SELECT current_database();');
        const owner = owned.psql('SELECT current_user;');
        assert.equal(database, owned.database); assert.equal(owner, 'postgres');
        assert.equal(owned.psql('SELECT count(*) FROM pg_prepared_xacts;'), '0', 'unknown prepared state must never be cleared');
        assert.equal(owned.psql('SELECT (SELECT count(*) FROM money_ledger_reconciliation_traversal)+(SELECT count(*) FROM money_ledger_reconciliation_batches);'), '0');
        const moneyTables = ['ledger_accounts', 'ledger_transactions', 'ledger_entries', 'wallet_ledger_entries',
            'payout_statements', 'commission_reconciliation_entries', 'cod_reconciliation_entries',
            'settlements', 'reserves', 'payouts', 'payout_items', 'recon_breaks',
            'payments', 'payment_attempts', 'payment_transactions', 'refunds'];
        const rows = (table: string) => `(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text COLLATE "C"),'[]'::jsonb) FROM public.${table} r)`;
        const finance = `jsonb_build_object(${moneyTables.map(table => `${literal(table)},${rows(table)}`).join(',')})`;
        const relations = ['money_ledger_reconciliation_traversal', 'money_ledger_reconciliation_batches',
            'money_ledger_site_reconciliations', 'sites', ...moneyTables];
        const functionNames = ['run_money_ledger_reconciliation_batch_v1', 'refresh_money_ledger_site_reconciliation',
            'ledger_account_balance_minor', 'post_settlement_ledger_transaction', 'post_ledger_transaction', 'ensure_ledger_account'];
        const catalog = `jsonb_build_object(
          'functions',(SELECT jsonb_agg(jsonb_build_object('oid',p.oid,'signature',p.oid::regprocedure::text,
            'owner',pg_get_userbyid(p.proowner),'owner_oid',p.proowner,'acl',p.proacl,'security_definer',p.prosecdef,
            'config',p.proconfig,'definition',pg_get_functiondef(p.oid),'comment',obj_description(p.oid,'pg_proc')) ORDER BY p.oid)
            FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname=ANY(ARRAY[${functionNames.map(literal).join(',')}])),
          'relations',(SELECT jsonb_agg(jsonb_build_object('oid',c.oid,'name',c.relname,'owner',pg_get_userbyid(c.relowner),
            'owner_oid',c.relowner,'kind',c.relkind,'persistence',c.relpersistence,'acl',c.relacl,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
            'columns',(SELECT jsonb_agg(jsonb_build_object('ordinal',a.attnum,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
              'not_null',a.attnotnull,'dropped',a.attisdropped,'identity',a.attidentity,'generated',a.attgenerated,'collation_oid',a.attcollation,
              'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d
              ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0),
            'constraints',(SELECT jsonb_agg(jsonb_build_object('oid',oid,'name',conname,'definition',pg_get_constraintdef(oid)) ORDER BY oid) FROM pg_constraint WHERE conrelid=c.oid),
            'indexes',(SELECT jsonb_agg(jsonb_build_object('oid',indexrelid,'definition',pg_get_indexdef(indexrelid)) ORDER BY indexrelid) FROM pg_index WHERE indrelid=c.oid),
            'triggers',(SELECT jsonb_agg(jsonb_build_object('oid',oid,'name',tgname,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) ORDER BY oid) FROM pg_trigger WHERE tgrelid=c.oid),
            'policies',(SELECT jsonb_agg(jsonb_build_object('oid',oid,'name',polname,'roles',polroles,'command',polcmd,
              'permissive',polpermissive,'using',pg_get_expr(polqual,polrelid),'check',pg_get_expr(polwithcheck,polrelid)) ORDER BY oid) FROM pg_policy WHERE polrelid=c.oid)) ORDER BY c.oid)
            FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relname=ANY(ARRAY[${relations.map(literal).join(',')}])))`;
        const complete = `jsonb_build_object('traversal',${rows('money_ledger_reconciliation_traversal')},
          'batches',${rows('money_ledger_reconciliation_batches')},'projection',${rows('money_ledger_site_reconciliations')},
          'sites',${rows('sites')},'financial',${finance},'catalog',${catalog})`;
        const snapshot = () => owned.psql(`SELECT ${complete};`);
        const digest = (text: string) => createHash('sha256').update(text).digest('hex');
        const outside = snapshot(), financialBefore = owned.psql(`SELECT ${finance};`);
        const runPrefix = 'n7-349-' + owned.runId + '-';
        const gid = runPrefix + randomUUID();
        const application = 'n7-canonical-writer-' + randomUUID();
        let writerError: unknown;
        const writer = owned.psqlAsync(`BEGIN; SET LOCAL application_name=${literal(application)};
          SET LOCAL ROLE service_role; SELECT public.run_money_ledger_reconciliation_batch_v1(${literal(gid + '-live')},2);
          RESET ROLE; SELECT pg_sleep(6); ROLLBACK;`).catch(error => { writerError = error; });
        let canonicalWriterRefused = false;
        try {
            const deadline = Date.now() + 4000;
            let ready = false;
            while (Date.now() < deadline) {
                ready = owned.psql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name=${literal(application)} AND backend_xid IS NOT NULL AND wait_event='PgSleep');`) === 't';
                if (ready) break;
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            assert.equal(ready, true, 'the real canonical service RPC must have written before refusal');
            const failure = owned.psqlScriptExpectError(rollback);
            assert.match(failure, /could not obtain lock/, 'the active canonical writer keeps the existing NOWAIT refusal contract');
            canonicalWriterRefused = true;
        } finally { await writer; }
        if (writerError) throw writerError;
        assert.ok(snapshot() === outside, 'canonical writer abort must conserve the full operational/catalog/financial preimage');
        const preparedRows = () => parseSql<Array<{ gid: string; owner: string; database: string; xid: string }>>(owned.psql(`
          SELECT coalesce(json_agg(jsonb_build_object('gid',gid,'owner',owner,'database',database,'xid',transaction::text)),'[]'::json)
          FROM pg_prepared_xacts WHERE gid=${literal(gid)};`));
        let observed: { gid: string; owner: string; database: string; xid: string } | undefined;
        let intendedPreparedRefusal = false;
        try {
            const result = parseSql<MoneyLedgerReconciliationResult>(owned.psql(`BEGIN; SET LOCAL ROLE service_role;
              SELECT public.run_money_ledger_reconciliation_batch_v1(${literal(gid)},2);
              RESET ROLE; PREPARE TRANSACTION ${literal(gid)};`));
            assert.equal(result.checked, 2); assert.equal(result.request_id, gid);
            const rows = preparedRows(); assert.equal(rows.length, 1);
            observed = rows[0];
            assert.equal(observed.gid, gid); assert.equal(observed.owner, owner); assert.equal(observed.database, database);
            assert.match(observed.xid, /^\d+$/, 'a real prepared transaction must retain its actual XID');
            assert.ok(snapshot() === outside, 'prepared canonical writes remain uncommitted outside');
            const failure = owned.psqlScriptExpectError(rollback);
            assert.match(failure, /ROLLBACK349_PREPARED_TRANSACTIONS/, 'the actual pg_prepared_xacts branch must refuse before catalog/domain locks');
            assert.doesNotMatch(failure, /could not obtain lock|lock timeout|canceling statement/i, 'a safe lock refusal or timeout does not prove the intended prepared branch');
            intendedPreparedRefusal = true;
            assert.equal(preparedRows().length, 1, 'the refused guard must not resolve the prepared transaction');
            assert.ok(snapshot() === outside, 'full refused rollback must preserve all visible outside state without reapply');
        } finally {
            // GID alone is insufficient authority. Resolve only this run's GID
            // after independently matching the actual owner and database.
            const rows = preparedRows();
            if (rows.length) {
                assert.equal(rows.length, 1); assert.equal(rows[0].gid, gid);
                assert.equal(rows[0].owner, owner); assert.equal(rows[0].database, database);
                assert.ok(gid.startsWith(runPrefix));
                owned.psql(`ROLLBACK PREPARED ${literal(gid)};`);
            }
        }
        assert.ok(observed, 'the real prepared row must have been observed');
        assert.equal(canonicalWriterRefused, true); assert.equal(intendedPreparedRefusal, true);
        assert.equal(owned.psql(`SELECT count(*) FROM pg_prepared_xacts WHERE gid LIKE ${literal(runPrefix + '%')};`), '0');
        assert.ok(snapshot() === outside, 'only-own prepared rollback must restore exact full outside state');
        assert.ok(owned.psql(`SELECT ${finance};`) === financialBefore, 'every financial bigint remains exact');
        assert.equal(functionHash(), canonicalHash);
        record('realPreparedCanonicalWriter', { enabled: 2, actualPreparedRowObserved: true,
            gid, owner, database, xid: observed.xid, canonicalWriterRefused, intendedPreparedRefusal,
            safeLockRefusalNotSubstituted: true, onlyOwnGidRolledBack: true, remainingOwnGids: 0,
            outsideFullStateConserved: true, financialTables: moneyTables, exactBigintFinancialConservation: true,
            financialStateSha256: digest(financialBefore), noForwardReapply: true, canonicalRefreshUnchanged: true });
    });
});
