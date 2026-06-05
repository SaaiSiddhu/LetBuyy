# LetBuyy Platform — Forensic Investigation: Executive Summary

**Investigation date:** 2026-06-05
**Scope:** Entire LetBuyy monorepo — merchant admin, theme system, storefront runtime, apps ecosystem, OAuth/billing/permissions, database, APIs, events, workers, queues, CI/CD, infrastructure.
**Role:** Forensic documentation of the *current state only*. No code was written, modified, deleted, moved, or renamed in the platform under investigation. Every finding in this report set is supported by file-level evidence. This document recommends nothing; it documents what exists.

This summary sits on top of 17 detailed reports (`01`–`17`). Where a claim is repeated here it has been independently re-verified against source; the spot-check log is in [`17-evidence-appendix.md`](17-evidence-appendix.md).

---

## 1. What LetBuyy is, in one paragraph

LetBuyy is a multi-tenant, Shopify-style commerce platform built as a pnpm + Turborepo monorepo. It comprises **9 Next.js 16 web applications**, **3 Flutter mobile apps** (only one of which is real), **3 deployed Cloudflare Workers**, **30 workspace packages** (25 TypeScript + 5 Dart), and a **Supabase/Postgres database of ~233 tables** (baseline migration) governed by 350+ row-level-security policies. A single Cloudflare Worker — `services/api-gateway` (90 source files; route handlers alone total ~20,340 lines) — is effectively the entire backend. Every web and mobile app is a thin client of it through one shared client factory (`@letbuyy/api-client`). There is a genuinely working commerce core underneath: subdomain-based multi-tenancy, a versioned theme pipeline with drafts/releases/rollback, checkout and orders with signature-verified payment webhooks (Razorpay/Stripe/PayPal/Cashfree, INR-centric), and an OAuth-capable app platform with HMAC-signed webhooks and an app-billing schema. That core is wrapped in an unusually large layer of self-referential governance machinery — 128 validator scripts and ~149 governance test files that overwhelmingly assert manifests are internally consistent rather than that the running system behaves correctly.

## 2. Headline numbers (measured this investigation)

| Dimension | Measured value | Source |
|---|---|---|
| Files in scope (excl. node_modules/.git/build) | ~2,831 | [01](01-repository-inventory.md) |
| Git-tracked files (per validator) | 2,934 | `validate-governance.mjs` |
| Largest language by LOC | **Markdown 380,185** (exceeds all code) | [01](01-repository-inventory.md) |
| Code LOC | TS 103,816 · TSX 71,541 · Dart 54,006 · SQL 53,874 | [01](01-repository-inventory.md) |
| Web apps | 9 (all Next 16.1.6 / React 19.2.3) | [03](03-application-investigation.md) |
| Mobile apps | 3 (1 real: `merchant-app` ~35k LOC; `operator-app` = counter demo; `shopper-app` = empty) | [03](03-application-investigation.md) |
| Services | 9 roots — **3 implemented, 6 manifest-only** | [03](03-application-investigation.md) |
| Workspace packages | 30 (25 TS, 5 Dart) | [01](01-repository-inventory.md) |
| api-gateway route handlers | ~20,340 LOC; `storefront.ts` alone ≈4,900 lines | [03](03-application-investigation.md), [17](17-evidence-appendix.md) |
| Database tables (baseline) | ~233; ~70 with no code reference | [01](01-repository-inventory.md), [09](09-dead-code.md) |
| Governance validators | 128 passing (exit 0) | `validate-governance.mjs` |
| Package unit tests | **0** | [14](14-risk-assessment.md) |
| Deployable workspaces with a real `test` script | **0 of 12** (`echo 'No tests yet' && exit 0`) | [14](14-risk-assessment.md), [17](17-evidence-appendix.md) |
| Root-level process-ledger `.md` files | 73 (~1.4 MB; largest 270 KB) | [09](09-dead-code.md) |

## 3. Five defining facts

**(1) The backend is a monolith dressed as microservices.** Of nine `services/*` roots, only three contain code (`api-gateway`, `webhook-service`, `queue-workers`). The other six — `checkout-runtime`, `search-service`, `media-service`, `notification-service`, `event-bus`, `analytics-pipeline` — contain exactly two files each (`AGENTS.md` + `runtime.manifest.json`) and **no `package.json` or `src/`**. Their manifests nonetheless assert domain ownership ("Reserved search and indexing authority…"). The capabilities they claim execute inside the api-gateway Worker. Evidence: [03](03-application-investigation.md), [11](11-architecture-violations.md), verified in [17](17-evidence-appendix.md).

**(2) The verification system verifies documents, not systems.** 128 validator scripts and ~149 `tests/**/*.test.mjs` files largely assert that JSON manifests are internally consistent and that source files contain expected string fragments. Load/chaos suites default to plan mode (print commands, record nothing); manifests self-label `mode: "governance-contract-not-live-evidence"`. The 30 workspace packages have **zero unit tests**, and no CI test calls a running system. To the platform's credit this is self-aware and fails closed — but "validate:production-certification passing" does **not** mean production was certified. Evidence: [14](14-risk-assessment.md).

**(3) The codebase is a pivot, and the previous product is still live inside it.** LetBuyy was a portfolio/resume-site builder before it was a commerce platform. The merchant admin still ships fully implemented Experience, Education, Certifications, Skills, Projects, and Testimonials pages (~470–510 LOC each); the gateway still mounts `/portfolio` and `/resume` routers; the baseline schema retains `portfolio_projects`, `resume_versions`, `education`, `work_experience`, `skills` tables. Evidence: [09](09-dead-code.md), [13](13-technical-debt.md).

**(4) Distributed-systems ambition far exceeds operational reality.** ~10,700 LOC across `distributed-runtime`, `orchestration`, and `projection-runtime` implement event sourcing, outbox, CQRS, replay, leases, Lamport/vector clocks, and CRDT merge — consumed mainly by the same single Worker. Roughly 60–70 of the ~233 tables are runtime/observability bookkeeping. Evidence: [01](01-repository-inventory.md), [13](13-technical-debt.md).

**(5) The application layer itself is comparatively clean.** Independently confirmed: no app→app imports, no direct Supabase access from any web app (0 `.from()` hits across `apps/*/src`), no deprecated-alias references in code, **no committed live secrets**, a single API-client factory, consistent Next.js/React versions, store-ownership checks on sampled merchant routes, timing-safe webhook signature verification for all four payment providers, and the repo's own governance suite passing all 128 gates. Evidence: [11](11-architecture-violations.md), [14](14-risk-assessment.md), [17](17-evidence-appendix.md).

## 4. The four Critical findings, distilled

The full Critical register (14 items, reconciled across reports) is in [`16-critical-findings-summary.md`](16-critical-findings-summary.md). The four with the broadest blast radius:

| ID | Finding | One-line evidence |
|---|---|---|
| **C-1** | **Single-worker backend is the entire platform and a single point of failure.** All commerce, auth, themes, apps, payments, media, analytics, and legacy portfolio logic run in one Cloudflare Worker. | `api-gateway/src/index.ts` mounts 30+ routers; 6 sibling services are code-free |
| **C-2** | **The app platform cannot actually host third-party apps.** App-scoped OAuth tokens are accepted at exactly **one** GET-only proxy endpoint; there is no app write API, no token refresh, no client secret/PKCE, and the mandatory GDPR compliance webhooks are subscribed at install but **never published**. | `verifyAppScopedAccessToken` single call site `app-store.ts:1253`; compliance topics defined `app-engine/src/index.ts:151-153`, zero emit sites |
| **C-3** | **Theme extensibility is closed.** Section types are React components compiled into the storefront (unknown types render `null`); the web theme editor's live preview is **unwired** (merchants edit against a hardcoded mock and publish blind); there are **no app embeds** and the Liquid runtime exposes no product/cart/customer objects. | `renderer-registry.tsx` static imports; `CenterPanel.tsx` has zero importers; `theme-renderer.ts:246-249` hardwires embeds empty |
| **C-4** | **Testing and "certification" are document-shaped, not behavior-shaped.** 0 package unit tests; every deployable workspace's `test` script is a no-op; the passing governance suite checks manifests and string fragments, not a running system. | All 12 `package.json` test scripts = `echo 'No tests yet' && exit 0` |

## 5. Shopify parity, at a glance

Measured subsystem-by-subsystem in [`12-shopify-compatibility.md`](12-shopify-compatibility.md): **overall parity ≈ 4.6 / 10**. The contract and persistence *spine* is built (theme drafts/releases, app OAuth/scopes/webhooks, payment providers, customer accounts); the *experience* layers are absent or unwired. Lowest-scoring subsystems: App Embeds (0/10 — not found in repository), Theme Runtime commerce-object model (effectively absent), and the in-editor app-block experience (no merchant UI). Highest: Theme Marketplace and App Marketplace spines (6/10 each).

## 6. Bottom line for diligence

What works: a coherent single-gateway commerce platform with real multi-tenancy, a real theme pipeline with drafts/releases/rollback, a real app-platform *skeleton* (OAuth, scopes, HMAC webhooks, billing schema, extension registry), strong secret hygiene, and disciplined import boundaries enforced by working validators.

What does not exist despite appearances: microservices, live certification/load/chaos evidence, meaningful automated testing, theme/app developer tooling (no CLI/SDK), shopper-facing mobile, money-moving app billing, and any second backend. **The largest diligence risk is not broken code — it is the gap between the documented, validator-"certified" architecture and the much smaller system that actually runs.**

> Reading order: this summary → [16 Critical Findings](16-critical-findings-summary.md) → [15 Production Readiness](15-production-readiness.md) → domain reports `03`–`14` → [17 Evidence Appendix](17-evidence-appendix.md). Index: [README.md](README.md).
