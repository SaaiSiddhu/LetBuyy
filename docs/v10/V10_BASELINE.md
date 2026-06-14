# LCIS V10 Baseline

Concise baseline for the V10 Navigation & Intelligence Foundation. Full current-state audit: **[V10_BASELINE_AUDIT.md](V10_BASELINE_AUDIT.md)**.

## Starting point (extended, not rebuilt)
- LCIS UI = single-file `tools/graph-server/index.html` (vanilla JS, no framework) + `server.mjs` (~105 `/api` endpoints) + ~75 engines.
- 17-perspective Domain Workspace (V8/V9), Explain/Technical/Atlas modes, command palette (`⌘K`), graph (`runSim` + Atlas), knowledge layers, all V1→LCIS X intelligence.

## What was absent before V10 (the navigation gap)
- **No URL state** — refresh always reset to `getting-started`; deep paths 404'd; `xCopyLink` wrote a hash nothing consumed.
- **No history** — no `pushState`/`popstate`.
- **No restoration / recent** — only `localStorage['lcis-nav']` (sidebar toggle).
- **Edge types in data but not in UI** — `graph.json` links carry `relation` (15 types); `runSim`/Atlas drew plain gray lines.
- **No graph levels, no path explanations, no performance instrumentation.**

## V10 delivers (extension only)
URL state engine · deep linking · browser history · workspace restoration · recent workspaces (+pin) · command palette V2 (NL grammar) · typed edges (color + legend + filter) · graph levels (L1–L6) · path explanations · shareable URLs · mobile-validated 320–1440 · performance budget HUD — all over the existing engines. Server change: SPA route fallback + real per-hop path relations.

See `V10_IMPLEMENTATION.md`, `V10_TEST_REPORT.md`, `V10_FINAL_CERTIFICATION.md`.
