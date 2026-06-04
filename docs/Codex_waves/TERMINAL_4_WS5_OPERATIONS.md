# 🖥️ TERMINAL 4 — WS5 Platform Operations

**Worktree:** `../lb-ws5`  ·  **Branch:** `stream/WS5-operations`  ·  **Wave:** 1 (launch now — isolated)
**Owns ONLY:** `apps/platform-console/src/**` · `apps/platform-operations-portal/src/**`
**Never touches:** `@letbuyy/ui`, other apps, backend, contracts, db, governance

### Setup
```bash
git worktree add ../lb-ws5 -b stream/WS5-operations   # (skip if already created)
cd ../lb-ws5 && pnpm install
# start Codex here, then paste the prompt below into /goal
```

### 📋 PASTE THIS INTO CODEX `/goal`
```
Read docs/Codex_waves/CODEX_OPERATIONS_MISSION.md in full, then execute continuously and autonomously, 24h+,
never stopping while unblocked work remains.

OWN ONLY: apps/platform-console/src/** and apps/platform-operations-portal/src/**.
NEVER edit @letbuyy/ui (Terminal 2 owns it), other apps, backend, contracts, database, or governance.

Goal: build out the two internal apps on the @letbuyy/ui design language. platform-console (leadership: CEO/CTO/partners)
modules — Merchant Directory, Revenue, Subscriptions, Marketplace Governance, Trust & Safety, Analytics, Platform Ops.
platform-operations-portal (employees: support/success/sales/ops) modules — CRM, Tickets, Merchant Health, Retention,
Campaigns, Communications, Onboarding. Apply layout grammar + feedback + empty states + responsive throughout.

Hard rules: NO architecture changes — data from existing gateway endpoints (internal-console.ts / operations.ts /
employee.ts / analytics.ts); missing data → [SKIP — NEEDS BACKEND] + placeholder. Missing @letbuyy/ui component →
src/components/_local-ui/ + [CONSOLIDATE → @letbuyy/ui]. Before/after screenshots; keep all 128 validators green per
commit; small reversible commits; 3 strikes → BLOCKED → next. Maintain CODEX_WS5_LEDGER.md. Begin with the baseline inventory now.
```
