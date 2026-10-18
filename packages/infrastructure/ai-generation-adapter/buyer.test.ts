import assert from 'node:assert/strict';
import test from 'node:test';
import { createBuyerAiAdapter, createAiGenerationAdapter } from './index';
const profile = { approved: true, purpose: 'buyer_shopping_public', content_scope: 'submitted_message_and_visible_chat', provider: 'openai_compatible', id: 'synthetic', endpoint: 'https://provider.invalid/chat/completions', model: 'synthetic-model', requests_per_day: 2, token_bound_per_day: 100000, max_input_bytes: 8000, max_output_tokens: 50, timeout_ms: 100, input_token_bound_per_byte: 1, input_framing_token_bound: 1000 };
const config = { profile: JSON.stringify(profile), apiKey: 'synthetic-not-a-credential' };
function response(extra = {}) { return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: 'Synthetic local answer' } }], usage: { prompt_tokens: 20, completion_tokens: 5 }, ...extra })); }
test('buyer profile never defaults to merchant sandbox or accepts unknown/absent limits', async () => {
 let calls = 0; const transport = async () => { calls++; return response(); };
 for (const configuration of [{}, { profile: JSON.stringify(profile) }, { ...config, profile: '{}' }, { ...config, profile: JSON.stringify({ ...profile, approved: false }) }, { ...config, profile: JSON.stringify({ ...profile, purpose: 'merchant_copywriter' }) }, { ...config, profile: JSON.stringify({ ...profile, max_output_tokens: 0 }) }, { ...config, apiKey: '   SKIP_NEEDS_HUMAN_SECRET   ' }, { ...config, profile: JSON.stringify({ ...profile, model: 'SKIP_NEEDS_HUMAN_MODEL' }) }]) {
  const a = createBuyerAiAdapter(configuration, transport); assert.equal(a.available, false); assert.equal(a.prepare({ prompt: 'x', history: [] }), null);
  await assert.rejects(a.generate({ body: '{}', reservedTokens: 1 }), /BUYER_AI_UNAVAILABLE/);
 }
 assert.equal(calls, 0); assert.equal(createAiGenerationAdapter({}).provider, 'letbuyy_sandbox');
});
test('owned buyer transport enforces bounded plain output, actual abort signal and no hidden context or tools', async () => {
 let seen: RequestInit | undefined; let calls = 0;
 const a = createBuyerAiAdapter(config, async (_url, init) => { seen = init; calls++; return response(); });
 const prepared = a.prepare({ prompt: 'Synthetic private question', history: [{ role: 'user', text: 'Visible question' }] })!;
 assert.ok(prepared.reservedTokens > profile.max_output_tokens); assert.equal(await a.generate(prepared), 'Synthetic local answer');
 const body = JSON.parse(seen!.body as string); assert.equal(body.model, profile.model); assert.equal(body.max_tokens, 50);
 assert.equal(body.tools, undefined); assert.equal(body.messages.length, 3); assert.ok(seen!.signal); assert.equal(seen!.redirect, 'error');
 await assert.rejects(a.generate(prepared)); assert.equal(calls, 1, 'prepared dispatch capability is single-use');
 assert.equal(a.prepare({ prompt: 'x'.repeat(9000), history: [] }), null);
});
test('model tools, invalid/missing usage, oversized/truncated/error responses stay unknown', async () => {
 for (const reply of [response({ choices: [{ finish_reason: 'tool_calls', message: { content: 'x', tool_calls: [{}] } }] }), response({ usage: null }), response({ usage: { prompt_tokens: 20, completion_tokens: 100 } }), new Response('x'.repeat(70000)), new Response('bad', { status: 503 })]) {
  const a = createBuyerAiAdapter(config, async () => reply); const prepared = a.prepare({ prompt: 'x', history: [] })!;
  await assert.rejects(a.generate(prepared), /BUYER_AI_OUTCOME_UNKNOWN/);
 }
});
test('timeout aborts the controlled transport; it does not retry', async () => {
 let calls = 0; let aborted = false;
 const a = createBuyerAiAdapter({ ...config, profile: JSON.stringify({ ...profile, timeout_ms: 5 }) }, async (_url, init) => {
  calls++; return new Promise((_resolve, reject) => init!.signal!.addEventListener('abort', () => { aborted = true; reject(new Error('synthetic private transport error')); }));
 });
 await assert.rejects(a.generate(a.prepare({ prompt: 'x', history: [] })!), /BUYER_AI_OUTCOME_UNKNOWN/);
 assert.equal(aborted, true); assert.equal(calls, 1);
});
