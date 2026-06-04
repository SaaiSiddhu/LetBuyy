# 🖥️ TERMINAL 2 — WS1 Design System

**Worktree:** `../lb-ws1`  ·  **Branch:** `stream/WS1-designsystem`  ·  **Wave:** 0 (launch now)
**Owns ONLY:** `packages/typescript/ui/**`
**Never touches:** any app, any other package

### Setup
```bash
git worktree add ../lb-ws1 -b stream/WS1-designsystem   # (skip if already created)
cd ../lb-ws1 && pnpm install
# start Codex here, then paste the prompt below into /goal
```

### 📋 PASTE THIS INTO CODEX `/goal`
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
