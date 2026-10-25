import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { StorefrontDiscoveryQuerySchema, StorefrontDiscoveryMetadataSchema, normalizeDiscoveryLengthMm, storefrontDiscoverySchemaSnapshot, storefrontDiscoveryUrl } from '../../../../packages/commerce-core/src/storefront-discovery';
import { SportsFactsSchema, SportsVariantFactsSchema, resolveSportsMeasurements } from '../../../../packages/commerce-core/src/trailmark-facts';
import { FurnitureFactsSchema, resolveFurnitureFacts, furnitureLengthMm } from '../../../../packages/commerce-core/src/habitat-facts';
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const up = read('./390_measurement_discovery.up.draft.sql');
const down = read('./390_measurement_discovery.down.draft.sql');
const source = read('../../../../database/supabase/migrations/386_storefront_discovery.sql');
const evidence = JSON.parse(read('./source-evidence.json'));
const definition = (text: string) => text.match(/CREATE OR REPLACE FUNCTION public\.browse_storefront_products_v1\([\s\S]*?END \$fn\$;/)![0];
const bodyHash = (text: string) => createHash('md5').update(definition(text).split('$fn$')[1]).digest('hex');

test('proposal unit domain and upper bound match the actual canonical query contract', () => {
 const schema = storefrontDiscoverySchemaSnapshot().query as { properties: { length_unit: { enum: string[] }; length_value: { maximum: number } } };
 assert.deepEqual(schema.properties.length_unit.enum, ['mm','cm','m','in']);
 assert.equal(schema.properties.length_value.maximum,100000);
 for (const unit of schema.properties.length_unit.enum) assert(StorefrontDiscoveryQuerySchema.safeParse({length_value:1,length_unit:unit}).success);
 for (const unit of ['ft','CM','inch']) assert(!StorefrontDiscoveryQuerySchema.safeParse({length_value:1,length_unit:unit}).success);
});

test('canonical cm, mm, m and inch equivalents normalize without source-unit facets', () => {
 for (const [value,unit] of [[254,'mm'],[25.4,'cm'],[0.254,'m'],[10,'in']] as const) assert.equal(normalizeDiscoveryLengthMm(value,unit),254);
 assert.equal(normalizeDiscoveryLengthMm(25.401,'cm'),254.01);
 assert.equal(normalizeDiscoveryLengthMm(0,'mm'),null);
 assert.equal(normalizeDiscoveryLengthMm(Infinity,'mm'),null);
});

test('paired measurement validation and unrelated repeated query values remain canonical', () => {
 assert(!StorefrontDiscoveryQuerySchema.safeParse({length_value:10}).success);
 assert(!StorefrontDiscoveryQuerySchema.safeParse({length_unit:'cm'}).success);
 assert(!StorefrontDiscoveryQuerySchema.safeParse({length_value:100001,length_unit:'mm'}).success);
 const parsed=StorefrontDiscoveryQuerySchema.parse({length_value:25.4,length_unit:'cm',connector:['usb-c','hdmi'],category:'Equipment',page:2,limit:1});
 const cleared=storefrontDiscoveryUrl('/search',parsed,{length_value:undefined,length_unit:undefined,page:1});
 const params=new URL(cleared,'https://example.invalid').searchParams;
 assert.deepEqual(params.getAll('connector'),['hdmi','usb-c']);assert.equal(params.get('category'),'Equipment');assert.equal(params.get('limit'),'1');
 assert(!params.has('length_value')&&!params.has('length_unit')&&!params.has('page'));
});

test('canonical selected sports measurement replaces the whole value/unit pair', () => {
 const common=SportsFactsSchema.parse({activity:'badminton',equipmentType:'racket',length:{value:67.5,unit:'cm'}});
 const variant=SportsVariantFactsSchema.parse({length:{value:700,unit:'mm'}});
 assert.deepEqual(resolveSportsMeasurements(common,variant).length,{value:700,unit:'mm'});
 assert(!SportsVariantFactsSchema.safeParse({length:{value:0,unit:'cm'}}).success);
 assert(!SportsVariantFactsSchema.safeParse({length:{value:67.5,unit:'ft'}}).success);
});

test('furniture dimension groups remain atomic and do not inherit an absent depth', () => {
 const common=FurnitureFactsSchema.parse({assembled:{width:100,depth:50,unit:'cm'}});
 const resolved=resolveFurnitureFacts(common,{assembled:{width:20,unit:'in'}});
 assert.deepEqual(resolved.assembled,{width:20,unit:'in'});
 assert(!FurnitureFactsSchema.safeParse({assembled:{width:20,unit:'m'}}).success);
});

test('released canonical schema accepts old absent and complete3-member metadata, rejecting malformed present values', () => {
 const current={query:StorefrontDiscoveryQuerySchema.parse({}),facets:[],matches:[]};
 assert(StorefrontDiscoveryMetadataSchema.safeParse(current).success);
 const capabilities={equipment_length:{available:false,allowed_units:[]},max_width_cm:{available:false},max_depth_cm:{available:false}};
 assert(StorefrontDiscoveryMetadataSchema.safeParse({...current,measurement_capabilities:capabilities}).success);
 for(const bad of [null,{}, {equipment_length:capabilities.equipment_length}, {...capabilities,max_width_cm:undefined}, {...capabilities,max_depth_cm:{available:'false'}}, {...capabilities,unknown:true}, {...capabilities,max_width_cm:{available:false,count:2}}, {...capabilities,equipment_length:{available:true,allowed_units:[]}}])
  assert(!StorefrontDiscoveryMetadataSchema.safeParse({...current,measurement_capabilities:bad}).success);
});

test('draft DOWN restores the exact qualified386 function definition and body hash', () => {
 assert.equal(definition(down),definition(source));
 assert.equal(bodyHash(down),evidence.baselineProsrcMd5);
 assert.equal(bodyHash(up),evidence.proposedProsrcMd5);
 assert.notEqual(bodyHash(up),bodyHash(down));
 assert.equal(createHash('sha256').update(source).digest('hex'),evidence.inputs['database/supabase/migrations/386_storefront_discovery.sql']);
});

test('draft retains every original browse predicate, order, page, facet and witness expression', () => {
 const baseline=definition(source);let restored=definition(up);
 const addedCte=restored.slice(restored.indexOf(',\n -- Capability only:'),restored.indexOf('\n SELECT jsonb_build_object(',restored.indexOf(',\n -- Capability only:')));
 restored=restored.replace(addedCte,'');
 const addedField=restored.slice(restored.indexOf(",\n  'measurement_capabilities'"),restored.indexOf('\n ) INTO result;',restored.indexOf(",\n  'measurement_capabilities'")));
 restored=restored.replace(addedField,'');
 assert.equal(restored,baseline);
 assert.match(addedCte,/FROM matched_candidates c WHERE c.quantity>0/);
 assert.match(addedCte,/jsonb_typeof\(c.facts->'_equipment_length_mm'\)='number'/);
 assert.match(addedCte,/::numeric>0/);assert.match(addedCte,/\/u.mm_per_unit<=100000/);
 assert.match(addedField,/jsonb_agg\(unit ORDER BY ordinal\)/);
 assert(!/\bcount\(/i.test(addedCte+addedField));
});

test('both drafts pin full helper profiles and forbid non-body catalog/ACL/dependency drift', () => {
 for(const draft of [up,down]) {
  assert.equal((draft.match(/CREATE OR REPLACE FUNCTION /g)||[]).length,1);
  assert(!/^\s*(?:CREATE TABLE|ALTER |DROP |GRANT |REVOKE )/m.test(draft));
  assert.match(draft,/to_jsonb\(before_row\)-'prosrc'/);assert.match(draft,/to_jsonb\(after_row\)-'prosrc'/);
  assert.match(draft,/before_dependencies IS DISTINCT FROM/);assert.match(draft,/before_shared_dependencies IS DISTINCT FROM/);
  assert.match(draft,/before_comment IS DISTINCT FROM/);assert.match(draft,/p\.proowner<>/);assert.match(draft,/p\.proconfig IS DISTINCT FROM/);
  assert.match(draft,/pg_catalog\.aclexplode/);assert.match(draft,/managed_catalog_fence/);
  assert.match(draft,/SECURITY INVOKER SET search_path=pg_catalog,public/);
 }
});

test('UP and DOWN reject initial non-owner grantors in every helper-profile admission', () => {
 for(const draft of [up,down]) {
  const profiles=[...draft.matchAll(/DO \$profile\$[\s\S]*?END \$profile\$;/g)].map(match=>match[0]);
  assert.equal(profiles.length,2,'before and after profile admission');
  for(const profile of profiles) assert.match(profile,/pg_catalog\.aclexplode\(coalesce\(p\.proacl,pg_catalog\.acldefault\('f',p\.proowner\)\)\) a WHERE a\.grantor<>p\.proowner OR a\.grantee NOT IN\(p\.proowner,'service_role'::regrole\) OR a\.grantee<>p\.proowner AND a\.is_grantable/);
 }
});

test('furniture equivalence and fixed cm threshold bounds reuse the canonical contracts', () => {
 assert.equal(furnitureLengthMm(609.6,'mm'),609.6);assert.equal(furnitureLengthMm(60.96,'cm'),609.6);assert.equal(furnitureLengthMm(24,'in'),609.6);
 assert(StorefrontDiscoveryQuerySchema.safeParse({max_width_cm:1000000,max_depth_cm:0.001}).success);
 assert(!StorefrontDiscoveryQuerySchema.safeParse({max_width_cm:1000000.01}).success);
 assert(!StorefrontDiscoveryQuerySchema.safeParse({max_depth_cm:0}).success);
 assert.throws(()=>furnitureLengthMm(1,'m' as 'mm'));
});

test('expanded SQL emits all3 finite capabilities and independently guards actual available axes', () => {
 const ddl=definition(up);const start=ddl.indexOf(",\n  'measurement_capabilities'");const metadata=ddl.slice(start,ddl.indexOf('\n ) INTO result;',start));
 for(const key of ['equipment_length','max_width_cm','max_depth_cm'])assert.equal((metadata.match(new RegExp(`'${key}'`,'g'))||[]).length,1);
 const axes=ddl.slice(ddl.indexOf(' measurement_axes AS ('),ddl.indexOf('\n SELECT jsonb_build_object(',ddl.indexOf(' measurement_axes AS (')));
 assert.match(axes,/FROM matched_candidates c WHERE c.quantity>0/);
 for(const key of ['width','depth']){
  assert(axes.includes(`jsonb_typeof(c.facts->'_${key}_mm')='number'`));
  assert(axes.includes(`(c.facts->>'_${key}_mm')::numeric>0`));
  assert(axes.includes(`(c.facts->>'_${key}_mm')::numeric/10<=1000000`));
  assert(axes.includes(`ELSE false END),false) AS ${key}_available`));
 }
 assert(!/\bcount\(|\bJOIN\b|public\.(?:products|product_variants)/i.test(axes));
});

test('equipment-only SQL revision and its complete evidence manifest remain byte-identical', () => {
 const previous=evidence.equipmentOnlyRevision;
 for(const [file,expected]of [['390_measurement_discovery.up.draft.sql',previous.upSha256],['390_measurement_discovery.down.draft.sql',previous.downSha256]]){
  assert.equal(createHash('sha256').update(read(`./revisions/01-equipment-only/${file}`)).digest('hex'),expected);
 }
 const manifest=JSON.parse(read('./revisions/01-equipment-only/manifest.json'));
 for(const artifact of manifest.artifacts)assert.equal(createHash('sha256').update(readFileSync(new URL(`./revisions/01-equipment-only/${artifact.path}`,import.meta.url))).digest('hex'),artifact.sha256);
 assert.equal(bodyHash(read('./revisions/01-equipment-only/390_measurement_discovery.up.draft.sql')),previous.proposedProsrcMd5);
});

test('both legs explicitly deny effective app_tenant and authenticator EXECUTE in every profile', () => {
 for(const draft of [up,down])for(const profile of [...draft.matchAll(/DO \$profile\$[\s\S]*?END \$profile\$;/g)].map(match=>match[0]))for(const role of ['anon','authenticated','app_tenant','authenticator'])
  assert(profile.includes(`pg_catalog.has_function_privilege('${role}',p.oid,'EXECUTE')`));
});
