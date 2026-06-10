# LetBuyy Platform — Forensic Investigation: Executive Summary

**Investigation date:** 2026-06-05 (second pass, post-remediation; HEAD `127a850e` on `develop`)
**Scope:** Entire LetBuyy monorepo — merchant admin, theme system, storefront runtime, apps ecosystem, OAuth/billing/permissions, database, APIs, events, workers, queues, CI/CD, infrastructure.
**Role:** Forensic documentation of *current state only*. No codebase file was written, modified, deleted, moved, or renamed; the only writes were the report files in `FORENSIC_REPORT/`. Every finding cites file‑level evidence.

This is the **second pass**. A first investigation (same date, AM) produced reports `01`–`17`; a Codex remediation run + five merged workstreams then landed **68 commits / 292 files / +21,140 −8,527** (`63053d18..HEAD`). This pass re‑verified every prior finding against current source, marked each **RESOLVED / PARTIAL / STILL‑OPEN**, and documents **new issues the remediation itself introduced**. The 10 highest‑stakes claims were independently re‑checked (8 confirmed, 2 partially, 0 refuted; log in [`17-evidence-appendix.md`](17-evidence-appendix.md)).

---

## 1. The one-paragraph verdict

The remediation did exactly what it scoped and did it well — but it was a *foundation‑honesty* pass, not a *capability* pass. Everything that was a lie the platform told about itself is now fixed and validator‑locked: the three disagreeing runtime inventories agree, the six phantom "services" admit they're unimplemented, the constitution's dead database section is corrected, and — most substantively — **core tables now have a single writer**, enforced by a new validator and a regression test. The governance suite grew 128 → 129 validators and still passes. **But the hard product Criticals are all still open** (no real app API, compliance webhooks still never fire, app billing still moves no money, the theme editor still previews a mock, no server‑side cart, observability still emits nothing), and the single‑writer refactor **introduced a new payment‑path auth hole that is fail‑open by default off‑production** — with the one test that touches it wired into no runner. The platform is meaningfully *more honest and structurally cleaner*; it is not yet *more capable*, and it is in one specific way slightly less safe than before.

## 2. What the remediation resolved (verified)

| Finding | Status | Evidence |
|---|---|---|
| C‑13 three runtime inventories disagree | **RESOLVED** + validator‑locked | `runtime-topology-validator.mjs` cross‑checks CLAUDE.md ↔ runtime‑boundaries.md (21 roots) |
| C‑2 six declared services don't exist | **RESOLVED** (honest manifests) | all 6 carry `reserved-not-implemented`; `queue-workers` recategorized `cloudflare-worker` |
| C‑12 AGENTS.md describes a dead DB | **RESOLVED** (with residue) | DB section corrected to `000_baseline.sql` + `073…089`; hand‑patch left stale counts (AV‑M8) |
| H‑1 dual write‑ownership of core tables | **RESOLVED** + validator + test | webhook‑service/queue‑workers route all writes through gateway internal endpoints; `single-writer-ownership-validator.mjs` |
| H‑10 queues with consumers, no producers | **RESOLVED** | `cloudflare-queue-triggers.ts` produces to all 5 bindings |
| H‑12 uncontracted theme events | **RESOLVED** | `theme.purchase.*`/`theme.draft.*` contracted in `event-core` (24→27) |
| H‑11 payout events no emitter | **Correctly SKIPPED** (honest) | marked `reserved-human-gated`, not faked |
| App‑marketplace integrity batch | **RESOLVED** (test‑locked) | idempotent install/uninstall, server‑side show‑once webhook secrets, review‑requires‑install, honest outage states, fail‑fast base URL |
| Theme Editor multi‑template editing | **NEW capability** | migration `087` + 6‑template switcher + scoped drafts/publish + test |

Shopify parity moved **41/90 → 43/90 (≈4.8/10)**: Theme Editor +1, App Marketplace +1.

## 3. What the remediation did NOT touch (still open)

The mission's later phases (app platform, theme/storefront extensibility, security, testing, observability, legacy, mobile) never ran, so every product‑facing Critical remains, verified unchanged in code:

- **C‑3** app OAuth tokens still reach exactly one GET‑only proxy; no app write API.
- **C‑4** GDPR compliance webhooks still force‑subscribed at install with **zero emit sites** (now also advertised to developers).
- **C‑5** app billing still fabricates `rzp_route_test_` refs; no money moves.
- **C‑6** web theme editor still previews a hardcoded `PREVIEW_PRODUCTS` mock; `CenterPanel.tsx` still 0 importers; merchants still publish blind.
- **C‑7** section types still compiled into the storefront; unknown → `null`.
- **C‑8** web publish still one‑step‑to‑live, still last‑write‑wins (no `base_version`).
- **C‑9** app embeds still absent; Liquid still has no product/cart/customer objects.
- **C‑10** cart still localStorage‑only; `public.carts` still unwired (now fail‑loud: GraphQL throws `CART_NOT_SUPPORTED`).
- **C‑14** observability stack still has no metric producer; `writeDataPoint` never called.
- **H‑4** theme‑marketplace "Pay" is still a `<Link>` to `/checkout/success` (rated Critical by the app report).
- **H‑2/H‑3/H‑5/H‑6/H‑7/H‑8/H‑15/H‑16/H‑17** all verified unchanged.

## 4. What the remediation introduced (new findings)

| ID | New issue | Severity |
|---|---|---|
| **N‑1** | Internal payment routes **fail open** when `INTERNAL_API_SECRET` unset & `ENVIRONMENT≠production`; siblings fail closed; base env defaults `staging`. The H‑1 refactor put real payment‑state transitions behind a default‑off‑prod‑open guard. | **High** |
| **N‑2** | App `access_token` + show‑once webhook `signing_secret` persisted **in plaintext** in `idempotency_keys.response_body` for ~24h replay. | **High** |
| **N‑3** | The two new `.ts` contract tests (incl. the internal‑payment auth test) are wired into **no runner** and the payment test only asserts the prod branch — so N‑1 is uncovered. | **High** |
| **N‑4** | `/v1/internal/events/domain` accepts uncontracted `payment.*` events with payloads stored raw. | Medium |
| **N‑5** | `gateway-events.ts` duplicated across webhook‑service and queue‑workers (4 copies of the internal‑fetch boilerplate, no shared package). | Medium |
| **N‑6** | Agent‑ledger residue inside source trees (`CODEX_WS9_LEDGER.md` in a Next route segment), 8 CODEX files back at root, and dead `webhook-deliveries` queue jobs that accumulate forever. | Medium/Low |

## 5. The numbers (second pass)

| Dimension | First pass | Second pass |
|---|---|---|
| Files in scope | ~2,831 | ~2,951 |
| Root `.md` files | 73 | **11** (72 archived; 8 CODEX residue remains) |
| Governance validators | 128 | **129** (added single‑writer) — passes, exit 0 |
| Deployable workspaces with a real `test` script | 0 / 12 | **2 / 12** (webhook‑service, queue‑workers) |
| Package unit tests | 0 | a handful (event‑core, the two service clients) |
| `storefront.ts` god file | ~4,826 lines | **4,833** (extraction of 233 lines, net grew) |
| Open Criticals (of 14) | 14 | **11** (C‑2, C‑12, C‑13 resolved) |
| Shopify parity | 41/90 (4.6) | **43/90 (4.8)** |
| Architecture violations | 19 (2C/5H/7M/5L) | **18** (0C/3H/9M/6L) — 4 resolved + 1 downgrade, 4 new |

## 6. Bottom line for diligence

The remediation is real, careful work: small green commits, the Green Law held at 129/129 throughout, the Honesty Law was followed (payouts marked SKIP, not faked), and the highest‑value structural fix — single‑writer ownership — is genuinely enforced. A reader can now *trust the runtime map and the ownership model*, which was not true a day ago.

Two cautions remain the story:

1. **Capability gap is unchanged.** Microservices, a usable app platform, theme/app extensibility, a server cart, live telemetry, and meaningful test coverage still do not exist. The foundation is honest; the building above it is the same height.
2. **One regression on the most sensitive path.** The single‑writer refactor created a payment‑confirm endpoint that is unauthenticated by default off‑production (N‑1), and the test that would catch it isn't run (N‑3) — precisely the failure mode the skipped "testing reality" phase exists to prevent.

> Reading order: this summary → [16 Critical Findings (with resolution status)](16-critical-findings-summary.md) → [15 Production Readiness](15-production-readiness.md) → domain reports `03`–`14` → [17 Evidence Appendix](17-evidence-appendix.md). Index: [README.md](README.md).
