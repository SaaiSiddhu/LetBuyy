import assert from 'node:assert/strict';
import test from 'node:test';
import {safePlatformReturnTo,authPathWithReturnTo} from '../lib/auth/return-to';

test('invitation navigation survives local configured auth steps without allowing arbitrary origins or credential URLs',()=>{
 const original=process.env.NEXT_PUBLIC_ADMIN_URL;process.env.NEXT_PUBLIC_ADMIN_URL='http://localhost:49123';
 try {
  const destination='http://localhost:49123/accept-invite?token=synthetic-invite';
  assert.equal(safePlatformReturnTo(destination),destination);
  const path=authPathWithReturnTo('/signup?email=synthetic%40example.invalid',destination);
  assert.equal(new URL(path,'https://accounts.letbuyy.com').searchParams.get('return_to'),destination);
  assert.equal(new URL(path,'https://accounts.letbuyy.com').searchParams.get('email'),'synthetic@example.invalid');
  for(const unsafe of ['http://attacker.invalid/accept-invite','http://localhost:49124/accept-invite','javascript:alert(1)',
    'https://user:password@admin.letbuyy.com/','ftp://admin.letbuyy.com/','https://letbuyy.com.attacker.invalid/'])assert.equal(safePlatformReturnTo(unsafe),null);
  assert.equal(safePlatformReturnTo('https://admin.letbuyy.com/accept-invite?token=synthetic'),'https://admin.letbuyy.com/accept-invite?token=synthetic');
 } finally {if(original===undefined)delete process.env.NEXT_PUBLIC_ADMIN_URL;else process.env.NEXT_PUBLIC_ADMIN_URL=original;}
});
