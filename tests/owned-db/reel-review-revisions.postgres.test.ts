// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
// Actual production worker/PostgREST + owned PostgreSQL. Verified private media
// and inspection rows below are explicit SUPERUSER SYNTHETIC FIXTURES, never
// provider/custody/human playback evidence or an application-ready writer.
import { tmpdir as ownedTmpDir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { createServer, type Server } from 'node:http';
import { exportJWK } from 'jose';
import { chromium, expect as playwrightExpect, type Page, type BrowserContext } from '@playwright/test';
import { hashMerchantPassword } from '../../services/api-gateway/src/lib/merchant-password';
import { evaluateStaffPermission } from '../../services/api-gateway/src/lib/staff-permission-decision';
import { createSupabaseServiceClient } from '@letbuyy/infrastructure/supabase-adapter';
import { OutboxExecutionAdapter } from '../../services/api-gateway/src/execution/outbox-execution.adapter';
import { withConsoleBrowser } from '../../services/api-gateway/src/__tests__/owned-db/console-browser-fixture';
import { requireOwnedDatabase, requireOwnedHistoricalSqlDatabase, startOwnedPooledSqlProxy, startOwnedClientRuntime, stopOwnedClientRuntime, type OwnedClientProcess } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
import { consoleFixture } from '../../services/api-gateway/src/__tests__/owned-db/console-session-fixture';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, newBarrier, tapRest, INTERNAL_SECRET } from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import { buildReelReviewPayload, type ReelMerchantCommand } from '../../services/api-gateway/src/schemas/reel.schema';
import { validateDomainEventEnvelope, buildDomainEventEnvelope, getDomainEventContract, queueNamesForEvent } from '@letbuyy/event-core';

const reelTableNames = ['commerce_reels', 'commerce_reel_revisions', 'commerce_reel_events', 'reel_asset_provenance', 'reel_processing_receipts', 'reel_review_inspections'];
const owned = requireOwnedDatabase();
const expect = playwrightExpect.configure({ timeout: 30000 });
const quote = (value: string) => "'" + value.replace(/'/g, "''") + "'";
const json = (value: unknown) => quote(JSON.stringify(value)) + '::jsonb';
const empty = () => ({ media_asset_id: null, listing_id: null, variant_id: null, thumbnail_asset_id: null, caption: 'Private draft', rights_evidence_ids: [] as string[] });
const command = (action: 'save' | 'submit', version: number, selection: ReelMerchantCommand['selection'] = empty(), key: string = randomUUID()): ReelMerchantCommand => ({ action, expected_version: version, idempotency_key: key, selection });

test('canonical private reel revision lifecycle, denial, races, fault recovery and privileges', async t => {
  assert.equal(owned.psql("SELECT to_regprocedure('public.mutate_reel_review_v1(uuid,uuid,uuid,jsonb,jsonb)') IS NOT NULL;"), 't', '345 must be present on the explicitly authorized branch/final test chain');

  const forward359 = readFileSync(new URL('../../database/supabase/migrations/359_private_reel_intake.sql', import.meta.url), 'utf8');
  const retirement359 = readFileSync(new URL('../../database/supabase/rollback/359_private_reel_intake.rollback.sql', import.meta.url), 'utf8');
  // Reverse-order, entirely empty schema retirement; no retained rows are deleted.
  owned.script(retirement359);

  const retirement = readFileSync(new URL('../../database/supabase/rollback/345_canonical_reel_review.rollback.sql', import.meta.url), 'utf8');
  const forward345 = readFileSync(new URL('../../database/supabase/migrations/345_canonical_reel_review.sql', import.meta.url), 'utf8');
  const retirementBody = retirement.replace(/^BEGIN;$/m, '').replace(/^COMMIT;$/m, '');
  globalThis.console.info('OWNED_N5_KNOWN_POLICY_DEPENDENCIES ' + owned.psql(`SELECT jsonb_agg(jsonb_build_object('policy',pg_describe_object(d.classid,d.objid,d.objsubid),'reference',pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid),'dependency_type',d.deptype) ORDER BY d.objid) FROM pg_depend d JOIN pg_policy p ON d.classid='pg_policy'::regclass AND d.objid=p.oid WHERE p.polrelid IN(${reelTableNames.map(name => quote('public.' + name) + '::regclass').join(',')}) AND d.refclassid='pg_class'::regclass;`));
  const state = () => owned.psql(reelRetentionStateSql());
  const conserved = () => JSON.stringify([state(), owned.psql(reelRetirementCatalogSql()), canonical()]);
  const canonical = () => owned.psql(`SELECT jsonb_build_object(
    'sites',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM sites x),
    'media',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM media_assets x),
    'audit',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM audit_logs x),
    'outbox',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM outbox_events x));`);
  const refuse = (setup: string, message: RegExp, label: string) => {
    const before = conserved();
    // Even an unexpectedly accepted guard cannot erase fixture history: the
    // enclosing transaction always aborts. Empty clean retirement is separate.
    const error = owned.psqlExpectError(`BEGIN;${setup}\n${retirementBody}\nROLLBACK;`);
    assert.equal(conserved(), before, label + ': every protected and canonical row/catalog entry survives');
    assert.match(error, message, label + ': failure must come from the intended guard, not invalid setup SQL');
  };
  await t.test('empty exact 345 family retires without canonical changes and frozen forward reapply restores the complete semantic profile', () => {
    const before = state(), parsed = JSON.parse(before), outside = canonical();
    for (const [name, rows] of Object.entries(parsed.rows)) assert.equal((rows as unknown[]).length, 0, name + ': no workflow rows may be removed to reach this case');
    owned.script(retirement);
    assert.equal(owned.psql(`SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN(${reelTableNames.map(quote).join(',')});`), '0');
    assert.equal(owned.psql(`SELECT count(*) FROM pg_proc WHERE proname~'(^|_)reels?(_|$)';`), '0');
    assert.equal(canonical(), outside, 'empty retirement preserves canonical sites, media, audit and outbox');
    assert.match(owned.psqlExpectError(retirement), /does not exist/, 'missing state is refused, never masked by IF EXISTS');
    assert.equal(canonical(), outside);
    owned.script(forward345);
    assert.deepEqual(normalizeReelState(JSON.parse(state())), normalizeReelState(parsed), 'reapply restores all six empty tables, typed bodies, defaults, constraints, indexes, RLS, grants and schema profile');
    assert.equal(canonical(), outside);
    globalThis.console.info('OWNED_N5_EMPTY_RETIREMENT ' + JSON.stringify({ allSixEmpty: true, retired: true, missingStateRefused: true, frozenForwardReapplied: true, completeSemanticProfileConserved: true, canonicalRowsConserved: true }));
  });
  await t.test('all four application roles refuse administrator retirement and conserve every row and catalog entry', () => {
    for (const role of ['anon', 'authenticated', 'app_tenant', 'service_role'])
      refuse(`SET LOCAL ROLE ${role};`, /permission denied|REEL_ROLLBACK_UNSAFE_SESSION_OR_WRITER/, role);
  });
  await t.test('empty family refuses typed ABI, helper body, owner, execution ACL and session drift before retirement', () => {
    const signature = 'public.mutate_reel_review_v1(uuid,uuid,uuid,jsonb,jsonb)';
    const stub = (args: string, result = 'jsonb') => `DROP FUNCTION ${signature};CREATE FUNCTION public.mutate_reel_review_v1(${args}) RETURNS ${result} LANGUAGE sql AS $$SELECT ${result === 'text' ? "''::text" : "'{}'::jsonb"}$$;`;
    const inputs = 'p_actor uuid,p_site uuid,p_reel uuid,p_command jsonb,p_console jsonb DEFAULT NULL';
    const readDefinition = owned.psql("SELECT pg_get_functiondef('public.read_reel_reviews_v1(uuid,uuid,uuid,jsonb,integer)'::regprocedure);");
    const cases: [string, string, RegExp][] = [
      ['input-name', stub(inputs.replace('p_actor uuid', 'p_wrong uuid')), /REEL_ROLLBACK_UNKNOWN_FUNCTION_ABI_BODY_OWNER_OR_PRIVILEGE/],
      ['return-type', stub(inputs, 'text'), /REEL_ROLLBACK_UNKNOWN_FUNCTION_ABI_BODY_OWNER_OR_PRIVILEGE/],
      ['set-returning', `DROP FUNCTION ${signature};CREATE FUNCTION public.mutate_reel_review_v1(${inputs}) RETURNS SETOF jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;`, /REEL_ROLLBACK_UNKNOWN_FUNCTION_ABI_BODY_OWNER_OR_PRIVILEGE/],
      ['procedure-kind', `DROP FUNCTION ${signature};CREATE PROCEDURE public.mutate_reel_review_v1(${inputs}) LANGUAGE sql AS $$SELECT 1$$;`, /REEL_ROLLBACK_UNKNOWN_FUNCTION_ABI_BODY_OWNER_OR_PRIVILEGE/],
      ['removed-defaults', `DROP FUNCTION public.read_reel_reviews_v1(uuid,uuid,uuid,jsonb,integer);${readDefinition.replace(/ DEFAULT NULL::uuid/g, '').replace(/ DEFAULT NULL::jsonb/g, '').replace(/ DEFAULT 1/g, '')};`, /REEL_ROLLBACK_UNKNOWN_FUNCTION_ABI_BODY_OWNER_OR_PRIVILEGE/],
      ['overload', "CREATE FUNCTION public.reel_actor_v1(text) RETURNS uuid LANGUAGE sql AS $$SELECT NULL::uuid$$;", /REEL_ROLLBACK_UNKNOWN_FUNCTION_FAMILY/],
      ['newer-function', "CREATE FUNCTION public.reel_future_v99() RETURNS boolean LANGUAGE sql AS $$SELECT true$$;", /REEL_ROLLBACK_UNKNOWN_FUNCTION_FAMILY/],
      ['trigger-helper-body', 'CREATE OR REPLACE FUNCTION public.protect_reel_record_v1() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW;END$$;', /REEL_ROLLBACK_UNKNOWN_FUNCTION_ABI_BODY_OWNER_OR_PRIVILEGE/],
      ['scalar-helper-body', "CREATE OR REPLACE FUNCTION public.reel_json_compact_v1(p_value json) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $$SELECT p_value::text$$;", /REEL_ROLLBACK_UNKNOWN_FUNCTION_ABI_BODY_OWNER_OR_PRIVILEGE/],
      ['search-path', `ALTER FUNCTION ${signature} SET search_path=public,pg_catalog;`, /REEL_ROLLBACK_UNKNOWN_SCHEMA_FUNCTION_OR_ACL_PROFILE/],
      ['owner', `ALTER FUNCTION ${signature} OWNER TO service_role;`, /REEL_ROLLBACK_UNKNOWN_FUNCTION_ABI_BODY_OWNER_OR_PRIVILEGE/],
      ['execute-grant', `GRANT EXECUTE ON FUNCTION ${signature} TO authenticated;`, /REEL_ROLLBACK_UNKNOWN_FUNCTION_ABI_BODY_OWNER_OR_PRIVILEGE/],
      ['execute-grant-option', `GRANT EXECUTE ON FUNCTION ${signature} TO service_role WITH GRANT OPTION;`, /REEL_ROLLBACK_UNKNOWN_SCHEMA_FUNCTION_OR_ACL_PROFILE/],
      ['repeatable-read', 'SET LOCAL TRANSACTION ISOLATION LEVEL REPEATABLE READ;', /REEL_ROLLBACK_UNSAFE_SESSION_OR_WRITER/],
      ['replication-role', 'SET LOCAL session_replication_role=replica;', /REEL_ROLLBACK_UNSAFE_SESSION_OR_WRITER/],
    ];
    for (const [label, setup, message] of cases) refuse(setup, message, label);
    globalThis.console.info('OWNED_N5_ABI_REFUSALS ' + JSON.stringify({ cases: cases.map(x => x[0]), allConserved: true }));
  });
  await t.test('empty family refuses unknown schema, relation, FK trigger, effective table grants and outside dependencies', () => {
    const profile = /REEL_ROLLBACK_UNKNOWN_SCHEMA_FUNCTION_OR_ACL_PROFILE/;
    const cases: [string, string, RegExp][] = [
      ['column', 'ALTER TABLE public.commerce_reels ADD COLUMN n5_owned_unknown text;', profile],
      ['column-type', 'ALTER TABLE public.commerce_reels ALTER COLUMN status TYPE varchar(100);', profile],
      ['column-default', "ALTER TABLE public.commerce_reels ALTER COLUMN status SET DEFAULT 'approved';", profile],
      ['column-nullability', 'ALTER TABLE public.commerce_reels ALTER COLUMN created_by DROP NOT NULL;', profile],
      ['constraint', 'ALTER TABLE public.commerce_reels DROP CONSTRAINT commerce_reels_version_check;', profile],
      ['immutable-trigger', 'ALTER TABLE public.commerce_reel_events DISABLE TRIGGER immutable_record;', profile],
      ['rls', 'ALTER TABLE public.commerce_reels DISABLE ROW LEVEL SECURITY;', profile],
      ['force-rls', 'ALTER TABLE public.commerce_reels NO FORCE ROW LEVEL SECURITY;', profile],
      ['policy', 'ALTER POLICY tenant_read ON public.commerce_reels USING(true);', profile],
      ['table-owner', 'ALTER TABLE public.commerce_reels OWNER TO service_role;', /REEL_ROLLBACK_UNKNOWN_TYPE_FAMILY/],
      ['raw-table-grant', 'GRANT SELECT ON public.commerce_reels TO app_tenant;', /REEL_ROLLBACK_UNKNOWN_INHERITED_TABLE_PRIVILEGE/],
      ['column-grant', 'GRANT SELECT(id) ON public.commerce_reels TO authenticated;', /REEL_ROLLBACK_UNKNOWN_SCHEMA_ATTRIBUTES/],
      ['namespace-acl-at-head', 'GRANT CREATE ON SCHEMA public TO authenticated;', /360 refuses untrusted public CREATE/],
      ['namespace-owner', 'ALTER SCHEMA public OWNER TO postgres;', profile],
      ['annotation', "COMMENT ON TABLE public.commerce_reels IS 'synthetic retained annotation';", /REEL_ROLLBACK_UNKNOWN_SCHEMA_ATTRIBUTES/],
      ['index', 'CREATE INDEX n5_owned_unknown_index ON public.commerce_reels(status);', profile],
      ['column-storage', 'ALTER TABLE public.commerce_reels ALTER COLUMN status SET STORAGE PLAIN;', /REEL_ROLLBACK_UNKNOWN_SCHEMA_ATTRIBUTES/],
      ['outside-view', 'CREATE VIEW public.n5_owned_private_probe AS SELECT id FROM public.commerce_reels;', /REEL_ROLLBACK_UNKNOWN_EXTERNAL_DEPENDENCY/],
      ['unknown-relation', 'CREATE TABLE public.reel_future_evidence(id uuid);', /REEL_ROLLBACK_UNKNOWN_RELATION_OR_SCHEMA_FAMILY/],
      ['unknown-type', 'CREATE TYPE public.reel_future_state AS ENUM(\'unknown\');', /REEL_ROLLBACK_UNKNOWN_TYPE_FAMILY/],
      ['parent-fk-trigger', `DO $$DECLARE target record;BEGIN SELECT t.tgname,c.relname INTO STRICT target FROM pg_trigger t JOIN pg_constraint fk ON fk.oid=t.tgconstraint JOIN pg_class c ON c.oid=t.tgrelid WHERE fk.conrelid='public.commerce_reels'::regclass AND fk.confrelid='public.sites'::regclass AND t.tgrelid=fk.confrelid ORDER BY t.tgname LIMIT 1;EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER %I',target.relname,target.tgname);END$$;`, /REEL_ROLLBACK_UNKNOWN_FOREIGN_KEY_TRIGGER_PROFILE/],
    ];
    for (const [label, setup, message] of cases) refuse(setup, message, label);
    // Current 360 rejects CREATE escalation before 345 can inspect it. Also
    // retain the older rollback's own ACL denial at a reviewed SQL-only point.
    const historical = requireOwnedHistoricalSqlDatabase(357);
    const historicalBefore = historical.psql(reelRetirementCatalogSql());
    assert.match(historical.psqlExpectError(`BEGIN; GRANT CREATE ON SCHEMA public TO authenticated;
      ${retirementBody}\nROLLBACK;`), profile);
    assert.equal(historical.psql(reelRetirementCatalogSql()), historicalBefore);
    globalThis.console.info('OWNED_N5_SCHEMA_REFUSALS ' + JSON.stringify({ cases: cases.map(x => x[0]), allConserved: true }));
  });
  await t.test('a named sql_drop fault aborts an otherwise eligible empty retirement atomically', () => {
    owned.psql(`CREATE FUNCTION public.n5_owned_drop_fault() RETURNS event_trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'N5_SYNTHETIC_RETIREMENT_DROP_FAULT';END$$;
      CREATE EVENT TRIGGER n5_owned_drop_fault ON sql_drop EXECUTE FUNCTION public.n5_owned_drop_fault();`);
    try { refuse('', /N5_SYNTHETIC_RETIREMENT_DROP_FAULT/, 'mandatory retirement effect fault'); }
    finally { owned.psql('DROP EVENT TRIGGER n5_owned_drop_fault;DROP FUNCTION public.n5_owned_drop_fault();'); }
  });
  await t.test('concurrent catalog DDL and other transaction writers are observed at a real lock barrier and refused without effects', async () => {
    for (const [label, setup, lock] of [
      ['catalog-ddl', "CREATE FUNCTION public.reel_future_v99() RETURNS boolean LANGUAGE sql AS $$SELECT true$$;", "l.locktype='transactionid' AND l.mode='ExclusiveLock'"],
      ['other-writer', 'SELECT txid_current();', "l.locktype='transactionid' AND l.mode='ExclusiveLock'"],
    ]) await reelRetirementRace(label, setup, lock, retirementBody, conserved);
  });

  const console = await consoleFixture(owned); let reviewer: { id: string; email: string; headers: Record<string, string>; token: string } = await console.actor('lead');
  const otherReviewer = await console.actor('lead'), viewer = await console.actor('viewer');
  const tenant = newSyntheticTenant('reel-review'), otherTenant = newSyntheticTenant('reel-other');
  seedSyntheticTenant(owned.psql, tenant); seedSyntheticTenant(owned.psql, otherTenant);
  const actor = randomUUID(), email = `syn-reel-${actor}@example.invalid`, otherActor = randomUUID(), otherEmail = `syn-reel-${otherActor}@example.invalid`;
  owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${actor}','${email}',true),('${otherActor}','${otherEmail}',true);
    UPDATE sites SET custom_user_id='${actor}' WHERE id='${tenant.siteId}'; UPDATE sites SET custom_user_id='${otherActor}' WHERE id='${otherTenant.siteId}';`);
  const gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys()));
  const headers = async (actorId: string = actor, actorEmail: string = email, siteId: string = tenant.siteId, key?: string) => ({ ...await signedIdentityHeaders(actorId, actorEmail, siteId), 'Content-Type': 'application/json', ...(key ? { 'X-Idempotency-Key': key } : {}) });
  const mutate = async (id: string, body: ReelMerchantCommand, a: string = actor, mail: string = email, site: string = tenant.siteId) => gateway.request(`/v1/reels/${id}?store_id=${site}`, { method: 'POST', headers: await headers(a, mail, site, body.idempotency_key), body: JSON.stringify(body) });
  const read = async (id?: string) => gateway.request(`/v1/reels${id ? '/' + id : ''}?store_id=${tenant.siteId}`, { headers: await headers() });
  const reel = randomUUID(), first = command('save', 0);
  await t.test('concurrent uncommitted private row writer is observed at the exact table barrier and rollback refuses without effects', async () => {
    const id = randomUUID();
    await reelRetirementRace('private-row-writer', `INSERT INTO public.commerce_reels(id,site_id,created_by,updated_by) VALUES('${id}','${tenant.siteId}','${actor}','${actor}');`,
      "l.relation='public.commerce_reels'::regclass AND l.mode='RowExclusiveLock'", retirementBody, conserved);
    assert.equal(owned.psql(`SELECT count(*) FROM public.commerce_reels WHERE id='${id}';`), '0', 'the competing synthetic writer rolled back its own uncommitted record');
  });
  await t.test('prepared transactions are refused by the guard when enabled, or their creation is disabled by the actual owned server', () => {
    const maximum = Number(owned.psql('SHOW max_prepared_transactions;'));
    const gid = 'n5_owned_retirement_' + randomUUID(), id = randomUUID(), before = conserved();
    const setup = `BEGIN;INSERT INTO public.commerce_reels(id,site_id,created_by,updated_by) VALUES('${id}','${tenant.siteId}','${actor}','${actor}');PREPARE TRANSACTION ${quote(gid)};`;
    if (maximum === 0) {
      assert.match(owned.psqlExpectError(setup), /prepared transactions are disabled/);
      assert.equal(owned.psql('SELECT count(*) FROM pg_prepared_xacts;'), '0');
      assert.equal(conserved(), before);
      globalThis.console.info('OWNED_N5_PREPARED_WRITER ' + JSON.stringify({ maxPreparedTransactions: maximum, actualPrepareRefusedByServer: true, guardPreparedBranchExecuted: false }));
    } else {
      owned.psql(setup);
      try {
        assert.equal(owned.psql(`SELECT count(*) FROM pg_prepared_xacts WHERE gid=${quote(gid)};`), '1');
        const error = owned.psqlExpectError(`BEGIN;${retirementBody}\nROLLBACK;`);
        assert.match(error, /could not obtain lock|REEL_ROLLBACK_UNSAFE_SESSION_OR_WRITER/);
      } finally { owned.psql(`ROLLBACK PREPARED ${quote(gid)};`); }
      assert.equal(conserved(), before);
      globalThis.console.info('OWNED_N5_PREPARED_WRITER ' + JSON.stringify({ maxPreparedTransactions: maximum, actualPreparedWriterRefused: true, allConserved: true }));
    }
  });


  await t.test('normal signed merchant saves and reads persisted private draft; missing custody does not publish', async () => {
    const saved = await mutate(reel, first); assert.equal(saved.status, 200, saved.text);
    assert.equal(saved.json?.data.reel.version, 1); assert.equal(saved.json?.data.revision.payload, null);
    const result = await read(reel); assert.equal(result.status, 200, result.text);
    const hidden = await console.gateway.request(`/v1/internal/console/reels/${reel}`, { headers: reviewer.headers }); assert.equal(hidden.status, 404, hidden.text);
    const noBridge = await console.gateway.request('/v1/internal/console/reels', { headers: { ...reviewer.headers, Authorization: 'Bearer synthetic-invalid-bridge' } }); assert.equal(noBridge.status, 401, noBridge.text);
    const noHuman = await console.gateway.request('/v1/internal/console/reels', { headers: { Authorization: reviewer.headers.Authorization } }); assert.equal(noHuman.status, 401, noHuman.text);
    assert.equal(result.json?.data.revision.selection.caption, 'Private draft');
    assert.equal(result.json?.data.events.length, 1); assert.equal(result.json?.data.inspection_available, false);
    assert.equal((await read()).json?.data.items.length, 1);
    assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE resource_id='${reel}' AND action='reel.save';`), '1');
    assert.equal(owned.psql(`SELECT count(*) FROM outbox_events WHERE aggregate_id='${reel}' AND event_type='reel.review.changed';`), '1');
  });
  await t.test('lost-response retry returns same revision once; conflicting and stale commands deny', async () => {
    const replay = await mutate(reel, first); assert.equal(replay.status, 200, replay.text); assert.equal(replay.json?.data.replayed, true);
    const conflict = await mutate(reel, { ...first, selection: { ...first.selection, caption: 'different' } }); assert.equal(conflict.status, 409, conflict.text);
    const stale = await mutate(reel, command('save', 0)); assert.equal(stale.status, 409, stale.text);
    assert.equal(owned.psql(`SELECT count(*) FROM commerce_reel_revisions WHERE reel_id='${reel}';`), '1');
    const longId = randomUUID(), longCommand = command('save', 0, empty(), 'k'.repeat(200));
    const longest = await mutate(longId, longCommand); assert.equal(longest.status, 200, longest.text);
    assert.equal(owned.psql(`SELECT length(idempotency_key) FROM outbox_events WHERE aggregate_id='${longId}';`), '69', 'scope plus exact request key is compacted below the event envelope budget');
  });
  await t.test('committed result lost on the real REST hop recovers its original receipt', async () => {
    const id = randomUUID(), body = command('save', 0); let lost = false;
    const tap = tapRest(owned.restUrl, async (call, forward) => {
      const result = await forward();
      if (call.resource === 'rpc/mutate_reel_review_v1' && !lost) { lost = true; return new Response(JSON.stringify({ message: 'synthetic response lost after commit' }), { status: 503, headers: { 'Content-Type': 'application/json' } }); }
      return result;
    });
    try { assert.equal((await mutate(id, body)).status, 503); } finally { tap.restore(); }
    assert.equal(owned.psql(`SELECT count(*) FROM commerce_reel_events WHERE reel_id='${id}';`), '1');
    const recovered = await mutate(id, body); assert.equal(recovered.status, 200, recovered.text); assert.equal(recovered.json?.data.replayed, true);
    assert.equal(owned.psql(`SELECT count(*) FROM commerce_reel_revisions WHERE reel_id='${id}';`), '1');
  });
  await t.test('failed canonical read is unavailable, never an authoritative empty list', async () => {
    const tap = tapRest(owned.restUrl, async (call, forward) => call.resource === 'rpc/read_reel_reviews_v1'
      ? new Response(JSON.stringify({ message: 'synthetic canonical read fault' }), { status: 503, headers: { 'Content-Type': 'application/json' } }) : forward());
    try { const result = await read(); assert.equal(result.status, 503, result.text); assert.equal(result.json?.data, undefined); } finally { tap.restore(); }
  });
  await t.test('wrong owner/site/realm, caller-resolved context and body budgets fail', async () => {
    const wrong = await mutate(reel, command('save', 1), otherActor, otherEmail, tenant.siteId); assert.equal(wrong.status, 403, wrong.text);
    const noAuth = await gateway.request(`/v1/reels/${reel}?store_id=${tenant.siteId}`); assert.equal(noAuth.status, 401);
    const injected = await gateway.request(`/v1/reels/${reel}?store_id=${tenant.siteId}`, { method: 'POST', headers: await headers(actor, email, tenant.siteId, randomUUID()), body: JSON.stringify({ ...first, serverResolved: { approved: true } }) }); assert.equal(injected.status, 400, injected.text);
    const big = await gateway.request(`/v1/reels/${reel}?store_id=${tenant.siteId}`, { method: 'POST', headers: await headers(actor, email, tenant.siteId, randomUUID()), body: JSON.stringify({ extra: 'x'.repeat(40000) }) }); assert.equal(big.status, 413, big.text);
  });
  await t.test('actual app_tenant RLS positive/wrong/unset controls with temporary owned read grant; production ACLs deny all raw access', () => {
    // Production has no raw grants: service_role inherits app_tenant and bypasses
    // RLS. This explicit fixture-only grant isolates the actual RLS policy test;
    // it is always revoked before the production ACL denial controls below.
    owned.psql('GRANT SELECT ON commerce_reels TO app_tenant;');
    try {
    assert.equal(owned.psql(`BEGIN;SET LOCAL ROLE app_tenant;SELECT set_config('app.site_id','${tenant.siteId}',true);SELECT count(*) FROM commerce_reels WHERE id='${reel}';COMMIT;`).split('\n').filter(line => /^[0-9]+$/.test(line)).at(-1), '1');
    assert.equal(owned.psql(`BEGIN;SET LOCAL ROLE app_tenant;SELECT set_config('app.site_id','${otherTenant.siteId}',true);SELECT count(*) FROM commerce_reels WHERE id='${reel}';COMMIT;`).split('\n').filter(line => /^[0-9]+$/.test(line)).at(-1), '0');
    assert.equal(owned.psql(`BEGIN;SET LOCAL ROLE app_tenant;SELECT count(*) FROM commerce_reels WHERE id='${reel}';COMMIT;`).split('\n').filter(line => /^[0-9]+$/.test(line)).at(-1), '0');
    } finally { owned.psql('REVOKE SELECT ON commerce_reels FROM app_tenant;'); }
    for (const role of ['anon', 'authenticated', 'app_tenant']) assert.match(owned.psqlExpectError(`BEGIN;SET LOCAL ROLE ${role};SELECT public.mutate_reel_review_v1(NULL,NULL,NULL,NULL,NULL);COMMIT;`), /permission denied/);
    assert.match(owned.psqlExpectError(`BEGIN;SET LOCAL ROLE service_role;INSERT INTO reel_processing_receipts DEFAULT VALUES;COMMIT;`), /permission denied/);
    for (const role of ['anon', 'authenticated', 'app_tenant', 'service_role']) {
      for (const table of ['commerce_reels', 'commerce_reel_revisions', 'commerce_reel_events', 'reel_asset_provenance', 'reel_processing_receipts', 'reel_review_inspections'])
        assert.match(owned.psqlExpectError(`BEGIN;SET LOCAL ROLE ${role};SELECT count(*) FROM ${table};COMMIT;`), /permission denied/, role + '/' + table);
    }
    assert.match(owned.psqlExpectError(`BEGIN;SET LOCAL ROLE app_tenant;INSERT INTO reel_review_inspections DEFAULT VALUES;COMMIT;`), /permission denied/);

    assert.match(owned.psqlExpectError(`UPDATE commerce_reel_revisions SET selection='{}' WHERE reel_id='${reel}';`), /REEL_IMMUTABLE_RECORD/);
  });
  await t.test('same-key concurrency has one effect; different-key CAS race has one winner', async () => {
    for (const sameKey of [true, false]) {
      const id = randomUUID(), body = command('save', 0), barrier = newBarrier(2);
      const tap = tapRest(owned.restUrl, async (call, forward) => { if (call.resource === 'rpc/mutate_reel_review_v1') await barrier.arrive(); return forward(); });
      try {
        const results = await Promise.all([mutate(id, body), mutate(id, sameKey ? body : { ...body, idempotency_key: randomUUID() })]);
        assert.deepEqual(results.map(r => r.status).sort(), sameKey ? [200, 200] : [200, 409]); assert.equal(barrier.arrived, 2);
      } finally { tap.restore(); }
      assert.equal(owned.psql(`SELECT count(*) FROM commerce_reel_revisions WHERE reel_id='${id}';`), '1');
      assert.equal(owned.psql(`SELECT count(*) FROM commerce_reel_events WHERE reel_id='${id}';`), '1');
      assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE resource_id='${id}' AND action='reel.save';`), '1');
      assert.equal(owned.psql(`SELECT count(*) FROM outbox_events WHERE aggregate_id='${id}' AND event_type='reel.review.changed';`), '1');
    }
  });
  await t.test('mandatory audit/outbox faults roll back root/revision/receipt and recover with the same key', async () => {
    for (const table of ['audit_logs', 'outbox_events']) {
      const id = randomUUID(), body = command('save', 0), trigger = `n5_owned_${table}_fault`;
      owned.psql(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'synthetic n5 mandatory write fault';END$$;
       CREATE TRIGGER ${trigger} BEFORE INSERT ON ${table} FOR EACH ROW WHEN(NEW.${table === 'audit_logs' ? 'action' : 'event_type'} LIKE 'reel.%') EXECUTE FUNCTION ${trigger}();`);
      try { assert.equal((await mutate(id, body)).status, 503); assert.equal(owned.psql(`SELECT count(*) FROM commerce_reels WHERE id='${id}';`), '0'); }
      finally { owned.psql(`DROP TRIGGER ${trigger} ON ${table};DROP FUNCTION ${trigger}();`); }
      assert.equal((await mutate(id, body)).status, 200);
    }
  });

  const product = randomUUID(), variant = randomUUID(), listing = randomUUID(), category = randomUUID();
  const media = randomUUID(), thumbnail = randomUUID(), rights = randomUUID(), videoProof = randomUUID(), posterProof = randomUUID(), rightsProof = randomUUID(), ready = randomUUID();
  owned.psql(`INSERT INTO marketplace_categories(id,slug,name) VALUES('${category}','syn-reels-${category.slice(0, 8)}','Synthetic reels');
    INSERT INTO products(id,site_id,store_id,name,slug,price,is_active,status) VALUES('${product}','${tenant.siteId}','${tenant.siteId}','Synthetic reviewed product','syn-reel-product',100,true,'active');
    INSERT INTO product_variants(id,product_id,title,price,inventory_qty,position) VALUES('${variant}','${product}','Blue',100,5,0);
    INSERT INTO channel_listings(id,site_id,product_id,channel,marketplace_category_id) VALUES('${listing}','${tenant.siteId}','${product}','marketplace','${category}');
    BEGIN;SELECT set_config('app.site_id','${tenant.siteId}',true);SELECT * FROM transition_channel_listing('${tenant.siteId}','${listing}','pending_review','merchant','${actor}',NULL,'syn-submit-product');COMMIT;
    SELECT * FROM claim_marketplace_listing_review('${tenant.siteId}','${listing}','${reviewer.id}','Synthetic product review claim','syn-claim-product',(SELECT version FROM channel_listings WHERE id='${listing}'));
    SELECT * FROM transition_channel_listing('${tenant.siteId}','${listing}','approved','operator','${reviewer.id}','Synthetic product reviewed','syn-approve-product');
    INSERT INTO media_assets(id,store_id,site_id,asset_type,storage_path,object_key,filename,checksum_sha256,public_url) VALUES
     ('${media}','${tenant.siteId}','${tenant.siteId}','video','synthetic-private/${media}','synthetic-private/${media}','Synthetic video','${'a'.repeat(64)}',NULL),
     ('${thumbnail}','${tenant.siteId}','${tenant.siteId}','image','synthetic-private/${thumbnail}','synthetic-private/${thumbnail}','Synthetic poster','${'b'.repeat(64)}',NULL),
     ('${rights}','${tenant.siteId}','${tenant.siteId}','file','synthetic-private/${rights}','synthetic-private/${rights}','Synthetic rights','${'d'.repeat(64)}',NULL);`);
  const selected = { media_asset_id: media, listing_id: listing, variant_id: variant, thumbnail_asset_id: thumbnail, caption: 'தமிழ் “quoted”\nproduct', rights_evidence_ids: [rightsProof] };
  await t.test('generic media metadata cannot supply private custody/ready receipts', async () => {
    const result = await mutate(randomUUID(), command('submit', 0, { ...selected, rights_evidence_ids: [] })); assert.equal(result.status, 503, result.text);
    assert.equal(owned.psql('SELECT count(*) FROM reel_processing_receipts;'), '0');
  });
  // Deliberately privileged owned fixtures. No app API or role has these grants.
  owned.psql(`INSERT INTO reel_asset_provenance(id,site_id,media_asset_id,asset_version,checksum_sha256,kind,provider_asset_id,custody_verified_at) VALUES
   ('${videoProof}','${tenant.siteId}','${media}','media:v1','${'a'.repeat(64)}','video','synthetic-owned-video',now()),
   ('${posterProof}','${tenant.siteId}','${thumbnail}','poster:v1','${'b'.repeat(64)}','image',NULL,now()),
   ('${rightsProof}','${tenant.siteId}','${rights}','rights:v1','${'d'.repeat(64)}','rights',NULL,now());
   INSERT INTO reel_processing_receipts(id,site_id,provenance_id,provider_asset_id,provider_event_id,checksum_sha256,media_version,state,verified_at)
   VALUES('${ready}','${tenant.siteId}','${videoProof}','synthetic-owned-video','synthetic-owned-event','${'a'.repeat(64)}','media:v1','ready',now());`);
  const reviewed = randomUUID(); let reviewVersion = 1;
  await t.test('complete relational variants and actual private byte evidence cannot be bypassed', async () => {
    for (const wrongVariant of [null, randomUUID()]) {
      const result = await mutate(randomUUID(), command('submit', 0, { ...selected, variant_id: wrongVariant })); assert.equal(result.status, 409, result.text);
    }
    owned.psql(`UPDATE media_assets SET public_url='https://example.invalid/synthetic-public.mp4' WHERE id='${media}';`);
    try { const result = await mutate(randomUUID(), command('submit', 0, selected)); assert.equal(result.status, 503, result.text); }
    finally { owned.psql(`UPDATE media_assets SET public_url=NULL WHERE id='${media}';`); }
    owned.psql(`UPDATE media_assets SET checksum_sha256='${'f'.repeat(64)}' WHERE id='${media}';`);
    try { const result = await mutate(randomUUID(), command('submit', 0, selected)); assert.equal(result.status, 503, result.text); }
    finally { owned.psql(`UPDATE media_assets SET checksum_sha256='${'a'.repeat(64)}' WHERE id='${media}';`); }
  });
  await t.test('SQL constructs the exact immutable CMS payload bytes and fingerprint from canonical rows', async () => {
    const result = await mutate(reviewed, command('submit', 0, selected)); assert.equal(result.status, 200, result.text);
    const revision = result.json?.data.revision;
    const fingerprint = owned.psql(`SELECT marketplace_listing_review_fingerprint('${listing}');`);
    const expected = buildReelReviewPayload(selected, {
      site: { id: tenant.siteId, status: 'published', deleted: false },
      media: { id: media, site_id: tenant.siteId, asset_type: 'video', version: 'media:v1', checksum_sha256: 'a'.repeat(64), access: 'private', deleted: false, provider_asset_id: 'synthetic-owned-video' },
      processing_evidence: { id: ready, site_id: tenant.siteId, media_asset_id: media, media_version: 'media:v1', checksum_sha256: 'a'.repeat(64), provider_asset_id: 'synthetic-owned-video', state: 'ready' },
      thumbnail: { id: thumbnail, site_id: tenant.siteId, asset_type: 'image', version: 'poster:v1', checksum_sha256: 'b'.repeat(64), access: 'private', deleted: false },
      product: { id: product, site_id: tenant.siteId, is_active: true, deleted: false },
      listing: { id: listing, site_id: tenant.siteId, product_id: product, channel: 'marketplace', status: 'approved', visibility: 'public', approved_product_fingerprint: fingerprint, current_product_fingerprint: fingerprint },
      variants: [{ id: variant, product_id: product }], rights_evidence: [{ id: rightsProof, site_id: tenant.siteId, version: 'rights:v1', checksum_sha256: 'd'.repeat(64), deleted: false }],
    });
    assert.equal(revision.canonical_payload, JSON.stringify(expected)); assert.deepEqual(revision.payload, expected);
  });
  const op = async (which: typeof reviewer, action: string, version: number, reason?: string, key: string = randomUUID()) => console.gateway.request(`/v1/internal/console/reels/${reviewed}?store_id=${tenant.siteId}`, { method: 'POST', headers: { ...which.headers, 'X-Idempotency-Key': key }, body: JSON.stringify({ action, expected_version: version, idempotency_key: key, ...(reason ? { reason } : {}) }) });
  await t.test('limited viewer and unassigned reviewer cannot decide; claim/CAS use live current reviewer', async () => {
    assert.equal((await op(viewer, 'claim', reviewVersion)).status, 403);
    assert.equal((await op(otherReviewer, 'reject', reviewVersion, 'Wrong product matching.')).status, 403);
    const result = await op(reviewer, 'claim', reviewVersion); assert.equal(result.status, 200, result.text); reviewVersion++;
    assert.equal((await op(otherReviewer, 'claim', reviewVersion)).status, 403);
    const inspected = await op(reviewer, 'approve', reviewVersion); assert.equal(inspected.status, 503, inspected.text);
    assert.equal(owned.psql(`SELECT status FROM commerce_reels WHERE id='${reviewed}';`), 'pending_review');
  });
  await t.test('self-review and a reassignment between Gateway scope check and atomic decision deny', async () => {
    owned.psql(`UPDATE sites SET custom_user_id='${reviewer.id}' WHERE id='${tenant.siteId}';`);
    try { assert.equal((await op(reviewer, 'reject', reviewVersion, 'Synthetic self-review denied.')).status, 403); }
    finally { owned.psql(`UPDATE sites SET custom_user_id='${actor}' WHERE id='${tenant.siteId}';`); }
    let reassigned = false;
    const tap = tapRest(owned.restUrl, async (call, forward) => {
      if (call.resource === 'rpc/mutate_reel_review_v1' && !reassigned) {
        reassigned = true; owned.psql(`UPDATE commerce_reels SET assigned_reviewer_id='${otherReviewer.id}',version=version+1 WHERE id='${reviewed}';`);
      }
      return forward();
    });
    try { assert.equal((await op(reviewer, 'reject', reviewVersion, 'Old assigned reviewer must fail.')).status, 409); }
    finally { tap.restore(); }
    reviewVersion++;
    assert.equal((await op(reviewer, 'reject', reviewVersion, 'Old assigned reviewer must fail.')).status, 403);
    owned.psql(`UPDATE commerce_reels SET assigned_reviewer_id='${reviewer.id}',version=version+1 WHERE id='${reviewed}';`); reviewVersion++;
  });
  await t.test('rejection/correction preserves immutable old revision and attributable event history', async () => {
    const reject = await op(reviewer, 'reject', reviewVersion, 'Correct the matched product and disclosure.'); assert.equal(reject.status, 200, reject.text); reviewVersion++;
    const before = owned.psql(`SELECT count(*) FROM commerce_reel_revisions WHERE reel_id='${reviewed}';`);
    const correction = await mutate(reviewed, command('submit', reviewVersion, { ...selected, caption: 'Corrected reviewed caption' })); assert.equal(correction.status, 200, correction.text); reviewVersion++;
    assert.equal(Number(owned.psql(`SELECT count(*) FROM commerce_reel_revisions WHERE reel_id='${reviewed}';`)), Number(before) + 1);
    assert.equal(owned.psql(`SELECT count(*) FROM commerce_reel_events WHERE reel_id='${reviewed}' AND action='reject' AND actor_id='${reviewer.id}';`), '1');
  });
  await t.test('current revision author cannot review a correction even when the original creator differs', async () => {
    owned.psql(`INSERT INTO employees(user_id,email,role,store_id,status,is_active,permissions) VALUES('${reviewer.id}','syn-editor-${reviewer.id}@example.invalid','editor','${tenant.siteId}','active',true,'{"granted":["content:write"]}');`);
    const replacement = await mutate(reviewed, command('submit', reviewVersion, selected), reviewer.id, reviewer.email);
    assert.equal(replacement.status, 200, replacement.text); reviewVersion++;
    reviewer = await console.signIn(reviewer);
    const self = await op(reviewer, 'claim', reviewVersion); assert.equal(self.status, 403, self.text);
    const corrected = await mutate(reviewed, command('submit', reviewVersion, selected)); assert.equal(corrected.status, 200, corrected.text); reviewVersion++;
    const claimed = await op(reviewer, 'claim', reviewVersion); assert.equal(claimed.status, 200, claimed.text); reviewVersion++;
  });
  await t.test('live permission downgrade after the Gateway snapshot prevents the final decision', async () => {
    let changed = false;
    const before = owned.psql(`SELECT count(*) FROM commerce_reel_events WHERE reel_id='${reviewed}';`);
    const tap = tapRest(owned.restUrl, async (call, forward) => {
      if (call.resource === 'rpc/mutate_reel_review_v1' && !changed) { changed = true; owned.psql(`UPDATE employees SET role='viewer' WHERE user_id='${reviewer.id}' AND store_id IS NULL;`); }
      return forward();
    });
    try { const denied = await op(reviewer, 'reject', reviewVersion, 'A stale permission snapshot cannot decide.'); assert.equal(denied.status, 403, denied.text); }
    finally { tap.restore(); owned.psql(`UPDATE employees SET role='manager' WHERE user_id='${reviewer.id}' AND store_id IS NULL;`); }
    // Canonical membership-change machinery revokes old sessions. Restoring a
    // role never resurrects one; the next positive control signs in again.
    reviewer = await console.signIn(reviewer);
    assert.equal(owned.psql(`SELECT count(*) FROM commerce_reel_events WHERE reel_id='${reviewed}';`), before);
  });
  await t.test('privileged synthetic inspection proves assigned approval, replacement revocation and takedown transactions only', async () => {
    const inspect = () => owned.psql(`INSERT INTO reel_review_inspections(site_id,revision_id,reviewer_id,processing_receipt_id,rights_policy_version,inspected_at,expires_at)
      SELECT '${tenant.siteId}',current_revision_id,'${reviewer.id}','${ready}','SYNTHETIC-OWNED-POLICY-NOT-ADOPTED',now(),now()+interval '1 minute' FROM commerce_reels WHERE id='${reviewed}';`);
    inspect();
    const approveKey = randomUUID(), approved = await op(reviewer, 'approve', reviewVersion, undefined, approveKey);
    assert.equal(approved.status, 200, approved.text); reviewVersion++;
    assert.equal(approved.json?.data.reel.status, 'approved');
    const replayed = await op(reviewer, 'approve', reviewVersion - 1, undefined, approveKey); assert.equal(replayed.status, 200, replayed.text); assert.equal(replayed.json?.data.replayed, true);
    const replacement = await mutate(reviewed, command('submit', reviewVersion, { ...selected, caption: 'Replacement cannot inherit approval' }));
    assert.equal(replacement.status, 200, replacement.text); reviewVersion++;
    assert.equal(replacement.json?.data.reel.status, 'pending_review'); assert.equal(replacement.json?.data.reel.assigned_reviewer_id, null);
    const claim = await op(reviewer, 'claim', reviewVersion); assert.equal(claim.status, 200, claim.text); reviewVersion++;
    const noInspection = await op(reviewer, 'approve', reviewVersion); assert.equal(noInspection.status, 503, noInspection.text);
    inspect(); const approval = await op(reviewer, 'approve', reviewVersion); assert.equal(approval.status, 200, approval.text); reviewVersion++;
    const wrong = await op(otherReviewer, 'take_down', reviewVersion, 'Synthetic different reviewer denial.'); assert.equal(wrong.status, 403, wrong.text);
    const down = await op(reviewer, 'take_down', reviewVersion, 'Synthetic current assigned reviewer takedown.'); assert.equal(down.status, 200, down.text); reviewVersion++;
    assert.equal(down.json?.data.reel.status, 'delisted');
    const bypass = await mutate(reviewed, command('submit', reviewVersion, selected)); assert.equal(bypass.status, 409, bypass.text);
  });
  // Only a browser-kind lease may set this opt-in. The ordinary owned_db run
  // executes no browser/dev client, and no tests are skipped in either mode.
  if (process.env.LETBUYY_N5_REEL_BROWSER === '1') await t.test('normal local merchant and reviewer private workflow with mounted recovery and correction', { timeout: 1200000 }, async () => {
    const password = 'Synthetic-private-reel-browser-42', passwordHash = await hashMerchantPassword(password);
    owned.psql(`UPDATE users_custom SET password_hash=${quote(passwordHash)} WHERE id IN('${actor}','${otherActor}');`);
    let browserReel = '';
    await withMerchantReelBrowser(async fixture => {
      const { page, context } = await fixture.login(email, password);
      fixture.readOutage(true); await page.goto(`${fixture.origin}/${tenant.subdomain}/content/reels`);
      await expect(page.getByRole('heading', { name: 'Product reels', exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Product reels', exact: true }).first()).toBeVisible();
      await expect(page.getByText('Reel needs attention', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Caption', { exact: true })).toHaveCount(0);
      fixture.readOutage(false); await page.getByRole('button', { name: 'Retry loading', exact: true }).click();
      await page.getByLabel('Caption', { exact: true }).fill('Normal private browser draft');
      fixture.loseReply();
      const [lost] = await Promise.all([page.waitForResponse(r => r.request().method() === 'POST' && /\/api\/stores\/[^/]+\/reels\//.test(r.url())), page.getByRole('button', { name: 'Save private draft', exact: true }).click()]);
      assert.equal(lost.status(), 503); const request = lost.request().postDataJSON(); const requestKey = request.idempotency_key;
      browserReel = new URL(lost.url()).pathname.split('/').at(-1)!;
      assert.equal(owned.psql(`SELECT count(*) FROM commerce_reel_events WHERE reel_id='${browserReel}';`), '1');
      await expect(page.getByRole('button', { name: 'Retry same request', exact: true })).toBeVisible();
      await page.reload(); await expect(page.getByLabel('Caption', { exact: true })).toHaveValue('Normal private browser draft');
      await expect(page.getByLabel('Caption', { exact: true })).toBeDisabled();
      const [retry] = await Promise.all([page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/reels/' + browserReel)), page.getByRole('button', { name: 'Retry same request', exact: true }).click()]);
      assert.equal(retry.status(), 200, await retry.text()); assert.equal(retry.request().postDataJSON().idempotency_key, requestKey);
      await expect(page.getByLabel('Caption', { exact: true })).toBeEnabled();
      assert.equal(owned.psql(`SELECT count(*) FROM commerce_reel_events WHERE reel_id='${browserReel}';`), '1');
      const stale = await context.newPage(); await stale.goto(`${fixture.origin}/${tenant.subdomain}/content/reels`);
      await stale.getByRole('button', { name: new RegExp(browserReel) }).click(); await expect(stale.getByLabel('Caption', { exact: true })).toHaveValue('Normal private browser draft');
      await page.bringToFront(); await page.getByLabel('Caption', { exact: true }).fill('Current saved browser caption');
      await page.getByRole('button', { name: 'Save private draft', exact: true }).click(); await expect(page.getByText('Server state: draft · version 2', { exact: true })).toBeVisible();
      await stale.bringToFront(); await stale.getByLabel('Caption', { exact: true }).fill('Keep my unsaved correction');
      const [conflict] = await Promise.all([stale.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/reels/' + browserReel)), stale.getByRole('button', { name: 'Save private draft', exact: true }).click()]);
      assert.equal(conflict.status(), 409); await expect(stale.getByLabel('Caption', { exact: true })).toHaveValue('Keep my unsaved correction');
      await stale.getByRole('button', { name: 'Load saved revision', exact: true }).click(); await expect(stale.getByLabel('Caption', { exact: true })).toHaveValue('Current saved browser caption');
      await stale.close(); await page.bringToFront();
      await page.getByLabel('Approved product listing (first 100)', { exact: true }).selectOption(listing);
      await page.getByLabel('Current product variant', { exact: true }).selectOption(variant);
      await page.getByLabel('Verified private video', { exact: true }).selectOption(media);
      await page.getByLabel('Verified private thumbnail', { exact: true }).selectOption(thumbnail);
      await page.getByRole('button', { name: 'Submit for review', exact: true }).click(); await expect(page.getByText('Server state: pending_review · version 3', { exact: true })).toBeVisible();
      await expect(page.locator('video,iframe')).toHaveCount(0); await page.screenshot({ path: fixture.evidence + '/merchant-submitted.png', fullPage: true });
      const other = await fixture.login(otherEmail, password);
      const endpoint = `${fixture.origin}/api/stores/${tenant.subdomain}/reels/${browserReel}`;
      const denied = await other.context.request.get(endpoint, { headers: { 'X-LetBuyy-Merchant-Context': otherActor } }); assert.ok([403, 404].includes(denied.status()));
      await page.bringToFront(); await page.getByLabel('Caption', { exact: true }).fill('Must clear on account replacement');
      await context.addCookies(await other.context.cookies(fixture.origin));
      const [changed] = await Promise.all([page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/reels/' + browserReel)), page.getByRole('button', { name: 'Save private draft', exact: true }).click()]);
      assert.equal(changed.status(), 409); await expect(page.getByLabel('Caption', { exact: true })).toHaveCount(0);
    });
    await withConsoleBrowser(owned, async fixture => {
      const { page } = await fixture.login(fixture.actors[0]); await page.getByRole('link', { name: 'Private reel reviews', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Private reel reviews', exact: true })).toBeVisible();
      await page.getByRole('link', { name: new RegExp(browserReel) }).click();
      await expect(page.getByText('Caption: Current saved browser caption', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Approve inspected revision', exact: true })).toBeDisabled();
      await page.getByRole('button', { name: 'Claim this revision', exact: true }).click();
      await expect(page.getByText('Status: pending_review · version 4', { exact: true })).toBeVisible();
      await page.getByLabel('Actionable correction or takedown reason', { exact: true }).fill('Add the missing product disclosure.');
      await page.getByRole('button', { name: 'Return for correction', exact: true }).click();
      await expect(page.getByText('Status: rejected · version 5', { exact: true })).toBeVisible();
      await expect(page.locator('video,iframe')).toHaveCount(0);
      assert.equal(owned.psql(`SELECT actor_id FROM commerce_reel_events WHERE reel_id='${browserReel}' AND action='reject';`), fixture.actors[0].id);
    });
    await withMerchantReelBrowser(async fixture => {
      const { page } = await fixture.login(email, password); await page.goto(`${fixture.origin}/${tenant.subdomain}/content/reels`);
      await page.getByRole('button', { name: new RegExp(browserReel) }).click();
      await expect(page.getByText(/reject: Add the missing product disclosure/)).toBeVisible();
      await page.getByLabel('Caption', { exact: true }).fill('Corrected normal browser disclosure');
      await page.getByRole('button', { name: 'Submit for review', exact: true }).click();
      await expect(page.getByText('Server state: pending_review · version 6', { exact: true })).toBeVisible();
      await page.screenshot({ path: fixture.evidence + '/merchant-corrected.png', fullPage: true });
    });
    assert.equal(owned.psql(`SELECT count(*) FROM commerce_reel_revisions WHERE reel_id='${browserReel}';`), '4');
    assert.equal(owned.psql(`SELECT assigned_reviewer_id IS NULL FROM commerce_reels WHERE id='${browserReel}';`), 't');
  });
  await t.test('canonical content grants preserve direct/wildcard parity and live staff denials', async t => {
    for (const grant of ['content:write', 'content:*', '*']) await t.test(grant, async () => {
      assert.equal(evaluateStaffPermission({ isOwner: false, granted: [grant], requiredKey: 'content:write' }).allowed, true);
      const staff = randomUUID(), mail = `syn-reel-permission-${staff}@example.invalid`, id = randomUUID(), body = command('save', 0);
      owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${staff}','${mail}',true);
        INSERT INTO employees(user_id,email,role,store_id,status,is_active,permissions) VALUES('${staff}','${mail}','editor','${tenant.siteId}','active',true,${json({ granted: [grant] })});`);
      const positive = await mutate(id, body, staff, mail); assert.equal(positive.status, 200, positive.text);
      const ownRead = await gateway.request(`/v1/reels/${id}?store_id=${tenant.siteId}`, { headers: await headers(staff, mail) }); assert.equal(ownRead.status, 200, ownRead.text);
      const wrong = await mutate(randomUUID(), command('save', 0), staff, mail, otherTenant.siteId); assert.equal(wrong.status, 403, wrong.text);
      for (const change of [`permissions=${json({ granted: [] })}`, `permissions=${json({ granted: ['content:read'] })}`, 'is_active=false', "status='disabled'", 'deleted_at=now()']) {
        owned.psql(`UPDATE employees SET ${change} WHERE user_id='${staff}' AND store_id='${tenant.siteId}';`);
        const denied = await mutate(id, body, staff, mail); assert.equal(denied.status, 403, denied.text);
        owned.psql(`UPDATE employees SET permissions=${json({ granted: [grant] })},is_active=true,status='active',deleted_at=NULL WHERE user_id='${staff}' AND store_id='${tenant.siteId}';`);
      }
      assert.equal(owned.psql(`SELECT count(*) FROM commerce_reel_events WHERE reel_id='${id}';`), '1');
    });
  });
  await t.test('live role revocation denies a replay; product edits invalidate later submission', async () => {
    const staff = randomUUID(), staffEmail = `syn-reel-staff-${staff}@example.invalid`;
    owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${staff}','${staffEmail}',true);INSERT INTO employees(user_id,email,role,store_id,status,is_active,permissions) VALUES('${staff}','${staffEmail}','editor','${tenant.siteId}','active',true,'{"granted":["content:write"]}');`);
    const id = randomUUID(), body = command('save', 0); assert.equal((await mutate(id, body, staff, staffEmail)).status, 200);
    owned.psql(`UPDATE employees SET permissions='{"granted":[]}' WHERE user_id='${staff}' AND store_id='${tenant.siteId}';`);
    assert.equal((await mutate(id, body, staff, staffEmail)).status, 403);
    owned.psql(`UPDATE products SET name='Synthetic material replacement' WHERE id='${product}';`);
    const stale = await mutate(randomUUID(), command('submit', 0, selected)); assert.equal(stale.status, 409, stale.text);
  });
  await t.test('actual atomic SQL outbox rows satisfy the canonical typed catalogue with no external consumers', () => {
    const rows = JSON.parse(owned.psql(`SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM outbox_events x WHERE event_type='reel.review.changed';`));
    assert.ok(rows.length >= 6, 'all transition types must have real committed rows');
    const actions = new Set<string>();
    for (const row of rows) {
      const transport = buildDomainEventEnvelope(row);
      const parsed = validateDomainEventEnvelope({ event_id: transport.id, event_type: transport.type, source_runtime: 'api-gateway', site_id: transport.site_id,
        aggregate_type: row.aggregate_type, aggregate_id: row.aggregate_id, occurred_at: new Date(String(transport.occurred_at)).toISOString(),
        payload: transport.payload, schema_version: transport.schema_version, idempotency_key: transport.idempotency_key });
      actions.add(String(parsed.payload.action)); assert.equal(parsed.idempotency_key?.length, 69);
    }
    for (const action of ['save', 'submit', 'claim', 'reject', 'approve', 'take_down']) assert.ok(actions.has(action), action);
    assert.deepEqual(getDomainEventContract('reel.review.changed')?.consumers, []);
    assert.deepEqual(queueNamesForEvent('reel.review.changed'), []);
  });
  await t.test('352 preserves existing data and mirror insert/update/delete, refuses unknown shape and retains compatibility on rollback/reapply', () => {
    const forward = readFileSync(new URL('../../database/supabase/migrations/352_webhook_partition_shadow_parity.sql', import.meta.url), 'utf8');
    const rollback = readFileSync(new URL('../../database/supabase/rollback/352_webhook_partition_shadow_parity.rollback.sql', import.meta.url), 'utf8');
    const subscription = randomUUID(), delivery = randomUUID(), event = randomUUID();
    owned.psql(`INSERT INTO webhook_subscriptions(id,site_id,name,target_url,event_types,signing_secret)
      VALUES('${subscription}','${tenant.siteId}','Synthetic mirror parity','https://webhook.example.com/n5-owned-test',ARRAY['product.updated'],'synthetic-not-a-real-signing-secret');
      INSERT INTO webhook_deliveries(id,site_id,subscription_id,event_id,event_type,target_url,payload,idempotency_key,nonce,dlq_reason)
      VALUES('${delivery}','${tenant.siteId}','${subscription}','${event}','product.updated','https://webhook.example.com/n5-owned-test','{"stage":"insert"}','n5-direct-after352:${event}','synthetic-nonce-original','synthetic-dlq-original');`);
    const mirrored = () => owned.psql(`SELECT to_jsonb(s)=to_jsonb(d) FROM webhook_deliveries s JOIN webhook_deliveries_partitioned d USING(id,created_at) WHERE s.id='${delivery}';`);
    assert.equal(mirrored(), 't', 'direct ordinary insert copies every value, including nonce/dlq_reason');
    const snapshot = () => owned.psql(`SELECT jsonb_build_object(
      'source_rows',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id,created_at) FROM webhook_deliveries x),
      'shadow_rows',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id,created_at) FROM webhook_deliveries_partitioned x),
      'columns',(SELECT jsonb_agg(jsonb_build_array(attrelid::regclass::text,attnum,attname,atttypid,atttypmod,attcollation,attnotnull,attgenerated,attidentity) ORDER BY attrelid,attnum) FROM pg_attribute WHERE attrelid IN('webhook_deliveries'::regclass,'webhook_deliveries_partitioned'::regclass) AND attnum>0),
      'roles',(SELECT jsonb_agg(jsonb_build_array(oid,relacl,relrowsecurity,relforcerowsecurity) ORDER BY oid) FROM pg_class WHERE oid IN('webhook_deliveries'::regclass,'webhook_deliveries_partitioned'::regclass)),
      'triggers',(SELECT jsonb_agg(pg_get_triggerdef(oid) ORDER BY oid) FROM pg_trigger WHERE tgrelid IN('webhook_deliveries'::regclass,'webhook_deliveries_partitioned'::regclass)),
      'partitions',(SELECT jsonb_agg(to_jsonb(x) ORDER BY relid::text) FROM pg_partition_tree('webhook_deliveries_partitioned') x));`);
    const before = snapshot();
    owned.script(forward); assert.equal(snapshot(), before, 'reapply preserves existing rows, schema, grants, RLS, triggers and partitions');
    owned.script(rollback); assert.equal(snapshot(), before, 'compatibility rollback retains data-bearing and preexisting columns with active mirror');
    owned.script(forward); assert.equal(snapshot(), before, 'reapply after compatibility rollback conserves all state');
    const inner = (sql: string) => sql.replace(/^BEGIN;$/m, '').replace(/^COMMIT;$/m, '');
    for (const [alter, script, message] of [
      ['ALTER TABLE webhook_deliveries_partitioned RENAME COLUMN nonce TO n5_owned_wrong_nonce;', forward, 'WEBHOOK_SHADOW_UNEXPECTED_TARGET_SHAPE'],
      ['ALTER TABLE webhook_deliveries_partitioned ALTER COLUMN dlq_reason TYPE varchar(200);', forward, 'WEBHOOK_SHADOW_UNEXPECTED_TARGET_SHAPE'],
      ['ALTER TABLE webhook_deliveries_partitioned ADD COLUMN n5_owned_unknown_tail text;', forward, 'WEBHOOK_SHADOW_UNEXPECTED_TARGET_SHAPE'],
      ['ALTER TABLE webhook_deliveries RENAME COLUMN nonce TO n5_owned_wrong_nonce;', forward, 'WEBHOOK_SHADOW_UNEXPECTED_SOURCE_SHAPE'],
      ['ALTER TABLE webhook_deliveries_partitioned RENAME COLUMN nonce TO n5_owned_wrong_nonce;', rollback, 'WEBHOOK_SHADOW_UNEXPECTED_TARGET_SHAPE'],
    ]) {
      assert.match(owned.psqlExpectError(`BEGIN;${alter}\n${inner(script)}\nROLLBACK;`), new RegExp(message));
      assert.equal(snapshot(), before, 'failed precondition rolls back the deliberately corrupted owned shape and conserves all state');
    }
    owned.psql(`UPDATE webhook_deliveries SET payload='{"stage":"update"}',nonce='synthetic-nonce-updated',dlq_reason='synthetic-dlq-updated' WHERE id='${delivery}';`);
    assert.equal(mirrored(), 't', 'update mirrors nonce/dlq_reason and the complete row');
    owned.psql(`DELETE FROM webhook_deliveries WHERE id='${delivery}';`);
    assert.equal(owned.psql(`SELECT count(*) FROM webhook_deliveries_partitioned WHERE id='${delivery}';`), '0', 'delete removes its exact shadow row');
    // Keep this synthetic subscription from changing the later once-only control.
    owned.psql(`UPDATE webhook_subscriptions SET status='paused' WHERE id='${subscription}';`);
    globalThis.console.info('OWNED_N5_352_PARITY ' + JSON.stringify({ insert: true, update: true, delete: true, conservation: true, refusalCases: 5, compatibilityRollback: true, reapply: true }));
  });
  await t.test('private reel events cannot fan out even to wildcard webhook subscriptions', async () => {
    // Real dispatcher/SQL against owned resources; this adapter only creates
    // queue/delivery rows. No webhook transport or external HTTP is invoked.
    globalThis.console.info('OWNED_N5_WEBHOOK_SCHEMA ' + owned.psql(`SELECT jsonb_build_object(
      'columns',(SELECT jsonb_object_agg(name,cols) FROM (SELECT c.relname AS name,jsonb_agg(jsonb_build_object('ordinal',a.attnum,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod)) ORDER BY a.attnum) AS cols FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid WHERE n.nspname='public' AND c.relname IN('webhook_deliveries','webhook_deliveries_partitioned') AND a.attnum>0 AND NOT a.attisdropped GROUP BY c.relname) x),
      'mirror',pg_get_functiondef('public.mirror_hot_table_partition_shadow()'::regprocedure),
      'policies',(SELECT jsonb_agg(jsonb_build_object('target_table',target_table,'shadow_table',shadow_table,'lifecycle_mode',lifecycle_mode)) FROM retention_policies WHERE target_table='webhook_deliveries' AND deleted_at IS NULL));`));
    owned.psql(`INSERT INTO webhook_subscriptions(site_id,name,target_url,event_types,signing_secret)
      VALUES('${tenant.siteId}','Synthetic wildcard consumer','https://webhook.example.com/n5-owned-test',ARRAY['*'],'synthetic-not-a-real-signing-secret');`);
    const control = randomUUID();
    owned.psql(`INSERT INTO outbox_events(site_id,store_id,event_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key)
      VALUES('${tenant.siteId}','${tenant.siteId}','${control}','product','${product}','product.updated',${json({site_id:tenant.siteId,product_id:product})},'n5-owned-control:${control}');`);
    const db = createSupabaseServiceClient(owned.restEnv()), adapter = new OutboxExecutionAdapter(db), barrier = newBarrier(2);
    const claimTap = tapRest(owned.restUrl, async (call, forward) => { if (call.resource === 'rpc/claim_outbox_events') await barrier.arrive(); return forward(); });
    let results: Awaited<ReturnType<OutboxExecutionAdapter['dispatchBatch']>>[];
    try { results = await Promise.all(['a', 'b'].map(worker => adapter.dispatchBatch({ dispatcherId: 'n5-owned-private-' + worker, outboxLimit: 100 }))); }
    finally { claimTap.restore(); }
    assert.equal(barrier.arrived, 2); assert.ok(results.reduce((sum, row) => sum + row.claimed, 0) > 0);
    assert.equal(owned.psql(`SELECT count(*) FROM webhook_deliveries WHERE event_type='reel.review.changed';`), '0');
    assert.equal(owned.psql(`SELECT count(*) FROM platform_queue_jobs WHERE job_type='reel.review.changed';`), '0');
    assert.equal(owned.psql(`SELECT count(*) FROM outbox_events WHERE event_type='reel.review.changed' AND status<>'processed';`), '0');
    globalThis.console.info('OWNED_N5_PRIVATE_DISPATCH_CLOSED ' + JSON.stringify({ privateWebhookRows: 0, privateQueueJobs: 0, privateUnprocessed: 0, concurrentClaims: barrier.arrived }));
    assert.equal(results.reduce((sum, row) => sum + row.failed, 0), 0, owned.psql(`SELECT coalesce(jsonb_agg(jsonb_build_object('event_type',event_type,'status',status,'attempts',attempts,'error',error_message)), '[]') FROM outbox_events WHERE status='failed';`));
    const assertPrivateClosed = () => {
      assert.equal(owned.psql(`SELECT count(*) FROM webhook_deliveries WHERE event_type='reel.review.changed';`), '0');
      assert.equal(owned.psql(`SELECT count(*) FROM platform_queue_jobs WHERE job_type='reel.review.changed';`), '0');
      assert.equal(owned.psql(`SELECT count(*) FROM webhook_deliveries WHERE event_id='${control}';`), '1', 'ordinary matching webhook fanout stays functional and once-only');
    };
    assertPrivateClosed();
    assert.equal(owned.psql(`SELECT count(*) FROM outbox_events WHERE event_type='reel.review.changed' AND status<>'processed';`), '0');
    assert.equal((await adapter.dispatchBatch({ dispatcherId: 'n5-owned-private-a', outboxLimit: 100 })).claimed, 0, 'replay cannot fan out completed events');
    const retryReel = randomUUID(), saved = await mutate(retryReel, command('save', 0)); assert.equal(saved.status, 200, saved.text);
    const retryId = owned.psql(`SELECT id FROM outbox_events WHERE aggregate_id='${retryReel}' AND event_type='reel.review.changed';`);
    let completionFailed = false;
    const fault = tapRest(owned.restUrl, async (call, forward) => {
      if (call.resource === 'rpc/complete_outbox_event' && !completionFailed) { completionFailed = true; return new Response(JSON.stringify({ message: 'synthetic owned completion fault before commit' }), { status: 503, headers: { 'Content-Type': 'application/json' } }); }
      return forward();
    });
    try { const failed = await adapter.dispatchBatch({ dispatcherId: 'n5-owned-private-retry', outboxLimit: 100 }); assert.equal(failed.failed, 1); }
    finally { fault.restore(); }
    assert.equal(completionFailed, true); assert.equal(owned.psql(`SELECT status FROM outbox_events WHERE id='${retryId}';`), 'failed'); assertPrivateClosed();
    // Explicit clock advancement of this one owned mutable queue row only.
    owned.psql(`UPDATE outbox_events SET available_at=now()-interval '1 second',next_attempt_at=now()-interval '1 second' WHERE id='${retryId}';`);
    const recovered = await adapter.dispatchBatch({ dispatcherId: 'n5-owned-private-retry', outboxLimit: 100 }); assert.equal(recovered.processed, 1); assert.equal(recovered.failed, 0);
    assert.equal(owned.psql(`SELECT status FROM outbox_events WHERE id='${retryId}';`), 'processed'); assertPrivateClosed();
  });
  await t.test('retained roots, immutable revisions/events and all custody evidence refuse retirement with full conservation', async () => {
    await gateway.settle(); await console.gateway.settle();
    const before = state(), parsed = JSON.parse(before), outside = canonical();
    for (const name of reelTableNames) assert.ok(parsed.rows[name].length > 0, name + ': retained evidence is present');
    refuse('', /REEL_ROLLBACK_RETAINED_DATA/, 'retained private workflow and custody family');
    assert.equal(state(), before); assert.equal(canonical(), outside);
    globalThis.console.info('OWNED_N5_RETENTION_AFTER ' + JSON.stringify({ retainedDataRefused: true, everyRowAndCatalogConserved: true, canonicalRowsConserved: true,
      retainedCounts: Object.fromEntries(Object.entries(parsed.rows).map(([name, rows]) => [name, (rows as unknown[]).length])) }));
  });
  owned.script(forward359);
});

// Finite synthetic owned snapshot: nothing is erased to make rollback pass.
// The profile excludes physical relation OIDs/filenodes, while retaining typed
// column/default/constraint/trigger/index, namespace, role and function metadata.
function reelRetentionStateSql() {
  const names = ['commerce_reels', 'commerce_reel_revisions', 'commerce_reel_events', 'reel_asset_provenance', 'reel_processing_receipts', 'reel_review_inspections'];
  const literals = names.map(quote).join(','), rows = names.map(name => `${quote(name)},(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM public.${name} x)`).join(',');
  return `SELECT jsonb_build_object('rows',jsonb_build_object(${rows}),'profile',jsonb_build_object(
    'namespace',(SELECT jsonb_build_object('owner',pg_get_userbyid(nspowner),'acl',nspacl) FROM pg_namespace WHERE nspname='public'),
    'functions',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'input_names',coalesce(p.proargnames[1:p.pronargs],ARRAY[]::text[]),'result',format_type(p.prorettype,NULL),'returns_set',p.proretset,'body_md5',md5(p.prosrc),'definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'language',l.lanname,'security_definer',p.prosecdef,'volatility',p.provolatile,'strict',p.proisstrict,'leakproof',p.proleakproof,'parallel',p.proparallel,'kind',p.prokind,'config',p.proconfig,'defaults',pg_get_expr(p.proargdefaults,0),'acl',p.proacl) ORDER BY p.proname,p.oid::regprocedure::text) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang WHERE p.proname IN('protect_reel_record_v1','reel_json_compact_v1','reel_actor_v1','reel_payload_v1','mutate_reel_review_v1','read_reel_reviews_v1')),
    'tables',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'owner',pg_get_userbyid(c.relowner),'kind',c.relkind,'persistence',c.relpersistence,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'acl',c.relacl,
      'columns',(SELECT jsonb_agg(jsonb_build_object('ordinal',a.attnum,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'collation',a.attcollation::regcollation::text,'generated',a.attgenerated,'identity',a.attidentity,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0),
      'constraints',(SELECT jsonb_agg(jsonb_build_object('name',conname,'type',contype,'definition',pg_get_constraintdef(oid),'validated',convalidated,'deferrable',condeferrable,'deferred',condeferred) ORDER BY conname) FROM pg_constraint WHERE conrelid=c.oid),
      'triggers',(SELECT jsonb_agg(jsonb_build_object('name',tgname,'definition',pg_get_triggerdef(oid),'enabled',tgenabled,'internal',tgisinternal) ORDER BY tgname) FROM pg_trigger WHERE tgrelid=c.oid),
      'indexes',(SELECT jsonb_agg(pg_get_indexdef(indexrelid) ORDER BY pg_get_indexdef(indexrelid)) FROM pg_index WHERE indrelid=c.oid),
      'policies',(SELECT jsonb_agg(jsonb_build_object('name',polname,'permissive',polpermissive,'command',polcmd,'roles',(SELECT jsonb_agg(CASE WHEN role_oid=0 THEN 'PUBLIC' ELSE pg_get_userbyid(role_oid) END ORDER BY role_oid) FROM unnest(polroles) role_oid),'using',pg_get_expr(polqual,polrelid),'check',pg_get_expr(polwithcheck,polrelid)) ORDER BY polname) FROM pg_policy WHERE polrelid=c.oid)) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN(${literals}))));`;
}


function normalizeReelState(value: { profile: { tables: { triggers: { internal: boolean; name: string; definition: string }[] | null }[] } }) {
  for (const table of value.profile.tables) {
    for (const trigger of table.triggers ?? []) if (trigger.internal) {
      trigger.name = trigger.name.replace(/^(RI_ConstraintTrigger_[ac]_)\d+$/, '$1<oid>');
      trigger.definition = trigger.definition.replace(/(RI_ConstraintTrigger_[ac]_)\d+/g, '$1<oid>');
    }
    table.triggers?.sort((a, b) => (a.name + '\0' + a.definition) < (b.name + '\0' + b.definition) ? -1 : (a.name + '\0' + a.definition) > (b.name + '\0' + b.definition) ? 1 : 0);
  }
  return value;
}
function reelRetirementCatalogSql() {
  const names = reelTableNames.map(quote).join(',');
  // Physical OIDs are retained here for exact refusal/fault conservation. Only
  // the separate successful reapply comparison normalizes generated RI names.
  return `SELECT jsonb_build_object(
    'attributes',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a WHERE a.attrelid IN(SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN(${names}))),
    'relations',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND (c.relname~'(^|_)reels?(_|$)' OR c.oid IN(SELECT indexrelid FROM pg_index WHERE indrelid IN(SELECT oid FROM pg_class WHERE relname IN(${names}))))),
    'types',(SELECT jsonb_agg(to_jsonb(x) ORDER BY x.oid) FROM pg_type x WHERE x.typname~'(^|_)reels?(_|$)'),
    'parent_fk_triggers',(SELECT jsonb_agg(to_jsonb(x) ORDER BY x.oid) FROM pg_trigger x WHERE x.tgconstraint IN(SELECT oid FROM pg_constraint WHERE conrelid IN(SELECT oid FROM pg_class WHERE relname IN(${names})))),
    'roles',(SELECT jsonb_agg(to_jsonb(x) ORDER BY x.oid) FROM pg_roles x),
    'members',(SELECT jsonb_agg(to_jsonb(x) ORDER BY roleid,member) FROM pg_auth_members x),
    'database_owner',(SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database()),
    'probe_view',to_regclass('public.n5_owned_private_probe'));
  `;
}
async function reelRetirementRace(label: string, setup: string, expectedLock: string, body: string, snapshot: () => string) {
  const before = snapshot(), key = Number.parseInt(randomUUID().slice(0, 8), 16) % 1000000000 + 1000000000;
  const advisory = `locktype='advisory' AND classid=0 AND objid=${key}`;
  const holder = owned.psqlAsync(`BEGIN;SET LOCAL statement_timeout='25s';SELECT pg_advisory_xact_lock(${key}::bigint);
    DO $$DECLARE deadline timestamptz:=clock_timestamp()+interval '20 seconds';BEGIN
    WHILE(SELECT count(*) FROM pg_locks WHERE ${advisory} AND NOT granted)<2 LOOP
      IF clock_timestamp()>deadline THEN RAISE EXCEPTION 'N5 retirement barrier did not obtain both actual waiters';END IF;
      PERFORM pg_sleep(0.01);
    END LOOP;END$$;COMMIT;`).then(() => null, (error: Error) => error);
  const wait = async (sql: string, reason: string) => {
    const deadline = Date.now() + 10000;
    while (owned.psql(sql) !== 't') {
      if (Date.now() > deadline) throw new Error(label + ': ' + reason);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  };
  let writer: Promise<Error | null> | undefined, release: Promise<Error | null> | undefined;
  try {
    await wait(`SELECT EXISTS(SELECT 1 FROM pg_locks WHERE ${advisory} AND granted);`, 'holder never acquired its exact advisory lock');
    writer = owned.psqlAsync(`BEGIN;SET LOCAL statement_timeout='25s';${setup}SELECT pg_advisory_xact_lock(${key}::bigint);ROLLBACK;`)
      .then(() => null, (error: Error) => error);
    await wait(`SELECT EXISTS(SELECT 1 FROM pg_locks barrier JOIN pg_locks l ON l.pid=barrier.pid WHERE barrier.${advisory.replaceAll(' AND ', ' AND barrier.')} AND NOT barrier.granted AND l.granted AND ${expectedLock});`, 'writer never held its actual private-table/catalog/transaction lock at the barrier');
    const observed = JSON.parse(owned.psql(`SELECT jsonb_build_object('pid',barrier.pid,'advisory_waiting',NOT barrier.granted,
      'locks',(SELECT jsonb_agg(jsonb_build_object('type',l.locktype,'relation',l.relation::regclass::text,'mode',l.mode,'granted',l.granted) ORDER BY l.locktype,l.mode,l.relation) FROM pg_locks l WHERE l.pid=barrier.pid))
      FROM pg_locks barrier WHERE barrier.${advisory.replaceAll(' AND ', ' AND barrier.')} AND NOT barrier.granted;`));
    if (label === 'catalog-ddl') assert.equal(owned.psql("SELECT to_regprocedure('public.reel_future_v99()') IS NULL;"), 't', 'natural uncommitted CREATE FUNCTION is invisible; no artificial catalog lock is added');
    globalThis.console.info('OWNED_N5_RETIREMENT_RACE_BARRIER ' + JSON.stringify({ label, observed, explicitCatalogLockInWriter: false }));
    const error = owned.psqlExpectError(`BEGIN;${body}\nROLLBACK;`);
    assert.equal(snapshot(), before, label + ': attempted retirement changes nothing while writer remains blocked');
    assert.match(error, /could not obtain lock|REEL_ROLLBACK_UNSAFE_SESSION_OR_WRITER/, label + ': exact active writer must refuse retirement');
  } finally {
    // Release through the same owned key even when setup/assertions fail. No
    // backend cancellation, record deletion or shared-resource reaping is used.
    release = owned.psqlAsync(`BEGIN;SET LOCAL statement_timeout='25s';SELECT pg_advisory_xact_lock(${key}::bigint);COMMIT;`).then(() => null, (error: Error) => error);
    const results = await Promise.all([holder, writer ?? Promise.resolve(null), release]);
    for (const result of results) assert.equal(result, null, label + ': every exact owned barrier session must finish');
  }
  assert.equal(snapshot(), before, label + ': writer abort restores complete private/canonical/catalog state');
  globalThis.console.info('OWNED_N5_RETIREMENT_RACE ' + JSON.stringify({ label, actualLockObserved: true, refused: true, allSessionsTerminal: true, allConserved: true }));
}

// Real local password/session/tenant/BFF paths. Only the existing development
// bot-challenge seam is enabled, so no external Turnstile/provider is contacted.
// This is no evidence of production bot verification, video custody or inbox delivery.
async function withMerchantReelBrowser(run: (fixture: {
  origin: string; evidence: string; readOutage(value: boolean): void; loseReply(): void;
  login(email: string, password: string): Promise<{ page: Page; context: BrowserContext }>;
}) => Promise<void>) {
  async function port() { const server = createServer(); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); const value = (server.address() as { port: number }).port; await new Promise<void>(resolve => server.close(() => resolve())); return value; }
  async function ready(url: string, child: OwnedClientProcess) {
    const deadline = Date.now() + 240000;
    while (Date.now() < deadline) { if (child.exitCode !== null || child.signalCode !== null) throw new Error('Owned N5 app stopped before readiness'); try { if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).status < 500) return; } catch { /* bounded local startup */ } await new Promise(resolve => setTimeout(resolve, 150)); }
    throw new Error('Owned N5 app startup timed out');
  }
  const identityPort = await port(), merchantPort = await port(), identityOrigin = `http://localhost:${identityPort}`, origin = `http://localhost:${merchantPort}`;
  const proxy = await startOwnedPooledSqlProxy(owned), keys = await newIdentityKeys();
  const gateway = new Gateway(gatewayEnv(owned, keys, { ENVIRONMENT: 'local', LETBUYY_IDENTITY_ISSUER: identityOrigin, ...proxy.env() }));
  let bridge: Server | undefined, identity: OwnedClientProcess | undefined, merchant: OwnedClientProcess | undefined, browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const pages: Page[] = [], errors: string[] = [], calls: { path: string; status: number; key: string | null }[] = [], diagnostics: string[] = [];
  const scriptFailures: unknown[] = [];
  const scriptNetwork: unknown[] = [];
  let outage = false, lose = false;
  const evidence = `${ownedTmpDir()}/letbuyy-n5-reel-browser-${owned.runId}-${randomUUID().slice(0, 8)}`; mkdirSync(evidence, { recursive: true });
  try {
    bridge = createServer(async (req, res) => {
      const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk)); const body = Buffer.concat(chunks).toString(), headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) if (typeof value === 'string' && !['host', 'connection', 'content-length', 'transfer-encoding', 'accept-encoding'].includes(name)) headers.set(name, value);
      try {
        const path = (req.url ?? '/').split('?')[0];
        if (outage && req.method === 'GET' && path === '/v1/reels') { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: { code: 'SYNTHETIC_REEL_READ_OUTAGE', message: 'Synthetic private read outage. Retry loading.' } })); return; }
        const result = await gateway.request(req.url ?? '/', { method: req.method, headers, ...(body ? { body } : {}) });
        calls.push({ path, status: result.status, key: headers.get('X-Idempotency-Key') });
        if (lose && req.method === 'POST' && path.startsWith('/v1/reels/') && result.status === 200) { lose = false; res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: { code: 'SYNTHETIC_COMMITTED_REPLY_LOSS', message: 'The save outcome is unknown. Retry the same request.' } })); return; }
        res.writeHead(result.status, Object.fromEntries(result.headers.entries())); res.end(result.text);
      } catch { res.writeHead(500); res.end('{}'); }
    });
    await new Promise<void>(resolve => bridge!.listen(0, '127.0.0.1', resolve)); const api = `http://127.0.0.1:${(bridge.address() as { port: number }).port}/v1`;
    const shared = { INTERNAL_API_SECRET: INTERNAL_SECRET, NEXT_PUBLIC_ACCOUNTS_URL: identityOrigin, NEXT_PUBLIC_ADMIN_URL: origin };
    identity = startOwnedClientRuntime(owned, 'identity-next', { port: identityPort, env: { ...shared, LETBUYY_API_URL: api, LETBUYY_IDENTITY_ISSUER: identityOrigin,
      LETBUYY_IDENTITY_PRIVATE_JWK: JSON.stringify({ ...await exportJWK(keys.privateKey), alg: 'ES256', kid: keys.kid }), ACCOUNTS_COOKIE_SECRET: randomUUID() + randomUUID(), COOKIE_DOMAIN: '',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: '', TURNSTILE_SECRET_KEY: '', LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'true', NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'true', RESEND_API_KEY: '', LETBUYY_EMAIL_API_KEY: '' } });
    merchant = startOwnedClientRuntime(owned, 'merchant-next', { port: merchantPort, env: { ...shared, LETBUYY_API_BASE_URL: api } });
    for (const app of [identity, merchant]) for (const stream of [app.stdout, app.stderr]) stream.on('data', data => { diagnostics.push(data.toString().replace(/\?[^\s]+/g, '?redacted').slice(0, 700)); if (diagnostics.length > 20) diagnostics.shift(); });
    await Promise.all([ready(identityOrigin + '/login', identity), ready(origin, merchant)]);
    browser = await chromium.launch({ headless: true });
    await run({ origin, evidence, readOutage: value => { outage = value; }, loseReply: () => { lose = true; }, login: async (email, password) => {
      const context = await browser!.newContext(), page = await context.newPage(); pages.push(page); page.setDefaultTimeout(45000); page.setDefaultNavigationTimeout(90000); page.on('pageerror', error => errors.push((error.stack || error.message).replace(/\?[^\s]+/g, '?redacted').slice(0, 2000)));
      const cdp = await context.newCDPSession(page); await cdp.send('Runtime.enable'); await cdp.send('Debugger.enable');
      await cdp.send('Network.enable');
      const layoutRequests = new Map<string, { path: string; decodedBytes: number }>();
      cdp.on('Network.requestWillBeSent', value => {
        const path = new URL(value.request.url).pathname;
        if (path === '/_next/static/chunks/app/layout.js') { layoutRequests.set(value.requestId, { path, decodedBytes: 0 }); scriptNetwork.push({ kind: 'request', requestId: value.requestId, path, timestamp: value.timestamp }); }
      });
      cdp.on('Network.responseReceived', value => {
        if (!layoutRequests.has(value.requestId)) return;
        const headers = Object.fromEntries(Object.entries(value.response.headers).filter(([name]) => /^(content-length|content-encoding|transfer-encoding|content-type)$/i.test(name)));
        scriptNetwork.push({ kind: 'response', requestId: value.requestId, status: value.response.status, headers, timestamp: value.timestamp });
      });
      cdp.on('Network.dataReceived', value => { const request = layoutRequests.get(value.requestId); if (request) request.decodedBytes += value.dataLength; });
      cdp.on('Network.loadingFinished', value => { const request = layoutRequests.get(value.requestId); if (request) scriptNetwork.push({ kind: 'finished', requestId: value.requestId, decodedBytes: request.decodedBytes, encodedBytes: value.encodedDataLength, timestamp: value.timestamp }); });
      cdp.on('Network.loadingFailed', value => { const request = layoutRequests.get(value.requestId); if (request) scriptNetwork.push({ kind: 'failed', requestId: value.requestId, decodedBytes: request.decodedBytes, canceled: value.canceled, error: value.errorText, timestamp: value.timestamp }); });
      page.on('console', message => { if (message.type() === 'error') scriptNetwork.push({ kind: 'browser-error', message: message.text().replace(/\?[^\s]+/g, '?redacted').slice(0, 1000) }); });
      cdp.on('Runtime.exceptionThrown', value => { const d = value.exceptionDetails; scriptFailures.push({ kind: 'uncaught', text: d.text, url: d.url, line: d.lineNumber, column: d.columnNumber, description: d.exception?.description, stack: d.stackTrace }); });
      cdp.on('Debugger.scriptFailedToParse', value => {
        if (scriptFailures.length >= 8) return;
        const file = evidence + '/failed-script-' + String(value.scriptId).replace(/[^a-z0-9_-]/gi, '') + '.js';
        scriptFailures.push({ kind: 'script-parse', url: value.url, line: value.startLine, column: value.startColumn, file });
        void cdp.send('Debugger.getScriptSource', { scriptId: value.scriptId }).then(result => writeFileSync(file, result.scriptSource)).catch(() => undefined);
      });
      await page.goto(identityOrigin + '/login'); await page.getByLabel('Email', { exact: true }).fill(email); await page.getByRole('button', { name: 'Continue with email', exact: true }).click(); await page.getByLabel('Password', { exact: true }).fill(password);
      const [response] = await Promise.all([page.waitForResponse(reply => reply.url().endsWith('/api/auth/login') && reply.request().method() === 'POST'), page.getByRole('button', { name: 'Log in', exact: true }).click()]); assert.equal(response.status(), 200, 'Actual password/session sign-in must succeed'); await page.waitForURL(url => url.origin === origin);
      // As in the canonical Console fixture, finish the journey route's dev
      // compilation before browser navigation. A cold webpack response has
      // repeatedly ended mid-layout.js (HTTP200/gzip, no canceled request).
      // These are real authenticated read-only requests, not an auth bypass,
      // browser reload/retry or a substitute for any mounted workflow assertion.
      const store = new URL(page.url()).pathname.split('/')[1]; assert.ok(store);
      const warmPath = '/' + store + '/content/reels';
      const compiledRoute = await context.request.get(origin + warmPath); assert.equal(compiledRoute.status(), 200);
      const compiledLayout = await context.request.get(origin + '/_next/static/chunks/app/layout.js'); assert.equal(compiledLayout.status(), 200);
      const layoutSource = await compiledLayout.text(); new Script(layoutSource);
      scriptNetwork.push({ kind: 'compiler-readiness', path: warmPath, routeStatus: compiledRoute.status(), layoutStatus: compiledLayout.status(), layoutBytes: Buffer.byteLength(layoutSource), completeOuterParse: true });
      return { context, page };
    } });
    assert.deepEqual(errors, [], 'no uncaught errors in the mounted merchant workflow');
    writeFileSync(evidence + '/result.json', JSON.stringify({ runId: owned.runId, localPasswordSignIns: pages.length, botChallenge: 'existing isolated development bypass; no production bot-verification proof', providerCustody: false, scriptNetwork, calls: calls.filter(call => call.path.startsWith('/v1/reels')) }, null, 2) + '\n');
    console.info('OWNED_N5_MERCHANT_REEL_BROWSER ' + JSON.stringify({ runId: owned.runId, evidence, localPasswordSignIns: pages.length, providerCustody: false }));
  } catch (error) {
    console.info('OWNED_N5_REEL_BROWSER_FAILURE ' + JSON.stringify({ calls: calls.slice(-20), errors, scriptFailures, scriptNetwork, diagnostics, pages: await Promise.all(pages.map(async page => ({ path: new URL(page.url()).pathname, visible: await page.locator('body').innerText().catch(() => '') }))) }));
    for (let i = 0; i < pages.length; i++) await pages[i].screenshot({ path: evidence + `/failure-${i}.png`, fullPage: true }).catch(() => undefined);
    throw error;
  } finally { await browser?.close(); await stopOwnedClientRuntime(merchant); await stopOwnedClientRuntime(identity); await gateway.settle(); await proxy.stop(); if (bridge) { bridge.closeAllConnections(); await new Promise<void>(resolve => bridge!.close(() => resolve())); } }
}
