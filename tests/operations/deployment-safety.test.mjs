import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("Worker deploy wrapper fails closed when --env is missing", () => {
  const result = spawnSync(process.execPath, ["infrastructure/scripts/deploy/deploy-worker-runtime.mjs", "--config", "services/api-gateway/wrangler.toml"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--env is required/);
});

test("Worker deploy wrapper rejects non-governed environments before invoking Wrangler", () => {
  const result = spawnSync(process.execPath, [
    "infrastructure/scripts/deploy/deploy-worker-runtime.mjs",
    "--config",
    "services/api-gateway/wrangler.toml",
    "--env",
    "local",
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /invalid --env local/);
});

import {mkdtempSync,writeFileSync,chmodSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';

// No real provider login or credential is used. The fake CLI proves that
// authentication alone cannot admit the wrong account or waive production intent.
function capabilityProbe(overrides={}) {
  const dir=mkdtempSync(join(tmpdir(),'letbuyy-provider-capability-'));
  try {
    const file=join(dir,'pnpm');
    writeFileSync(file,`#!/usr/bin/env node\nconst args=process.argv.slice(2);\nif(args[0]==='-v')console.log('10.6.2');\nelse if(args.includes('--version'))console.log('wrangler 4.100.0');\nelse if(args.includes('whoami')){console.log(process.env.FAKE_CF_IDENTITY_JSON);process.exit(Number(process.env.FAKE_CF_LOGIN_EXIT||0));}\nelse process.exit(99);\n`);chmodSync(file,0o700);
    const env={...process.env,PATH:dir+':'+process.env.PATH,LETBUYY_CLOUDFLARE_AUTH_MODE:'oauth',CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),XDG_CONFIG_HOME:dir,FAKE_CF_IDENTITY_JSON:JSON.stringify({loggedIn:true,authType:'OAuth Token',accounts:[{id:'a'.repeat(32)}]}),...overrides};
    for(const name of ['CLOUDFLARE_API_TOKEN','CLOUDFLARE_API_KEY','LETBUYY_PROVIDER_MUTATION_APPROVED'])if(!(name in overrides))delete env[name];
    return spawnSync(process.execPath,['infrastructure/scripts/cloudflare/provider-capability-validator.mjs','--environment='+(overrides.PROBE_ENVIRONMENT||'staging'),'--execute'],{cwd:process.cwd(),env,encoding:'utf8'});
  } finally {rmSync(dir,{recursive:true,force:true});}
}

test('governed OAuth admits only an explicit scoped native CLI login to the intended account',()=>{
 const result=capabilityProbe();assert.equal(result.status,0,result.stderr);
});
for(const [label,overrides] of [
 ['wrong account',{CLOUDFLARE_ACCOUNT_ID:'b'.repeat(32)}],
 ['invalid account',{CLOUDFLARE_ACCOUNT_ID:'invalid'}],
 ['missing account',{CLOUDFLARE_ACCOUNT_ID:''}],
 ['unscoped login',{XDG_CONFIG_HOME:''}],
 ['relative scoped config',{XDG_CONFIG_HOME:'relative'}],
 ['mixed credentials',{CLOUDFLARE_API_TOKEN:randomUUID()}],
 ['non-OAuth identity',{FAKE_CF_IDENTITY_JSON:JSON.stringify({loggedIn:true,authType:'API Token',accounts:[{id:'a'.repeat(32)}]})}],
 ['logged out',{FAKE_CF_IDENTITY_JSON:JSON.stringify({loggedIn:false,accounts:[{id:'a'.repeat(32)}]})}],
 ['unstructured response',{FAKE_CF_IDENTITY_JSON:'not-json'}],
 ['failed CLI login',{FAKE_CF_LOGIN_EXIT:'1'}],
 ['unknown auth mode',{LETBUYY_CLOUDFLARE_AUTH_MODE:'anything'}],
 ['production without approval',{PROBE_ENVIRONMENT:'production'}],
])test('governed provider refuses '+label,()=>{assert.notEqual(capabilityProbe(overrides).status,0);});
test('production OAuth retains its explicit mutation approval and exact account checks',()=>{
 const result=capabilityProbe({PROBE_ENVIRONMENT:'production',LETBUYY_PROVIDER_MUTATION_APPROVED:'true'});assert.equal(result.status,0,result.stderr);
 assert.notEqual(capabilityProbe({PROBE_ENVIRONMENT:'production',LETBUYY_PROVIDER_MUTATION_APPROVED:'true',CLOUDFLARE_ACCOUNT_ID:'b'.repeat(32)}).status,0);
});
test('API-token mode remains supported, without admitting an absent credential',()=>{
 const identity=JSON.stringify({loggedIn:true,authType:'API Token',accounts:[{id:'a'.repeat(32)}]});
 const valid=capabilityProbe({LETBUYY_CLOUDFLARE_AUTH_MODE:'api-token',CLOUDFLARE_API_TOKEN:randomUUID(),FAKE_CF_IDENTITY_JSON:identity});assert.equal(valid.status,0,valid.stderr);
 assert.notEqual(capabilityProbe({LETBUYY_CLOUDFLARE_AUTH_MODE:'api-token',FAKE_CF_IDENTITY_JSON:identity}).status,0);
});
