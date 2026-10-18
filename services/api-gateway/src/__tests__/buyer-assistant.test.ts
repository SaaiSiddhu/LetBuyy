import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createBuyerAiAdapter, executeBuyerAssistant, BuyerAiAdmissionDenied, type BuyerAiReceiptStore } from '../execution/buyer-assistant.adapter';
import { registerBuyerAssistantRoutes } from '../routes/storefront/buyer-assistant-routes';
import { installBuyerSessionState } from './buyer-session-state-fake';
import type { Env } from '../index';
const buyer = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const input = { request_id: '11111111-1111-4111-8111-111111111111', conversation_id: '22222222-2222-4222-8222-222222222222', prompt: 'Synthetic private question', history: [] };
const profile = { approved: true, purpose: 'buyer_shopping_public', content_scope: 'submitted_message_and_visible_chat', provider: 'openai_compatible', id: 'synthetic', endpoint: 'https://provider.invalid/chat/completions', model: 'synthetic', requests_per_day: 2, token_bound_per_day: 100000, max_input_bytes: 8000, max_output_tokens: 50, timeout_ms: 1000, input_token_bound_per_byte: 1, input_framing_token_bound: 1000 };
function fixture(fault?: string, hold?: Promise<void>) {
 let enter!: () => void; const entered = new Promise<void>(resolve => { enter = resolve; });
 let calls = 0; const rows = new Map<string, { hash: string; state: string }>(); const transitions: string[] = [];
 const provider = createBuyerAiAdapter({ profile: JSON.stringify(profile), apiKey: 'synthetic-not-a-credential' }, async () => {
  calls++; enter(); await hold; if (fault === 'provider') throw new Error(input.prompt);
  return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: 'Synthetic actual transport answer' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }));
 });
 const receipts: BuyerAiReceiptStore = {
  async reserve(actor, request, hash) {
   assert.equal(actor.buyerAccountId, buyer); assert.equal(actor.sessionEpoch, 1); assert.match(hash, /^[a-f0-9]{64}$/);
   const row = rows.get(request.request_id);
   if (row) return row.hash !== hash ? 'conflict' : row.state === 'completed' ? 'result_unavailable' : row.state === 'outcome_unknown' ? 'outcome_unknown' : 'in_progress';
   rows.set(request.request_id, { hash, state: 'reserved' });
   if (fault === 'reserve_response') throw new Error(input.prompt);
   return 'reserved';
  },
  async transition(_actor, id, from, to) {
   if (fault === 'revoked') return false;
   if (fault === 'finish' && to === 'completed') throw new Error(input.prompt);
   assert.equal(rows.get(id)!.state, from); rows.get(id)!.state = to; transitions.push(to); return true;
  },
 };
 return { dependencies: { provider, receipts, fingerprintKey: 'synthetic-fingerprint-key-at-least-32-characters' }, calls: () => calls, rows, transitions, entered };
}
test('concurrent same logical operation dispatches once, preserves response, and replay cannot regenerate unstored output', async () => {
 let release!: () => void; const hold = new Promise<void>(resolve => { release = resolve; });
 const f = fixture(undefined, hold);
 const first = executeBuyerAssistant({ buyerAccountId: buyer, sessionEpoch: 1 }, input, f.dependencies);
 await f.entered;
 const concurrent = await executeBuyerAssistant({ buyerAccountId: buyer, sessionEpoch: 1 }, input, f.dependencies);
 assert.equal(concurrent.status, 'in_progress'); assert.equal(f.calls(), 1); release();
 assert.equal((await first).status, 'completed');
 assert.equal((await executeBuyerAssistant({ buyerAccountId: buyer, sessionEpoch: 1 }, input, f.dependencies)).status, 'result_unavailable'); assert.equal(f.calls(), 1);
 await assert.rejects(executeBuyerAssistant({ buyerAccountId: buyer, sessionEpoch: 1 }, { ...input, prompt: 'different payload' }, f.dependencies), BuyerAiAdmissionDenied);
});
test('missing buyer profile/key is unavailable, without quota write or provider traffic', async () => {
 const f = fixture(); const result = await executeBuyerAssistant({ buyerAccountId: buyer, sessionEpoch: 1 }, input, { ...f.dependencies, provider: createBuyerAiAdapter({}) });
 assert.equal(result.status, 'unavailable'); assert.equal(f.calls(), 0); assert.equal(f.rows.size, 0);
 for (const fingerprintKey of ['', ' '.repeat(40), 'SKIP_NEEDS_HUMAN_FINGERPRINT_SECRET_AT_LEAST_32']) {
  const denied = await executeBuyerAssistant({ buyerAccountId: buyer, sessionEpoch: 1 }, input, { ...f.dependencies, fingerprintKey });
  assert.equal(denied.status, 'unavailable'); assert.equal(f.calls(), 0); assert.equal(f.rows.size, 0);
 }
});
test('reservation response loss, provider ambiguity and finish failure never blindly dispatch again', async () => {
 for (const fault of ['reserve_response','provider','finish']) {
  const f = fixture(fault); const result = await executeBuyerAssistant({ buyerAccountId: buyer, sessionEpoch: 1 }, input, f.dependencies);
  assert.equal(result.status, 'outcome_unknown'); assert.doesNotMatch(JSON.stringify(result), /Synthetic private/);
  const count = f.calls(); const replay = await executeBuyerAssistant({ buyerAccountId: buyer, sessionEpoch: 1 }, input, f.dependencies);
  assert.ok(['in_progress','outcome_unknown'].includes(replay.status)); assert.equal(f.calls(), count);
 }
});
test('current authority is required again immediately before dispatch', async () => {
 const f = fixture('revoked'); await assert.rejects(executeBuyerAssistant({ buyerAccountId: buyer, sessionEpoch: 1 }, input, f.dependencies), BuyerAiAdmissionDenied); assert.equal(f.calls(), 0);
});
test('real signed BUYER middleware denies wrong realm/current revocation and strict transport rejects hidden context', async () => {
 const keys = await generateKeyPair('ES256', { extractable: true }); const jwk = await exportJWK(keys.publicKey);
 const app = new Hono<{ Bindings: Env }>(); let epoch = 1; installBuyerSessionState(app, async () => ({ data: { status: 'active', session_epoch: epoch }, error: null }));
 const f = fixture(); registerBuyerAssistantRoutes(app, { dependencies: () => f.dependencies });
 const env = { LETBUYY_IDENTITY_ISSUER: 'https://identity.invalid', LETBUYY_IDENTITY_PUBLIC_JWKS: JSON.stringify({ keys: [{ ...jwk, alg: 'ES256', kid: 'synthetic' }] }) } as Env;
 async function token(realm = 'buyer') { return new SignJWT({ realm, token_use: `${realm}_session`, session_epoch: 1 }).setProtectedHeader({ alg: 'ES256', kid: 'synthetic' }).setIssuer(env.LETBUYY_IDENTITY_ISSUER!).setAudience(`letbuyy:${realm}-session`).setSubject(buyer).setIssuedAt().setJti('synthetic-replay-identifier-0000').setExpirationTime('1h').sign(keys.privateKey); }
 async function request(credential?: string, body: object = input) { return app.request('/buyer/assistant', { method: 'POST', headers: { 'content-type': 'application/json', ...(credential ? { 'X-LetBuyy-Buyer-Session': credential } : {}) }, body: JSON.stringify(body) }, env); }
 assert.equal((await request()).status, 401); assert.equal((await request(await token('merchant'))).status, 401);
 const valid = await token(); assert.equal((await request(valid, { ...input, buyer_account_id: buyer })).status, 400);
 const positive = await request(valid); assert.equal(positive.status, 200); assert.equal((await positive.json() as {data: {status: string}}).data.status, 'completed');
 epoch = 2; assert.equal((await request(valid)).status, 401); assert.equal(f.calls(), 1);
});
