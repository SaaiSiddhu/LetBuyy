# LCIS V7 Baseline Audit (Phase 1)

Inventory of the LCIS platform at the start of the LetBuyy Operating System program. Counts are repository-derived.

## Inventory
| Asset | Count |
|-------|------:|
| Intelligence engines (`tools/graph-server/*.mjs`) | **65** |
| API endpoints (`/api/*`) | **75** |
| Explain-mode IA pages | **18** |
| Technical-mode tabs | 47 |
| `pnpm graph:*` scripts | **50** |
| Reports (`docs/central-intelligence/` + `docs/mission-control/` + `docs/operating-system/`) | 55+ |

## Status by category
### Implemented (operational)
Explain Mode + Technical Mode + Atlas; Code/DB/Domain/Runtime/Deployment/Security/Relationship intelligence; Mission Control dashboard; AI Context + multi-AI packs; Operations Center; Knowledge Graphs (7); Environment Intelligence (Local/Staging/Production); FK Relationship Intelligence (705 FKs); Connection Registry (NOT CONNECTED honesty); Production Health (G/Y/R); Audit Engine v2; **Intelligence Search V2** (semantic NL); **Ecosystem Intelligence** (Theme/Apps/Developer).

### High value
- Intelligence Search V2 — answers "How does Orders work?" from LCIS (no repo scan).
- Mission Control dashboard + Production Health (G/Y/R) + Connection Registry.
- AI Context packs (< 20k tokens, self-contained) for Claude/Gemini/Codex/Cursor.
- FK Relationship + Database Mission Control (tenant root `sites`, 705 FKs).

### Missing → now built this program
| Missing (before) | Built |
|------------------|-------|
| Semantic search (only node lookup existed) | `search-intel.mjs` → `/api/search-v2` |
| Theme Marketplace intelligence | `ecosystem-intel.mjs` → `/api/theme-intelligence` (32 tables, frozen) |
| App Marketplace intelligence | `/api/apps-intelligence` (47 tables, frozen) |
| Developer Platform intelligence | `/api/developer-intelligence` (frozen; OAuth/PKCE) |
| Explain V2 fields (merchant/customer impact, recovery, runbooks, launch relevance) | enriched `explain-intel` nodes |
| Technical V2 fields (triggers, indexes, blast radius) | enriched `explain-intel` technical |
| Multi-AI self-contained packs | `/api/ai-pack?target=` |

### Broken
- None at audit. One operational caveat: the graph server reads `index.html` once at startup, so UI edits require a server restart (documented).

### Duplicate / Obsolete
- No duplicate engines — the program EXTENDS existing ones (merchant lifecycle extends `merchant-intelligence.mjs`; search-v2 extends copilot; ecosystem composes db-intel). No engine was rebuilt or replaced.
- Obsolete: none active. Frozen domains (marketplace/developer/theme-marketplace) are labeled frozen, not obsolete.

### Low value (intentional)
- Live-only surfaces with no connected source render "NOT CONNECTED" rather than fabricate — correct by policy, low display value until an environment is wired.

## Intelligence quality
- Deterministic governance gate **107/107** is authoritative and green.
- Heuristic layers (domain classification, readiness, audit candidates, search intent) are labeled with their verification command / authoritative validator.
- **No fabricated metrics** — every certification number across v2–V7 cross-checked against fresh extraction; live values are NOT CONNECTED with the exact source.

> Baseline for the Operating System program. See `LETBUYY_OPERATING_SYSTEM_CERTIFICATION.md` for the final grade.
