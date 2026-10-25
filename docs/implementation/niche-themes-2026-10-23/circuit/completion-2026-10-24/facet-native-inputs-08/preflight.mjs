// Separate gate only. Never imports/spawns the owned runner or native suite.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { verify } from './verify.mjs';
const root=process.cwd(),here=dirname(fileURLToPath(import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=path=>readFileSync(resolve(root,path)),json=path=>JSON.parse(read(path));
try {
  assert(process.argv[2],'A fresh explicit Root execution-grant path is required; no default or old grant reuse');
  const grant=json(process.argv[2]);assert.equal(grant.status,'ROOT_GRANTED_ONE_CIRCUIT_FACET_OWNED_QUALIFICATION');assert(Date.parse(grant.expiresAt)>Date.now());
  assert.equal(grant.expectedPhases,8);assert.equal(grant.expectedTAP,9);assert.equal(grant.migrationCeiling,null);assert.equal(grant.sandboxPermissions,'require_escalated');
  const path=resolve(here,'source-closure.json'),closure=json(path),checked=verify(closure);
  assert.equal(sha(read(path)),grant.inputClosureSha256);assert.equal(checked.files,grant.sourceFiles);
  assert.equal(checked.migrationCount,grant.migrationCount);assert.equal(checked.migrationMaximum,grant.migrationMaximum);
  const admission=json(grant.admissionPath);assert.equal(sha(read(grant.admissionPath)),grant.admissionSha256);
  assert.equal(admission.status,'ROOT_ACCEPTED_FOR_OWNED_NATIVE_QUALIFICATION');assert.equal(admission.migrationCeiling,null);
  assert.equal(admission.suiteSha256,sha(read(closure.suitePath)));assert.deepEqual(admission.sourceFiles,closure.files.map(({path,sha256})=>({path,sha256})));
  const base='docs/implementation/niche-themes-2026-10-23/circuit/completion-2026-10-24/facet-private-implementation-03/';
  assert.equal(admission.upSha256,sha(read(base+'UNNUMBERED_circuit_facets.up.proposal.sql')));assert.equal(admission.downSha256,sha(read(base+'UNNUMBERED_circuit_facets.down.proposal.sql')));
  assert.equal(grant.argv[0],'node');assert.equal(grant.argv[1],'scripts/governance/run-executable-suites.mjs');
  const value=key=>{assert.equal(grant.argv.filter(x=>x===key).length,1);return grant.argv[grant.argv.indexOf(key)+1];};
  assert.equal(value('--suite'),closure.suitePath);assert.equal(value('--kind'),'gateway-db');assert.equal(value('--jobs'),'1');assert.equal(value('--timeout'),'600');assert.equal(value('--prepared-transactions'),'2');assert(grant.argv.includes('--no-reap'));
  assert(!grant.argv.some(x=>/through-migration|migration-ceiling|keep-container|reap-only/.test(x)));
  process.stdout.write(JSON.stringify({status:'FRESH_ROOT_GRANT_SOURCE_PREFLIGHT_PASS_NO_RUNNER_STARTED',...checked,executionGrantSha256:sha(read(process.argv[2])),runnerStarted:false,next:'Inspect this separate tool result exit0 before issuing exact grant argv in a NEW tool call.'})+'\n');
} catch(error) { process.stderr.write((error instanceof Error?error.stack:String(error))+'\n');process.exitCode=1; }
