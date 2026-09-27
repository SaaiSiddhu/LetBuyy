-- Phase 2 / F2.7 (Section 11): widen support_tickets.topic to admit 'privacy'.
--
-- Buyer-facing data-rights request intake (F2.7_PRIVACY_TENANT_ISOLATION.md) reuses the existing
-- support_tickets/ticket_messages system rather than introducing a parallel privacy platform
-- (buyer-support-routes.ts already establishes this pattern for support conversations). A privacy
-- request is not billing/technical/abuse/onboarding/payments/orders/themes/apps/general, so it needs
-- its own topic value; everything else about the row (columns, RLS, triggers, indexes) is unchanged.
ALTER TABLE public.support_tickets DROP CONSTRAINT support_tickets_topic_check;
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_topic_check
  CHECK (topic = ANY (ARRAY['billing'::text, 'technical'::text, 'abuse'::text, 'onboarding'::text, 'payments'::text, 'orders'::text, 'themes'::text, 'apps'::text, 'general'::text, 'privacy'::text]));
