import type {Context} from 'hono';
import {z} from 'zod';
import bcrypt from 'bcryptjs';
import type {Env} from '../index';
import {getBuyerSession,readBuyerToken} from '../middleware/buyer-session';
import {getSupabaseAdmin} from '../lib/supabase';
import {AppError} from '../lib/errors';
import {decryptFieldWithKms,encryptFieldWithKms,resolveKmsProviderFromEnv,sha256Hex} from '../lib/crypto';

const Metadata=z.object({export_id:z.string().uuid(),request_id:z.string().uuid(),single_use:z.literal(true),
 status:z.enum(['ready','delivered','expired','revoked']),expires_at:z.string(),verified_at:z.string(),released_at:z.string().nullable(),created_at:z.string()});
const errors:Record<string,[number,string]>={
 BUYER_SESSION_INVALID:[401,'Your buyer session has ended. Sign in again.'],
 EXPORT_INTENT_INVALID:[400,'The export request is invalid.'],
 EXPORT_REQUEST_NOT_FOUND:[404,'This access request was not found.'],EXPORT_NOT_FOUND:[404,'This export was not found.'],
 EXPORT_REQUEST_CLOSED:[409,'This request was closed without fulfillment. Create a new access request.'],
 EXPORT_IDEMPOTENCY_CONFLICT:[409,'This request key belongs to a different request or sign-in.'],
 EXPORT_VERIFICATION_LIMIT:[429,'Too many export verification attempts. Try again in ten minutes.'],
 EXPORT_PROOF_CHANGED:[409,'Your verification changed. Verify your password again with a new request.'],
 EXPORT_SESSION_MISMATCH:[403,'This download belongs to a different sign-in. Verify again to prepare a new export.'],
 EXPORT_EXPIRED:[410,'This download expired. Verify again to prepare a new export.'],
 EXPORT_ALREADY_RELEASED:[410,'This single-use download was already released. If it was interrupted, verify again to prepare a new export.'],
 EXPORT_SCOPE_LIMIT:[413,'Your data exceeds the automatic export limit. This request remains open for a complete assisted export.'],
 EXPORT_SOURCE_CHANGED:[409,'The export source changed before it could be saved. Verify again with a new request.'],
};
export class BuyerPrivacyExportExecutionAdapter{
 constructor(private c:Context<{Bindings:Env}>){ }
 private async binding(){
  const s=getBuyerSession(this.c),token=readBuyerToken(this.c);
  if(!s||!token||!Number.isSafeInteger(s.sessionEpoch)||s.sessionEpoch!<1)throw new AppError('A current buyer session is required.',401,'BUYER_SESSION_INVALID');
  return {p_buyer:s.buyerAccountId,p_epoch:s.sessionEpoch!,p_session_sha256:await sha256Hex(token)};
 }
 private async rpc(name:string,args:Record<string,unknown>){
  const {data,error}=await getSupabaseAdmin(this.c).rpc(name,args);
  if(error)throw new AppError('Your export is temporarily unavailable. Retry when service is restored.',503,'BUYER_EXPORT_UNAVAILABLE');
  if(!data||typeof data!=='object'||data.accepted!==true){
   const code=typeof data?.code==='string'?data.code:'BUYER_EXPORT_UNAVAILABLE',spec=errors[code];
   throw new AppError(spec?.[1]??'Your export is temporarily unavailable.',spec?.[0]??503,code);
  }
  return data as Record<string,unknown>;
 }
 private metadata(value:unknown){const v=Metadata.safeParse(value);if(!v.success)throw new AppError('Export state is unavailable.',503,'BUYER_EXPORT_UNAVAILABLE');return v.data;}
 async prepare(ticket:string,key:string,password:string){
  const bind=await this.binding();let kms:ReturnType<typeof resolveKmsProviderFromEnv>;
  // A key/adapter outage must fail before verification quota or release state.
  try{ kms=resolveKmsProviderFromEnv(this.c.env);const probe=await encryptFieldWithKms(kms,'letbuyy-buyer-export-readiness-v1');
   if(await decryptFieldWithKms(kms,probe)!=='letbuyy-buyer-export-readiness-v1')throw new Error('Key check failed');
  }catch{throw new AppError('Export encryption is unavailable.',503,'BUYER_EXPORT_UNAVAILABLE');}
  const proof=await this.rpc('begin_buyer_export_proof_v1',{...bind,p_ticket:ticket,p_request_key:key});
  const hash=typeof proof.password_hash==='string'?proof.password_hash:null;
  const valid=hash?await bcrypt.compare(password,hash):false;
  if(!valid){await this.rpc('fail_buyer_export_proof_v1',{p_buyer:bind.p_buyer,p_id:proof.challenge_id,p_session_sha256:bind.p_session_sha256});throw new AppError('Your password could not be verified.',401,'EXPORT_PASSWORD_INVALID');}
  const snapshot=await this.rpc('snapshot_buyer_export_v1',{...bind,p_id:proof.challenge_id,p_password_hash:hash});
  if(snapshot.replayed===true)return {metadata:this.metadata(snapshot.export),replayed:true};
  const source=z.object({source_json:z.string().max(5242880),source_digest:z.string().regex(/^[0-9a-f]{64}$/),email:z.string().email()}).safeParse(snapshot);
  if(!source.success||await sha256Hex(source.data.source_json)!==source.data.source_digest)throw new AppError('Export source is unavailable.',503,'BUYER_EXPORT_UNAVAILABLE');
  const [payload,email]=await Promise.all([encryptFieldWithKms(kms,source.data.source_json),encryptFieldWithKms(kms,source.data.email)]);
  const saved=await this.rpc('save_buyer_export_v1',{...bind,p_id:proof.challenge_id,p_digest:source.data.source_digest,p_ciphertext:payload,p_email_hash:await sha256Hex(source.data.email),p_encrypted_email:email});
  return {metadata:this.metadata(saved.export),replayed:saved.replayed===true};
 }
 async list(ticket:string){const data=await this.rpc('access_buyer_export_v1',{...await this.binding(),p_operation:'list',p_ticket:ticket,p_export:null,p_digest:null});
  const result=z.array(Metadata).max(20).safeParse(data.items);if(!result.success)throw new AppError('Export history is unavailable.',503,'BUYER_EXPORT_UNAVAILABLE');return {items:result.data,limit:20};}
 async download(ticket:string,id:string){
  const args={...await this.binding(),p_ticket:ticket,p_export:id,p_digest:null};
  const inspected=await this.rpc('access_buyer_export_v1',{...args,p_operation:'inspect'});
  const sealed=z.object({encrypted_payload:z.string(),payload_digest:z.string().regex(/^[0-9a-f]{64}$/)}).safeParse(inspected);
  if(!sealed.success)throw new AppError('Export data is unavailable.',503,'BUYER_EXPORT_UNAVAILABLE');
  // Decrypt and validate before consuming: unavailable keys or damaged bytes
  // leave the single-use permission available for recovery.
  let raw:string;
  try{raw=await decryptFieldWithKms(resolveKmsProviderFromEnv(this.c.env),sealed.data.encrypted_payload);}catch{throw new AppError('Export decryption is unavailable. Retry when service is restored.',503,'BUYER_EXPORT_UNAVAILABLE');}
  if(await sha256Hex(raw)!==sealed.data.payload_digest)throw new AppError('Export integrity could not be verified.',503,'BUYER_EXPORT_UNAVAILABLE');
  const content=z.object({contractVersion:z.literal('buyer-restricted-access-v1'),requestId:z.literal(ticket),buyerAccountId:z.literal(args.p_buyer),complete:z.literal(true)}).safeParse(JSON.parse(raw));
  if(!content.success)throw new AppError('The export scope could not be verified.',503,'BUYER_EXPORT_UNAVAILABLE');
  await this.rpc('access_buyer_export_v1',{...args,p_operation:'consume',p_digest:sealed.data.payload_digest});
  return raw;
 }
}
