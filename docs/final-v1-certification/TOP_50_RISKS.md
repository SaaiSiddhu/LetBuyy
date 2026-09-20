# Top 50 Risks

**HEAD `ae383bb8`. Risk = could-cause-harm, ranked by severity × likelihood.**

## Critical (1–8)
1. Money/auth outage pages nobody (dry-run alerting) → silent revenue loss.
2. Gate can move with code — a guard test was edited alongside a feature change (`9c3f2157`); legitimate here, but proves the gate isn't tamper-evident.
3. Shared `INTERNAL_API_SECRET` is the real per-request merchant trust root; legacy-accept ON → fleet blast radius.
4. First deploy ships 217 unrun-in-prod commits + 103 migrations in one shot.
5. Payouts settle without KYC verification → compliance exposure.
6. Single-region Postgres write ceiling under any flash crowd.
7. Stale internal status docs ("LB-1 done / 2 blockers") misdirect launch decisions (this cert corrects them).
8. Contact-form email-bombing burns Resend quota + owner trust.

## High (9–22)
9. Shipping-rate drop charges wrong (free) standard shipping → margin leak at scale.
10. Invited staff can never activate → merchants think teams work; they don't.
11. No KYC operator surface → documents pile with no decision path.
12. Unprovisioned secrets fail closed → signup/login/email silently dead on first deploy if any secret missed.
13. GST invoice on mutable column → tax record tamperable post-issue.
14. Coupon enumeration → discount leakage.
15. Distributed credential-stuffing (per-IP-only limiter).
16. Razorpay Route onboarding latency (KYC/underwriting) blocks payouts for weeks.
17. Resend domain-auth latency (DNS propagation) blocks all email.
18. Backup/rollback never drilled.
19. Queue drain on 15-min cron → email/notification latency under load.
20. mig 100 `USING(true)` becomes live if any anon write path is added.
21. Dead notification-core templates imply email coverage the live path lacks (no shipped email).
22. Webhook internal `!==` timing side-channel.

## Medium (23–38)
23. COD no-email → support tickets / perceived failed orders.
24. Storefront search thin → poor UX on large catalogs.
25. Analytics hardcoded `revenueByMonth` → wrong merchant decisions.
26. Non-V1 Stripe/PayPal routes unaudited (secret-gated).
27. ES256 verified only at session creation, not per request.
28. Hyperdrive 3-conn pool exhaustion under write storm.
29. Inventory `FOR UPDATE` contention on hot SKUs.
30. Supabase Free-tier connection/size wall (~100 merchants).
31. Workers free req/day wall.
32. R2 egress cost at high media volume.
33. 2FA TOTP brute-force within a session.
34. `/storefront/directory` lists draft stores (minor disclosure).
35. notifications `/send` arbitrary actor_id targeting.
36. Frozen app-marketplace OAuth surfaces mounted with no first-party client.
37. Smart-placement + single region → cross-region write latency for distant buyers.
38. No per-tenant rate isolation → one noisy store can bucket-starve neighbors on shared IP.

## Low (39–50)
39. Theme Liquid path OFF (React-only V1) — fine, but parity 0%. 40. Mobile merchant app login seams (V2). 41. Impersonation consumer absent. 42. Support-ticket queue thin. 43. Section image-upload widget missing. 44. Footer-menu edit UI missing. 45. `revalidate=60` staleness window on price changes. 46. Idempotency-key collisions if client reuses keys. 47. KV cache invalidation lag. 48. Dead-letter backlog needs manual drain. 49. Observability 10% sampling misses tail errors. 50. Governance memory drift vs code (ongoing).
