# Graphify Installation & Knowledge-Graph Report

## Installation
- **Package:** `graphifyy` 0.8.39 (PyPI, MIT, © 2026 Safi Shamsi; 155 releases). Deps are benign code-parsing libs: `networkx`, `numpy`, `rapidfuzz`, `tree-sitter` + language grammars.
- **Method:** `uv tool install graphifyy` (isolated venv at `~/.local/bin/graphify`). `pipx`/`pip` were not available; `pip install` fallback not needed.
- **Executables installed:** `graphify`, `graphify-mcp`.
- **Verify:** `graphify 0.8.39` ✅

## Security decisions (documented, deliberate)
1. **Isolated install only** — used `uv tool` so the tool lives in its own venv, not the system/global Python.
2. **Git hooks NOT installed.** The program's `graphify hook install` adds a commit-time merge-driver/hook that runs the third-party binary on every commit. In this governance-strict production repo, persistent commit-time execution of an unaudited binary is an unacceptable supply-chain surface — **skipped by design**, not omitted by accident.
3. **Claude skill install BLOCKED & respected.** `graphify install --platform claude` (which copies graphify's own skill/instructions into `.claude/`) was denied by the Claude Code safety classifier as self-modification with unverified startup content. I did **not** work around it. The `/graphify` skill is therefore not registered; the CLI is used directly.
4. **Output gitignored.** `graphify-out/` (45 MB `graph.json`) + `.graphify/` were added to `.gitignore` — generated artifacts, never committed.

## Graph statistics (`graphify update .`)
| Metric | Value |
|--------|-------|
| Nodes | **52,246** |
| Edges | **66,761** |
| Communities | **3,279** |
| Files parsed | **3,677** |
| graph.json | 45 MB (gitignored) |
| Report | `graphify-out/GRAPH_REPORT.md` (838 KB, gitignored) |

### Languages discovered (by source-file extension)
| Lang | Nodes |
|------|------:|
| Markdown | 24,015 |
| TypeScript `.ts` | 9,319 |
| Dart | 7,413 |
| JSON | 4,820 |
| TSX | 3,170 |
| MJS (validators/tests) | 2,762 |
| Swift / Kotlin / Python / Shell | 80 / 27 / 6 / 10 |

### Services / workspaces discovered (top, by node count)
`apps/mobile` (5,134), `services/api-gateway` (3,623), `packages/dart` (1,865), `apps/merchant_web` (1,293), `packages/typescript` (1,282), `packages/shared-types` (1,086), `apps/customer_web` (910), `packages/theme-engine` (464), `apps/identity-platform` / `apps/admin_web` (443 each), `services/queue-workers` (393), `packages/checkout-core` (259), `packages/auth-core` (254), `packages/commerce-core` (179), `services/webhook-service` (175).

### API routes & pages discovered
- **140** `route.ts` API route files (Next app proxies + gateway).
- **200** `page.tsx` Next pages.

### Database models discovered
Graphify's tree-sitter extraction is **code-symbol oriented**; it does **not** deeply index SQL function bodies, so individual Postgres RPCs (`issue_gift_card`, `restore_gift_card_on_refund`) are **not** distinct nodes. Schema/ledger truth lives in `database/supabase/migrations/` and is governed by `canonical-ledger-only` + `sequential-migration` validators — treat those as authoritative for the data model, not the graph. (Recorded as a known graph limitation.)

## Usage
- `graphify explain "<symbol>"` — node + neighbors (verified: `create_checkout_order` → Orders governance node; `proxy` → `apps/app-marketplace/src/proxy.ts`).
- `graphify path "A" "B"` — shortest path (verified: `checkout`→`gift_card`, 3 hops).
- `graphify update .` — re-extract after code changes (LLM-free, deterministic).
- Regenerate anytime; output stays out of git.
