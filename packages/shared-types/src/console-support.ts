import { z } from 'zod';
export const SupportTicketStatusSchema = z.enum(['open', 'pending_customer', 'pending_internal', 'escalated', 'resolved', 'closed']);
export const SupportTicketPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);
export const SupportTicketChannelSchema = z.enum(['email', 'in_app', 'chat', 'phone', 'api']);
export const SupportTicketTopicSchema = z.enum(['billing', 'technical', 'abuse', 'onboarding', 'payments', 'orders', 'themes', 'apps', 'general']);
// What a ticket in the platform queue can carry, so what the queue can be filtered by: every topic above plus 'privacy'
// (migration 261). Only the buyer's privacy intake writes a privacy ticket. An operator creates tickets and macros with
// SupportTicketTopicSchema, which leaves 'privacy' out on purpose: filter with this schema, create with that one.
export const SupportTicketQueueTopicSchema = z.enum(['billing', 'technical', 'abuse', 'onboarding', 'payments', 'orders', 'themes', 'apps', 'general', 'privacy']);
export const SupportTicketMessageAuthorSchema = z.enum(['requester', 'agent', 'system']);
export const SupportTicketMessageVisibilitySchema = z.enum(['public', 'internal']);
export const SupportTicketEscalationTargetSchema = z.enum(['risk', 'trust_safety', 'incident', 'finance', 'engineering']);
export const SupportTicketSlaClockTypeSchema = z.enum(['first_response', 'resolution']);

export type SupportTicketStatus = z.infer<typeof SupportTicketStatusSchema>;
export type SupportTicketPriority = z.infer<typeof SupportTicketPrioritySchema>;
export type SupportTicketChannel = z.infer<typeof SupportTicketChannelSchema>;
export type SupportTicketTopic = z.infer<typeof SupportTicketTopicSchema>;
export type SupportTicketQueueTopic = z.infer<typeof SupportTicketQueueTopicSchema>;
export type SupportTicketMessageAuthor = z.infer<typeof SupportTicketMessageAuthorSchema>;
export type SupportTicketMessageVisibility = z.infer<typeof SupportTicketMessageVisibilitySchema>;
export type SupportTicketEscalationTarget = z.infer<typeof SupportTicketEscalationTargetSchema>;
export type SupportTicketSlaClockType = z.infer<typeof SupportTicketSlaClockTypeSchema>;



export const ConsoleSupportQueueQuerySchema = z.object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    q: z.string().trim().max(160).optional(), site_id: z.string().uuid().optional(),
    status: SupportTicketStatusSchema.optional(), priority: SupportTicketPrioritySchema.optional(),
    topic: SupportTicketQueueTopicSchema.optional(), assignee_id: z.string().uuid().optional(),
    view: z.enum(['all', 'mine', 'unassigned', 'overdue']).default('all'),
});
export const ConsoleSupportOwnershipSchema = z.object({
    assignee_id: z.string().uuid().nullable(), priority: SupportTicketPrioritySchema,
    expected_updated_at: z.string().datetime({ offset: true }),
    reason: z.string().trim().min(8).max(1000),
}).strict();
export const ConsoleSupportClockSchema = z.object({
    id: z.string().uuid(), ticket_id: z.string().uuid(),
    clock_type: z.enum(['first_response', 'resolution']), due_at: z.string().datetime({ offset: true }),
    paused: z.boolean(), breached: z.boolean(), satisfied_at: z.string().nullable(),
});
export const ConsoleSupportTicketSchema = z.object({
    id: z.string().uuid(), site_id: z.string().uuid().nullable(), ticket_ref: z.string(), subject: z.string(),
    status: SupportTicketStatusSchema, topic: SupportTicketQueueTopicSchema, priority: SupportTicketPrioritySchema,
    assignee_id: z.string().uuid().nullable(), created_at: z.string(), updated_at: z.string(),
    sla_clocks: z.array(ConsoleSupportClockSchema).max(2).optional(),
});
export const ConsoleSupportAssigneeSchema = z.object({ id: z.string().uuid(), user_id: z.string().uuid().nullable(), full_name: z.string().nullable(), email: z.string().nullable() });
export type ConsoleSupportTicket = z.infer<typeof ConsoleSupportTicketSchema>;
export type ConsoleSupportClock = z.infer<typeof ConsoleSupportClockSchema>;
export type ConsoleSupportAssignee = z.infer<typeof ConsoleSupportAssigneeSchema>;
export type ConsoleSupportOwnership = z.infer<typeof ConsoleSupportOwnershipSchema>;

export const ConsoleDependencyHealthSchema = z.object({
    observed_at: z.string().datetime({offset:true}),
    database: z.object({status:z.enum(['reachable','unavailable']),latency_ms:z.number().int().nonnegative(),action:z.string()}),
});
export type ConsoleDependencyHealth = z.infer<typeof ConsoleDependencyHealthSchema>;
