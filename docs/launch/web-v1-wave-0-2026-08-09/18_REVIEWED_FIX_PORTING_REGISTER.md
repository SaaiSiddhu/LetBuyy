# 18 — Reviewed Fix Porting Register

**Evidence artifact, not governance authority.** Subordinate to `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` → root `AGENTS.md` → the relevant nested `AGENTS.md` → `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md`. Nothing in this document creates, amends, or relaxes a rule.

| Field | Value |
|---|---|
| **Baseline SHA** | `ee3711829d857e986014c5811bb94d86ebc3d343` |
| **Branch / worktree described** | `codex/web-v1-integration` at `/Users/saai_siddharth/Projects/Start_Up/Copy/letbuyy-w0-worktrees/web-v1-integration` |
| **Tip SHA after this pass** | `83b7fb39` (11 local commits, none pushed) |
| **Date** | 2026-08-09 |
| **Toolchain** | Node `v26.5.1`, pnpm `10.6.2`, git `2.50.1 (Apple Git-155)`, Darwin 25.3.0 |
| **Net change** | **134 files, +48,434 / −920** |

**Safety statement.** No `supabase` command of any kind was run. No `git clean` / `stash` / `reset` / `checkout --` / `restore` / `chmod` / `worktree remove` / push / PR / deploy. No migration was applied. The original tree at `/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store` was re-measured at the end of this pass: `git status --porcelain | wc -l` → **6826** (unchanged), `HEAD` → `ee371182` (unchanged), `git stash list` → **2** (unchanged). The only writes into the original tree are this document and the scratch evidence under the two authorised paths.

---

## 0. Executive summary

| Outcome | Count |
|---|---:|
| Files classified `PORT_TO_WEB_V1` by doc 16 | 138 (62 tracked + 76 untracked) |
| **Ported and committed** | **133** |
| **Held back — reclassified `HUMAN_REVIEW`** | **2** |
| **Held back — reclassified `REJECT`** | **3** |
| Additional file changed by this agent (declared, not from the dirty tree) | 1 (`store-publish.test.ts`) |
| **Total files in the branch's change set** | **134** |
| Atomic commits | 11 |

Six defects repaired here were **provably broken at `ee371182`**, each with an executed before/after:

| # | Defect | Executed proof |
|---|---|---|
| 1 | `apps/marketing-site` did not typecheck at all | `tsc --noEmit` exit **2 → 0**, 24 TS errors → 0 |
| 2 | Product / collection / search Liquid templates rendered an empty shell | theme-engine suite **1722 pass / 4 fail → 1730 pass / 0 fail**, 27 → 0 "template render limit exceeded" |
| 3 | Every newly onboarded merchant got a **dead store URL** | `platform-domain-literal-validator` exit **1 → 0**, 5 banned literals → 0 |
| 4 | A governance test **demanded the banned domain literal** (ANTI-R3) | wave-3 suite exit **1 → 0**, 3 pass/1 fail → 4 pass/0 fail |
| 5 | `sites.published` had readers + an index and **no writer** — admin said "live", storefront denied every request | source + migration + proxy corroborated; test contract retargeted, gateway unit suite **542 → 548 pass**, failures unchanged at 3 |
| 6 | One handle could resolve to **two different tenants**, returning an arbitrary one | new `storefront-handle-resolution.test.ts`: 6/6 pass, including a control proving the removed predicate DID select the namesake tenant |

Two regressions **this port itself introduced** were found by an individual run of all 108 gate-lane validators and fixed in commit `83b7fb39`. **Final attribution check: 0 of the 19 still-failing validators name any file in this branch's 134-file change set.**

---

## 1. Method

### 1.1 What was executed

```
git archive ee371182 | tar -x                                (pristine baseline tree)
pnpm install --prefer-offline                                 -> exit 0
python3 split_patch.py                                        (99 per-file chunks from
                                                               REAL_CONTENT_CHANGES_99.no-mode-flip.binary.patch)
python3 port.py <path-prefix>                                 (git apply --check then git apply;
                                                               untracked copied from untracked-raw/
                                                               with a non-empty-byte assertion)
python3 abcompare.py <name> "<cmd>" -- <paths>                (A/B a command against HEAD with a
                                                               PATH-PRESERVING snapshot + sha256
                                                               restore verification)
node scripts/validate-governance.mjs                          -> exit 1 (fail-fast at #6)
node scripts/validators/<each of 108>.mjs                     (individually, twice)
pnpm --filter <pkg> run typecheck | lint | test               (per package)
node scripts/generators/generate-tenant-table-registry.mjs    -> exit 0
```

The port used `REAL_CONTENT_CHANGES_99.no-mode-flip.binary.patch` as doc 16 §7.1 instructs, split per file. **No mode-only flip entered any commit** — verified with `git diff --cached --summary` before every commit (zero `mode change` lines).

### 1.2 Mode-only noise excluded

`pnpm install` chmod'd `packages/theme-engine/src/theme-cli.ts` to `100755`. Verified mode-only (`git diff --numstat` → `0 0`; index blob `51d8c00d…` == worktree blob `51d8c00d…`) and **never staged**. It is the single remaining dirty path in the worktree.

### 1.3 The empty-blob trap

None of the 10 intent-to-add SQL files is classified `PORT_TO_WEB_V1` (all are `HUMAN_REVIEW`, doc 16 group I), so the trap was never armed for this port. `port.py` nonetheless asserts non-zero bytes on every untracked file both at source and at destination; **every one of the 76 untracked candidates was non-empty**.

### 1.4 One methodological error, found and repaired

An early backup loop used `$(basename $f)` on two files both named `page.tsx` (`identity-platform/src/app/onboarding/page.tsx` and `.../select/page.tsx`), so the restore wrote `select`'s content into `onboarding`. Detected within the same step by an implausible lint delta (1 error → 2, both reported at `220:25`). **Nothing was committed.** All four identity-platform files were restored from `HEAD` (`git status --porcelain` → empty for that path), re-ported from the patch set, and re-measured. `abcompare.py` was then written to snapshot with **full relative paths** and to **verify every restore by sha256**; every subsequent A/B prints `RESTORE VERIFIED`. Recorded here because a register that hides its own near-miss is not evidence.

---

## 2. Per-fix register

### FIX 1 — `@letbuyy/ui` sidebar affordance, exact-match nav, hydration-safe toggle
**Commit `039a23af`** · 6 files · doc 16 group N + 2 untracked

| | |
|---|---|
| **Files** | `packages/typescript/ui/src/{app-shell.tsx, navigation/app-navigation.tsx, theme-toggle-button.tsx, tokens.ts}`, `+ src/sidebar-navigation.stories.tsx`, `+ tests/components/navigation-linked-parent.test.tsx` |
| **Diff summary** | `NavigationItem`/`NavigationChildItem` gain `exact`; `isNavItemActive(pathname, href, exact)`; active rows get a rail + hairline inset ring; a parent carrying its own `href` navigates on row click and toggles only on the chevron; submenu gets a `useId`-bound `aria-controls`; the theme-toggle icon is gated on a mount flag so the server render and the first client render agree; three sidebar tokens added in light and dark, all `color-mix` over existing `--lb-*`. |
| **Governance** | **UI-R7** (`AGENTS.md:294`) — no new naked `rgb()/hsl()`, raw px or arbitrary radius. **ARCH-R13** (`AGENTS.md:102`) — packages import no apps/services. |
| **Tests (real exit codes)** | `pnpm --filter @letbuyy/ui test` — **BEFORE** exit 1, 1 file, 35 pass / 1 fail; **AFTER** exit 1, 2 files, **44 pass / 1 fail**. Same pre-existing `foundation.test.tsx:736` failure; **+9 new passing tests**. `typecheck` → **0**. `validate:api` → **0**. `validate:tokens` → **0**. `validate:aliases` → **1 before and after, same 8 violations** (pre-existing palette hex duplicates). |
| **Validators** | `validate-design-system.mjs` → exit 1 before and after, **metric vector byte-identical** (`appCssRawHex 98, appCssNakedRgbHsl 849, appLocalLbTokenRedefs 220, rawPxSpacing 1568, tsxArbitraryRadius 387 …`). |
| **Verdict** | **PORTED.** No drift added; net +9 tests. |

---

### FIX 2 — Contact contract export; marketing-site build repair
**Commit `40a8dffe`** · 5 files · doc 16 groups D, H, M

| | |
|---|---|
| **Files** | `packages/shared-types/src/index.ts`, `apps/marketing-site/src/app/[locale]/contact/page.tsx`, `packages/infrastructure/resend-adapter/index.ts`, `config/env/{production,staging}.env.example` |
| **Diff summary** | `contact.ts`, `ContactForm.tsx`, `TicketLookup.tsx` and `services/api-gateway/src/routes/contact-public.ts` were **all already committed at `ee371182`** — but `contact.ts` was never re-exported from the package barrel, so every consumer imported symbols that did not exist. One line (`export * from './contact'`) restores the contract. The contact page mounts the form + ticket lookup and derives its published response promise from `CONTACT_TOPICS`. The Resend adapter keys its client cache **by API key** instead of using one module-level singleton, so the scoped public-form keys are genuinely isolated from transactional mail; it also sends text+html together and adds `replyTo`. |
| **Governance** | **ARCH-R15** (`AGENTS.md:103`) — cross-runtime contracts move through shared-package public exports. |
| **Secret handling** | Env templates add **variable NAMES and placeholders only** (`CONTACT_RESEND_API_KEY`, `CONTACT_RESEND_FROM_EMAIL`, `CONTACT_NOTIFY_EMAIL`, `CONTACT_TEAM_INBOXES`), matching names already read at `services/api-gateway/src/index.ts:236-245`. Screened: only `re_PLACEHOLDER_contact_form_only` and `generate-with-openssl-rand-base64-32`. **No real value is in the repo.** |
| **Tests (real exit codes)** | `pnpm --filter @letbuyy/marketing-site typecheck` — **BEFORE (both files at HEAD) exit 2, 24 TS errors**, first `ContactForm.tsx(7,5): TS2305 Module '"@letbuyy/shared-types"' has no exported member 'CONTACT_BUSINESS_TYPES'`; **AFTER exit 0**. `shared-types typecheck` → **0**. `api-gateway typecheck` → **0**. |
| **Verdict** | **PORTED.** Repairs a runtime that did not typecheck at baseline. |

---

### FIX 3 — theme-engine: empty product/collection/search renders
**Commit `d1c4fd7e`** · 33 files · doc 16 groups J + K + 10 untracked

| | |
|---|---|
| **Files** | `packages/theme-engine/src/{theme-renderer, theme-presets, experience-apply, experience-compositions, section-type-map, portable-to-liquid, theme-bundle, theme-bundle-core, index}.ts`, 2 tests, 12 example-theme fixtures, `+ src/theme-library-schemas.ts`, `+ test/liquid-render-limit-contention.test.ts`, `+ 8` fixture sections/templates |
| **Headline** | `liquidRenderOptions.renderLimit` **250 → 5_000**. LiquidJS `renderLimit` is a **wall-clock ms budget** from the start of `parseAndRender`, not a CPU budget or an operation count. Sections render concurrently (`Promise.all`) and `sanitizeRenderedHtml` runs jsdom + DOMPurify synchronously, so a ~3 ms section was aborted because a sibling blocked the event loop while its clock ran. |
| **Also** | `getExperience()` uses `hasOwnProperty`, so a merchant-supplied id like `'constructor'` resolves to `undefined` instead of a truthy non-experience object. NOVA's `defaultSections` now mirror its composition index, so `preview.sectionCount` stops misreporting to the merchant. |
| **Governance** | **THEME-R4** (`AGENTS.md:278`) and **SEC-R11** (`AGENTS.md:237`) — the **data-safety controls are untouched**: `ownPropertyOnly`, `dynamicPartials:false`, `strictFilters`, `outputEscape:'escape'`, the DOMPurify `FORBID` lists, upload-time `{% render %}` forbidding, `parseLimit` (300 000, template size) and `memoryLimit` (2 000 000, output size). Liquid rendering remains **default OFF (canary)**. **ARCH-R15** for the barrel re-export. |
| **Tests (real exit codes)** | `pnpm --filter @letbuyy/theme-engine test` — **BEFORE exit 1: 1726 tests, 1722 pass, 4 fail (L3, L5, L6, L7) with 27 `template render limit exceeded` log lines**; **AFTER exit 0: 1730 tests, 1730 pass, 0 fail, 0 render-limit errors.** `typecheck` → **0** (the first run's `TS6305` was purely a missing `packages/shared-types/dist` in a fresh worktree). |
| **Validators** | `theme-governance-validator.mjs` → **0**; `theme-editor-dead-shell-validator.mjs` → **0**. |
| **⚠ ESCALATION (E-A)** | `renderLimit: 250` is described as a **DoS limit** in ~15 documents under `docs/theme-research/`, `docs/storefront-liquid-discovery/` and `docs/archive/`. This raises that budget **20×**. It is not the data-safety boundary and no sanitizer control changed, and the old value was demonstrably breaking three storefront templates — but a 20× relaxation of a documented DoS budget should carry an **explicit security sign-off before the Liquid canary is widened**. It was ported because the repo's own suite proves it repairs 4 real failures; it is flagged here rather than absorbed silently. |
| **Verdict** | **PORTED**, with escalation E-A. |

---

### FIX 4 — identity-platform: DEPLOY-R3 storefront hosts
**Commit `90a5a3ee`** · 4 files · doc 16 group C

| | |
|---|---|
| **Files** | `apps/identity-platform/src/lib/config/urls.ts`, `src/app/api/auth/create-store/route.ts`, `src/app/onboarding/page.tsx`, `src/app/select/page.tsx` |
| **Diff summary** | Adds `DEFAULT_PLATFORM_ROOT_DOMAIN = 'letbuyy.com'` plus `getPlatformRootDomain()` / `getStorefrontHost()` / `getStorefrontUrl()`, each overridable via `NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN` or `PLATFORM_ROOT_DOMAIN` (names only). Three consumers stop interpolating a domain. |
| **Governance** | **DEPLOY-R3** (`AGENTS.md:332`) — one canonical domain, `letbuyy.com`; MUST NOT introduce the banned literal. **ARCH-R17** (`AGENTS.md:108`) — app-side config/presentation only. |
| **Tests (real exit codes)** | `node scripts/validators/platform-domain-literal-validator.mjs` — **BEFORE (all 4 files at HEAD) exit 1**, five functional literals at `create-store/route.ts:133`, `onboarding/page.tsx:378`, `:489`, `:531`, `select/page.tsx:197`; **AFTER exit 0**. `environment-honesty-validator.mjs` → **0**. `typecheck` → **0**. `lint` → **exit 1 BEFORE and AFTER, 36 problems (1 error, 35 warnings) both times** — the one error is the pre-existing raw `<button>` at `select/page.tsx:220:25`, untouched. |
| **Resolves an open item** | Doc 16 §10.4 recorded the ledger's "5 literals removed" as *not reproducible at ±1 (3–4 observable)*. **The validator counts 5.** The ledger figure is correct; the earlier undercount came from reading the diff rather than the enforcement. |
| **Deviation from the preserved patch** | The preserved `urls.ts` hunk carried the banned literal **inside its own explanatory comment**, which trips the validator it exists to satisfy. The comment was reworded ("the five banned legacy-TLD literals this replaces"). **No code changed.** |
| **Verdict** | **PORTED** with one declared comment-only deviation. |

---

### FIX 5 — merchant-control-plane: navigation IA, honest activation checklist, client-bundle fix
**Commit `5d6fa5f2`** · 12 files · doc 16 group E (2 files held back, 3 rejected)

| | |
|---|---|
| **Ported** | `next.config.ts`, `src/components/{merchantNavigation.ts, AdminShell.tsx}`, `src/app/[store]/dashboard/{page.tsx, DashboardClient.tsx}`, 7 product pages |
| **Diff summary** | Orders becomes a leaf — its `orders?view=drafts` / `?view=abandoned-checkouts` children were **dead links** (the Orders page filters from local state, never reads `useSearchParams`, and neither value is in its `OrderStatus` union). Inventory and Purchasing split out of the 12-child Products group; Customers is promoted out of Marketing; `exact` stops `products` matching `products/inventory`; a parent whose own path is literally one of its children (Money → Billing, Content → Pages) no longer renders the same `href` twice with two identical accessible names. The activation checklist's `paymentConfigured` was **hardcoded `false`** and now derives from real config, **under-claiming on any doubt** (COD on, OR shared-account online payments, OR own-Razorpay with `secret_configured` AND `verified`; an unreachable endpoint counts as not configured). `next.config.ts` adds `serverExternalPackages:['jsdom']` and a `NormalModuleReplacementPlugin` for `node:crypto`. |
| **False-green check** | `next.config.ts` contains **no `ignoreBuildErrors` and no `ignoreDuringBuilds`** — checked explicitly, not assumed. |
| **Governance** | **SEC-R1** (`AGENTS.md:224`) for the under-claiming checklist. **UI-R7** (`AGENTS.md:294`) — see the held-back item. |
| **Tests (real exit codes)** | `typecheck` → **0**. `lint` — **BEFORE (12 paths restored to HEAD, `RESTORE VERIFIED` by sha256) exit 1, 220 problems (122 errors, 98 warnings); AFTER exit 1, 217 problems (122 errors, 95 warnings)** → errors unchanged, warnings −3, **no new lint error**. |
| **Validators** | `dead-residue-validator` → 0, `typescript-dead-source-validator` → 0, `settings-apps-dead-twin-validator` → 0. `validate-design-system.mjs` → exit 1 before and after; metric delta vs the worktree baseline: `tailwindPaletteClasses 547 → 545` (improved), `tsxArbitraryRadius 387 → 388` (+1). All other metrics identical. |
| **On that +1** | `ARBITRARY_RADIUS` is `/\brounded-\[[^\]]+\]/` (`validate-design-system.mjs:136`) — it cannot distinguish `rounded-[14px]` from `rounded-[var(--lb-radius-full)]`. **All three additions use the token**, which is what UI-R7 actually requires. Recorded as a metric artifact, not a UI-R7 violation. |
| **Verdict** | **PARTIALLY PORTED** — see §3.1 and §3.2. |

---

### FIX 6 — storefront-runtime: fail closed on unresolved access; gate `/preview`
**Commit `54b2401d`** · 4 files · doc 16 group G + 1 untracked · **highest security value in this port**

| | |
|---|---|
| **Files** | `src/proxy.ts`, `src/app/preview/page.tsx`, `next.config.ts`, `+ src/lib/webpack/node-crypto-client-stub.ts` |
| **Defect A — the gate failed OPEN** | When store-access resolution returned `unavailable` (missing `INTERNAL_API_SECRET` or API base URL, gateway error, timeout) the middleware called `NextResponse.next()` and **served the storefront**. "Unavailable" is not evidence a store is public; it disabled the gate for **every store for the whole outage**. Now returns a 503 holding page. |
| **Defect B — `/preview` was ungated** | `loadPreviewStore` fell back to `StoreService.getStoreBySubdomainAnyStatus`, a loader whose purpose is to ignore status. **Any anonymous caller naming a subdomain in `?subdomain=` got a full render of that store** — password-gated, `preview_only`, `offline` and unpublished ones included. The fallback is removed: no store is fetched until the theme preview session token proves the caller may see it. |
| **Also** | Unvalidated `access_mode` JSON now counts as unresolved rather than falling through to a public render; both store-access fetches get a 3 s `AbortSignal.timeout`; `host.includes('vercel.app')` → exact-suffix match (a custom domain like `my-vercel.applications.in` no longer inherits the deployment bypass); the internal `/store/<subdomain>` tree is denied on deployment hosts and resolved against the named store's own host on the platform root; `rewriteToStore`'s prefix test lands on a **path-segment boundary**, so `/store/<subdomain>x` — a *different* tenant — is no longer passed through unprefixed; the `X-Lb-Render-Engine` header is dropped (derived from an env name declared in no env file, `vercel.json`, `wrangler.toml` or workflow and never read by the renderer, so it reported `'react'` on every response including genuine Liquid renders — **ANTI-R9**, a fabricated telemetry value). |
| **Governance** | **SEC-R1** (`AGENTS.md:224`) — everything fails closed; an omitted tenant gate must deny. **ANTI-R9** for the removed header. No money, RLS or OAuth code touched. |
| **Tests (real exit codes)** | `pnpm --filter @letbuyy/storefront-runtime test` — **BEFORE (3 paths at HEAD, `RESTORE VERIFIED`) exit 0, 945 tests, 945 pass, 0 fail; AFTER exit 0, 945 tests, 945 pass, 0 fail.** `typecheck` → **0**. `lint` → exit 1 before and after, **861 problems (4 errors, 857 warnings) both times**. `fail-closed-internal-routes-validator.mjs` → **0**. |
| **⚠ HONEST CAVEAT (E-B)** | The 945-test suite **does not cover `proxy.ts` or the `/preview` loader**. It proves *no regression elsewhere*; it neither confirms nor refutes the new fail-closed behaviour. **There is no executed test for the fail-closed path itself.** This is the largest untested surface in the port. |
| **⚠ DEPLOYMENT PRECONDITION (E-C)** | With the gate failing closed, a storefront environment missing `INTERNAL_API_SECRET` or `LETBUYY_API_BASE_URL` / `NEXT_PUBLIC_API_URL` will serve **503 for every store** instead of silently serving them ungated. Correct under SEC-R1, but it promotes those two variable names to **hard launch prerequisites**. |
| **Verdict** | **PORTED**, with escalations E-B and E-C. |

---

### FIX 7 — api-gateway: cross-tenant handle resolution, `sites.published`, fail-closed uniqueness
**Commit `d5562c75`** · 10 files · doc 16 group L + 1 untracked · **highest consequence in this port**

| Sub-fix | Detail |
|---|---|
| **7.1 `sites.published` had readers, an index and NO writer** | `database/supabase/migrations/090_custom_domains_and_store_access.sql:10` declares `published boolean NOT NULL DEFAULT false` with an index at `:34`; `apps/storefront-runtime/src/proxy.ts:299-300` gates on `site.published && site.status === 'published'` and `:311` denies on `!site.published`. Only `status` was ever written, so the boolean stayed `false` forever while the merchant admin reported the store live. `POST /:id/publish` now writes `published: true`; `PATCH /:id` writes `updates.published = (updates.status === 'published')` whenever status changes — which also covers unpublish (there is no separate `/unpublish` route; `grep -n unpublish stores.ts` → no match). |
| **7.2 Cross-tenant handle resolution** | `sites.subdomain` and `sites.store_name` are UNIQUE **within their own column but never against each other**, so one handle could match two different tenants; with `.limit(1)` and no ordering the resolver returned an **arbitrary** one — a `store_name` could capture another tenant's `subdomain`. Fixed in `GET /stores/handle/:handle`, `loadPublishedStore`, `loadSiteByHandle` and both pooled-SQL loaders (`subdomain` is NOT NULL + UNIQUE, so single-valued). The public store-finder probes the canonical column first, then `store_name`, each single-valued via `maybeSingle()`. |
| **7.3 PostgREST raw-filter hardening** | Nine interpolations of `.or(\`custom_user_id.eq.${id},user_id.eq.${id}\`)` — the tenant-**ownership** predicate — go through `ownedByCustomUserFilter()`, which double-quotes and backslash-escapes. `.or()` takes a **raw** filter string that postgrest-js does not quote. Defence in depth today (the value is a uuid) in the highest-consequence place to leave that pattern. |
| **7.4 Fail-closed uniqueness** | Store creation probes `subdomain` and `store_name` separately and returns **503 `SUBDOMAIN_CHECK_UNAVAILABLE`** if either probe errors, instead of racing the UNIQUE index into an opaque 500. Onboarding's `/:attemptId/complete` and `/check-subdomain` get the same cross-column rule. **SEC-R1.** |
| **7.5 `.single()` → `.maybeSingle()`** | The schema-compat retry is now gated on `isSchemaMismatchError` rather than any error, so a not-found no longer triggers a second pointless query. |
| **7.6 Contract de-duplication** | The Phase Q theme-library schemas and `sha256Hex` stop being redefined in the gateway and re-export from `@letbuyy/theme-engine` and `../../lib/crypto` — **ARCH-R15** (`AGENTS.md:103`). |
| **7.7 Tenant registry 261 → 265** | Adds `founding_merchant_allocations`, `site_domain_verifications`, `site_domains`, `subscription_coupon_redemptions`. Unregistered tenant tables are an isolation gap. |

**Generated-artifact proof (resolves doc 16 §10.2's UNVERIFIED item).** `node scripts/generators/generate-tenant-table-registry.mjs` → **exit 0**, "Generated … with 265 tenant-owned tables". Regenerated output vs the ported file: **a 4-line diff, one changed line — the generation timestamp only.** The registry is a real generator output, not a hand-edit.

**Declared test change.** Four assertions in `services/api-gateway/src/__tests__/store-publish.test.ts` pinned the **exact old source text of the vulnerable predicates** (`.or(\`custom_user_id.eq.${customUser.id},…\`)` and `.or(\`subdomain.eq.${normalized},store_name.eq.${normalized}\`)`). As written they made the suite **demand the unescaped, cross-tenant-ambiguous form and fail the hardened one** — the ANTI-R3 shape (`AGENTS.md:316`). They are retargeted and **strengthened, not relaxed**: the ownership assertion now additionally requires `ownedByCustomUserFilter` to exist and to double-quote + backslash-escape its value, **and asserts the old unescaped interpolation is absent**; the handle assertion requires `.eq('subdomain', normalized)` **and asserts the ambiguous `.or()` is absent**.

**Tests (real exit codes).**

| Suite | Before | After port, before retarget | Final |
|---|---|---|---|
| `test:unit` | exit 1 — 545 tests, **542 pass, 3 fail** | exit 1 — 551 tests, 544 pass, **7 fail** | exit 1 — 551 tests, **548 pass, 3 fail** |
| `tests/contracts/*` | exit 1 — 200 tests, **188 pass, 12 fail** | — | exit 1 — 200 tests, **188 pass, 12 fail** (identical) |
| `typecheck` | — | — | **exit 0** |
| `tenant-isolation-validator.mjs` | — | — | **exit 0** |

The 3 remaining unit failures are the same three present at baseline (`merchant AI route…`, `executive analytics migration…`, `storefront runtime no longer owns payment route handlers`). The new `storefront-handle-resolution.test.ts` contributes **6 passing tests**, including a control case proving the removed predicate **did** select the namesake tenant.

**Residual risks (recorded, not fixed).**
- *Behavioural narrowing.* A store addressable in the merchant admin by `store_name` rather than `subdomain` would now 404 on `GET /stores/handle/:handle`. Verified the sole producer emits `subdomain` (`identity-platform/src/app/select/page.tsx:85` and `:108` call `getAdminDashboardUrl(store.subdomain)`), so no known caller is affected.
- *Pre-existing, NOT introduced here.* Store creation probes uniqueness with the **raw** `body.subdomain` but inserts a normalized `body.subdomain.toLowerCase().replace(/[^a-z0-9-]/g,'')`, so probe and insert can disagree. The old `.or()` had the same flaw.

**Verdict: PORTED.**

---

### FIX 8 — tests: ANTI-R3 governance assertion; missing money fixture table
**Commits `023a2e00` + `3a3b269d`** · 2 files (1 held back)

| | |
|---|---|
| **8.1** | `tests/governance/foundation-wave3-production-safety.test.ts` — the test named *"domain defaults stay on letbuyy.com until DNS cutover is approved"* asserted the **opposite of its own name**: it required the banned literal in four source files. All four had already migrated to `letbuyy.com` (verified by grep: `marketing-site/src/lib/public-urls.ts:14`, `theme-marketplace/src/lib/public-urls.ts:8`, `app-marketplace/src/lib/site-url.ts:19`, `developer-portal/src/lib/site-url.ts:6`), so the assertion was **failing the suite for being correct**. **ANTI-R3** (`AGENTS.md:316`) + **DEPLOY-R3** (`AGENTS.md:332`). |
| **8.2** | `tests/executable/foundation-wave1-money-postgres.test.mjs` — `resetDatabase()` never created `public.store_customers`, but `database/supabase/migrations/142_executable_payment_sessions.sql:28` declares `customer_id uuid REFERENCES public.store_customers(id) ON DELETE SET NULL`, so the fixture could never satisfy that FK. Verified structurally: HEAD's fixture contains **0** occurrences of `store_customers`, the migration **1**. |
| **8.3 (follow-up `3a3b269d`)** | My own explanatory comment on 8.1 quoted the banned literal in prose, which the domain validator counts. Reworded — comment text only. Validator **exit 1 → 0**. |
| **Tests (real exit codes)** | wave-3 governance suite — **BEFORE exit 1: 4 tests, 3 pass, 1 fail; AFTER exit 0: 4 tests, 4 pass, 0 fail.** |
| **⚠ UNVERIFIED (E-D)** | `node --test tests/executable/foundation-wave1-money-postgres.test.mjs` → **exit 1**, `Error response from daemon: container … is not running`. The suite requires a live `letbuyy-executable-pg` docker Postgres which is not running and which this workflow will not start. **8.2 is verified structurally only.** |
| **⚠ OPEN DESIGN QUESTION (E-E)** | Two of the four files this Web V1 governance test reaches into live in **frozen** surfaces (`theme-marketplace`, `app-marketplace`). A V1 governance test coupling itself to frozen apps warrants an explicit call. |
| **Verdict** | **PORTED**, with E-D and E-E. |

---

### FIX 9 — discovery documentation packages
**Commit `6289c26d`** · 58 files

26 files under `docs/merchant-system-discovery/2026-08-04T225330+0530-ee371182/` and 27 under `docs/theme-system-current-state/`, plus agent notes. **Evidence artifacts, not governance authority.**

**Screened before commit.**
- **No mobile V1/V1.1 deferral assertion.** The only `DEFERRED` hits are the `SAFE-BUT-DEFERRED` scope-classification legend in `15-gap-register-and-priorities.md` — a statement about that engagement's authorization, not about mobile. **HUMAN DECISION 1 is not contradicted.**
- **One App Bridge mention**, at `04-MERCHANT-ROUTE-AND-NAVIGATION-INVENTORY.md:306` — a Dart route-inventory row recording an existing unreachable screen. Documentation of state, not App Bridge code. The `codex/emergency-appbridge-killswitch` surface is untouched.
- **Secret screen:** the only secret-shaped match across all 58 files is `sk_live_should_never_reach_liquid`, a deliberate negative-test fixture string quoted in prose. It is broken with an ellipsis in commit `83b7fb39` (see §4.2) so the secret scanner no longer flags it.

**Staleness notice (recorded in the commit).** Both packages are snapshots of `ee371182` taken **before** this branch's ports. Two rows of `15-gap-register-and-priorities.md` are already resolved here and must be read as historical: **GOV-02** (theme.schema.ts defines 6 `z.object` contracts locally) — fixed in `d5562c75`; **SET-02** (the `node:crypto` webpack fix is uncommitted and half-untracked, so a clean checkout builds neither app) — fixed in `5d6fa5f2` and `54b2401d`.

**Note.** 5 committed docs mention the banned domain literal in prose. `platform-domain-literal-validator.mjs` does not scan `docs/`, so this does not fail the gate. Recorded for transparency.

**Verdict: PORTED.**

---

## 3. NOT PORTED — reclassified from the preservation pass's labels

### 3.1 `apps/merchant-control-plane/src/app/globals.css` → **HUMAN_REVIEW** (was `PORT_TO_WEB_V1`)

The +271/−73 diff adds **+17 net app-local `--lb-*` redefinitions**, including:

```
--lb-color-primary: #7C3AED;
--lb-color-primary-hover: #8B5CF6;
--lb-sidebar-bg: rgb(44 38 66);
--lb-component-sidebar-bg: rgb(44 38 66);
```

That is **one app overriding the canonical design-system primary with raw hex and raw `rgb()`** — squarely the drift **UI-R7** (`AGENTS.md:294`) says the ratchet "MUST BLOCK … not baseline it". Measured with the file in place: `appLocalLbTokenRedefs` **220 → 237**, while `appCssNakedRgbHsl` improves **849 → 812**. Net it is a **design-system authority decision, not a bug fix**, so it is held rather than absorbed.

Doc 16 §E1 already flagged that this file was missing from register `04` entirely. It is now the single largest unported item and needs a design-system owner's call: either accept the app-level brand override and re-baseline the ratchet deliberately, or route the values through `@letbuyy/ui`.

### 3.2 The `AdminShell.tsx` class hooks → **HUMAN_REVIEW** (coupled to 3.1)

The preserved `AdminShell.tsx` diff adds `admin-panel-frame` / `admin-panel-sidebar` / `admin-panel-content` and **removes** `rounded-tl-[var(--sidebar-panel-radius)] overflow-hidden`. Those three classes exist **only** in the withheld `globals.css` (`git show HEAD:…globals.css | grep -c admin-panel-` → **0**; ported file → **6**). Porting the removal without the definitions would have shipped a sidebar that lost its rounded corner and overflow clip. The original Tailwind classes are kept; the `toNavigationItems` logic (`exact` passthrough + `duplicatesAChild`), which `merchantNavigation.ts` genuinely needs, **is** ported. Move both together with 3.1.

### 3.3 `public/__g3.html` + `public/activation/choose-theme-{left,right}.png` → **REJECT** (was `PORT_TO_WEB_V1`)

`__g3.html` is a developer **design-comparison scratch harness** ("Activation vs reference") that would be **publicly served from the merchant admin's `public/` directory**. It is not a Web V1 deliverable and expands the public surface for no product purpose. The preservation pass's label came from a bulk rationale ("Web V1 source/test/docs"), not a per-file judgement. The two PNGs were **never captured in `untracked-raw/`** either (that directory holds text files only), so porting them would have required copying binaries out of the production-linked tree.

### 3.4 `tests/security/theme-tenant-isolation.test.mjs` → **HUMAN_REVIEW** (was `PORT_TO_WEB_V1`)

Its own header states it exists to prove **migration 196**'s replacement of the `USING (true)` catalog policy on `public.themes`. Migration 196 is classified `HUMAN_REVIEW` (RLS/schema change, ARB-gated, and one of the ten intent-to-add empty-blob files) and is **not** in this port, so the test would assert a schema this branch does not have. Executed here it reported **0 tests, exit 0** — it self-skips without a database, which would read as a false green. **It must move together with migration 196.**

### 3.5 Everything doc 16 already classified away — untouched, confirmed

| Class | Count | Confirmation |
|---|---:|---|
| `PRESERVE_OUTSIDE_WEB_V1` — `apps/mobile/merchant-app/**` + `pubspec.lock` | 12 tracked + 2 untracked | **Zero mobile files in this branch.** `git diff --name-only ee371182..HEAD` contains no `apps/mobile/` path. **HUMAN DECISION 1 honoured:** mobile is `HUMAN_DECISION_REQUIRED`; no deferral is asserted anywhere in this branch. |
| `PRESERVE_OUTSIDE_WEB_V1` — `apps/developer-portal/**` (frozen) | 13 tracked + 7 untracked | Zero `apps/developer-portal/` paths in this branch. |
| `HUMAN_REVIEW` — migrations 196/197 + 8 rollbacks | 10 | Not ported. **No migration was applied or staged.** The empty-blob trap remains armed in the original tree (doc 16 E7) — untouched by this pass. |
| `HUMAN_REVIEW` — the two deferral-asserting governance docs + the 18-doc readiness package | 2 tracked + 18 untracked | Not ported. |
| `REJECT` — 2 zip artifacts + `tools/central-intelligence/package-lock.json` | 3 | Not ported. |
| App Bridge / app-store / marketplace code | — | **Untouched.** Reference only, as escalation E-F. |

---

## 4. Regressions this port introduced, and their repair

An individual run of **all 108 gate-lane validators** (the gate itself fail-fasts at #6, so it never reaches 102 of them) found exactly two.

### 4.1 `dependency-manifest-validator` + `undeclared-import-validator`
`packages/typescript/ui/src/sidebar-navigation.stories.tsx` imported `@storybook/react` — not declared anywhere. `@storybook/react-vite`, which **is** declared, is a `devDependency`, and the validator counts devDependencies only for files under `/test/`, `/tests/` or `*.config.*` (`isDevOnlySource`, `dependency-manifest-validator.mjs:65-77`). A `src/*.stories.tsx` therefore cannot import either. Rewritten to the convention **every other story in that directory already uses** — bare `export default { title }` plus an exported render function, no `@storybook/*` import. Verified this was the only one of the 8 stories importing `@storybook`. **ARCH-R15.**

### 4.2 `environment-validator`
Three ported docs **quoted** the fixture literal `sk_live_should_never_reach_liquid` while explaining why the validator's existing finding is a false positive — which made the secret scanner flag the docs too (pattern `/\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9_=-]{20,}/`, `environment-validator.mjs:131`). An ellipsis was inserted mid-literal so the suffix falls under the 20-character threshold. The prose still names the fixture; **the fixtures themselves are untouched** — redacting them would weaken the security tests, which is exactly what those docs argue.

Both fixed in commit `83b7fb39`.

---

## 5. Gate and validator state — measured, not copied

### 5.1 The gate

`node scripts/validate-governance.mjs` → **exit 1**, failing at validator **#6** `validate-design-system.mjs` — **identical to baseline**: same 1 hard invariant (`marketing-site: dark mode must be reachable through the canonical provider toggle`) and the same 9 ratchet regressions. The fail-fast at `validate-governance.mjs:201-203` still means the other 102 never run in the gate.

The `fs.rmSync` hazard (doc 16 / task brief) was handled: `removeGeneratedArtifactDirectories()` deletes `node_modules`, `.next`, `dist`, `build`, `coverage`, `.wrangler`, `.vercel`, `.turbo`, `.dart_tool`, `.cache`, `.symlinks`, `Pods` under `apps/`, `packages/`, `services/`, and fires only when the runner reaches `stale-artifact-validator.mjs` (`validate-governance.mjs:191`, list position 86). The gate dies at #6, so it never fires — **confirmed: `node_modules` survived the run.** In the individual sweep `stale-artifact-validator.mjs` was **deliberately SKIPPED**, and that is recorded rather than counted as a pass.

### 5.2 Design-system ratchet — full before/after

| Metric | Worktree baseline | After this port | Δ |
|---|---:|---:|:--|
| `appCssRawHex` | 98 | 98 | — |
| `appCssNakedRgbHsl` | 849 | 849 | — |
| `tailwindPaletteClasses` | 547 | 545 | **−2 (improved)** |
| `appLocalLbTokenRedefs` | 220 | 220 | — |
| `rawPxFontSize` | 604 | 604 | — |
| `rawPxSpacing` | 1568 | 1568 | — |
| `tsxInlineStyles` | 673 | 673 | — |
| `tsxRawHex` | 5 | 5 | — |
| `tsxArbitraryRadius` | 387 | 388 | **+1 (token-based, see §2 FIX 5)** |
| `tsxArbitraryShadow` | 9 | 9 | — |
| `localWorkspaceImplementations` | 0 | 0 | — |

> **Correction to the task brief.** The brief states validator #6 fails with *"2 hard invariants + 9 ratchet regressions"*. Remeasured on this worktree at baseline: **1 hard invariant + 9 ratchet regressions**. Not copied — executed.

### 5.3 All 108 individually

| | Pass | Fail | Skipped |
|---|---:|---:|---:|
| After the port, before §4 repairs | 86 | 20 | 1 |
| **Final** | **87** | **19** | **1** |

`platform-domain-literal-validator.mjs` is **proven failing at `ee371182`** (5 literals) and **passing now** — so the baseline had at least 20 failures and this port removed one.

**Final attribution check: for each of the 19 still-failing validators, its output was searched for every one of this branch's 134 changed paths. Zero matches.** The nearest entries — `packages/lcis-live/test/security.test.ts`, `packages/theme-engine/src/theme-safe-update.ts`, `packages/theme-engine/test/{dynamic-source-binding,theme-engine}.test.ts` — were each checked with `git diff --name-only ee371182..HEAD -- <path>` and none is in the change set.

Still failing (all pre-existing): `validate-design-system`, `package-ownership`, `dependency-manifest`, `undeclared-import`, `provider-isolation`, `typescript-governance`, `custom-domain-target`, `merchant-domains-settings`, `route-ownership`, `legacy-site-type`, `domain-boundary`, `route-line-count`, `cms-slugify`, `date-format`, `api-client-runtime-base`, `marketing-dead-twin`, `raw-error-message`, `environment`, `prompt-perimeter`.

> A baseline sweep against a pristine `git archive ee371182` extraction was attempted and **discarded as not comparable**: without generated artifacts and per-package `node_modules`, several validators crash with Node errors rather than failing cleanly (it reported 46 failures, an artefact of the extraction). Attribution by changed-file reference is used instead, and is stated as such.

---

## 6. Consolidated test evidence — every number executed in this worktree

| Suite | Command | Baseline (`ee371182`) | Final | Verdict |
|---|---|---|---|---|
| `@letbuyy/ui` | `pnpm --filter @letbuyy/ui test` | exit 1 — 36 tests, 35 pass, 1 fail | exit 1 — **45 tests, 44 pass, 1 fail** | +9 tests, same pre-existing failure |
| theme-engine | `pnpm --filter @letbuyy/theme-engine test` | exit 1 — 1726, 1722 pass, **4 fail** | **exit 0 — 1730, 1730 pass, 0 fail** | **4 failures repaired** |
| storefront-runtime | `pnpm --filter @letbuyy/storefront-runtime test` | exit 0 — 945, 945 pass | exit 0 — 945, 945 pass | no regression |
| api-gateway unit | `pnpm --filter @letbuyy/api-gateway test:unit` | exit 1 — 545, 542 pass, 3 fail | exit 1 — **551, 548 pass, 3 fail** | +6 tests, +6 passes, failures unchanged |
| contracts | `npx tsx --test tests/contracts/*.test.ts` | exit 1 — 200, 188 pass, 12 fail | exit 1 — 200, 188 pass, 12 fail | identical |
| wave-3 governance | `npx tsx --test tests/governance/foundation-wave3-production-safety.test.ts` | exit 1 — 4, 3 pass, 1 fail | **exit 0 — 4, 4 pass, 0 fail** | **repaired** |
| wave-1 money | `node --test tests/executable/foundation-wave1-money-postgres.test.mjs` | — | **exit 1 — docker container not running** | **UNVERIFIED (E-D)** |

**Typechecks — all exit 0:** `@letbuyy/ui`, `@letbuyy/shared-types`, `@letbuyy/theme-engine`, `@letbuyy/api-gateway`, `@letbuyy/marketing-site`, `@letbuyy/identity-platform`, `@letbuyy/merchant-control-plane`, `@letbuyy/storefront-runtime`.

**Lint (exit 1 everywhere, before and after — error counts unchanged):** identity-platform 36 problems / 1 error (both); merchant-control-plane 220 → 217 problems, **122 errors both**; storefront-runtime 861 problems / 4 errors (both).

---

## 7. Commit ledger

| SHA | Files | Subject |
|---|---:|---|
| `039a23af` | 6 | `feat(ui): sidebar active-state affordance, exact-match nav, hydration-safe theme toggle` |
| `40a8dffe` | 5 | `fix(marketing,shared-types): export the contact contract and repair the contact page build` |
| `d1c4fd7e` | 33 | `fix(theme-engine): repair empty product/collection/search renders and align experience compositions` |
| `90a5a3ee` | 4 | `fix(identity-platform): derive storefront hosts from the canonical domain (DEPLOY-R3)` |
| `5d6fa5f2` | 12 | `feat(merchant-control-plane): navigation IA, honest activation checklist, client-bundle fix` |
| `54b2401d` | 4 | `fix(storefront-runtime): fail closed on unresolved store access and gate /preview on its token` |
| `d5562c75` | 10 | `fix(api-gateway): close cross-tenant handle resolution, write sites.published, fail closed on uniqueness` |
| `023a2e00` | 2 | `fix(tests): stop the wave-3 governance test demanding the banned domain literal; add the missing money fixture table` |
| `6289c26d` | 58 | `docs: add the merchant-system and theme-system discovery evidence packages` |
| `3a3b269d` | 1 | `fix(tests): reword the wave-3 comment so it stops carrying the banned domain literal` |
| `83b7fb39` | 4 | `fix(ui,docs): remove the two validator regressions this port introduced` |

Every message ends with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. **Local only — nothing pushed, no PR, no deploy.**

**Allowlist audit.** All 134 changed paths were checked against `DISPOSITION_REGISTER.tsv`. **133 are `PORT_TO_WEB_V1`.** The one exception is `services/api-gateway/src/__tests__/store-publish.test.ts` — a HEAD file this agent edited deliberately (§2 FIX 7), declared in its commit message. Arithmetic: 138 candidates − 1 (§3.1) − 3 (§3.3) − 1 (§3.4) = 133, + 1 = **134**. ✓

---

## 8. Escalations requiring a human

| # | Item | Why |
|---|---|---|
| **E-A** | **Liquid `renderLimit` 250 → 5_000** (`d1c4fd7e`). | Documented as a DoS limit in ~15 repo documents. Ported because it provably repairs 4 failing tests and 27 render aborts, and because no sanitizer/data-safety control changed — but a 20× relaxation warrants an explicit security sign-off **before the Liquid canary is widened**. |
| **E-B** | **The storefront fail-closed path has no executed test.** | `proxy.ts` and the `/preview` loader are not covered by the 945-test suite. The two most valuable security fixes in this port rest on code review + adjacent-source corroboration only. |
| **E-C** | **New hard launch prerequisite.** | With the gate failing closed, a storefront environment missing `INTERNAL_API_SECRET` or `LETBUYY_API_BASE_URL`/`NEXT_PUBLIC_API_URL` serves **503 for every store**. Correct under SEC-R1; must be in the launch checklist, not discovered at rollout. |
| **E-D** | **`foundation-wave1-money-postgres` is UNVERIFIED.** | Requires a live `letbuyy-executable-pg` docker Postgres. Structural verification only. A money-lane fixture fix should not ship on a structural argument. |
| **E-E** | **A Web V1 governance test asserts against two FROZEN apps.** | `foundation-wave3-production-safety.test.ts` reads `theme-marketplace` and `app-marketplace` sources. Design call needed. |
| **E-F** | **App Bridge / marketplace overlap stands.** | Untouched here by instruction; owned by `codex/emergency-appbridge-killswitch`. Doc 16 E5 remains open. |
| **E-G** | **`globals.css` + the AdminShell class hooks are unported** (§3.1, §3.2). | A UI-R7 design-system authority decision. Until resolved, the merchant admin does not receive the intended panel restyle. |
| **E-H** | **`theme-tenant-isolation.test.mjs` is unported and must move with migration 196** (§3.4). | It currently reports 0 tests / exit 0 without a database — a false-green shape if it were merged alone. |
| **E-I** | **Six activation images referenced by DashboardClient do not exist** anywhere in the repo (`/activation/add-product.png` and 5 siblings). | Handled gracefully (hidden on error), so the cards degrade to empty wells. An asset gap, not a defect, but visible to every activating merchant. |
| **E-J** | **Pre-existing gate debt is unchanged.** | 19 of 108 validators fail, 12 contract tests fail, 3 gateway unit tests fail, and the gate still fail-fasts at #6 so 102 validators never run in CI. None is attributable to this port, and none is fixed by it. |
| **E-K** | **Doc 16 E7 (empty-blob trap) remains armed in the original tree.** | No SQL file was ported, so this pass neither triggered nor defused it. Any `git commit` in the original tree without a prior `git add` on those 10 paths still destroys ~789 lines. |

---

## 9. What remains UNVERIFIED

1. **No app `next build` was run.** `pnpm --filter <app> build` was not executed for any of the four Next apps. Typecheck and lint passed everywhere, but the repo's own operating rules note the gate does not cover `next build`, and neither does this register. The `node:crypto` webpack fix in particular is **verified by typecheck only** — its whole purpose is a bundler behaviour that only a real build exercises.
2. **The fail-closed proxy behaviour** (E-B) — no executed test.
3. **The wave-1 money fixture** (E-D) — no live Postgres.
4. **Runtime behaviour of the navigation IA change** — no browser or E2E run; correctness is argued from route existence and the 9 new unit tests, not from a rendered admin.
5. **Whether the withheld `globals.css` would break any visual regression baseline** — not measured, since it was not ported.
6. **The 12 failing contract tests and 3 failing gateway unit tests** were confirmed identical before and after but **not diagnosed**.
7. **Cross-branch interaction** with `codex/emergency-appbridge-killswitch` and with `stash@{0}`'s 28 divergent files (doc 16 E4) — neither was inspected or merged here.

---

## 10. Where the evidence lives

```
/Users/saai_siddharth/Projects/Start_Up/Copy/letbuyy-w0-worktrees/web-v1-integration
  git log ee371182..83b7fb39            <- the 11 commits; each message carries its own
                                           executed before/after with real exit codes

/Users/saai_siddharth/Projects/Start_Up/Copy/Letbuyy_Store/
  docs/launch/web-v1-wave-0-2026-08-09/
    16_DIRTY_WORKTREE_PRESERVATION_RECORD.md   <- the disposition this pass consumed
    18_REVIEWED_FIX_PORTING_REGISTER.md        <- this document
  artifacts/local-operational-proof/web-v1-wave-0-2026-08-09/raw-evidence/preservation/
    REAL_CONTENT_CHANGES_99.no-mode-flip.binary.patch   <- the patch source used
    DISPOSITION_REGISTER.tsv                            <- the allowlist enforced by port.py
    untracked-raw/                                      <- the 96 untracked source copies
```
