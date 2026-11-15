// Explicit synthetic account setup for owned refund fixtures. This is not a
// provider-identity assertion, a production backfill or a real refund.
import {randomUUID} from 'node:crypto';
import type {OwnedDatabase} from './owned-db-support';
import type {Gateway} from './gateway-harness';
import {encryptPaymentSecret,encryptPaymentWebhookSecret} from '../../lib/store-payment-config';

export async function bindSyntheticRefundCredential(owned:OwnedDatabase,gateway:Gateway,siteId:string,paymentIds:string[],webhookSecret?:string){
 const id=randomUUID(),keyId=['rzp','test',randomUUID().replaceAll('-','')].join('_'),keySecret=randomUUID();
 const wrapping=gateway.env.PAYMENT_CONFIG_ENCRYPTION_KEY||randomUUID();
 gateway.env.PAYMENT_CONFIG_ENCRYPTION_KEY=wrapping;
 const encrypted=await encryptPaymentSecret(keySecret,wrapping,{siteId,keyId,environment:'sandbox',credentialId:id});
 const encryptedWebhook=webhookSecret?await encryptPaymentWebhookSecret(webhookSecret,wrapping,{siteId,keyId,environment:'sandbox',credentialId:id}):undefined;
 if(!paymentIds.length||![siteId,...paymentIds].every(value=>/^[0-9a-f-]{36}$/.test(value)))throw new Error('Synthetic refund scope must be exact UUIDs');
 owned.psql(`INSERT INTO payment_credentials(id,site_id,provider,mode,status,provider_key_id,last_verified_at,encrypted_credentials)
  VALUES('${id}','${siteId}','razorpay','sandbox','active','${keyId}',now(),'${JSON.stringify({key_secret_ciphertext:encrypted,...(encryptedWebhook?{webhook_secret_ciphertext:encryptedWebhook}:{})})}'::jsonb);
  UPDATE payments SET credential_id='${id}' WHERE site_id='${siteId}' AND id IN(${paymentIds.map(p=>"'"+p+"'").join(',')}) AND credential_id IS NULL;`);
 return {id,keyId,keySecret,webhookSecret,authorization:'Basic '+btoa(keyId+':'+keySecret)};
}
