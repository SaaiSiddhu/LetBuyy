import { z } from 'zod';

const MinorAmount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

/** Public projection of the canonical PostgreSQL quote. The browser never prices tax. */
export const CheckoutTotalsQuoteSchema = z.object({
  version: z.literal(1),
  currency: z.literal('INR'),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  collection_status: z.enum(['configured', 'not_collecting']),
  price_includes_tax: z.boolean(),
  place_of_supply_state: z.string().regex(/^[0-9]{2}$/).nullable(),
  subtotal_minor: MinorAmount,
  discount_minor: MinorAmount,
  shipping_minor: MinorAmount,
  shipping_discount_minor: MinorAmount,
  tax_minor: MinorAmount,
  added_tax_minor: MinorAmount,
  included_tax_minor: MinorAmount,
  total_minor: MinorAmount,
  components: z.array(z.object({
    title: z.enum(['CGST', 'SGST', 'UTGST', 'IGST']),
    rate_percent: z.number().min(0).max(100),
    amount_minor: MinorAmount,
  })).max(100),
});

export type CheckoutTotalsQuote = z.infer<typeof CheckoutTotalsQuoteSchema>;

export const StorefrontShippingOptionSchema = z.object({
  id: z.string().uuid(), name: z.string(), type: z.enum(['flat','free','price_based','weight_based']),
  currency: z.literal('INR'), amount_minor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  estimated_days_min: z.number().int().nonnegative().nullable(), estimated_days_max: z.number().int().nonnegative().nullable(),
  cod_available: z.boolean(), source: z.literal('seller_zone_configuration'), carrier_confirmed: z.literal(false),
});
export const StorefrontShippingOptionsSchema = z.array(StorefrontShippingOptionSchema).max(100);
export type StorefrontShippingOption = z.infer<typeof StorefrontShippingOptionSchema>;

export const ShippingProfileSchema = z.object({
  id: z.string().uuid(), site_id: z.string().uuid(), name: z.string(), is_default: z.boolean(),
  handling_fee_minor: MinorAmount, cod_enabled: z.boolean(), updated_at: z.string(),
});
export type ShippingProfile = z.infer<typeof ShippingProfileSchema>;

export const CreateShippingProfileSchema = z.object({
  store_id: z.string().uuid(), id: z.string().uuid(), name: z.string().trim().min(1).max(100),
  handling_fee_minor: z.number().int().nonnegative().max(100_000_000).default(0),
  cod_enabled: z.boolean().default(true),
}).strict();
export const UpdateShippingProfileSchema = z.object({
  expected_revision: z.string().datetime({ offset: true }),
  name: z.string().trim().min(1).max(100).optional(),
  handling_fee_minor: z.number().int().nonnegative().max(100_000_000).optional(),
  cod_enabled: z.boolean().optional(),
  is_default: z.literal(true).optional(),
}).strict().refine(value => Object.keys(value).length>1, 'At least one setting is required');
export type CreateShippingProfileInput = z.infer<typeof CreateShippingProfileSchema>;
export type UpdateShippingProfileInput = z.infer<typeof UpdateShippingProfileSchema>;

/** Account ownership choices. These flags describe enabled execution, not plans
 * inferred from the presence of a provider secret or a sandbox adapter. */
export const ShippingCapabilitiesSchema = z.object({
  provider_mode: z.literal('unavailable'),
  manual: z.literal(true),
  letbuyy_shipping: z.literal('integration_pending'),
  own_shiprocket_app: z.literal('integration_pending'),
  carrier_booking_available: z.literal(false),
});
export type ShippingCapabilities = z.infer<typeof ShippingCapabilitiesSchema>;
