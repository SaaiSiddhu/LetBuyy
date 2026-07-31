# 04 — INTERNAL APP AUDIT (apps/platform-console)

**HEAD `cd5905be` · code-verified.** The staffed internal ops console (21 pages, `(auth)`/`(dashboard)` route groups). Auth = email allowlist + TOTP MFA.

| Capability | Status | Evidence |
|---|---|---|
| Console auth (allowlist + TOTP) | **implemented** | custom but real; env-allowlist acceptable at V1 scale |
| Merchant 360 (search/view/suspend/restore) | **implemented** | with SoD + audit logging |
| Operations dashboards | **implemented** | ~21 console pages incl. exec analytics rollups (mig 169) |
| Support tickets | **partial (ops-manual)** | `support_tickets` table + Merchant-360 visibility; no standalone queue (V1.1) |
| Refunds (force/staff) | **partial** | merchant-side refund UI (LB-3) covers V1; console force-refund = V1.1 |
| Merchant review / KYC queue | **partial (build-or-ops-manual)** | merchant KYC submission API exists; staff review surface is the gap — build (~3d) or ops-manual via Supabase + decision log |
| Risk / Trust & Safety | **implemented (read-only)** | risk detection + T&S case tables (mig 124/125); case actions V1.1 |
| Money reconciliation queue | **implemented** | wallet-vs-ledger, SoD dual-approve; auto-plug P0 closed |
| Audit logs | **implemented** | paginated/searchable (no diffs/export — acceptable) |
| Compliance / DSR | **implemented** | dry-run export acceptable V1 |
| Admin tooling (impersonation) | **partial (V1.1)** | token minted+logged but storefront consumer absent — defer |

**Verdict:** sufficient for a staffed 10–50-merchant pilot. The one notable build-or-decide gap is the **KYC review queue** (only if payouts gate on KYC). Risk/T&S/support are read-or-ops-manual for V1. Not an order-flow blocker.
