import {assertReviewedSourceHash} from './consolidation-source-review.mjs';
// PREPARED392. Requires Root admission + a newly owned cluster. Qualification
// enters exact391; future default-LATEST regression recognizes only admitted392
// and uses its strict DOWN before the same full tests, ending at exact392.
// Real RPC and mounted Worker/PostgREST; no developer/retained browser fixture.
// This proves internal service-role/application scope, not RLS or browser E2E.
import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { setImmediate as yieldToTransport } from 'node:timers/promises';
import { closePooledSqlClients } from '@letbuyy/infrastructure/pooled-sql-adapter';
import { StorefrontDiscoveryQuerySchema, StorefrontDiscoveryMetadataSchema, PRODUCT_NICHE_FACT_SCHEMAS, readElectronicsFacts } from '@letbuyy/commerce-core';
import { readStorefrontDiscoveryPayload } from '../../lib/storefront-discovery';
import { Gateway, gatewayEnv, newIdentityKeys, tapRest, type RestTap } from './gateway-harness';
import { requireOwnedDatabase, startOwnedPooledSqlProxy, type OwnedPooledSqlProxy } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant, type SyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase(), root = new URL('../../../../../', import.meta.url);
const docs = 'docs/implementation/niche-themes-2026-10-23/circuit/discovery/search392/';
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const evidence = JSON.parse(read(docs + 'source-evidence.json')) as {
    baseline390: { path: string; sha256: string; prosrcMd5: string }; proposedProsrcMd5: string;
    drafts: Array<{ path: string; sha256: string }>;
    validatorCases: { path: string; sha256: string };
};
const up = read(docs + '392_electronics_search.up.draft.sql'), down = read(docs + '392_electronics_search.down.draft.sql');
const signature = 'public.browse_storefront_products_v1(uuid,jsonb,uuid[])';
const proofDirectory = mkdtempSync(join(tmpdir(), `letbuyy-search392-${owned.runId}-`));
let proofSequence = 0;
let proofInputs: Record<string, string> = {};
// Evidence only: never serialize the harness/environment, headers or credentials.
// Every record belongs to this verified owned run and its actual source bytes.
function proof(operation: string, value: unknown) {
    const path = join(proofDirectory, String(++proofSequence).padStart(4, '0') + '-' + operation + '.json');
    const bytes = JSON.stringify({ runId: owned.runId, sequence: proofSequence, operation, inputs: proofInputs, value }, null, 2) + '\n';
    writeFileSync(path, bytes, { mode: 0o600, flag: 'wx' });
    const receipt = { path, sha256: sha(bytes) };
    console.info('SEARCH392_PROVENANCE', JSON.stringify(receipt));
    return receipt;
}
const q = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const json = (value: unknown) => q(JSON.stringify(value)) + '::jsonb';
const a = newSyntheticTenant('search392-a'), b = newSyntheticTenant('search392-b');
let gateway: Gateway, proxy: OwnedPooledSqlProxy, tap: RestTap, outage = false;
let originalCatalog: string, originalRows: string, unchangedQueries: unknown[];
const ids: Record<string, string> = {}, variants: Record<string, string> = {};
const rejectedModels: string[] = [], rejectedProducts: string[] = [], tieIds: string[] = [];
const hub = { kind: 'hub', manufacturer: 'Synthetic Lab', model: 'Synthetic H1', power_input_w: 65, power_output_w: 45,
    pass_through_output_w: 60, connectors: [{ kind: 'usb-c', role: 'power-input', count: 1 }, { kind: 'usb-c', role: 'power-output', count: 2 }, { kind: 'usb-a', role: 'data', count: 1 }] };
function product(tenant: SyntheticTenant, name: string, metadata: unknown, price = 1200, stock = 8, extra: { description?: string; tags?: string[] } = {}) {
    const id = randomUUID();
    owned.psql(`INSERT INTO products(id,site_id,store_id,name,slug,price,stock,is_active,status,category,country_of_origin,metadata,description,tags)
        VALUES(${q(id)},${q(tenant.siteId)},${q(tenant.siteId)},${q(name)},${q('syn-' + id)},${price},${stock},true,'active','Search392','India',${json(metadata)},${q(extra.description ?? '')},ARRAY[${(extra.tags ?? []).map(q).join(',')}]::text[]);`);
    return id;
}
function variant(productId: string, size: string, price: number, stock: number, metadata: unknown = {}) {
    const id = randomUUID();
    owned.psql(`INSERT INTO product_variants(id,product_id,title,price,inventory_qty,option1,metadata)
        VALUES(${q(id)},${q(productId)},${q('Synthetic ' + size)},${price},${stock},${q(size)},${json(metadata)});
        WITH _fixture_inventory_scope436 AS MATERIALIZED (SELECT set_config('app.site_id','${a.siteId}',true)) SELECT public.set_inventory_level_available(${q(productId)},${q(id)},${q(a.locationId)},${stock},NULL) FROM _fixture_inventory_scope436;`);
    return id;
}
function browse(query: Record<string, unknown> = {}, tenant = a, only?: string[]) {
    const parsed = StorefrontDiscoveryQuerySchema.parse(query);
    const raw: unknown = JSON.parse(owned.psql(`SELECT public.browse_storefront_products_v1(${q(tenant.siteId)},${json(parsed)},${only ? `ARRAY[${only.map(q)}]::uuid[]` : 'NULL'});`));
    proof('browse', { signature, tenantSiteId: tenant.siteId, query: parsed, productIds: only ?? null, raw });
    return { raw, ...readStorefrontDiscoveryPayload(raw, parsed) };
}
const found = (query: Record<string, unknown>, tenant = a, only?: string[]) => browse(query, tenant, only).data.map(row => row.id);
function hashBody() {
    const actual = owned.psql(`SELECT md5(prosrc) FROM pg_proc WHERE oid=${q(signature)}::regprocedure;`);
    proof('body', { signature, actual }); return actual;
}
function catalog() {
    const actual = owned.psql(`SELECT jsonb_agg(jsonb_build_object('row',to_jsonb(p),'comment',obj_description(p.oid,'pg_proc'),
        'dependencies',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text),'[]') FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid),
        'sharedDependencies',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text),'[]') FROM pg_shdepend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.dbid=(SELECT oid FROM pg_database WHERE datname=current_database()))) ORDER BY p.proname)
        FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND(p.proname LIKE 'storefront_discovery_%_v1' OR p.proname IN('browse_storefront_products_v1','browse_storefront_apparel_v1'));`);
    proof('catalog', JSON.parse(actual)); return actual;
}
function businessRows() {
    const actual = owned.psql(`SELECT jsonb_build_object(
        'products',(SELECT encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]')::text,'UTF8')),'hex') FROM products t),
        'variants',(SELECT encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]')::text,'UTF8')),'hex') FROM product_variants t),
        'options',(SELECT encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]')::text,'UTF8')),'hex') FROM product_options t),
        'inventory',(SELECT encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]')::text,'UTF8')),'hex') FROM inventory_levels t),
        'collections',(SELECT encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]')::text,'UTF8')),'hex') FROM collections t),
        'memberships',(SELECT encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t) ORDER BY collection_id,product_id),'[]')::text,'UTF8')),'hex') FROM collection_products t),
        'orders',(SELECT count(*) FROM orders),'carts',(SELECT count(*) FROM carts),
        'themes',(SELECT encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]')::text,'UTF8')),'hex') FROM themes t),
        'versions',(SELECT encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]')::text,'UTF8')),'hex') FROM theme_package_versions t));`);
    proof('business-rows', JSON.parse(actual)); return actual;
}
function roles() {
    for (const role of ['anon', 'authenticated', 'app_tenant', 'authenticator']) {
        const privilege = owned.psql(`SELECT has_function_privilege(${q(role)},${q(signature)},'EXECUTE');`);
        proof('role-privilege', { role, signature, privilege }); assert.equal(privilege, 'f', role);
        const error = owned.psqlExpectError(`SET ROLE ${role};SELECT public.browse_storefront_products_v1(${q(a.siteId)});`);
        proof('role-denial', { role, signature, error }); assert.match(error, /permission denied/);
    }
    const query = json(StorefrontDiscoveryQuerySchema.parse({ search: 'Circuit lifecycle hub' }));
    assert.equal(owned.psql(`BEGIN;SET LOCAL ROLE service_role;SELECT public.browse_storefront_products_v1(${q(a.siteId)},${query})->>'count';ROLLBACK;`).split('\n').find(line => line === '1'), '1');
}
function refuses(script: string) {
    const before = catalog(), rows = businessRows();
    const entry = proof('refusal-before', { scriptSha256: sha(script), catalog: JSON.parse(before), businessRows: JSON.parse(rows) });
    const error = owned.psqlScriptExpectError(script);
    proof('refusal-error', { entry, scriptSha256: sha(script), error });
    assert.match(error, /discovery function profile changed|DRAFT392 refuses/);
    assert.equal(catalog(), before); assert.equal(businessRows(), rows);
    proof('refusal-conserved', { entry, scriptSha256: sha(script) });
}
function executeDdl(ddl: string) { owned.psql(`DO $restore$ BEGIN EXECUTE $replacement$${ddl}$replacement$;END $restore$;`); }
function admissionMutants(script: string, currentDdl: string) {
    roles(); const before = catalog();
    try { owned.psql(`GRANT EXECUTE ON FUNCTION ${signature} TO anon;`); refuses(script); }
    finally { owned.psql(`REVOKE EXECUTE ON FUNCTION ${signature} FROM anon;`); }
    assert.equal(catalog(), before);
    try { owned.psql(`ALTER FUNCTION ${signature} COST 101;`); refuses(script); }
    finally { owned.psql(`ALTER FUNCTION ${signature} COST 100;`); }
    assert.equal(catalog(), before);
    // Same defaults/body, different parse locations: raw default AST drift must
    // fail atomically rather than silently normalizing a poisoned profile.
    try { executeDdl('\n' + currentDdl); refuses(script); }
    finally { executeDdl(currentDdl); }
    assert.equal(catalog(), before);
    const originalAcl = owned.psql(`SELECT proacl::text FROM pg_proc WHERE oid=${q(signature)}::regprocedure;`);
    try {
        owned.psql(`UPDATE pg_proc p SET proacl=(SELECT array_agg(makeaclitem(a.grantee,CASE WHEN a.grantee='service_role'::regrole THEN 'anon'::regrole::oid ELSE a.grantor END,a.privilege_type,a.is_grantable) ORDER BY a.grantee,a.grantor) FROM aclexplode(p.proacl) a) WHERE p.oid=${q(signature)}::regprocedure;`);
        refuses(script);
    } finally { owned.psql(`UPDATE pg_proc SET proacl=${q(originalAcl)}::aclitem[] WHERE oid=${q(signature)}::regprocedure;`); }
    assert.equal(catalog(), before);
    type Edge = { roleid: string; member: string; grantor: string; admin_option: boolean; inherit_option: boolean; set_option: boolean };
    const edges = (group: string, member: string) => {
        const actual = JSON.parse(owned.psql(`SELECT coalesce(jsonb_agg(jsonb_build_object('roleid',r.rolname,'member',u.rolname,'grantor',m.grantor,'admin_option',m.admin_option,'inherit_option',m.inherit_option,'set_option',m.set_option)),'[]') FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid JOIN pg_roles u ON u.oid=m.member WHERE r.rolname=${q(group)} AND u.rolname=${q(member)};`)) as Edge[];
        proof('role-edges', { group, member, actual }); return actual;
    };
    const reverse = edges('app_tenant', 'service_role'), existing = edges('service_role', 'app_tenant');
    assert.equal(existing.length, 0, 'baseline cannot already grant the protected role in reverse');
    for (const row of reverse) assert.equal(owned.psql(`SELECT ${row.grantor}=(SELECT oid FROM pg_roles WHERE rolname=current_user);`), 't');
    try {
        if (reverse.length) owned.psql('REVOKE app_tenant FROM service_role;');
        owned.psql('GRANT service_role TO app_tenant WITH INHERIT TRUE;');
        const inheritedPrivilege = owned.psql(`SELECT has_function_privilege('app_tenant',${q(signature)},'EXECUTE');`);
        proof('inherited-privilege-mutant', { role: 'app_tenant', signature, privilege: inheritedPrivilege });
        assert.equal(inheritedPrivilege, 't');
        refuses(script);
    } finally {
        owned.psql('REVOKE service_role FROM app_tenant;');
        for (const row of reverse) owned.psql(`GRANT app_tenant TO service_role WITH ADMIN ${row.admin_option ? 'TRUE' : 'FALSE'}, INHERIT ${row.inherit_option ? 'TRUE' : 'FALSE'}, SET ${row.set_option ? 'TRUE' : 'FALSE'};`);
    }
    assert.deepEqual(edges('app_tenant', 'service_role'), reverse); assert.deepEqual(edges('service_role', 'app_tenant'), existing);
    roles(); assert.equal(catalog(), before);
}
const baselineDdl = read(evidence.baseline390.path).match(/EXECUTE \$replacement\$([\s\S]+?)\$replacement\$;/)![1];
const nextDdl = up.match(/EXECUTE \$replacement\$([\s\S]+?)\$replacement\$;/)![1];
const parityQueries: Array<Record<string, unknown>> = [];
before(async () => {
    // Root writes this concrete record after391 emission and exact392 review.
    // Missing/pending admission fails, with no native mutation or silent ceiling.
    const admission = JSON.parse(read(docs + 'admission.json')) as { status: string; upSha256: string; downSha256: string;
        predecessor391: { upPath: string; downPath: string; upSha256: string; downSha256: string; functionSignature: string; prosrcMd5: string } };
    assert.equal(admission.status, 'ROOT_ACCEPTED_FOR_OWNED_NATIVE_QUALIFICATION');
    assert.equal(sha(up), admission.upSha256); assert.equal(sha(down), admission.downSha256);
    proofInputs = {
        suiteSha256: sha(readFileSync(new URL(import.meta.url), 'utf8')), upSha256: sha(up), downSha256: sha(down),
        admissionSha256: sha(read(docs + 'admission.json')), validatorCasesSha256: sha(read(docs + evidence.validatorCases.path)),
        predecessor391UpSha256: sha(read(admission.predecessor391.upPath)), predecessor391DownSha256: sha(read(admission.predecessor391.downPath)),
    };
    assert.match(admission.predecessor391.upPath, /^database\/supabase\/migrations\/391_[^/]+\.sql$/);
    assert.match(admission.predecessor391.downPath, /^database\/supabase\/rollback\/391_[^/]+\.sql$/);
    assert.equal(sha(read(admission.predecessor391.upPath)), admission.predecessor391.upSha256);
    assertReviewedSourceHash(admission.predecessor391.downPath,sha(read(admission.predecessor391.downPath)),admission.predecessor391.downSha256);
    assert.match(admission.predecessor391.prosrcMd5, /^[a-f0-9]{32}$/);
    const actualPredecessor391Body = owned.psql(`SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure(${q(admission.predecessor391.functionSignature)});`);
    proof('predecessor391', { signature: admission.predecessor391.functionSignature, actualBody: actualPredecessor391Body });
    assert.equal(actualPredecessor391Body, admission.predecessor391.prosrcMd5, 'actual emitted391 function must be present');
    assertReviewedSourceHash(evidence.baseline390.path,sha(read(evidence.baseline390.path)),evidence.baseline390.sha256);
    for (const row of evidence.drafts) assert.equal(sha(read(docs + row.path)), row.sha256);
    assert.equal(sha(read(docs + evidence.validatorCases.path)), evidence.validatorCases.sha256);
    const entryBody = hashBody();
    proof('entry', { entryBody, signature, predecessor391: admission.predecessor391 });
    assert([evidence.baseline390.prosrcMd5, evidence.proposedProsrcMd5].includes(entryBody), 'unknown latest body refuses before DDL');
    if (entryBody === evidence.proposedProsrcMd5) {
        const rows = businessRows(); owned.script(down);
        assert.equal(businessRows(), rows, 'default-LATEST strict392 DOWN conserves all existing rows');
    }
    assert.equal(hashBody(), evidence.baseline390.prosrcMd5, 'exact390 body is the qualified search baseline;391 is a different function');
    seedSyntheticTenant(owned.psql, a); seedSyntheticTenant(owned.psql, b);
    assert(PRODUCT_NICHE_FACT_SCHEMAS.electronics.safeParse(hub).success);
    ids.hub = product(a, 'Circuit lifecycle hub', { electronics: hub });
    ids.foreign = product(b, 'Circuit foreign hub', { electronics: hub });
    ids.unicode = product(a, 'Separate accessory', { electronics: { ...hub, model: 'नमूना H‑1 Δ', connectors: [{ kind: 'hdmi', role: 'video', count: 1 }] } }, 400);
    ids.hyphen = product(a, 'Hyphen accessory', { electronics: { kind: 'other', model: 'MODEL-X-2', connectors: [] } });
    ids.noFacts = product(a, 'Unknown accessory', {});
    ids.noModel = product(a, 'Connector-only accessory', { electronics: { kind: 'other', connectors: [{ kind: 'sd', role: 'card-reader', count: 1 }] } });
    ids.malformed = product(a, 'Malformed accessory', { electronics: { ...hub, model: 'POISON-ONE', connectors: 'bad' }, private: 'PRIVATE-OUTER-TERM' });
    ids.impossible = product(a, 'Impossible accessory', { electronics: { ...hub, model: 'POISON-TWO', pass_through_output_w: 66 } });
    ids.unknown = product(a, 'Unknown shape accessory', { electronics: { ...hub, model: 'POISON-THREE', private_key: 'PRIVATE-NAMESPACE-TERM' } });
    ids.coerced = product(a, 'Numeric model accessory', { electronics: { ...hub, model: 987654321 } });
    const invalidConnectors = JSON.parse(read(docs + evidence.validatorCases.path)) as Array<{ label: string; connectors: unknown }>;
    assert.equal(invalidConnectors.length, 11);
    for (const [index, row] of invalidConnectors.entries()) {
        const model = 'REJECTED-CONNECTOR-MODEL-' + index, facts = { ...hub, model, connectors: row.connectors };
        assert.equal(PRODUCT_NICHE_FACT_SCHEMAS.electronics.safeParse(facts).success, false, 'canonical invalid connector fixture ' + index);
        assert.equal(owned.psql(`SELECT public.storefront_discovery_facts_valid_v1(${json(facts)},'electronics',false);`), 'f');
        rejectedModels.push(model); rejectedProducts.push(product(a, 'Rejected connector accessory ' + index, { electronics: facts }));
    }
    ids.inactive = product(a, 'Inactive accessory', { electronics: hub });
    ids.deleted = product(a, 'Deleted accessory', { electronics: hub });
    owned.psql(`UPDATE products SET is_active=false WHERE id=${q(ids.inactive)};UPDATE products SET deleted_at=now() WHERE id=${q(ids.deleted)};`);
    ids.sold = product(a, 'Sold accessory', { electronics: { ...hub, model: 'SOLD-MODEL' } }, 100, 0);
    ids.variant = product(a, 'Variant accessory', { electronics: { ...hub, model: 'VARIANT-COMMON' } }, 2000);
    owned.psql(`INSERT INTO product_options(product_id,name,position,values)VALUES(${q(ids.variant)},'Size',0,'["M","L","S"]');`);
    variants.m = variant(ids.variant, 'M', 1900, 3); variants.l = variant(ids.variant, 'L', 700, 0);
    variants.s = variant(ids.variant, 'S', 1300, 2);
    const beforeUnsupportedVariant = businessRows();
    const unsupportedVariantError = owned.psqlExpectError(`UPDATE public.product_variants SET metadata=${json({ electronics: { kind: 'hub', model: 'UNSUPPORTED-VARIANT-MODEL' } })} WHERE id=${q(variants.s)};`);
    proof('unsupported-variant-persistence-denial', { constraint: 'product_variants_metadata_envelope', error: unsupportedVariantError, beforeBusinessRows: JSON.parse(beforeUnsupportedVariant), classification: 'Persistence denial, not a stored legacy override read proof' });
    assert.match(unsupportedVariantError, /product_variants_metadata_envelope/);
    assert.equal(businessRows(), beforeUnsupportedVariant);
    ids.onlySold = product(a, 'Only sold variant accessory', { electronics: { kind: 'other', model: 'RELATIONAL-UNAVAILABLE', connectors: [{ kind: 'displayport', role: 'video', count: 1 }] } }, 2000, 999);
    owned.psql(`INSERT INTO product_options(product_id,name,position,values)VALUES(${q(ids.onlySold)},'Size',0,'["M"]');`);
    variants.onlySold = variant(ids.onlySold, 'M', 100, 0);
    for (let i = 0; i < 3; i++) tieIds.push(product(a, 'Same display name', { electronics: { kind: 'other', model: 'TIE-MODEL', connectors: [] } }, 450));
    tieIds.sort();
    ids.collection = randomUUID(); ids.empty = randomUUID(); ids.inactiveCollection = randomUUID();
    owned.psql(`INSERT INTO collections(id,store_id,title,is_active)VALUES(${q(ids.collection)},${q(a.siteId)},'Scoped electronics',true),(${q(ids.empty)},${q(a.siteId)},'Known empty',true),(${q(ids.inactiveCollection)},${q(a.siteId)},'Inactive collection',false);
        INSERT INTO collection_products(collection_id,product_id,position)VALUES(${q(ids.collection)},${q(ids.hub)},0),(${q(ids.inactiveCollection)},${q(ids.hub)},0);`);
    const oldFacts = {
        electronics: { kind: 'other', model: 'LEGACY-EXACT-MODEL', connectors: [] },
        toys: { ageBands: ['6-8'], interests: ['art'] }, food: { netQuantity: { value: 250, unit: 'g' } },
        furniture: { assembled: { width: 61, depth: 76.2, unit: 'cm' }, materials: ['Wood'], finish: 'Natural' },
        gifts: { occasions: ['birthday'], recipients: ['friend'] },
        personalization: { version: 1, revision: 1, methods: [{ id: 'engrave', label: 'Engrave', min_graphemes: 1, max_graphemes: 12, character_set: 'latin-name', styles: [{ id: 'sans', label: 'Sans' }], placements: [{ id: 'front', label: 'Front' }] }] },
        beauty: { routineStage: 'care', format: 'Cream' }, sports: { activity: 'badminton', equipmentType: 'racket', length: { value: 67.5, unit: 'cm' } },
        books: { kind: 'book', authors: ['LegacyAuthorOnly'], subjects: ['Fiction'], language: 'English', format: 'paperback' },
    };
    for (const [namespace, facts] of Object.entries(oldFacts)) {
        assert(PRODUCT_NICHE_FACT_SCHEMAS[namespace as keyof typeof PRODUCT_NICHE_FACT_SCHEMAS].safeParse(facts).success, namespace);
        product(a, 'LegacyName-' + namespace, { [namespace]: facts }, 999, 5, { description: 'LegacyDescription-' + namespace, tags: ['LegacyTag-' + namespace] });
        parityQueries.push({ search: 'LegacyName-' + namespace }, { search: 'LegacyDescription-' + namespace }, { search: 'LegacyTag-' + namespace });
    }
    parityQueries.push({ search: 'LegacyAuthorOnly' }, { pack_size: 'g:250' }, { age_band: '6-8', interest: 'art' },
        { max_width_cm: 61, max_depth_cm: 76.2, material: 'Wood' }, { length_value: 675, length_unit: 'mm' }, { routine_stage: 'care', format: 'Cream' },
        { occasion: 'birthday', recipient: 'friend' }, { personalization_method: 'engrave' }, { books_author: 'LegacyAuthorOnly', books_language: 'English' },
        {}, { sort: 'price-asc', limit: 2, page: 2 }, { search: 'LegacyName', sort: 'price-desc', limit: 2 }, { connector: ['usb-c', 'hdmi'] });
    unchangedQueries = parityQueries.map(query => browse(query).raw);
    originalCatalog = catalog(); originalRows = businessRows();
    assert.deepEqual(found({ search: 'Circuit lifecycle hub' }), [ids.hub]);
    assert.deepEqual(found({ search: 'Synthetic H1' }), [], 'actual390 model miss must reproduce before fix');
    assert.deepEqual(found({ search: 'usb-c' }), [], 'connector text is not seeded in titles/descriptions/tags');
    admissionMutants(up, baselineDdl); assert.equal(catalog(), originalCatalog);
    owned.script(up); assert.equal(hashBody(), evidence.proposedProsrcMd5); assert.equal(businessRows(), originalRows);
    proxy = await startOwnedPooledSqlProxy(owned); gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys(), proxy.env()));
    tap = tapRest(owned.restUrl, async (call, forward) => outage && call.resource === 'rpc/browse_storefront_products_v1'
        ? Response.json({ message: 'PRIVATE-SEARCH392-DB-FAULT', code: 'XX392' }, { status: 500 }) : forward());
});
after(async () => { await gateway?.settle(); tap?.restore(); await closePooledSqlClients(); await proxy?.stop(); proof('suite-after', { completedEvidenceSequence: proofSequence }); });

test('model-only and positive-supplied connector kinds use actual validated common facts, including case/hyphen/Unicode', () => {
    assert.deepEqual(found({ search: 'Synthetic H1' }), [ids.hub]);
    assert.deepEqual(found({ search: 'synthetic h1' }), [ids.hub]);
    assert.deepEqual(found({ search: 'नमूना H‑1 Δ' }), [ids.unicode]);
    assert.deepEqual(found({ search: 'model-x-2' }), [ids.hyphen]);
    assert.deepEqual(found({ search: 'hdmi' }), [ids.unicode]); assert.deepEqual(found({ search: 'sd' }), [ids.noModel]);
    assert(found({ search: 'USB-C' }).includes(ids.hub));
    assert.deepEqual(found({ search: 'Circuit lifecycle hub' }), [ids.hub]);
});
test('missing/malformed facts, private/raw JSON, role keys and unsupported electronics overrides never become search authority', () => {
    for (const term of ['POISON-ONE', 'POISON-TWO', 'POISON-THREE', '987654321', 'PRIVATE-OUTER-TERM', 'PRIVATE-NAMESPACE-TERM', 'UNSUPPORTED-VARIANT-MODEL', 'PRIVATE-CONNECTOR', 'power-input', 'power_output_w', 'USB C', 'usb_c', 'Type-C', 'unknown-connector', "' OR true --", 'MODEL_%_X', ...rejectedModels]) assert.deepEqual(found({ search: term }), [], term);
    assert(!found({ search: 'usb-c' }).includes(ids.noFacts)); assert(!found({ search: 'usb-c' }).includes(ids.malformed));
    const connectorMatches = found({ search: 'usb-c' }); for (const id of rejectedProducts) assert(!connectorMatches.includes(id), 'malformed whole namespace contributes no connector witness');
    assert.deepEqual(found({ search: 'Malformed accessory' }), [ids.malformed], 'existing name search must not be removed for legacy invalid facts');
});
test('search composes exact tenant/collection/ID scope and known-empty never broadens', () => {
    assert.deepEqual(found({ search: 'Synthetic H1' }, b), [ids.foreign]);
    assert.deepEqual(found({ search: 'Synthetic H1', collection_id: ids.collection }), [ids.hub]);
    assert.deepEqual(found({ search: 'Synthetic H1', collection_id: ids.collection }, b), []);
    assert.deepEqual(found({ search: 'Synthetic H1', collection_id: ids.empty }), []);
    assert.deepEqual(found({ search: 'Synthetic H1', collection_id: ids.inactiveCollection }), []);
    assert.deepEqual(found({ search: 'Synthetic H1' }, a, [ids.foreign]), []);
});
test('available variant witnesses/price/options remain conjunctive and sold-only search invents no available variant', () => {
    assert.equal(browse({ search: 'VARIANT-COMMON', size: 'L', max_price: 1500 }).count, 0);
    assert.equal(browse({ search: 'VARIANT-COMMON', size: 'M', max_price: 1500 }).count, 0);
    const actual = browse({ search: 'VARIANT-COMMON', size: 'M', max_price: 2000 });
    assert.equal(actual.data[0].price, 2000); assert.deepEqual(actual.discovery.matches, [{ product_id: ids.variant, price: 1900, variant_ids: [variants.m] }]);
    const sold = browse({ search: 'SOLD-MODEL' }); assert.equal(sold.count, 1); assert.deepEqual(sold.discovery.matches[0].variant_ids, []);
    assert.equal(browse({ search: 'SOLD-MODEL', connector: 'usb-c' }).count, 0);
    const onlySold = browse({ search: 'RELATIONAL-UNAVAILABLE' }); assert.equal(onlySold.count, 1); assert.deepEqual(onlySold.discovery.matches[0].variant_ids, []);
    assert.equal(browse({ search: 'RELATIONAL-UNAVAILABLE', connector: 'displayport' }).count, 0, 'parent stock999 cannot fill an OOS relational variant');
});
test('all original domains keep exact search/filter results, measurement capabilities and stable sort/page/count/facet metadata', () => {
    assert.deepEqual(parityQueries.map(query => browse(query).raw), unchangedQueries);
    const one = browse({ search: 'usb-c', sort: 'price-asc', limit: 1 }), two = browse({ search: 'usb-c', sort: 'price-asc', limit: 1, page: 2 });
    assert.equal(one.count, 3); assert.equal(two.count, 3); assert.equal(one.data[0].id, ids.sold); assert.equal(two.data[0].id, ids.hub);
    assert.equal(one.discovery.facets.find(row => row.key === 'connector' && row.value === 'usb-c')?.count, 2, 'only available product witnesses contribute facets');
    StorefrontDiscoveryMetadataSchema.parse(one.discovery);
    const first = browse({ search: 'TIE-MODEL', sort: 'price-asc', limit: 2 }), second = browse({ search: 'TIE-MODEL', sort: 'price-asc', limit: 2, page: 2 }), past = browse({ search: 'TIE-MODEL', sort: 'price-asc', limit: 2, page: 10000 });
    assert.deepEqual(first.data.map(row => row.id), tieIds.slice(0, 2)); assert.deepEqual(second.data.map(row => row.id), tieIds.slice(2)); assert.deepEqual(past.data, []);
    for (const page of [first, second, past]) assert.equal(page.count, 3, 'past-end page retains server total');
});
test('actual mounted public worker returns canonical model matches and rejects unsupported filters without error leakage', async () => {
    const request = async (path: string) => {
        await yieldToTransport(); const result = await gateway.request(path); await gateway.settle();
        proof('public-http', { path, status: result.status, requestId: result.headers.get('x-request-id'), json: result.json, text: result.text });
        return result;
    };
    for (const path of [`/v1/storefront/${a.subdomain}/products?search=Synthetic%20H1`, `/v1/storefront/store/${a.siteId}/products?search=Synthetic%20H1`]) {
        const response = await request(path); assert.equal(response.status, 200, response.text);
        assert.deepEqual(response.json?.data.map((row: { id: string }) => row.id), [ids.hub]);
        assert.equal(response.json?.meta.total, 1); StorefrontDiscoveryMetadataSchema.parse(response.json?.discovery);
        assert.equal(readElectronicsFacts(response.json?.data[0].metadata)?.model, 'Synthetic H1');
    }
    const invalid = await request(`/v1/storefront/${a.subdomain}/products?connector_role=power-input`); assert.equal(invalid.status, 400);
    outage = true; try { const failed = await request(`/v1/storefront/${a.subdomain}/products?search=UncachedFault392`); assert.equal(failed.status, 500); assert.doesNotMatch(failed.text, /XX392|PRIVATE-SEARCH392/); } finally { outage = false; }
});
test('finite owned query executes within its bounded budget without claiming production load qualification', () => {
    const query = StorefrontDiscoveryQuerySchema.parse({ search: 'Synthetic H1', limit: 10 });
    const plan = JSON.parse(owned.psql(`EXPLAIN(ANALYZE,FORMAT JSON) SELECT public.browse_storefront_products_v1(${q(a.siteId)},${json(query)});`)) as Array<Record<string, unknown>>;
    proof('finite-explain', { query, plan });
    const elapsed = plan[0]['Execution Time']; assert.equal(typeof elapsed, 'number');
    assert(Number.isFinite(elapsed) && Number(elapsed) >= 0 && Number(elapsed) < 5000, 'bounded native fixture execution');
    console.info('SEARCH392_OWNED_PERF', JSON.stringify({ executionMs: elapsed, budgetMs: 5000, scope: 'finite owned fixture only; not production/load acceptance' }));
});
test('strict DOWN admission and UP→DOWN→UP conserve data, exact390 profile and all helper catalog rows', () => {
    roles(); admissionMutants(down, nextDdl);
    const nextCatalog = catalog(); const nextRows = businessRows(); assert.equal(nextRows, originalRows);
    owned.script(down); assert.equal(hashBody(), evidence.baseline390.prosrcMd5); assert.equal(catalog(), originalCatalog); assert.equal(businessRows(), originalRows);
    assert.deepEqual(found({ search: 'Synthetic H1' }), []); assert.deepEqual(found({ search: 'Circuit lifecycle hub' }), [ids.hub]);
    assert.deepEqual(parityQueries.map(query => browse(query).raw), unchangedQueries);
    owned.script(up); assert.equal(hashBody(), evidence.proposedProsrcMd5); assert.equal(catalog(), nextCatalog); assert.equal(businessRows(), nextRows);
    assert.deepEqual(found({ search: 'Synthetic H1' }), [ids.hub]);
});
