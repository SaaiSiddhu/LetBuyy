import { z } from 'zod';
const Minor = z.union([z.number().int().safe(), z.string().regex(/^\d+$/)]).transform(String).nullable();
export const ConsoleBillingQuerySchema = z.object({
    page:z.coerce.number().int().min(1).max(10000).default(1),limit:z.coerce.number().int().min(1).max(50).default(25),
    section:z.enum(['invoices','payments','renewals','mandates']).default('invoices'),
    status:z.preprocess(value=>value===''?undefined:value,z.string().regex(/^[a-z_]{1,40}$/).optional()),invoice_id:z.string().uuid().optional(),format:z.literal('csv').optional(),
}).refine(q=>!q.invoice_id||q.section==='invoices','An invoice ID requires the invoice section');
/** Minimal operator projection over the existing immutable financial records. */
export const ConsoleBillingRecordSchema = z.object({
    id:z.string().uuid(),kind:z.enum(['invoices','payments','renewals','mandates']),reference:z.string(),status:z.string(),
    payment_status:z.string().nullable(),amount_minor:Minor,currency:z.string().nullable(),
    provider:z.string().nullable(),provider_reference:z.string().nullable(),related_id:z.string().uuid().nullable(),
    period_start:z.string().nullable(),period_end:z.string().nullable(),created_at:z.string(),next_attempt_at:z.string().nullable(),
});
export const ConsoleBillingWorkspaceSchema = z.object({
    observed_at:z.string(),site:z.object({id:z.string().uuid(),name:z.string().nullable(),store_name:z.string().nullable()}),
    subscription:z.object({id:z.string().uuid(),plan:z.string().nullable(),status:z.string().nullable(),billing_period:z.string().nullable(),current_period_end:z.string().nullable()}).nullable(),
    entitlements:z.object({plan:z.string(),features:z.array(z.string()),limits:z.record(z.string(),z.unknown())}).nullable(),
    unavailable:z.array(z.enum(['subscription','entitlements'])),section:z.enum(['invoices','payments','renewals','mandates']),
    records:z.array(ConsoleBillingRecordSchema).max(50),
    meta:z.object({page:z.number().int(),per_page:z.number().int(),total:z.number().int(),has_next:z.boolean(),has_prev:z.boolean()}),
});
export type ConsoleBillingRecord=z.infer<typeof ConsoleBillingRecordSchema>;
export type ConsoleBillingWorkspace=z.infer<typeof ConsoleBillingWorkspaceSchema>;
