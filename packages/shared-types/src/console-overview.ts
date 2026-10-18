import { z } from 'zod';

export const InternalConsoleSummarySchema = z.object({
  total_users: z.number().int().nonnegative(),
  total_stores: z.number().int().nonnegative(),
  active_stores: z.number().int().nonnegative(),
  total_subscriptions: z.number().int().nonnegative(),
  active_subscriptions: z.number().int().nonnegative(),
  total_employees: z.number().int().nonnegative(),
  total_audit_logs: z.number().int().nonnegative(),
  // Preserves the existing active-subscription amount_paid aggregate and unit.
  // This projection is not recognized revenue, settlement or a ledger balance.
  monthly_revenue_paise: z.number().int(),
}).strict();
export type InternalConsoleSummary = z.infer<typeof InternalConsoleSummarySchema>;

export const InternalConsoleAnalyticsSchema = z.object({
  period_days: z.literal(30),
  new_signups: z.number().int().nonnegative(),
  stores_created: z.number().int().nonnegative(),
  subscriptions_created: z.number().int().nonnegative(),
  audit_events: z.number().int().nonnegative(),
  signup_to_store_conversion_percent: z.number().nonnegative(),
}).strict();
export type InternalConsoleAnalytics = z.infer<typeof InternalConsoleAnalyticsSchema>;
