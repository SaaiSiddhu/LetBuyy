import { createBuyerAiAdapter, type BuyerAiAdapter } from '@letbuyy/infrastructure/ai-generation-adapter';
import type { BuyerAssistantRequest, BuyerAssistantResponse } from '@letbuyy/shared-types';

export interface BuyerAiActor { buyerAccountId: string; sessionEpoch: number }
export type Admission = 'reserved' | 'conflict' | 'unauthorized' | 'quota_exceeded' |
  'in_progress' | 'outcome_unknown' | 'result_unavailable';
export interface BuyerAiReceiptStore {
  reserve(actor: BuyerAiActor, request: BuyerAssistantRequest, hash: string,
    profile: NonNullable<BuyerAiAdapter['profile']>, tokens: number): Promise<Admission>;
  transition(actor: BuyerAiActor, requestId: string,
    from: 'reserved' | 'dispatched', to: 'dispatched' | 'completed' | 'outcome_unknown'): Promise<boolean>;
}
export { createBuyerAiAdapter };
export class BuyerAiAdmissionDenied extends Error {
  constructor(readonly code: 'conflict' | 'unauthorized') { super('BUYER_AI_ADMISSION_DENIED'); }
}
export async function executeBuyerAssistant(
  actor: BuyerAiActor, request: BuyerAssistantRequest,
  dependencies: { provider: BuyerAiAdapter; receipts: BuyerAiReceiptStore; fingerprintKey?: string },
): Promise<BuyerAssistantResponse> {
  const { provider, receipts, fingerprintKey } = dependencies;
  const result = (status: Exclude<BuyerAssistantResponse['status'], 'completed'>): BuyerAssistantResponse =>
    ({ request_id: request.request_id, conversation_id: request.conversation_id, status });
  if (!provider.available || !provider.profile || !fingerprintKey || fingerprintKey.trim().length < 32 ||
      fingerprintKey.trim().startsWith('SKIP_NEEDS_HUMAN_')) return result('unavailable');
  const prepared = provider.prepare(request);
  if (!prepared) return result('unavailable');
  // Keyed, actor/session/resource/payload-bound fingerprint. No raw content is
  // passed to the durable store and no hash or credential reaches diagnostics.
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(fingerprintKey),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(JSON.stringify({
    buyer: actor.buyerAccountId, epoch: actor.sessionEpoch, ...request,
  })));
  const hash = [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
  try {
    const status = await receipts.reserve(actor, request, hash, provider.profile, prepared.reservedTokens);
    if (status === 'conflict' || status === 'unauthorized') throw new BuyerAiAdmissionDenied(status);
    if (status !== 'reserved') return result(status);
    if (!await receipts.transition(actor, request.request_id, 'reserved', 'dispatched')) {
      throw new BuyerAiAdmissionDenied('unauthorized');
    }
  } catch (error) {
    if (error instanceof BuyerAiAdmissionDenied) throw error;
    return result('outcome_unknown');
  }
  // Any exception from dispatch onwards is ambiguous. Never reserve again,
  // release its allowance, recover unstored content, or automatically resend.
  try {
    const text = await provider.generate(prepared);
    if (!await receipts.transition(actor, request.request_id, 'dispatched', 'completed')) {
      throw new BuyerAiAdmissionDenied('unauthorized');
    }
    return { request_id: request.request_id, conversation_id: request.conversation_id, status: 'completed', text };
  } catch (error) {
    if (error instanceof BuyerAiAdmissionDenied) throw error;
    try { await receipts.transition(actor, request.request_id, 'dispatched', 'outcome_unknown'); } catch { /* Already remains non-retryable. */ }
    return result('outcome_unknown');
  }
}
