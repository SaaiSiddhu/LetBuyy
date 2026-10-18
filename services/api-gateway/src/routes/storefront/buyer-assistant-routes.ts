import type { Hono } from 'hono';
import type { Env } from '../../index';
import { getBuyerSession, requireBuyerSession } from '../../middleware/buyer-session';
import { BuyerAssistantRequestSchema, BuyerAssistantResponseSchema } from '../../schemas/buyer-assistant.schema';
import { BuyerAiAdmissionDenied, executeBuyerAssistant } from '../../execution/buyer-assistant.adapter';
import type { AppContext } from './customer-engagement-routes';

export interface BuyerAssistantRoutesDeps {
  dependencies(c: AppContext): Parameters<typeof executeBuyerAssistant>[2];
}
export function registerBuyerAssistantRoutes(router: Hono<{ Bindings: Env }>, deps: BuyerAssistantRoutesDeps): void {
  router.post('/buyer/assistant', requireBuyerSession, async c => {
    c.header('Cache-Control', 'no-store');
    const session = getBuyerSession(c);
    if (!session || !Number.isSafeInteger(session.sessionEpoch) || session.sessionEpoch! < 0) {
      return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A buyer session is required.' } }, 401);
    }
    let body: unknown;
    try {
      if (!c.req.header('content-type')?.toLowerCase().startsWith('application/json')) throw new Error();
      const reader = c.req.raw.body?.getReader();
      if (!reader) throw new Error();
      const chunks: Uint8Array[] = []; let size = 0;
      try {
        for (;;) {
          const { value, done } = await reader.read(); if (done) break;
          size += value.byteLength;
          if (size > 65536) { await reader.cancel(); throw new Error(); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      body = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes));
    } catch { return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid assistant request.' } }, 400); }
    const parsed = BuyerAssistantRequestSchema.safeParse(body);
    if (!parsed.success) return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid assistant request.' } }, 400);
    try {
      const response = await executeBuyerAssistant({ buyerAccountId: session.buyerAccountId, sessionEpoch: session.sessionEpoch! }, parsed.data, deps.dependencies(c));
      return c.json({ success: true, data: BuyerAssistantResponseSchema.parse(response) });
    } catch (error) {
      if (error instanceof BuyerAiAdmissionDenied) {
        const conflict = error.code === 'conflict';
        return c.json({ success: false, error: { code: conflict ? 'AI_REQUEST_CONFLICT' : 'UNAUTHORIZED',
          message: conflict ? 'This request identifier belongs to another operation.' : 'A current buyer session is required.' } }, conflict ? 409 : 401);
      }
      return c.json({ success: false, error: { code: 'AI_UNAVAILABLE', message: 'Assistant is unavailable.' } }, 503);
    }
  });
}
