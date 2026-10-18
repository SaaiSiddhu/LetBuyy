import { z } from 'zod';

// Content is transient request/response data. Operation receipts contain none.
export const BuyerAssistantRequestSchema = z.object({
  request_id: z.string().uuid(),
  conversation_id: z.string().uuid(),
  prompt: z.string().trim().min(1).max(2000),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    text: z.string().trim().min(1).max(2000),
  }).strict()).max(8),
}).strict();
const identity = { request_id: z.string().uuid(), conversation_id: z.string().uuid() };
export const BuyerAssistantResponseSchema = z.discriminatedUnion('status', [
  z.object({ ...identity, status: z.literal('completed'), text: z.string().min(1).max(8000) }).strict(),
  ...(['unavailable', 'quota_exceeded', 'in_progress', 'outcome_unknown', 'result_unavailable'] as const)
    .map(status => z.object({ ...identity, status: z.literal(status) }).strict()),
]);
export type BuyerAssistantRequest = z.infer<typeof BuyerAssistantRequestSchema>;
export type BuyerAssistantResponse = z.infer<typeof BuyerAssistantResponseSchema>;
