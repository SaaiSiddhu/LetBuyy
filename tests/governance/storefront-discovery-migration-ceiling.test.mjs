import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {listMigrations,parseMigrationCeiling} from '../../scripts/governance/owned-database-provision.mjs';
test('migration ceiling has no default and rejects absent values and nonpositive/noninteger/unbounded input',()=>{
 assert.equal(parseMigrationCeiling(undefined),undefined);assert.equal(parseMigrationCeiling('385'),385);
 for(const value of['','0','-1','1.5','1e2','NaN','Infinity',' 385','385 ','1000000','--suite',null,385])assert.throws(()=>parseMigrationCeiling(value));
});
test('default includes all migrations while explicit385 selects only its numerically ordered predecessor history',()=>{
 const root=mkdtempSync(join(tmpdir(),'discovery-migration-selection-'));
 try{const dir=join(root,'database/supabase/migrations');mkdirSync(dir,{recursive:true});for(const name of['388_c.sql','100_a.sql','387_b.sql','385_last.sql','README.md'])writeFileSync(join(dir,name),'');
 assert.deepEqual(listMigrations(root),['100_a.sql','385_last.sql','387_b.sql','388_c.sql']);
 assert.deepEqual(listMigrations(root,{throughMigration:385}),['100_a.sql','385_last.sql']);
 for(const throughMigration of[0,-1,1.2,1000000,'385'])assert.throws(()=>listMigrations(root,{throughMigration}));
 }finally{rmSync(root,{recursive:true,force:true});}
});
