import { z } from "zod";
export const MerchantMessageCategorySchema = z.enum([
  "ad_campaigns",
  "offers",
  "regulations",
  "platform_updates",
]);
const ActionUrl = z
  .string()
  .url()
  .max(2048)
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  }, "Use a public HTTPS link without credentials.")
  .nullable();
export const MerchantMessageContentSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    body: z.string().trim().min(3).max(8000),
    category: MerchantMessageCategorySchema,
    action_url: ActionUrl,
    expires_at: z.string().datetime({ offset: true }).nullable(),
    audience_mode: z.enum(["all", "selected"]),
    target_user_ids: z.array(z.string().uuid()).max(500),
  })
  .strict()
  .refine(
    (value) =>
      value.audience_mode === "all"
        ? value.target_user_ids.length === 0
        : value.target_user_ids.length > 0,
    "Choose the merchant accounts for this message.",
  );
export const MerchantMessageSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  body: z.string(),
  category: MerchantMessageCategorySchema,
  action_url: ActionUrl,
  expires_at: z.string().nullable(),
  audience_mode: z.enum(["all", "selected"]),
  target_user_ids: z.array(z.string().uuid()),
  status: z.enum(["draft", "published"]),
  revision: z.number().int().positive(),
  published_at: z.string().nullable(),
  published_count: z.number().int().nonnegative(),
  created_at: z.string(),
  updated_at: z.string(),
});
export const MerchantMessageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(25),
  q: z.string().trim().max(120).default(""),
  status: z.enum(["draft", "published"]).optional(),
});
export const MerchantMessageCommandSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("save"),
      id: z.string().uuid(),
      request_key: z.string().uuid(),
      expected_revision: z.number().int().nonnegative(),
      content: MerchantMessageContentSchema,
      reason: z.string().trim().min(8).max(1000),
    })
    .strict(),
  z
    .object({
      operation: z.literal("publish"),
      id: z.string().uuid(),
      request_key: z.string().uuid(),
      expected_revision: z.number().int().positive(),
      audience_hash: z.string().regex(/^[a-f0-9]{64}$/),
      reason: z.string().trim().min(8).max(1000),
    })
    .strict(),
  z
    .object({
      operation: z.literal("recover"),
      id: z.string().uuid(),
      request_key: z.string().uuid(),
    })
    .strict(),
]);
export const MerchantMessageAccountSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().nullable(),
  email: z.string(),
});
export const MerchantMessageReviewSchema = z.object({
  message: MerchantMessageSchema,
  recipient_count: z.number().int().nonnegative(),
  audience_hash: z.string(),
  sample: z.array(MerchantMessageAccountSchema).max(5),
  marked_read: z.number().int().nonnegative(),
  observed_at: z.string(),
});
export const MerchantInboxQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(25),
  is_read: z.enum(["true", "false"]).optional(),
  type: z.string().max(40).optional(),
  source: z.literal("platform").optional(),
  category: MerchantMessageCategorySchema.optional(),
});
export const MerchantInboxItemSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  title: z.string(),
  message: z.string().nullable(),
  is_read: z.boolean(),
  created_at: z.string(),
  action_url: z.string().nullable(),
  data: z.record(z.string(), z.unknown()),
});
export type MerchantMessage = z.infer<typeof MerchantMessageSchema>;
export type MerchantMessageAccount = z.infer<
  typeof MerchantMessageAccountSchema
>;
export type MerchantMessageReview = z.infer<typeof MerchantMessageReviewSchema>;
export type MerchantInboxItem = z.infer<typeof MerchantInboxItemSchema>;
