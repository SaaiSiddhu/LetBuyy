import { z } from 'zod';

/** Public, non-secret setup state. Credential checks do not establish KYC or bank approval. */
export const StorePaymentSetupSchema = z.object({
  connection: z.enum(['own_account', 'managed_sandbox', 'unresolved', 'not_connected']),
  environment: z.enum(['sandbox', 'live']).nullable(),
  status: z.enum(['not_configured', 'disabled', 'action_required', 'test_ready']),
  can_enable_online: z.boolean(),
  online_checkout_available: z.boolean(),
  blocking_reasons: z.array(z.enum([
    'schema_unavailable', 'credentials_missing', 'credentials_unverified',
    'credentials_unusable', 'account_model_unresolved', 'live_checkout_not_qualified', 'managed_sandbox_disabled',
  ])),
  business_verification: z.literal('not_confirmed'),
  bank_verification: z.literal('not_confirmed'),
  settlement_status: z.enum(['not_available_in_test', 'not_confirmed']),
  managed_payments: z.object({
    available: z.boolean(),
    reason: z.enum(['sandbox_only', 'provider_approval_required']),
  }),
});

const OwnAccountPaymentConfigSchema = z.object({
  key_id: z.string().min(12).max(128).regex(/^rzp_(test|live)_[A-Za-z0-9]+$/),
  key_secret: z.string().min(16).max(256).regex(/^[^\s\u0000-\u001f]+$/),
  test_mode: z.boolean().default(true),
  expected_revision: z.string().datetime({ offset: true }).optional(),
}).strict().superRefine((value, context) => {
  if (value.key_id.startsWith('rzp_test_') !== value.test_mode) {
    context.addIssue({ code: 'custom', path: ['test_mode'], message: 'The Razorpay key must match the selected test or live environment.' });
  }
});

export const SaveStorePaymentConfigSchema = z.union([
  OwnAccountPaymentConfigSchema,
  z.object({ connection: z.literal('managed_sandbox'),
    expected_revision: z.string().datetime({ offset: true }).optional() }).strict(),
]);

export const UpdateStorePaymentMethodsSchema = z.object({
  cod_enabled: z.boolean().optional(),
  online_payment_enabled: z.boolean().optional(),
  expected_revision: z.string().datetime({ offset: true }).optional(),
}).strict().refine(value => value.cod_enabled !== undefined || value.online_payment_enabled !== undefined, {
  message: 'Choose a payment method setting to update.',
});

export type StorePaymentSetup = z.infer<typeof StorePaymentSetupSchema>;
export type SaveStorePaymentConfigInput = z.input<typeof SaveStorePaymentConfigSchema>;
export type UpdateStorePaymentMethodsInput = z.infer<typeof UpdateStorePaymentMethodsSchema>;
