import type { ReelMerchantCommand, ReelReviewerCommand, ReelReadback, ReelReviewPage, ReelUploadBegin, ReelUploadRetry, ReelUploadReadback, ReelUploadCapabilities } from '@letbuyy/shared-types';
import type { LetbuyyRequestOptions } from './index';
export type { ReelMerchantCommand, ReelReviewerCommand, ReelReadback, ReelReviewPage, ReelDraftSelection, ReelSummary } from '@letbuyy/shared-types';

interface ReelTransport { requestData<T>(path: string, options?: LetbuyyRequestOptions): Promise<T> }
type MutationResult = Pick<ReelReadback, 'reel' | 'revision'> & { replayed: boolean };
export function createReelReviewSdk(client: ReelTransport) {
  const path = (id: string) => `/reels/${encodeURIComponent(id)}`;
  const uploads = (id?: string) => '/reels/uploads' + (id ? '/' + encodeURIComponent(id) : '');
  return {
    uploadCapabilities: (siteId: string, options?: LetbuyyRequestOptions) => client.requestData<ReelUploadCapabilities>(uploads() + '/capabilities', { ...options, query: { store_id: siteId } }),
    uploadList: (siteId: string, options?: LetbuyyRequestOptions) => client.requestData<{ items: ReelUploadReadback[] }>(uploads(), { ...options, query: { store_id: siteId } }),
    uploadGet: (siteId: string, id: string, options?: LetbuyyRequestOptions) => client.requestData<ReelUploadReadback>(uploads(id), { ...options, query: { store_id: siteId } }),
    uploadBegin: (siteId: string, command: ReelUploadBegin, options?: LetbuyyRequestOptions) => client.requestData<ReelUploadReadback>(uploads(), { ...options, method: 'POST', query: { store_id: siteId }, body: command, idempotencyKey: command.idempotency_key }),
    uploadReconcile: (siteId: string, id: string, command: ReelUploadRetry, options?: LetbuyyRequestOptions) => client.requestData<ReelUploadReadback>(uploads(id), { ...options, method: 'POST', query: { store_id: siteId }, body: command, idempotencyKey: command.idempotency_key }),
    uploadOriginal: (siteId: string, id: string, body: Blob, command: ReelUploadRetry, options?: LetbuyyRequestOptions) => client.requestData<ReelUploadReadback>(uploads(id) + '/content', {
      ...options, method: 'PUT', query: { store_id: siteId }, body, idempotencyKey: command.idempotency_key,
      headers: { ...Object.fromEntries(new Headers(options?.headers)), 'Content-Type': body.type, 'X-Reel-Upload-Version': String(command.expected_version) },
    }),
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
