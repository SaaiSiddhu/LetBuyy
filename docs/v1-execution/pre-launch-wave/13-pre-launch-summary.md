# 13 — Pre-Launch Wave Summary & Decision

**Date:** 2026-06-19 · **Branch:** `stepup/main`

## Decision: ⛔ NO-GO for October 1 production launch.
Not because of irreparable engineering — the platform is strong and got meaningfully hardened this wave — but because the launch-critical gates are dominated by **human/business/regulatory seams + live certifications that cannot be performed in an engineering environment**, plus a set of documented code hardening items.

## What was fixed this wave (real bugs, verified)
| Fix | Severity | Evidence |
|---|---|---|
| COD cancellation **inventory leak** (reject + timeout now release inventory) | CRITICAL | `order-risk.ts` helper; canonical `db.rpc`; contract-tested |
| COD + refund **gift-card balance not restored** (reject/timeout + canonical refund/complete) | HIGH | `order-risk.ts` + `orders.ts`; contract-tested |
| **shippingRateId dropped at the storefront proxy** (every order shipped flat/free) | HIGH | api-client type + proxy forward; gateway already consumed it; contract-tested |

All fixes: typecheck-clean, 167/167 launch regression, canonical-ledger-only validator PASS, no governance regression.

## Readiness scores (honest)
| Dimension | Score | Note |
|---|---|---|
| Theme | ~91% | Engineering done; B1 visual / B3 designer / B2 typography gated |
| Checkout | ~80% | Shipping fixed; GST stateCode gap; live Razorpay gate |
| Payments | ~78% | Capture/refund sound; COD queue-path/cron/risk + webhook G4/G5/G7 + payout-race open |
| Infrastructure | ~15% (code) | 85% human-gated (H2–H9) — the dominant launch gate |
| Security | ~90% | Controls launch-grade; FORCE-RLS on PII + E2 step-up + registry regen pending |
| **Platform (engineering)** | **~93%** | up from ~92% (real fixes); **overall LAUNCH readiness is gated below this by the human seams** |

## Launch confidence for Oct 1: **LOW** — gated, not ready.

## Blockers to GO (by owner)
**Human / business / regulatory (weeks):** H2 secrets · H3 DNS+SSL · H4 prod Supabase · H6 Resend (also unblocks platform-console + order emails) · H7 Turnstile · **H8 Razorpay Route PA onboarding (weeks, regulatory)** · H9 legal · WABA WhatsApp (COD confirmation live).

**Live certifications (staging + real Razorpay):** CAP-C01 capture-ledger · CAP-C02 refund-ledger · CAP-C03 payout · CAP-C04 reconciliation.

**Code hardening (engineering, ~days):** COD queue-auto-expiry parity (inventory/GC/email) · COD dedicated timeout cron (F5) · auto-risk-screen at order creation (F6) · webhook inbound tests + DLQ alerting + refund-before-capture guard (G4/G5/G7) · refund step-up on orders/returns routes (E2) · GST `stateCode` capture (I-2) · FORCE RLS on PII tables · `letbuyy-core` activation (B4).

**Verification / human (staging):** theme visual certification across 10 experiences × devices × draft/published (B1) · designer review of 5 designed experiences (B3).

**Inherited WIP cleanup:** tenant-isolation registry regen · design-system CSS drift baseline · commit untracked migrations 186/187 → green the full gate.

## Files changed this wave
`order-risk.ts`, `orders.ts`, `api-client/src/index.ts`, `storefront-runtime/.../api/orders/route.ts`, `tests/launch/lb-checkout-hardening.test.mjs`, `docs/v1-execution/pre-launch-wave/*` (13).

## Recommendation
Run the human-seam track (H2–H9) and live certifications (CAP-C01..C04) in parallel with the documented code-hardening backlog (above). The engineering foundation is sound and money-safe on the audited happy paths; **re-evaluate for GO once the human seams, live money certs, and the code-hardening backlog clear on staging.** October 1 is not achievable unless the H-seams (especially H8 Razorpay Route) are already in flight.
