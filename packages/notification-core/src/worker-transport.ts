import { z } from 'zod';
import { OrderEmailMessageSchema } from './order-email';

const Worker = z.string().min(8).max(200).trim();
const Job = z.uuid();
const Empty = z.object({}).strict();
const Limit = z.object({ limit: z.number().int().min(1).max(25) }).strict();
const Result = z.record(z.string(), z.unknown()).refine(value => JSON.stringify(value).length <= 4000);
const frame = { worker_id: Worker };
const operation = <T extends string, S extends z.ZodType>(name: T, payload: S) =>
  z.object({ ...frame, operation: z.literal(name), job_id: Job, payload }).strict();

/** A closed transport vocabulary, never a caller-selected SQL/RPC interface. */
export const NotificationWorkerRequestSchema = z.discriminatedUnion('operation', [
  z.object({ ...frame, operation: z.literal('claim'), payload: Limit }).strict(),
  z.object({ ...frame, operation: z.literal('recover'), payload: Empty }).strict(),
  operation('order-delivery', Empty),
  operation('order-seal', z.object({ log_id: Job, message: OrderEmailMessageSchema }).strict()),
  operation('order-receipt', z.object({ log_id: Job, provider_id: z.string().min(1).max(200), subject: z.string().max(240) }).strict()),
  operation('staff-delivery', z.object({ invitation_id: Job }).strict()),
  operation('operator-delivery', z.object({ sender: z.string().max(500).nullable() }).strict()),
  operation('complete', z.object({ result: Result }).strict()),
  operation('fail', z.object({ message: z.string().max(1000), retry_seconds: z.number().int().min(1).max(86400), result: Result }).strict()),
  operation('quarantine', z.object({ message: z.string().max(1000), result: Result }).strict()),
]);
export type NotificationWorkerRequest = z.infer<typeof NotificationWorkerRequestSchema>;
export const NotificationWorkerResponseSchema = z.object({ success: z.literal(true), data: z.object({ result: z.unknown() }).strict() }).strict();
