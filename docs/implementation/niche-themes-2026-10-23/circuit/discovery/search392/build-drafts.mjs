// Source preparation only. Emitted SQL is standalone and requires no app artifact.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../../../../../../', import.meta.url), out = new URL('./', import.meta.url);
const path = 'database/supabase/migrations/390_storefront_measurement_capabilities.sql';
const original = readFileSync(new URL(path, root), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const md5 = value => createHash('md5').update(value).digest('hex');
assert.equal(sha(original), '6e5eb5e50cecd43acc9a663dd79c505db6c7bfdbe4e559b34d998065f88e9027');
const profileBlocks = [...original.matchAll(/DO \$profile\$[\s\S]*?END \$profile\$;/g)].map(match => match[0]);
assert.equal(profileBlocks.length, 2);
const currentProfile = profileBlocks[1];
const replacement = original.match(/EXECUTE \$replacement\$([\s\S]+?)\$replacement\$;/)?.[1];
assert.ok(replacement);
const oldBody = replacement.split('$fn$')[1];
assert.equal(md5(oldBody), '95cda4d15f36172c5457ad5045600cde');
const search = "concat_ws(' ',c.name,c.description,c.tags::text,c.facts->'books_author'::text)";
assert.equal(oldBody.split(search).length, 2);
const expandedSearch = `concat_ws(' ',c.name,c.description,c.tags::text,c.facts->'books_author'::text,
    -- Only the canonical validated common electronics namespace contributes.
    -- Electronics variant overrides are unsupported. Never search raw JSON or
    -- invent an available variant witness for a supplied model/connector term.
    CASE WHEN public.storefront_discovery_facts_valid_v1(c.product#>'{metadata,electronics}','electronics',false)
     THEN concat_ws(' ',c.product#>>'{metadata,electronics,model}',
      (SELECT string_agg(connector->>'kind',' ' ORDER BY ordinal)
       FROM jsonb_array_elements(coalesce(c.product#>'{metadata,electronics,connectors}','[]'::jsonb))
        WITH ORDINALITY AS supplied(connector,ordinal)))
     ELSE NULL END)`;
const newBody = oldBody.replace(search, expandedSearch), newDdl = replacement.replace(oldBody, newBody);
const nextMd5 = md5(newBody);
const nextProfile = currentProfile.replaceAll('95cda4d15f36172c5457ad5045600cde', nextMd5);
assert.notEqual(nextProfile, currentProfile);
const prefix = original.slice(0, original.indexOf(profileBlocks[0]))
    .replace('-- DRAFT390 UP: DOCUMENTATION ONLY; not applied or promoted.', '-- DRAFT392: DOCUMENTATION ONLY; not applied or promoted.')
    .replace('-- Extends the existing browse RPC result; no table/helper/RLS/ACL mutations.', '-- Completes validated model/connector keyword search in the existing RPC; no wire/table/helper/RLS/ACL changes.')
    .replace('migration390:measurement-discovery', 'migration392:electronics-keyword-search');
const mutation = original.match(/DO \$mutation\$[\s\S]*?END \$mutation\$;/)?.[0];
assert.ok(mutation);
const emit = (before, after, ddl) => prefix + before + '\n' + mutation
    .replace(replacement, ddl).replaceAll('DRAFT390', 'DRAFT392') + '\n\n' + after + "\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n";
const up = emit(currentProfile, nextProfile, newDdl), down = emit(nextProfile, currentProfile, replacement);
writeFileSync(new URL('392_electronics_search.up.draft.sql', out), up);
writeFileSync(new URL('392_electronics_search.down.draft.sql', out), down);
writeFileSync(new URL('source-evidence.json', out), JSON.stringify({
    classification: 'PREPARED_NOT_NATIVE_QUALIFIED_NOT_EMITTED_OR_APPLIED',
    defect: 'CIRCUIT-SEARCH-MODEL-001',
    baseline390: { path, sha256: sha(original), prosrcMd5: md5(oldBody) },
    function: 'public.browse_storefront_products_v1(uuid,jsonb,uuid[])',
    proposedProsrcMd5: nextMd5,
    validatorCases: { path: 'validator-cases.json', sha256: sha(readFileSync(new URL('validator-cases.json', out), 'utf8')) },
    drafts: [{ path: '392_electronics_search.up.draft.sql', sha256: sha(up) }, { path: '392_electronics_search.down.draft.sql', sha256: sha(down) }],
    changedScope: 'One existing search concat expression; validated supplied model and connector kind only. Original name/description/tags/books_author predicate remains intact.',
    prerequisites: '391 paired emission and Root exact native admission/lease before any392 application; no current9cd apply.',
    unchanged: ['RPC signature/query/wire shape', 'matching candidate availability', 'variant witness semantics', 'facets/sort/page/count', '390 measurement capability expression', 'all other helper bodies', 'OID/owner/raw ACL/default AST/roles/dependencies/provider fence', 'all v2 theme artifact bytes'],
}, null, 2) + '\n');
process.stdout.write(JSON.stringify({ upSha256: sha(up), downSha256: sha(down), baselineMd5: md5(oldBody), proposedMd5: nextMd5, nativeExecuted: false }) + '\n');
