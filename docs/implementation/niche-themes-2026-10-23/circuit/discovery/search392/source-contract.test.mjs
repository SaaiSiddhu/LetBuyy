import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../../../../../../', import.meta.url), here = new URL('./', import.meta.url);
const read = path => readFileSync(new URL(path, here), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const md5 = value => createHash('md5').update(value).digest('hex');
const evidence = JSON.parse(read('source-evidence.json'));
const baseline = readFileSync(new URL(evidence.baseline390.path, root), 'utf8');
const up = read('392_electronics_search.up.draft.sql'), down = read('392_electronics_search.down.draft.sql');
const ddl = sql => sql.match(/EXECUTE \$replacement\$([\s\S]+?)\$replacement\$;/)?.[1];
const body = sql => ddl(sql)?.split('$fn$')[1];
test('both standalone drafts are pinned to the exact qualified390 body and inverse replacement', () => {
    assert.equal(sha(baseline), evidence.baseline390.sha256);
    assert.equal(md5(body(baseline)), evidence.baseline390.prosrcMd5);
    assert.equal(md5(body(up)), evidence.proposedProsrcMd5);
    assert.equal(ddl(down), ddl(baseline));
    for (const row of evidence.drafts) assert.equal(sha(read(row.path)), row.sha256);
    assert.equal(ddl(up).split('AS $fn$')[0], ddl(baseline).split('AS $fn$')[0], 'default-expression parse positions and declaration remain identical');
});
test('only the existing search expression expands; capabilities, candidate witnesses and output ABI are byte preserved', () => {
    const before = body(baseline), after = body(up);
    const start = "concat_ws(' ',c.name,c.description,c.tags::text,c.facts->'books_author'::text)";
    const changed = after.match(/concat_ws\(' ',c.name,c.description,c.tags::text,c.facts->'books_author'::text,[\s\S]+?ELSE NULL END\)/)?.[0];
    assert.ok(changed); assert.equal(after.replace(changed, start), before);
    assert.match(changed, /storefront_discovery_facts_valid_v1\(c.product#>'\{metadata,electronics\}','electronics',false\)/);
    assert.match(changed, /metadata,electronics,model/); assert.match(changed, /connector->>'kind'/);
    assert.doesNotMatch(changed, /variant.*metadata|::text\).*metadata|manufacturer|setweight|to_tsvector|ILIKE|regexp_replace/);
});
test('strict entry/exit profile, managed catalog fence and nonbody/OID/ACL/default/dependency conservation guards remain on both legs', () => {
    for (const sql of [up, down]) {
        assert.equal((sql.match(/DO \$profile\$/g) ?? []).length, 2);
        for (const text of ['LETBUYY_PROVIDER_ADMIN_CATALOG_FENCE_REQUIRED', 'LETBUYY_NATIVE_CATALOG_LOCKS_REQUIRED', 'p.pronargdefaults', 'p.prosupport', 'p.procost', 'p.proowner', 'p.proargnames', 'p.proconfig', 'a.grantor', 'a.is_grantable', "to_jsonb(before_row)-'prosrc'", 'before_dependencies', 'before_shared_dependencies', "obj_description(after_row.oid,'pg_proc')"]) assert.ok(sql.includes(text), text);
        assert.match(sql, /SECURITY INVOKER/); assert.match(sql, /search_path=pg_catalog,public/);
        assert.doesNotMatch(sql, /\b(?:GRANT|REVOKE|DROP|CREATE TABLE|CREATE INDEX|ALTER TABLE)\b/);
    }
    assert.ok(up.indexOf(evidence.baseline390.prosrcMd5) < up.indexOf('DO $mutation$'));
    assert.ok(down.indexOf(evidence.proposedProsrcMd5) < down.indexOf('DO $mutation$'));
});
