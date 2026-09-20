# Top 50 Recommendations

**HEAD `ae383bb8`. Actionable, ordered by leverage.**

## Do first — the launch gate (1–12)
1. Fix LB-8: register an `announcementBar` renderer in `renderer-registry.tsx`.
2. Fix shipping-drop: forward `shippingRateId` in `app/api/orders/route.ts` createOrder payload.
3. Fix LB-11: remove gift-card nav entry + add storefront redemption input (or hide gift cards for V1).
4. Wire one external alert sink (Slack/PagerDuty/email) for sev2 incidents — flip `incident-command.ts` off dry-run.
5. Decide: does payout gate on KYC? If yes, add the check in `payouts.ts` + a console review surface.
6. Add rate-limit + Turnstile to `/contacts` and storefront contact route.
7. Execute `HR-B1A`: push `stepup/main`→`main` under branch protection.
8. Provision ~40 prod secrets via secret-manager.
9. Stand up production Supabase + run gated migrate (with backup).
10. DNS zone + wildcard `*.letbuyy.com`.
11. Razorpay live + Route onboarding (start early — long pole).
12. Resend domain auth (SPF/DKIM/DMARC) + `LETBUYY_EMAIL_MODE=live`.

## Harden before scale (13–28)
13. Per-identity/per-account limiter on customer auth fallback paths.
14. Persist checkout GST invoice into the immutable `gst_invoices` table.
15. Add COD order-placed email (decouple from `order.paid`).
16. Add `email.order_shipped` dispatch to the live queue path.
17. Provision per-caller `INTERNAL_API_KEYRING`; flip `INTERNAL_AUTH_LEGACY_ACCEPT=false`.
18. Add limiter to coupon-validate endpoints.
19. Scope mig 100 marketplace policies to `TO service_role`.
20. Constant-time the webhook internal-secret compare.
21. Add a dedicated security metric/alert on signature-verify failures.
22. Build merchant-teams invite acceptance page + enforce `site_memberships` RBAC, OR formally defer teams to V1.1.
23. Real ToS/Privacy/DPDP pages + fix `/terms` `/privacy` `/legal` routes.
24. Add a `proxy.ts`-exists invariant + make guard tests resistant to lockstep weakening.
25. Wire storefront search to the trigram backend or document the client-filter limitation.
26. Fix analytics `revenueByMonth` or banner it as estimated.
27. Per-request ES256 re-verification (or document the DB-session trust model explicitly).
28. Remove/guard non-V1 Stripe/PayPal routes for the V1 surface.

## Operability (29–40)
29. Observability dashboards (Workers logs + Analytics Engine + Supabase).
30. Raise observability sampling for error classes to 100% (already biased; confirm).
31. Rollback drill on staging.
32. Continuous queue consumers (not just 15-min cron) before volume.
33. DLQ-depth + circuit-open alerts.
34. Hyperdrive pool sizing review for expected write concurrency.
35. Load-test checkout against single-region Postgres; find the real concurrent-checkout number.
36. Inventory: optimistic/queued reservation for flash-sale SKUs (V2).
37. Pre-warm KV cache for top stores.
38. Document the V1 scale envelope (10–1,000 merchants) for sales.
39. Add idempotency-key client guidance.
40. Backup retention + restore-time SLO.

## Governance / process (41–50)
41. Reconcile `MASTER_SYSTEM_RESEARCH` docs with this cert (mark LB-1 satisfied).
42. Add a CI check that fails if a `tests/launch/*` guard is edited in the same commit as the code it guards (without an ARB tag).
43. Keep gate green after each fix.
44. ARB sign-off for any money/identity/tenancy/checkout change.
45. Tag a V1 freeze once 1–12 done.
46. Pilot issue register with P0 freeze protocol.
47. G4 go-live probes in CI (takeover-deny, anon-order-deny, commission=0).
48. Single CANONICAL executor for the push (avoid split-brain).
49. Memory: record "Next 16 proxy.ts = middleware" to prevent re-flagging LB-1.
50. Post-pilot retro before scaling to 100 merchants.
