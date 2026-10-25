// Mandatory post-native parent evidence check. Reading JSON only; does not execute the suite.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),v=require('./qualification-inputs.ts');
assert.equal(process.argv.length,3,'Supply actual parent result.json after the separately admitted run');
v.verifyNativeResult(JSON.parse(fs.readFileSync(process.argv[2],'utf8')),JSON.parse(fs.readFileSync('native-source-closure.json','utf8')));
console.log('ACTUAL_PARENT_MIGRATION_AND_CLEANUP_EVIDENCE_ACCEPTED; no browser/full-theme credit implied');
