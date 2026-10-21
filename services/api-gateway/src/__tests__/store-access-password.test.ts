import assert from 'node:assert/strict';
import test from 'node:test';
import {verifyStoreAccessPassword} from '../lib/store-access-password';
import {AppError} from '../lib/errors';
test('missing store password is refused, while malformed persisted hash is sanitized unavailable rather than bad credentials',async()=>{
 assert.equal(await verifyStoreAccessPassword('synthetic-password',null),false);
 await assert.rejects(verifyStoreAccessPassword('synthetic-password','invalid-persisted-hash'),(error:unknown)=>error instanceof AppError&&error.statusCode===503&&error.code==='STOREFRONT_ACCESS_UNAVAILABLE'&&!error.message.includes('invalid-persisted-hash'));
});
