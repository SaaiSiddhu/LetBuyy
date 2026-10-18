import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { functionDefinitions, sqlStatements } from '../../scripts/governance/definer-role-closure.mjs';

// Authority pins only. Actual empty-only rollback, retained-record refusals and
// catalog/writer races require the separately admitted owned database fixture.
const source = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const digest = (algorithm, text) => createHash(algorithm).update(text).digest('hex');
const forward = source('database/supabase/migrations/345_canonical_reel_review.sql');

test('retention recovery pins the reviewed explicit-DDL 345 forward and unchanged 352 pair', () => {
  for (const [path, expected] of [
    ['database/supabase/migrations/345_canonical_reel_review.sql', '5cd56d6edb16c8125d3c9368da345ac3a063b9fe727e9d9de9d54d3352f5a69d'],
    ['database/supabase/migrations/352_webhook_partition_shadow_parity.sql', 'f96d608c6ecfd9cd9e52101616c3efc38fc1d5e3804ab7281011312e58adc10a'],
    ['database/supabase/rollback/352_webhook_partition_shadow_parity.rollback.sql', '8d5810b57f197ec1c5867c52709f184565f02b8549e67248bc27610742f342dc'],
  ]) assert.equal(digest('sha256', source(path)), expected, path);
});

test('the retirement trust baseline contains all six exact typed function bodies from frozen 345', () => {
  const expected = [
    ['public.protect_reel_record_v1()', [], '6164422dd7400ef9681e3ac058f9ed9b'],
    ['public.reel_json_compact_v1(json)', ['p_value'], '0010259af51e8762637125afceb690a3'],
    ['public.reel_actor_v1(uuid,uuid,jsonb,boolean)', ['p_actor', 'p_site', 'p_console', 'p_write'], 'd99d69c697e36990561e8cfbb600d511'],
    ['public.reel_payload_v1(uuid,jsonb)', ['p_site', 'p_selection'], 'a0391dd81ec416922ce8c016c2b6460c'],
    ['public.mutate_reel_review_v1(uuid,uuid,uuid,jsonb,jsonb)', ['p_actor', 'p_site', 'p_reel', 'p_command', 'p_console'], 'b2c5009020c5993bc443250ea314e457'],
    ['public.read_reel_reviews_v1(uuid,uuid,uuid,jsonb,integer)', ['p_actor', 'p_site', 'p_reel', 'p_console', 'p_page'], '385edefbc18555e10b669430c3aaac02'],
  ];
  const statements = sqlStatements(forward);
  const actual = functionDefinitions(forward).map(definition => {
    const statement = statements.find(tokens => tokens[0]?.start === definition.start);
    const body = statement?.find(token => token.kind === 'body');
    assert.ok(body, definition.identity);
    return [definition.identity, definition.inputNames, digest('md5', body.value)];
  });
  assert.deepEqual(actual, expected);
});

test('the guarded rollback embeds the same independent frozen function authority and complete six-table profile', () => {
  const rollback = source('database/supabase/rollback/345_canonical_reel_review.rollback.sql');
  const embedded = rollback.match(/expected_profile jsonb := \$reel_frozen_profile\$([\s\S]*?)\$reel_frozen_profile\$::jsonb;/);
  assert.ok(embedded, 'a fixed reviewed profile is required; live metadata cannot approve its own destruction');
  const profile = JSON.parse(embedded[1]);
  const statements = sqlStatements(forward);
  const frozen = functionDefinitions(forward).map(definition => {
    const body = statements.find(tokens => tokens[0]?.start === definition.start)?.find(token => token.kind === 'body');
    assert.ok(body);
    return { signature: definition.identity.replace(/^public\./, ''), input_names: definition.inputNames, body_md5: digest('md5', body.value) };
  });
  const actual = profile.functions.map(({ signature, input_names, body_md5 }) => ({ signature, input_names, body_md5 }));
  assert.deepEqual(actual.sort((a, b) => a.signature.localeCompare(b.signature)), frozen.sort((a, b) => a.signature.localeCompare(b.signature)));
  assert.deepEqual(profile.tables.map(table => table.name).sort(), ['commerce_reel_events', 'commerce_reel_revisions', 'commerce_reels', 'reel_asset_provenance', 'reel_processing_receipts', 'reel_review_inspections']);
  for (const table of profile.tables) {
    assert.equal(table.owner, 'postgres'); assert.equal(table.rls, true); assert.equal(table.force_rls, true);
    assert.ok(table.columns.length > 0); assert.ok(table.constraints.length > 0); assert.ok(table.indexes.length > 0);
    assert.deepEqual(table.acl, ['postgres=arwdDxt/postgres']);
  }
  for (const fn of profile.functions) assert.match(fn.definition_md5, /^[a-f0-9]{32}$/);
  // Finite tokenizer must see one complete transaction rather than a truncated
  // dollar-quoted guard. This is parsing evidence, not PostgreSQL execution.
  const rollbackStatements = sqlStatements(rollback);
  assert.equal(rollbackStatements[0][0].value.toUpperCase(), 'BEGIN');
  assert.equal(rollbackStatements.at(-1)[0].value.toUpperCase(), 'COMMIT');
});

test('explicit private-table DDL preserves each reviewed closure, policy, index and immutable trigger', () => {
  const tables = ['reel_asset_provenance','reel_processing_receipts','commerce_reels','commerce_reel_revisions','commerce_reel_events','reel_review_inspections'];
  const statements = sqlStatements(forward);
  assert.equal(statements.filter(tokens => tokens[0]?.value === 'do').length, 0);
  for (const table of tables) {
    assert.ok(forward.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`));
    assert.ok(forward.includes(`ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY;`));
    assert.ok(forward.includes(`CREATE POLICY tenant_read ON public.${table} FOR SELECT TO app_tenant USING(site_id=public.current_site_id());`));
    assert.ok(forward.includes(`REVOKE ALL ON public.${table} FROM PUBLIC,anon,authenticated,app_tenant,service_role;`));
    assert.ok(forward.includes(`CREATE INDEX ${table}_site_page_idx ON public.${table}(site_id,created_at,id);`));
    assert.equal(forward.includes(`CREATE TRIGGER immutable_record BEFORE UPDATE OR DELETE ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.protect_reel_record_v1();`), table !== 'commerce_reels');
  }
});
