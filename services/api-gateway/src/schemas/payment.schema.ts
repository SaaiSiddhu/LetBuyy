import { z } from 'zod';

export const V1PaymentProviderSchema = z.enum(['razorpay', 'cashfree', 'upi', 'cod']);
export const V1PaymentModeSchema = z.enum(['mock', 'sandbox', 'live']).optional();
export const PaymentSessionMetadataSchema = z.record(z.string(), z.unknown()).default({});

export const CreatePaymentSessionSchema = z.object({
    order_id: z.string().uuid(),
    provider: V1PaymentProviderSchema.default('razorpay'),
    mode: V1PaymentModeSchema,
    idempotency_key: z.string().min(8).max(200),
    customer_id: z.string().uuid().optional(),
    tokenize: z.boolean().optional().default(false),
    metadata: PaymentSessionMetadataSchema,
});

export const PaymentCaptureSchema = z.object({
    idempotency_key: z.string().min(8).max(200),
    provider_payment_id: z.string().min(1).max(200).optional(),
    metadata: PaymentSessionMetadataSchema,
});

export const PaymentVoidSchema = z.object({
    idempotency_key: z.string().min(8).max(200),
    reason: z.string().max(500).optional(),
    metadata: PaymentSessionMetadataSchema,
});

export const PaymentRefundSchema = z.object({
    idempotency_key: z.string().min(8).max(200),
    amount_minor: z.number().int().positive().optional(),
    reason: z.string().max(500).optional(),
    metadata: PaymentSessionMetadataSchema,
});

export type CreatePaymentSessionInput = z.infer<typeof CreatePaymentSessionSchema>;
export type PaymentCaptureInput = z.infer<typeof PaymentCaptureSchema>;
export type PaymentVoidInput = z.infer<typeof PaymentVoidSchema>;
export type PaymentRefundInput = z.infer<typeof PaymentRefundSchema>;
