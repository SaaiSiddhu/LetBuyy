// Permanent default-LATEST regression: ordinary owned guard, canonical393 SQL, no release admission or frozen source count.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {requireOwnedDatabase} from './owned-db-support';
import {registerPublisherAclProof} from './publisher-acl-proof';
const root=new URL('../../../../../',import.meta.url);
const upPath='database/supabase/migrations/393_theme_publisher_tenant_execute.sql';
const downPath='database/supabase/rollback/393_theme_publisher_tenant_execute.rollback.sql';
const read=(path:string)=>readFileSync(new URL(path,root),'utf8');
const up=read(upPath),down=read(downPath);
const suiteSha256=createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
registerPublisherAclProof({owned:requireOwnedDatabase(),up,down,entryTenantExecute:false,suiteSha256,verifySource:()=>{
 assert.equal(read(upPath),up,'Selected UP changed during the regression');
 assert.equal(read(downPath),down,'Selected DOWN changed during the regression');
}});
