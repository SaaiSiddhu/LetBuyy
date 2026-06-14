# LCIS V11 Baseline

Concise baseline for V11 (Business + Operational Intelligence). Full current-state audit: **[V11_BASELINE_AUDIT.md](V11_BASELINE_AUDIT.md)**.

## Starting point (extended, not rebuilt)
- LCIS through **V10**: single-file UI (`index.html`) + `server.mjs` (~110 `/api` endpoints) + ~76 engines; 22 domains, 17-perspective workspace, URL/navigation foundation, command palette, typed edges, graph levels.
- Operational backends **already present** (LCIS X): `/api/executive-center`, `/api/observability`, `/api/investigate`, `/api/root-cause`, `/api/runbook`, `/api/time-travel`, `/api/impact-score`, `/api/revenue-v2`, `/api/memory`, `/api/explain` (flows + `gettingStarted`), knowledge graphs (business/journey/revenue layers).

## What was absent (the business-intelligence gap)
- No unified **Business Flow** over the 10 journeys; no **journey workspaces**; no plain-language **business impact**; no **Investor** mode; no surfaced **Founder / Operations / Support / Developer** modes; no business graph tabs.

## V11 delivers (extension only)
- **1 engine** — `business-flow-intel.mjs`: 10 journeys (9 implemented, Subscription honestly NOT IMPLEMENTED) + a Business Flow Graph (32 shared-domain edges).
- **5 endpoints** — `/api/business-flow`, `/api/business-impact`, `/api/investor`, `/api/developer`, `/api/founder` (last two compose existing engines).
- **6 UI modes** — Founder · Operations · Support · Investor · New Developer (30-min) · Business Flows + deep-linkable **Journey Workspaces** (`/journey/<key>`), business graph tabs, and **Copilot V2** routing ("how does checkout work" → journey workspace).
- All reusing existing engines; live metrics **CONNECTED or NOT CONNECTED** only; gate **107/107**.

See `V11_IMPLEMENTATION.md`, `V11_TEST_REPORT.md`, `V11_FINAL_CERTIFICATION.md`.
