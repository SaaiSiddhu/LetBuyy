import assert from 'node:assert/strict';
import test from 'node:test';
import {PAYMENT_KEYRING_PREFIX,paymentEncryptionKeyring} from '../lib/payment-encryption-keyring';
import {encryptPaymentSecret,encryptPaymentWebhookSecret,readStoreRazorpayTestCredentials,readStoreRazorpayWebhookSecret,projectStorePaymentConfig,type PaymentSettings} from '../lib/store-payment-config';

const ring=(active:string,previous:string[],legacy_version?:string)=>PAYMENT_KEYRING_PREFIX+JSON.stringify({active,previous,...(legacy_version?{legacy_version}:{})});
const fixture=()=>({siteId:crypto.randomUUID(),credentialId:crypto.randomUUID(),keyId:['rzp','test',crypto.randomUUID().replaceAll('-','')].join('_'),environment:'sandbox' as const});
const settings=(context:ReturnType<typeof fixture>,cipher:string):PaymentSettings=>({mode:'ownAccount',razorpay:{
    credential_id:context.credentialId,key_id:context.keyId,key_secret_ciphertext:cipher,verified:true,test_mode:true}});

test('wrapping-key rotation reads exact retained versions and encrypts only with the new active version',async()=>{
 const context=fixture(),old=crypto.randomUUID(),next=crypto.randomUUID(),secret=crypto.randomUUID();
 const v3=await encryptPaymentSecret(secret,old,context);
 const v2=await encryptPaymentSecret(secret,old,{...context,credentialId:undefined});
 const configuration=ring(next,[old]);
 for(const cipher of [v2,v3])assert.equal((await readStoreRazorpayTestCredentials(settings(context,cipher),configuration,context.siteId))?.keySecret,secret);
 const fresh=await encryptPaymentSecret(secret,configuration,context);
 const keys=await paymentEncryptionKeyring(configuration);
 assert.equal(fresh.split(':')[1],keys.active.version);assert.notEqual(fresh.split(':')[1],v3.split(':')[1]);
 assert.equal(await readStoreRazorpayTestCredentials(settings(context,fresh),old,context.siteId),null);
 assert.equal(await readStoreRazorpayTestCredentials(settings(context,v3),ring(next,[]),context.siteId),null,'removing a required old key fails closed');
 assert.equal((await readStoreRazorpayTestCredentials(settings(context,fresh),ring(next,[]),context.siteId))?.keySecret,secret);
 const publicConfig=await projectStorePaymentConfig({id:context.siteId,online_payment_enabled:true,cod_enabled:true,payment_settings:settings(context,fresh)},configuration);
 for(const privateValue of [old,next,secret,configuration,fresh])assert.equal(JSON.stringify(publicConfig).includes(privateValue),false);
 assert.ok(publicConfig.setup);assert.equal(publicConfig.setup.bank_verification,'not_confirmed');
});

test('retaining old keys never weakens the authenticated tenant, provider key, credential version or envelope binding',async()=>{
 const context=fixture(),old=crypto.randomUUID(),next=crypto.randomUUID(),secret=crypto.randomUUID(),configuration=ring(next,[old]);
 const cipher=await encryptPaymentSecret(secret,old,context),parts=cipher.split(':');
 const wrongVersion=[...parts];wrongVersion[1]=(await paymentEncryptionKeyring(configuration)).active.version;
 assert.equal(await readStoreRazorpayTestCredentials(settings(context,wrongVersion.join(':')),configuration,context.siteId),null);
 assert.equal(await readStoreRazorpayTestCredentials(settings(context,cipher),configuration,crypto.randomUUID()),null);
 for(const patch of [{credential_id:crypto.randomUUID()},{key_id:context.keyId+'different'},{test_mode:false},{verified:false}]){
  const good=settings(context,cipher);
  assert.equal(await readStoreRazorpayTestCredentials({...good,razorpay:{...good.razorpay,...patch}},configuration,context.siteId),null);
 }
});

test('merchant webhook secret is independently encrypted, version bound, and absent from the public projection',async()=>{
 const context=fixture(),wrappingKey=crypto.randomUUID(),apiSecret=crypto.randomUUID(),webhookSecret=crypto.randomUUID();
 const apiCipher=await encryptPaymentSecret(apiSecret,wrappingKey,context);
 const webhookCipher=await encryptPaymentWebhookSecret(webhookSecret,wrappingKey,context);
 const configured=settings(context,apiCipher);
 configured.razorpay={...configured.razorpay,webhook_secret_ciphertext:webhookCipher};
 assert.equal(await readStoreRazorpayWebhookSecret(configured,wrappingKey,context.siteId),webhookSecret);
 assert.equal(await readStoreRazorpayWebhookSecret({...configured,razorpay:{...configured.razorpay,webhook_secret_ciphertext:apiCipher}},wrappingKey,context.siteId),null);
 assert.equal((await readStoreRazorpayTestCredentials({...configured,razorpay:{...configured.razorpay,key_secret_ciphertext:webhookCipher}},wrappingKey,context.siteId)),null);
 assert.equal(await readStoreRazorpayWebhookSecret(configured,wrappingKey,crypto.randomUUID()),null);
 assert.equal(await readStoreRazorpayWebhookSecret({...configured,razorpay:{...configured.razorpay,credential_id:crypto.randomUUID()}},wrappingKey,context.siteId),null);
 const projected=await projectStorePaymentConfig({id:context.siteId,payment_settings:configured},wrappingKey);
 assert.equal(projected.payment_settings.razorpay?.webhook_secret_configured,true);
 assert.equal(projected.webhook_callback_url,null,'local work must not advertise a reachable callback');
 const staging=await projectStorePaymentConfig({id:context.siteId,payment_settings:configured},wrappingKey,'https://webhooks.staging.letbuyy.com');
 assert.equal(staging.webhook_callback_url,`https://webhooks.staging.letbuyy.com/razorpay/merchant/${context.siteId}/${context.credentialId}`);
 const wrongKey=await projectStorePaymentConfig({id:context.siteId,payment_settings:configured},crypto.randomUUID(),'https://webhooks.staging.letbuyy.com');
 assert.equal(wrongKey.webhook_callback_url,null,'unusable credentials cannot advertise callback readiness');
 assert.equal((await projectStorePaymentConfig({id:context.siteId,payment_settings:configured},wrappingKey,'https://untrusted.example')).webhook_callback_url,null);
 for(const secret of [apiSecret,webhookSecret,apiCipher,webhookCipher])assert.equal(JSON.stringify(projected).includes(secret),false);
});

test('unbound legacy ciphertext has one explicit historical reader in a keyring, with no key trial or default fallback',async()=>{
 const context=fixture(),old=crypto.randomUUID(),next=crypto.randomUUID(),secret=crypto.randomUUID();
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(old));
 const key=await crypto.subtle.importKey('raw',digest,'AES-GCM',false,['encrypt']);
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const bytes=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(secret)));
 const encode=(value:Uint8Array)=>btoa(String.fromCharCode(...value));
 const legacy=settings(context,encode(iv)+':'+encode(bytes));
 assert.equal((await readStoreRazorpayTestCredentials(legacy,old,context.siteId))?.keySecret,secret,'former raw-key read bridge remains compatible');
 assert.equal(await readStoreRazorpayTestCredentials(legacy,ring(next,[old]),context.siteId),null);
 const oldVersion=(await paymentEncryptionKeyring(old)).active.version;
 assert.equal((await readStoreRazorpayTestCredentials(legacy,ring(next,[old],oldVersion),context.siteId))?.keySecret,secret);
 const newVersion=(await paymentEncryptionKeyring(next)).active.version;
 assert.equal(await readStoreRazorpayTestCredentials(legacy,ring(next,[old],newVersion),context.siteId),null);
});

test('keyring size, duplicate keys, invalid legacy selection and malformed private configuration fail without echoing secrets',async()=>{
 const active=crypto.randomUUID(),previous=Array.from({length:4},()=>crypto.randomUUID()),context=fixture();
 assert.equal((await paymentEncryptionKeyring(ring(active,previous))).byVersion.size,5);
 const invalid=[ring(active,[...previous,crypto.randomUUID()]),ring(active,[active]),ring(active,[previous[0],previous[0]]),
  ring(active,previous,'0000000000000000'),ring('too-short',[]),PAYMENT_KEYRING_PREFIX+'{"active":'+active,
  PAYMENT_KEYRING_PREFIX+JSON.stringify({active,previous,unexpected:'field'}),PAYMENT_KEYRING_PREFIX+'[]'];
 for(const configuration of invalid){
  await assert.rejects(paymentEncryptionKeyring(configuration),error=>{
   assert.ok(error instanceof Error);assert.equal(error.message,'Payment encryption keyring is unavailable');
   assert.equal(error.message.includes(active),false);return true;
  });
  await assert.rejects(encryptPaymentSecret(crypto.randomUUID(),configuration,context));
 }
});
