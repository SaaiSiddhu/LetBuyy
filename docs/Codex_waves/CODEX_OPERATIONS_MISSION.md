# CODEX OPERATIONS MISSION — LetBuyy WS5

**Driver:** Codex agent. Reasoning: `medium`.
**Mode:** Continuous, autonomous. Never stop while unblocked work remains.
**Domain Ownership:** `apps/platform-console/src/**` and `apps/platform-operations-portal/src/**` ONLY.
**Dependencies:** `@letbuyy/ui` (consume only). API data via `@letbuyy/api-client`.

---

## 0. PRIME DIRECTIVE

Build operational substance in the Platform Console and Operations Portal. These are internal tools for the LetBuyy leadership team (Console) and operational employees (Ops Portal). They must be functional, data-driven, and use the shared design system.

**SUCCESS CRITERIA:**
1. Console has functional Merchant Directory, Revenue Dashboard, Subscription Management, and Audit Logs.
2. Ops Portal has CRM scaffold, Ticket System scaffold, and Merchant Health view.
3. Every page uses `Page`/`PageHeader`/`Card`/`Section` grammar.
4. Every list has empty states, skeletons, and search.
5. Backend-gated features are cleanly `[SKIP — NEEDS BACKEND]` with exact API requirements.
6. Governance 128/128 maintained.

---

## 1. THE WORK

### OP1 — Platform Console
- **OP1.1** Merchant Directory: searchable list of all stores with status, plan, revenue, created date. Uses `IndexTable`. Data from existing `internal-console` API routes.
- **OP1.2** Revenue Dashboard: `MetricCard` grid (MRR, ARR, churn, ARPU, active stores). Data from existing analytics endpoints or `[SKIP — NEEDS BACKEND]`.
- **OP1.3** Subscription Management: plan distribution chart, upcoming renewals, recent cancellations.
- **OP1.4** Audit Logs: searchable, filterable log of platform actions. From existing event data or `[SKIP — NEEDS BACKEND]`.
- **OP1.5** Trust & Safety: flagged merchants, review queue, suspension actions.
- **GATE OP1:** Console has 5 functional modules; governance 128/128.

### OP2 — Operations Portal
- **OP2.1** Merchant Health: store health scores (products, orders, theme, payments configured).
- **OP2.2** CRM Scaffold: merchant contact list, notes, last interaction.
- **OP2.3** Ticket System Scaffold: ticket list, status badges, assignment, priority.
- **OP2.4** Onboarding Support: new merchant queue, onboarding checklist status.
- **OP2.5** Communications: template-based merchant messaging scaffold.
- **GATE OP2:** Ops Portal has 5 functional modules; governance 128/128.

---

## 2. OPERATING CONTRACT

1. Touch ONLY `apps/platform-console/src/**` and `apps/platform-operations-portal/src/**`.
2. Consume `@letbuyy/ui` and `@letbuyy/api-client` — never modify.
3. Most views will need API data that may not exist yet. Build the best UI you can with existing `internal-console` and `operations` API routes. Graceful placeholder states for missing data with `[SKIP — NEEDS BACKEND]`.
4. Use `Page`/`PageHeader`/`Card` grammar everywhere.
5. `pnpm turbo typecheck` + `pnpm lint` + `validate:governance` green after every commit.
6. Max 3 attempts per task → BLOCKED → next.

---

## 3. DO NOT TOUCH

- `services/**`, `packages/*-core/**`, `database/**`
- All other `apps/**` directories
- `packages/shared-types/**`, `packages/typescript/api-client/**`, `packages/typescript/ui/**`
- `scripts/validators/**`, `docs/governance/**`

---

## 4. LAUNCH PROMPT

```
Read CODEX_OPERATIONS_MISSION.md in full.
Execute OP1→OP2 continuously and autonomously.

Hard rules:
- Touch ONLY apps/platform-console/src/** and apps/platform-operations-portal/src/**.
- Compose every screen from @letbuyy/ui.
- If API data is missing, build the UI with graceful placeholders and log
  [SKIP — NEEDS BACKEND] with the exact endpoint/fields needed.
- Keep governance 128/128 green after every commit.
- Max 3 attempts per task then BLOCKED.
- Maintain CODEX_OPERATIONS_LEDGER.md.

Begin with OP1.1 now.
```
