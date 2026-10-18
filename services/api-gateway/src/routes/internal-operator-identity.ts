// Private first-party Identity transport. Human authority is always an
// asymmetric credential plus the existing live operator/session/permission DB.
import { Hono } from 'hono';
import { z } from 'zod';
import { verifyIdentityPlatformMagic } from '@letbuyy/auth-core/platform-identity';
import type { Env } from '../index';
import { verifyInternalAppRequest } from '../lib/internal-auth';
import { AppError, ValidationError } from '../lib/errors';
import { claimInternalAuthReplayJti, success } from '../lib/supabase';
import { consoleApprovalRpc } from '../identity-foundation/console-approval-repository';
import { consoleRegistrationArguments, readConsoleCredential, transitionConsoleSession } from '../identity-foundation/console-session-repository';
import { completeConsoleMfa } from '../execution/console-mfa-execution.adapter';
const router = new Hono<{Bindings:Env}>();
router.use('*',async(c,next)=>{
 if(!await verifyInternalAppRequest(c,'accounts'))throw new AppError('A fresh Identity transport proof is required.',401,'IDENTITY_TRANSPORT_REQUIRED');
 await next();
});
router.post('/bridge-claim',async c=>{
 const body=z.object({jti:z.string().uuid()}).strict().safeParse(await c.req.json().catch(()=>null));
 if(!body.success)throw new ValidationError('Invalid transport request.');
 const result=await claimInternalAuthReplayJti(c.env,{kind:'app:console_identity',jti:body.data.jti,ttlSeconds:120});
 if(result!=='claimed')throw new AppError('Identity transport is unavailable or already used.',result==='replayed'?401:503,'IDENTITY_TRANSPORT_REPLAY');
 return c.json(success({claimed:true}));
});
router.post('/lookup',async c=>{
 const body=z.object({email:z.string().trim().email().max(254),actor_id:z.string().uuid().optional()}).strict().safeParse(await c.req.json().catch(()=>null));
 if(!body.success)throw new ValidationError('Invalid operator query.');
 return c.json(success(await consoleApprovalRpc(c,'resolve_console_operator_v1',{p_email:body.data.email.toLowerCase(),p_actor_id:body.data.actor_id??null})));
});
router.post('/exchange',async c=>{
 const body=z.object({magic_token:z.string().min(1).max(4096)}).strict().safeParse(await c.req.json().catch(()=>null));
 if(!body.success)throw new ValidationError('Invalid operator exchange.');
 const magic=await verifyIdentityPlatformMagic(body.data.magic_token,{issuer:c.env.LETBUYY_IDENTITY_ISSUER,publicJwks:c.env.LETBUYY_IDENTITY_PUBLIC_JWKS});
 const target=await readConsoleCredential(c);
 if(!magic || target.payload.mfaVerified || target.payload.userId!==magic.userId || target.payload.email!==magic.email)throw new AppError('A matching Identity magic proof is required.',401,'CONSOLE_MAGIC_INVALID');
 const args=consoleRegistrationArguments(target,null);
 return c.json(success(await consoleApprovalRpc(c,'exchange_identity_console_magic_v1',{
  p_magic_jti:magic.jti,p_email:magic.email,p_actor_id:magic.userId,p_magic_issued_at:new Date(magic.issuedAt*1000).toISOString(),p_magic_expires_at:new Date(magic.exp*1000).toISOString(),
  p_session_id:args.p_session_id,p_cookie_sha256:args.p_cookie_sha256,p_issued_at:args.p_issued_at,p_expires_at:args.p_expires_at,
 })));
});
router.get('/current',async c=>c.json(success((await transitionConsoleSession(c,'validate')).state)));
router.post('/mfa',async c=>{
 const body=z.object({counter:z.number().safe().int().nonnegative().nullable(),factor_fingerprint:z.string().regex(/^[0-9a-f]{64}$/)}).strict().safeParse(await c.req.json().catch(()=>null));
 if(!body.success)throw new ValidationError('Invalid authenticator request.');
 return c.json(success(await completeConsoleMfa(c,body.data.counter,body.data.factor_fingerprint)));
});
export default router;
