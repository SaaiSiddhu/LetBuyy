# Awesome Claude Code Toolkit — Analysis & Integration Decision

**Source:** `rohitg00/awesome-claude-code-toolkit` (Apache-2.0). Cloned read-only to `/tmp` for inventory; **nothing from it was copied into or executed against this repository.**

## Inventory (verified by `find`/`ls`)
| Category | Count | Nature |
|----------|------:|--------|
| commands | 42 (8 category dirs: architecture, devops, documentation, git, refactoring, security, testing, workflow) | slash-command markdown |
| skills | 40 | domain knowledge packs (accessibility-wcag, authentication-patterns, database-optimization, …) |
| agents | 136 | subagent definitions |
| hooks | 21 (JS/Python: `secret-scanner.js`, `lint-fix.js`, `smart-approve.py`, `block-md-creation.js`, `pre-push-check.js`, …) | **executable scripts that run on Claude Code events** |
| plugins | 342 files | plugin marketplace entries |
| rules / templates / mcp-configs | 15 / 7 / 15 | config |

## Classification for LetBuyy

### REJECT (do not install)
- **All 21 hooks** — they execute arbitrary JS/Python on edit/stop/pre-push events. LetBuyy already has a deterministic 107-validator governance gate + its own commit discipline; importing third-party event hooks is an unreviewed code-execution surface and would conflict with/duplicate governance. (Their `secret-scanner.js`/`type-check.js` overlap what our gate + `tsc` already enforce.)
- **`/plugin marketplace add rohitg00/...`** — bulk-adding 342 plugin entries pulls unvetted third-party content into the agent's runtime. Cherry-pick only after review.
- **136 agents wholesale** — too broad; most are generic and unrelated to commerce/India-first/multi-tenant concerns.

### MAYBE (review then cherry-pick)
- **Command *patterns*** under `commands/{security,testing,architecture}` — useful structure to mirror, but written generically. We authored LetBuyy-specific equivalents in `.claude/commands/` instead of importing files.
- **Skills** like `authentication-patterns`, `database-optimization`, `api-design-patterns` — good reference reading; not installed (the platform already exposes hundreds of first-class skills via the Skill tool).
- **MCP configs** — only if a specific server is needed; evaluate per-server.

### USE (adopted as inspiration, LetBuyy-native implementation)
- The **command taxonomy** (audit-by-domain) informed our `.claude/commands/*-audit.md` set — but implemented against LetBuyy's real files, validators, and invariants rather than copied.
- The Anthropic-official `claude-code-security-review` action (separate from this toolkit) **was** wired in (`.github/workflows/security-review.yml`).

## Decision
**No files from the toolkit were installed.** LetBuyy's AI tooling is built **native** (repo-grounded slash commands, the official Anthropic security action, the Graphify code graph) so every executable surface is reviewed and governed. The toolkit remains a curated reference catalogue, not a dependency.
