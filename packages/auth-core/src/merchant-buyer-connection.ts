import { z } from 'zod';
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const binding = z.object({verifier_hash:hash,request_hash:hash}).strict();
export const MerchantBuyerConnectionStartSchema = binding.extend({merchant_session_token:z.string().min(32).max(8192)}).strict();
export const MerchantBuyerConnectionConfirmSchema = binding.extend({
 intent_id:z.string().uuid(),code:z.string().regex(/^\d{6}$/),consent:z.literal(true),
}).strict();
export const MerchantBuyerConnectionCancelSchema = binding.extend({intent_id:z.string().uuid()}).strict();
export const MERCHANT_BUYER_CONNECTION_COOKIE = 'lb_merchant_buyer_connection';
export const MERCHANT_BUYER_CONNECTION_TTL_SECONDS = 600;
