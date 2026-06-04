# CODEX LAUNCH PLAYBOOK — 5 Agents, 24h+, Collision‑Free

> Companion to `LETBUYY_MASTER_EXECUTION_BLUEPRINT_V2.md`. One‑time worktree setup, then paste each prompt into its own Codex `/goal` in its own terminal. Each agent owns a **disjoint** folder set → they cannot collide.

---

## STEP 0 — One‑time worktree setup (run once, from the repo root)

```bash
cd /Users/saai_sidd/Git/Letbuyy_Store

# create 5 isolated worktrees, each on its own branch
git worktree add ../lb-ws7  -b stream/WS7-hardening
git worktree add ../lb-ws1  -b stream/WS1-designsystem
git worktree add ../lb-ws9  -b stream/WS9-settings
git worktree add ../lb-ws5  -b stream/WS5-operations
git worktree add ../lb-ws10 -b stream/WS10-devportal

# install deps in each (pnpm shares the global store, so disk stays sane)
for d in ../lb-ws7 ../lb-ws1 ../lb-ws9 ../lb-ws5 ../lb-ws10; do (cd "$d" && pnpm install); done
```

Then open **5 terminals**, `cd` each into its worktree, start Codex there, and paste that terminal's prompt below.

| Terminal | `cd` into | Codex branch |
|---|---|---|
| 1 | `../lb-ws7`  | `stream/WS7-hardening` |
| 2 | `../lb-ws1`  | `stream/WS1-designsystem` |
| 3 | `../lb-ws9`  | `stream/WS9-settings` |
| 4 | `../lb-ws5`  | `stream/WS5-operations` |
| 5 | `../lb-ws10` | `stream/WS10-devportal` |

---

## TERMINAL 1 — WS7 Production Hardening (Wave 0)

```
Read docs/Codex_waves/CODEX_PRODUCTION_HARDENING_MISSION.md and CODEX_PRODUCTION_READINESS_MISSION.md in full,
then execute continuously and autonomously, 24h+, never stopping while unblocked work remains.

OWN ONLY: services/**, database/**, packages/infrastructure/**, scripts/staging/**.
NEVER edit apps/** or packages/typescript/** (other agents own those) — if you need a UI change, log [SKIP — NEEDS UI].

Goal: seed and prove the staging stack from the baseline, run J1–J5 E2E against staging Postgres,
make COD + GST real and one online provider (Cashfree or UPI) real in test mode (live keys → [SKIP — NEEDS HUMAN]),
keep the build network-free, advance scaffold services where unblocked.

Hard rules: keep all 128 validators green after every commit; full `pnpm run validate:governance` at each gate;
never commit red; max 3 attempts per task then revert + log BLOCKED + move on; small reversible commits;
never mutate prod; migrations forward-only & fresh-replay-safe; no fabrication (every DONE = command + result).
Maintain CODEX_WS7_LEDGER.md. When real J1–J5 are green, publish "staging proof ready" in the ledger.
Begin with P1 now.
```

## TERMINAL 2 — WS1 Design System (Wave 0)

```
Read docs/Codex_waves/CODEX_DESIGN_SYSTEM_MISSION.md and CODEX_SHOPIFY_UX_MISSION.md §3 (design-system spec) in full,
then execute continuously and autonomously, 24h+, never stopping while unblocked work remains.

OWN ONLY: packages/typescript/ui/**.
NEVER edit any app or any other package.

Goal: build the token system (color/typography/spacing/radius/shadow/motion as CSS vars + TS tokens) first,
then the full Polaris-parity component set (Page, PageHeader, Card, Section, Badge, Banner, Toast, Skeleton,
EmptyState, Modal, ConfirmDialog, Tabs, Select/Combobox, Tooltip, MetricCard, Avatar, Pagination, IndexTable,
SaveBar, CommandPalette + upgrade Button/Input/DataTable), each token-driven, accessible (keyboard/focus/ARIA/AA),
responsive, with a Storybook story + screenshot. Brand: primary #8B5CF6, secondary #6366F1, 90% neutral / 10% accent.

Hard rules: ADDITIVE-ONLY — never break or rename an existing @letbuyy/ui export (WS2/WS5/WS9/WS10 import it live).
Keep all 128 validators green per commit; network-free build (self-hosted fonts, no next/font/google); no fabrication
(every DONE = command + result + Storybook screenshot); small reversible commits; 3 strikes → BLOCKED → next.
After each batch, publish the stable component API list to CODEX_WS1_LEDGER.md so consumers know what's available.
Maintain CODEX_WS1_LEDGER.md. Begin now.
```

## TERMINAL 3 — WS9 Settings Architecture (Wave 0/1)

```
Read docs/Codex_waves/CODEX_SETTINGS_ARCHITECTURE_MISSION.md in full, then execute continuously and autonomously,
24h+, never stopping while unblocked work remains.

OWN ONLY: apps/merchant-control-plane/src/app/[store]/settings/** and apps/merchant-control-plane/src/components/settings/**.
NEVER edit @letbuyy/ui (Terminal 2 owns it), the Sidebar / global layout.tsx / globals.css (WS2 owns the app shell),
backend, contracts, database, or governance.

Goal: build the unified Shopify-style Settings hub shell (grouped left index + content pane + one sticky SaveBar),
migrate the 13 existing scattered settings panes onto the @letbuyy/ui grammar (Page → Section → Card) with proper
empty/loading/feedback, then add the missing panes (Apps & Channels, Business, Localization, Security, Custom Data)
against existing gateway data. Add settings search, contextual guidance, responsive (index → drawer on mobile), a11y.

Hard rules: NO architecture changes — missing data → [SKIP — NEEDS BACKEND] with the exact endpoint/field + a graceful
placeholder pane. If @letbuyy/ui lacks a component, build it under src/components/_local-ui/ and log [CONSOLIDATE → @letbuyy/ui].
Register the Settings nav via WS2's route manifest (or a local index) — do NOT edit the Sidebar; log [HANDOFF → WS2].
Before/after screenshot per pane; keep all 128 validators green per commit; small reversible commits; 3 strikes → BLOCKED.
Maintain CODEX_WS9_LEDGER.md. Begin with S0.1 now.
```

## TERMINAL 4 — WS5 Platform Operations (Wave 1)

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

## TERMINAL 5 — WS10 Developer Ecosystem (Wave 1)

```
Read docs/Codex_waves/CODEX_DEVELOPER_ECOSYSTEM_MISSION.md in full, then execute continuously and autonomously, 24h+,
never stopping while unblocked work remains.

OWN ONLY: apps/developer-portal/** (create this new Next.js app).
NEVER edit @letbuyy/ui (Terminal 2 owns it), other apps, backend, contracts, database, or governance. You may READ
services/** and packages/*-engine/** read-only to document the TRUTH of the real API/OAuth/webhook surface.

Goal: scaffold developers.letbuyy.store on @letbuyy/ui — landing + API reference (from the real gateway routes/schemas)
+ OAuth docs (auth-code + token-exchange, scopes, session tokens) + Webhook docs (HMAC X-LetBuyy-Hmac-SHA256, mandatory
compliance topics, retry) + Theme SDK & App SDK quick-starts + a developer dashboard shell.

Hard rules: document only REAL capabilities (mark others "planned"); absent endpoint/SDK/tooling → [SKIP — NEEDS BACKEND/SDK]
with an honest placeholder (do NOT invent). Expect to be SKIP-heavy until WS7 lands its real surface — that's fine, build the
shell and document what exists. Missing @letbuyy/ui component → src/components/_local-ui/ + [CONSOLIDATE]. Keep all 128 validators
green per commit; network-free build; before/after screenshots; small reversible commits. Maintain CODEX_WS10_LEDGER.md. Begin with D0 now.
```

---

## LATER WAVES (for reference — launch after the merges below)

**Day 7 → WS2 Merchant UX** (after WS1 + WS9 + WS7 merged): worktree `../lb-ws2` / branch `stream/WS2-merchant`. Prompt: *Read docs/Codex_waves/CODEX_MERCHANT_UX_MISSION.md + LETBUYY_MERCHANT_EXPERIENCE_AUDIT.md. OWN ONLY apps/merchant-control-plane/src/** EXCEPT .../settings/** (WS9). Consume @letbuyy/ui. Migrate every non-settings page to the layout grammar + feedback + empty states + nav + home + theme editor + productivity. [SKIP — NEEDS BACKEND] for missing data. Keep 128/128. Maintain CODEX_WS2_LEDGER.md. Begin now.*

**Day 10 → WS3 Marketplace** (`stream/WS3-marketplaces`) and **WS4 Storefront** (`stream/WS4-storefront`) from `CODEX_MARKETPLACE_UX_MISSION.md` / `CODEX_STOREFRONT_MISSION.md`.

**Day 14 → WS8 Mobile Parity** (`stream/WS8-mobile`) from `CODEX_MOBILE_PARITY_MISSION.md`.

**Day 14+ → WS6 Identity & Marketing** (`stream/WS6-identity`) from `CODEX_IDENTITY_MARKETING_MISSION.md`.

---

## YOUR DAILY PROGRAM‑MANAGER WORKFLOW

**Each morning:** open the 5 ledgers (`CODEX_WS{7,1,9,5,10}_LEDGER.md`), scan for `BLOCKED` and `SKIPPED — NEEDS HUMAN`, batch‑resolve the human‑gated items (live keys, brand/copy, design assets).

**Merge order (run the per‑wave gate after each merge — `validate:governance` 128/128 + typecheck + build + tests):**
1. **WS1** first (everyone needs the design system) → then have WS5/WS9/WS10 rebase and swap their `_local-ui/` fallbacks for real `@letbuyy/ui` components (their ledgers list the `[CONSOLIDATE]` items).
2. **WS7** next (everyone needs the real stack) → UI agents switch from Storybook proof to live‑stack screenshots.
3. **WS9**, **WS5**, **WS10** as each completes its gate.
4. Then launch **WS2**, later **WS3/WS4**, then **WS8/WS6**.

**Conflict rule:** a stream that must touch a root file or the lockfile logs `[NEEDS HUMAN MERGE]` — you reconcile it at merge time (worktrees make this clean: each branch carries its own delta).

---

## NOTES / EXPECTATIONS (so nothing surprises you)

- **All 5 are collision‑free today** (disjoint folders). Safe to run simultaneously.
- **WS9 / WS5 / WS10 consume the design system WS1 is still building** → expect `[CONSOLIDATE → @letbuyy/ui]` entries in their ledgers (temporary `_local-ui/` components they'll swap after WS1 merges). This is normal, not a bug.
- **WS10 will be SKIP‑heavy on Day 1** (it documents WS7's real API, which isn't done yet) — it builds the portal shell + documents what exists and SKIPs the rest. Also fine.
- **5 agents is your safe cap** on the M4 — the bottleneck is *your* review/merge throughput, not CPU.
- **WS2 stays parked** until WS1 + WS9 + WS7 are merged (it consumes all three).
