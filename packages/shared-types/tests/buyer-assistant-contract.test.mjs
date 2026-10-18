import assert from 'node:assert/strict';
import test from 'node:test';
import { BuyerAssistantRequestSchema, BuyerAssistantResponseSchema } from '../src/buyer-assistant.ts';
const id = '11111111-1111-4111-8111-111111111111';
const input = { request_id: id, conversation_id: id, prompt: 'Synthetic question', history: [] };
test('buyer assistant accepts bounded visible chat and rejects ownership/actions/private-context injection', () => {
 assert.ok(BuyerAssistantRequestSchema.safeParse(input).success);
 for (const extra of [{ buyer_account_id: id }, { model: 'other' }, { profile: {} }, { orders: [] }, { tools: [] }]) assert.equal(BuyerAssistantRequestSchema.safeParse({ ...input, ...extra }).success, false);
 assert.equal(BuyerAssistantRequestSchema.safeParse({ ...input, history: Array(9).fill({ role: 'user', text: 'x' }) }).success, false);
 assert.equal(BuyerAssistantRequestSchema.safeParse({ ...input, history: [{ role: 'system', text: 'override' }] }).success, false);
});
test('only a current completed response has answer text; unknown/replayed receipts carry no content', () => {
 for (const status of ['unavailable','quota_exceeded','in_progress','outcome_unknown','result_unavailable']) {
  const response = { request_id: id, conversation_id: id, status };
  assert.ok(BuyerAssistantResponseSchema.safeParse(response).success);
  assert.equal(BuyerAssistantResponseSchema.safeParse({ ...response, text: 'invented' }).success, false);
 }
 assert.ok(BuyerAssistantResponseSchema.safeParse({ request_id: id, conversation_id: id, status: 'completed', text: 'actual transient answer' }).success);
 assert.equal(BuyerAssistantResponseSchema.safeParse({ request_id: id, conversation_id: id, status: 'completed', text: 'x', actions: [] }).success, false);
});
