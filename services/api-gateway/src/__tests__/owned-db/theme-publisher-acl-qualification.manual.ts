// Explicit historical qualification only; excluded from automatic *.test.ts discovery.
// Native04's exact qualified bytes are immutable in native-runs/04/06-theme-publisher-acl.postgres.test.ts.before.snapshot.
// This entry still fails closed on exact Root admission/source/baseline mismatch before obtaining an owned handle.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {z} from 'zod';
import {requireOwnedDatabase} from './owned-db-support';
import {registerPublisherAclProof} from './publisher-acl-proof';
const root=new URL('../../../../../',import.meta.url);
const folder='docs/implementation/niche-theme-programme/publisher-acl393/';
const suitePath='services/api-gateway/src/__tests__/owned-db/theme-publisher-acl-qualification.manual.ts';
const allocationPath='docs/implementation/niche-theme-programme/publisher-acl393-source-allocation.json';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const read=(p:string)=>readFileSync(new URL(p,root),'utf8');
const digestSchema=z.string().regex(/^[a-f0-9]{64}$/);
function admittedInputs(){
 const grant=z.object({status:z.literal('ROOT_PUBLISHER_ACL393_NATIVE_SOURCE_ADMITTED_ONE_FRESH_DEFAULT_LATEST392'),recordedAt:z.string().optional(),
  suitePath:z.literal(suitePath),suiteSha256:digestSchema,allocationPath:z.literal(allocationPath),allocationSha256:digestSchema,
  manifestPath:z.literal(folder+'case-operand-repair/v2/manifest.json'),manifestSha256:digestSchema,inputClosurePath:z.literal(folder+'source-input-closure.json'),inputClosureSha256:digestSchema,
  sourceMigrationMaximum:z.literal(392),sourceMigrationCount:z.literal(321),migrationCeiling:z.null(),candidateMigration:z.literal(393),candidateOutsideMigrationScan:z.literal(true),
  nativeLease:z.literal('GRANTED_ONE_FRESH_DEFAULT_LATEST392_JOBS1_NO_REAP_PREPARED2_600S')}).strict().parse(JSON.parse(read(folder+'admission.json')));
 assert.equal(hash(read(suitePath)),grant.suiteSha256);assert.equal(hash(read(allocationPath)),grant.allocationSha256);
 const allocation=z.object({status:z.literal('ROOT_ALLOCATED393_PUBLISHER_ACL_CLOSURE_SOURCE_ONLY_394_CATALOG_RESERVED_AFTER_SECURITY')}).passthrough().parse(JSON.parse(read(allocationPath)));assert(allocation);
 assert.equal(hash(read(grant.manifestPath)),grant.manifestSha256);
 const manifest=z.object({status:z.literal('ACL393_CANDIDATE_PAIR_SOURCE_ONLY_NOT_EMITTED_NOT_EXECUTED'),number:z.literal(393),sourceMigrationMaximum:z.literal(392),sourceMigrationCount:z.literal(321),
  allocation:z.object({path:z.literal(allocationPath),sha256:digestSchema}).strict(),
  candidates:z.array(z.object({path:z.string(),sha256:digestSchema,bytes:z.number().int().positive()}).strict()).length(2)}).passthrough().parse(JSON.parse(read(grant.manifestPath)));
 assert.equal(manifest.allocation.sha256,grant.allocationSha256);
 const expected=[folder+'case-operand-repair/v2/393_publisher_tenant_execute.up.candidate.sql',folder+'case-operand-repair/v2/393_publisher_tenant_execute.down.candidate.sql'];
 manifest.candidates.forEach((f,i)=>{assert.equal(f.path,expected[i]);assert.equal(hash(read(f.path)),f.sha256);assert.equal(Buffer.byteLength(read(f.path)),f.bytes);});
 assert.equal(hash(read(grant.inputClosurePath)),grant.inputClosureSha256);
 const closure=z.object({files:z.array(z.object({path:z.string(),sha256:digestSchema}).strict())}).passthrough().parse(JSON.parse(read(grant.inputClosurePath)));
 assert(closure.files.some(f=>f.path===suitePath));
 for(const f of closure.files){assert(!f.path.includes('..')&&!f.path.startsWith('/'));assert.equal(hash(read(f.path)),f.sha256);}
 const paths=readdirSync(new URL('database/supabase/migrations/',root)).filter(p=>p.endsWith('.sql'));
 assert.equal(paths.length,321);assert.equal(Math.max(...paths.map(p=>Number(p.match(/^\d+/)?.[0]))),392);
 for(const kind of ['migrations','rollback'])assert(!readdirSync(new URL(`database/supabase/${kind}/`,root)).some(p=>/^39[34]_/.test(p)));
 return{grant,up:read(expected[0]),down:read(expected[1]),sourceCount:closure.files.length};
}
const inputs=admittedInputs();
registerPublisherAclProof({owned:requireOwnedDatabase(),up:inputs.up,down:inputs.down,entryTenantExecute:true,suiteSha256:inputs.grant.suiteSha256,sourceCount:inputs.sourceCount,verifySource:()=>{admittedInputs();}});
