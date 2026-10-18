import type { ReelMerchantCommand, ReelReviewerCommand, ReelReadback, ReelReviewPage } from '@letbuyy/shared-types';
import type { LetbuyyRequestOptions } from './index';
export type { ReelMerchantCommand, ReelReviewerCommand, ReelReadback, ReelReviewPage, ReelDraftSelection, ReelSummary } from '@letbuyy/shared-types';

interface ReelTransport { requestData<T>(path: string, options?: LetbuyyRequestOptions): Promise<T> }
type MutationResult = Pick<ReelReadback, 'reel' | 'revision'> & { replayed: boolean };
export function createReelReviewSdk(client: ReelTransport) {
  const path = (id: string) => `/reels/${encodeURIComponent(id)}`;
  return {
    list: (siteId: string, page = 1, options?: LetbuyyRequestOptions) => client.requestData<ReelReviewPage>('/reels', { ...options, query: { store_id: siteId, page } }),
    get: (siteId: string, id: string, options?: LetbuyyRequestOptions) => client.requestData<ReelReadback>(path(id), { ...options, query: { store_id: siteId } }),
    mutate: (siteId: string, id: string, command: ReelMerchantCommand, options?: LetbuyyRequestOptions) => client.requestData<MutationResult>(path(id), {
      ...options, method: 'POST', query: { store_id: siteId }, body: command, idempotencyKey: command.idempotency_key,
    }),
    operatorList: (page = 1, options?: LetbuyyRequestOptions) => client.requestData<ReelReviewPage>('/internal/console/reels', { ...options, query: { page } }),
    operatorGet: (id: string, options?: LetbuyyRequestOptions) => client.requestData<ReelReadback>(`/internal/console${path(id)}`, options),
    operatorMutate: (siteId: string, id: string, command: ReelReviewerCommand, options?: LetbuyyRequestOptions) => client.requestData<MutationResult>(`/internal/console${path(id)}`, {
      ...options, method: 'POST', query: { store_id: siteId }, body: command, idempotencyKey: command.idempotency_key,
    }),
  };
}
