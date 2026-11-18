import assert from 'node:assert/strict';
import test from 'node:test';
import {hashStoreAccessPassword,verifyStoreAccessPassword} from '../lib/store-access-password';
import {AppError} from '../lib/errors';
test('missing store password is refused, while malformed persisted hash is sanitized unavailable rather than bad credentials',async()=>{
 assert.equal(await verifyStoreAccessPassword('synthetic-password',null),false);
 await assert.rejects(verifyStoreAccessPassword('synthetic-password','invalid-persisted-hash'),(error:unknown)=>error instanceof AppError&&error.statusCode===503&&error.code==='STOREFRONT_ACCESS_UNAVAILABLE'&&!error.message.includes('invalid-persisted-hash'));
});
test('Node hashing adapter preserves Argon2 parameters and password verification',async()=>{
 const encoded=await hashStoreAccessPassword('synthetic-ci-password');
 assert.match(encoded,/^\$argon2id\$v=19\$m=19456,t=3,p=1\$/);
 assert.equal(await verifyStoreAccessPassword('synthetic-ci-password',encoded),true);
 assert.equal(await verifyStoreAccessPassword('synthetic-ci-wrong',encoded),false);
});
