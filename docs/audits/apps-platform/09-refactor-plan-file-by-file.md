# File-by-File Refactor Plan (Deliverable 20)

Refactors only — no new features here (new builds live in docs 10–17). Each entry: target state, motivation (issue IDs from doc 07), and sequencing. Apply in listed order inside each tier; tiers are independent tracks.

---

## Tier A — Security-critical refactors (do first)

| # | File(s) | Refactor | Fixes |
|---|---|---|---|
| A1 | `services/api-gateway/src/middleware/auth.ts` | Add third identity class: `Authorization: Bearer letbuyy_app_*` → lookup `oauth_tokens` (new table, doc 16) → attach `{appId, installationId, storeId, scopes[]}` to context. Factor the three identities into strategy modules `auth/strategies/{internal-sso,supabase-jwt,app-token}.ts` | C5, H8 |
| A2 | `services/api-gateway/src/routes/app-store.ts` (2,721 lines) | **Decompose** into `src/routes/app-store/{catalog,reviews,installations,oauth,embed,charges,developers,partners}.ts` + `src/lib/app-store/{oauth-config,install-service,charge-service}.ts`. Pure move-and-split; no behavior change; each module ≤400 lines; shared zod parsing into lib | maintainability, prerequisite for all platform work |
| A3 | `services/api-gateway/src/index.ts` Env usage + `packages/infrastructure` supabase adapter | Introduce `createTenantClient(ctx)` (anon + RLS, JWT-bound) and restrict `getSupabaseAdminFromEnv()` to an allowlist (outbox dispatcher, webhook claim, migrations); lint rule forbidding admin client in route handlers | C2 |
| A4 | `database/supabase/migrations/079_rls_hardening.sql` (new) | Rewrite the 39 permissive policies: tenant-scoped `EXISTS(sites.user_id=auth.uid())` patterns (copy working pattern from `checkout_sessions` policy); service-role narrowed per table | C1 |
| A5 | `apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx` (iframe branch :95-149) | Drop `allow-same-origin` OR serve frames from apps CDN origin; add `referrerpolicy="no-referrer"`, `loading="lazy"`, explicit `allow=""` | C6 |
| A6 | `services/webhook-service/src/index.ts` + migration | Hash `signing_secret` at rest (store `secret_hash`, show-once on create); sign with KMS-style lookup; backfill migration with forced re-issue | C4 |
| A7 | `apps/storefront-runtime/src/app/api/payments/paypal/webhook/route.ts` | Relocate handler into `services/webhook-service` beside Stripe/Razorpay; storefront route becomes 410 tombstone for one release | H7 |
| A8 | `apps/app-marketplace/src/app/api/apps/[id]/install/route.ts` + gateway install | Derive `store_id` server-side from session-store binding; reject body store_id mismatch; add `Idempotency-Key` support (dedupe table or KV) | H9, §5 doc 06 |

## Tier B — Correctness & observability

| # | File(s) | Refactor | Fixes |
|---|---|---|---|
| B1 | `apps/app-marketplace/src/lib/app-service.ts:48-56`, `apps/theme-marketplace/src/lib/theme-service.ts:18-23` | Replace empty-fallback with typed `Result<…, MarketplaceUnavailableError>`; UI renders explicit error state + retry | H5 |
| B2 | All 20+ files with `console.log` (storefront api routes, app-marketplace api routes, `packages/typescript/utils/src/auth.ts`, `platform-console/src/lib/console-auth-server.ts`, contexts) | Introduce `@letbuyy/observability` logger (level, redaction, request-id); codemod console.* → logger; add eslint `no-console` error to `config/eslint` | M1 |
| B3 | `apps/storefront-runtime/src/lib/store-service.ts:55-56` + `demo/urban-kicks-demo.ts` | Gate demo store behind `DEMO_STORE_SUBDOMAINS` env (empty in prod) | M4 |
| B4 | `apps/app-marketplace/src/lib/api/client.ts:14` | Remove staging fallback; fail-fast on missing `LETBUYY_API_BASE_URL` at boot | M2 |
| B5 | `services/api-gateway/src/middleware/{auth,store-context}.ts` + tenant lib | Consolidate 3 tenant-resolution implementations into `packages/tenant-core/resolve-context.ts`; middlewares call it | M7 |
| B6 | `services/api-gateway/src/routes/app-store/installations.ts` (post A2) + `apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts` | Honor extension registry status at render: placements joined with registry, `revoked|disabled` filtered; emit `app_block.suppressed` log | H11 |
| B7 | gateway install/uninstall handlers | Emit audit rows (`audit_logs`) + outbox events `app.installed/uninstalled` with actor; uninstall schedules purge job stub | M6, M18 |
| B8 | `services/webhook-service/src/index.ts:655-670` | Extract tax rate to store/billing settings; remove 18% hardcode | M11 |

## Tier C — Performance

| # | File(s) | Refactor | Fixes |
|---|---|---|---|
| C1 | `packages/theme-engine/src/theme-renderer.ts:230-250` | Engine/template LRU keyed `releaseId:templateKey` (Workers: per-isolate Map + size cap; enable liquidjs cache w/ custom keying); precompile hook on publish writing parse results to KV | M3 |
| C2 | `apps/storefront-runtime/src/lib/theme-engine/data-binding-engine.ts:46-84` | `Promise.all` section data fetches; per-request fetch budget; move ahead-of-render | M8 |
| C3 | `apps/storefront-runtime/src/lib/store-service.ts:348-376` | Replace O(N×M) section-definition walk with prebuilt `Map<type, definition>` | perf |
| C4 | `store-service.ts:220-288` | Move app-block injection to publish-time placement snapshot (doc 12 §5); request path reads snapshot | doc 05 §3 |

## Tier D — Type-safety & contracts

| # | File(s) | Refactor |
|---|---|---|
| D1 | `packages/theme-engine/src/index.ts:99-128` | `appBlocks?: unknown` → `AppBlockInstance[]` (import type from app-engine via shared-types to respect package layering); zod-validate at boundary |
| D2 | `packages/app-engine/src/index.ts` (~1520, 1556) | Normalizers stop silent-defaulting: return `{value, issues[]}`; callers log issues with store/app ids |
| D3 | `packages/app-engine/src/index.ts` | Split monolithic index.ts into `src/{manifest,lifecycle,extensions,webhooks,blocks,functions}.ts` with index re-exports (file is 1,778 lines) |
| D4 | `packages/shared-types/src/index.ts` | Resolve 2 TODOs; extract feature-flag engine (:1951-2027) to `packages/feature-flags` with targeting/exemptions support (M-flag gap) |
| D5 | `packages/extension-host/src/index.ts` | Either wire as the single iframe/web-component host used by admin + storefront (preferred; doc 10) or fold types into app-engine and delete package |

## Tier E — CI/CD & governance hygiene

| # | Target | Refactor | Fixes |
|---|---|---|---|
| E1 | `tsconfig`s + worker packages | Fix `@cloudflare/workers-types` resolution so `pnpm typecheck` passes repo-wide; make CI gate blocking again | H10 |
| E2 | `scripts/validate-governance.mjs` + generated artifacts | Regenerate or gitignore stale artifacts failing governance; add CI step that fails on drift | H10 |
| E3 | `.github/workflows/ci.yml` | Add secrets-scan (gitleaks), dependency audit, and `validate-governance` to PR pipeline | doc 07 CI gaps |
| E4 | Root `AGENTS.md` | Correct migration count claim; add Apps-Platform ownership section (OAuth owner = gateway; consent UI owner = control-plane) once doc 19 ratified | L5, ownership gaps |
| E5 | `config/eslint` | Rules: no-console (error), no service-role client outside allowlist, no `process.env` outside config modules | M1, C2 regression-guard |

## Sequencing
A1–A8 unblock everything and are independent of feature blueprints. B/C/D parallelizable by team. E1–E2 first if CI must gate the rest (recommended: do E1/E2 alongside A-tier week 1). Every PR: run `node scripts/validate-governance.mjs` per CLAUDE.md.
