import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,chmodSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const script=fileURLToPath(new URL('../../scripts/github/activate-flutter.py',import.meta.url));
function fixture(version='3.44.8') {
 const dir=mkdtempSync(join(realpathSync(tmpdir()),'letbuyy-flutter-admission-'));
 const sdk=join(dir,'SDK with spaces');
 mkdirSync(join(sdk,'bin/cache/dart-sdk/bin'),{recursive:true});
 writeFileSync(join(sdk,'bin/cache/flutter.version.json'),JSON.stringify({frameworkVersion:version}));
 for(const binary of ['bin/flutter','bin/cache/dart-sdk/bin/dart']) {
  writeFileSync(join(sdk,binary),'#!/bin/sh\nexit 91\n');chmodSync(join(sdk,binary),0o700);
 }
 const pathFile=join(dir,'path'),envFile=join(dir,'env');writeFileSync(pathFile,'');writeFileSync(envFile,'');
 return {sdk,pathFile,envFile,run:(root=sdk)=>spawnSync('python3',[script,'--version','3.44.8'],{
  encoding:'utf8',env:{...process.env,LETBUYY_CI_FLUTTER_ROOT:root,GITHUB_PATH:pathFile,GITHUB_ENV:envFile},
 }),close:()=>rmSync(dir,{recursive:true,force:true})};
}
test('installed SDK admission preserves spaces and never runs or downloads an SDK',()=>{
 const f=fixture();try {
  const result=f.run();assert.equal(result.status,0,result.stderr);
  assert.equal(readFileSync(f.pathFile,'utf8'),join(f.sdk,'bin')+'\n');
  assert.equal(readFileSync(f.envFile,'utf8'),'FLUTTER_ROOT='+f.sdk+'\n');
 }finally{f.close();}
});
test('SDK version drift fails before changing the job environment',()=>{
 const f=fixture('0.0.0');try {
  assert.notEqual(f.run().status,0);assert.equal(readFileSync(f.pathFile,'utf8'),'');assert.equal(readFileSync(f.envFile,'utf8'),'');
 }finally{f.close();}
});
test('multiline SDK paths cannot inject job environment variables',()=>{
 const f=fixture();try {
  assert.notEqual(f.run(f.sdk+'\nINJECTED=value').status,0);
  assert.equal(readFileSync(f.pathFile,'utf8'),'');assert.equal(readFileSync(f.envFile,'utf8'),'');
 }finally{f.close();}
});
