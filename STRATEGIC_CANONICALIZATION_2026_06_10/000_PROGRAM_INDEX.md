# LETBUYY STRATEGIC CANONICALIZATION PROGRAM — 2026-06-10

> **Mandate:** Not to preserve the current implementation, not to pick the most-complete one — to determine the **Strategic Winners** (what should still exist at 100 → 1,000 → 10,000 India merchants) and the roadmap that moves LetBuyy directly to its intended architecture. LetBuyy has **no production merchants and no legacy burden**, so the rule is *move to the destination, preserve nothing for its own sake.*
> **Built on:** the 14-document forensic audit in `FORENSIC_MASTER_2026_06_10/` (291 evidence-anchored issues, 9 S0s — independently code-verified). This program turns those findings into strategic-winner decisions and an execution plan.
> **Constitution:** `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` + `LETBUYY_FINAL_ARCHITECTURE_FREEZE.md` ratified as canonical. The maximalist 1M-merchant/22-service/Wasm `CHECKOUT_PLATFORM` plan and the `AGENTS.md` 9-app end-state are formally rejected.

---

## The canonical LetBuyy (one paragraph)
One India-only **modular monolith** (`api-gateway`) + four satellites (`queue-workers`, `mobile-bff`, `identity-platform`, `webhook-service`) over **one RLS+GUC Postgres** on Cloudflare + Vercel, under **one constitution and one validator suite that enforces it**. Money is **one append-only double-entry ledger as the sole source of truth** (balance always derived, bigint paise), money-out via **licensed PA-split — never custody**, at a **permanent 0% transaction fee**. Identity is **`identity-platform` as the sole asymmetric token issuer** for all three realms (every other service verify-only). Tenancy is **fail-closed RLS `ENABLE`+`FORCE` + per-transaction GUC** as the load-bearing backstop, with the app-guard kept as the permanent outer layer and the gateway off blanket `service_role`. Commerce is **server-authoritative** end-to-end (one order RPC, server cart, hosted `checkout.letbuyy.com`, reserve→commit inventory) fronted by a **Liquid-first Online-Store-2.0 theme platform**. Everything Shopify-scale (Wasm checkout functions, 3rd-party marketplace, headless Hydrogen, CQRS, multi-region, the six reserved services) is **frozen as an empty seam**, reconsidered only at a named scale trigger.

**Final position:** *Ship the canonical monolith, rent the rails, make RLS and the ledger load-bearing, delete the parallel systems, and freeze the Shopify-scale machinery — the program is deletion and completion, not imitation.*

---

## What survives / freezes / is replaced / is deleted / is canonical (at a glance)

| Verdict | Headline items |
|---|---|
| **CANONICAL (build/finish — ~48% of components)** | canonical double-entry ledger · identity-platform sole issuer · layered RLS+GUC tenancy · server cart + hosted checkout · Liquid theme platform · storefront-runtime (one runtime) · merchant-control-plane + Flutter app · one design-token source + one shell · PA-split payout · transactional outbox · marketing-site · one internal ops console |
| **TRANSITIONAL (bridge, then retire — ~15%)** | React section renderer (first-party fast-path until Liquid parity) · client React cart (thin view) · dual-verify token window · app-layer query-guard (becomes outer layer, not sole) |
| **LEGACY (delete after the winner serves — ~20%)** | gateway `routes/auth.ts` mint + Supabase `/auth/*` + identity-foundation shadow · un-ledgered capture/refund/COD paths + 4 compat ledger tables + mutable balances · `runtime-composition` (unwire from storefront first) · `users_custom`, `store_id`/`site_id` dual, `*_partitioned` · 60+ competing root governance docs |
| **DEAD (SAFE_DELETE now — ~12%, ~28k+ LOC)** | CQRS/saga/extension package cluster (~13.3k LOC) · `legacy/firebase` (~15k) · parity catalog `merchant_feature_*` (~974) · `/api/auth/switch` takeover path · 6 anon RLS-to-PUBLIC policies + anon super_admin_allowlist · `razorpayx` self-custody rail · 3% rake · forgeable step-up · GUC-from-param posting · ~36 rejected-architecture "governance theater" validators |
| **FROZEN (empty seam, reconsider at trigger — ~5%)** | `app-marketplace` + `developer-portal` (keep OAuth2/PKCE seam) · 6 reserved services · reserved mobile apps · Wasm checkout-functions · headless Hydrogen tier · full in-WhatsApp commerce · partition helper |

Platform-wide classification totals (~121 significant components): **CANONICAL ≈58 · TRANSITIONAL ≈18 · LEGACY ≈24 · DEAD ≈15 · FROZEN ≈6.**

---

## The 15 deliverables

| # | Document | What it decides |
|---|----------|-----------------|
| — | **`000_PROGRAM_INDEX.md`** (this file) | The canonical architecture + at-a-glance verdicts |
| 1 | `STRATEGIC_WINNERS_MASTER_PLAN.md` | The 32-domain Current→Strategic→Migration→Legacy→Dead table + cluster narratives |
| 2 | `CANONICAL_ARCHITECTURE_MATRIX.md` | 155-row component matrix + canonical target diagram + classification totals |
| 3 | `LEGACY_ERADICATION_REGISTER.md` | 78 systems classified SAFE_DELETE / DELETE_AFTER_MIGRATION / KEEP_TEMPORARILY / CANONICAL |
| 4 | `SAFE_DELETION_PLAN.md` | 63 gated deletions, ordered, with pre/post validation + rollback |
| 5 | `SHOPIFY_ALIGNMENT_REPORT.md` | Align / diverge-intentionally / leapfrog vs current Shopify (web-verified) |
| 6 | `THEME_MIGRATION_MASTER_PLAN.md` | **React→Liquid** strategic-winner call + gated migration (the directive's explicit test) |
| 7 | `IDENTITY_MIGRATION_MASTER_PLAN.md` | identity-platform sole issuer; collapse 4 auth impls; HS256→asymmetric cutover |
| 8 | `MONEY_SYSTEM_CANONICALIZATION_PLAN.md` | Canonical ledger as SSOT; adapters/legacy/dead; PA-split; bigint cutover; backfill |
| 9 | `TENANT_ISOLATION_CANONICALIZATION_PLAN.md` | 3-layer fail-closed RLS+GUC; service_role→GUC staged cutover; 261-table FORCE |
| 10 | `UI_UX_UNIFICATION_MASTER_PLAN.md` | One token source + one shell; honesty badge; ratchet that blocks drift |
| 11 | `PLATFORM_SIMPLIFICATION_PLAN.md` | Four-realities reconciliation; deploy-meta-blocker; governance retargeting; topology 13→10 |
| 12 | `IMPLEMENTATION_EXECUTION_ROADMAP.md` | Waves 0–8 (goals/deps/risks/validation/exit) + critical path + burn-down |
| 13 | `TESTING_AND_VALIDATION_MASTER_PLAN.md` | 9-class test taxonomy per winner; deletion-validation gates; wave-exit matrix |
| 14 | `PRODUCTION_READINESS_GAP_REPORT.md` | Per-winner completion % + remaining eng-weeks (≈55% tree / ~80 weeks to beta) |
| 15 | `FINAL_ARCHITECTURE_DECISION_RECORD.md` | 24 ADRs (ACCEPTED) + the 30/90/180/365 executive answers |

---

## The roadmap in one screen (Waves 0–8)
**W0 Decisions + Emergency Stabilization** — deploy-unblock + 9 S0s + kill rake · **W1 Winner Foundations** — identity issuer + asymmetric tokens, RLS+GUC engaged, ledger-the-capture, PA-split · **W2 Winner Completion** — reconciliation + backfill, hosted checkout origin, FORCE-all-261-tables, honesty badge *(all 33 go-live blockers closed)* · **W3 Traffic Migration** — domain→letbuyy.com, route to canonical paths · **W4 Legacy Freeze** — governance retargeted, AGENTS.md regenerated, one constitution · **W5 Legacy Removal** — execute SAFE_DELETION · **W6 Hardening** — perf + design-system + observability + Liquid default · **W7 Production Readiness** — restore drill + monitoring + load/security/chaos, beta-gate · **W8 Shopify-Class** — Liquid universal + marketplace seeding + OIDC + passkeys (demand-gated).

**Critical path:** clean tree → deploy `/api/auth/switch` fix → fix deploy meta-blocker → engage RLS off `service_role` → ledger-the-capture → close reconciliation → safe PA-split payout → hosted checkout origin → cart-bound handoff → beta. **~80 eng-weeks; ~4–6 months wall-clock** to the beta gate with 2–3 squads; Wave 8 is demand-gated, off the beta clock.

## Executive answers
- **Delete immediately:** the 9 S0 paths + money-honesty violations (`/api/auth/switch`, 6 anon RLS policies, super_admin_allowlist, razorpayx rail, forgeable step-up, 3% rake, GUC-from-param, AUTH_SECRET fallback); then (post validator-retarget) the CQRS cluster, fiction validators, k8s/Helm, Firebase.
- **Freeze immediately:** app-marketplace + developer-portal (keep the OAuth seam), 6 reserved services, reserved mobile apps, Wasm functions, headless tier, full in-WhatsApp stack — and the React renderer (frozen, not deleted).
- **Complete immediately:** ledger-the-capture, RLS+GUC + FORCE-all-tables, asymmetric re-key + sole issuer, PA-split + reconciliation, hosted checkout, honesty badge + mobile signing + BFF composites, outbox + compensation, observability quartet.
- **Never build:** the 22-service fleet, CQRS/saga/multi-region, a live 3rd-party marketplace / Wasm / extension host, a headless storefront tier, a money-custody rail, any GMV/transaction fee.

---

## Provenance & caveats
Every strategic call traces to a domain deliverable and to evidence in the forensic audit (`path:line`). The most consequential **UNVERIFIED** items (carried forward, never upgraded to fact): the 6 anon RLS GRANTs are set by Supabase's managed bootstrap, not repo SQL — confirm with an anon-key probe / `\dp public.orders` before final S0 sign-off; live deployment state is ~0% until the deploy meta-blocker clears (so all completion-% reflect the working tree); which of the two internal consoles survives is an ARB decision, not a code fact; money-kernel test depth and the red-team/parity harnesses are specified, not yet executed/built; per-table FORCE coverage and dead-table writers need a live DB before any DROP.
