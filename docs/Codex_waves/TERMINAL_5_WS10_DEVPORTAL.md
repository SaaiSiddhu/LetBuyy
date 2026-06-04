# 🖥️ TERMINAL 5 — WS10 Developer Ecosystem

**Worktree:** `../lb-ws10`  ·  **Branch:** `stream/WS10-devportal`  ·  **Wave:** 1 (launch now — isolated)
**Owns ONLY:** `apps/developer-portal/**` (a NEW Next.js app to create)
**Never touches:** `@letbuyy/ui`, other apps, backend, contracts, db, governance (may READ services/** + packages/*-engine/** read-only to document the truth)
**Expect:** SKIP-heavy on Day 1 (it documents WS7's real API, which lands later) — that's normal.

### Setup
```bash
git worktree add ../lb-ws10 -b stream/WS10-devportal   # (skip if already created)
cd ../lb-ws10 && pnpm install
# start Codex here, then paste the prompt below into /goal
```

### 📋 PASTE THIS INTO CODEX `/goal`
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
