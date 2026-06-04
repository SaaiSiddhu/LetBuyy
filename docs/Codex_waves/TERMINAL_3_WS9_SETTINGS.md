# 🖥️ TERMINAL 3 — WS9 Settings Architecture

**Worktree:** `../lb-ws9`  ·  **Branch:** `stream/WS9-settings`  ·  **Wave:** 0/1 (launch now)
**Owns ONLY:** `apps/merchant-control-plane/src/app/[store]/settings/**` · `apps/merchant-control-plane/src/components/settings/**`
**Never touches:** `@letbuyy/ui`, the Sidebar / global `layout.tsx` / `globals.css` (WS2 owns the app shell), backend, contracts, db, governance

### Setup
```bash
git worktree add ../lb-ws9 -b stream/WS9-settings   # (skip if already created)
cd ../lb-ws9 && pnpm install
# start Codex here, then paste the prompt below into /goal
```

### 📋 PASTE THIS INTO CODEX `/goal`
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
