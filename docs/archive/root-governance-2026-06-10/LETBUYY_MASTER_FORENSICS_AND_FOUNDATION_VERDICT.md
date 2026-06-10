# LETBUYY — MASTER FORENSICS & FOUNDATION VERDICT

> **The definitive truth document for the LetBuyy platform.**
> **Date:** 2026-06-09 · **Posture:** read-only forensic due diligence (CTO / Principal Architect / Security / Platform / DB / Design-System / Production-Readiness review). **No code was modified.**
> **Evidence rule:** every claim traces to a repository `path[:line]` or is marked **INSUFFICIENT EVIDENCE**. Documentation, ledgers, comments, and status files are treated as *claims to be verified against code*, never as proof. Where a governing doc and the code disagree, **the code wins** and the conflict is named.

---

## HOW TO READ THIS DOCUMENT

Phases A–I answer the full review mandate. The short version lives in the **Executive Reality Check** immediately below; the **Final Verdict (Phase I)** is the board-level answer. Everything between is the evidence. This document supersedes the optimistic framing of the `CODEX_*` ledgers and reconciles the governing authorities (below) against what the code actually does.

### Governing authorities reconciled (all confirmed to exist)
| Authority | Location | How the code measures up |
|---|---|---|
| Executable Architecture V1 | `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` | Aspirational; partially realized in `api-gateway`. |
| **Final Architecture Freeze** | `LETBUYY_FINAL_ARCHITECTURE_FREEZE.md` | *“Ship a monolith, rent rails, never custody money, don’t build the 13-service platform.”* **The code violates this freeze** (see Phase A). |
| Foundation Remediation Mission | `CODEX_FOUNDATION_REMEDIATION_MISSION.md` | The corrective plan; this verdict is its evidentiary base. |
| Auth audit / current / target / SSO / session / migration | `docs/auth/2026-06-08-*/`, `2026-06-09-*/` | Accurate and unusually honest; the target (one issuer, verifiable tokens) is **not yet built**. |
| Foundation forensics (17 reports) | `FOUNDATION_FORENSICS_2026_06_09/` | The deep evidence base for this synthesis. |
| Production readiness audits | `PRODUCTION_READINESS_*_2026-06-07.md` | Corroborated; gaps still open in code. |

---

## EXECUTIVE REALITY CHECK

**What LetBuyy is, in one paragraph (code, not slides):** a single real backend — `services/api-gateway` (62 routes, Hono on Cloudflare Workers, Supabase Postgres, no ORM) — fronted by 9 Next.js apps and a Flutter merchant app, rendering multi-tenant section/block storefronts. The hard, valuable foundations are genuinely built: a double-entry ledger kernel, concurrency-safe inventory, an order state machine, a real theme engine, a four-layer design-token system, and a provably acyclic module graph. Wrapped around that core is a large layer of **aspirational scaffolding that runs in zero production paths** — a distributed-runtime tower, a 501 OIDC skeleton, a dormant “identity-foundation V2,” six manifest-only services, and ~46% name-grep validators. The platform **can take money but cannot truthfully move it out**, its **tenant boundary is convention-not-construction**, and **production is unobservable and un-backed-up**.

| Status | Meaning | Representative evidence |
|---|---|---|
| **REAL** | Runs, persists, correct | Ledger kernel `migrations/139`; inventory `SELECT…FOR UPDATE` `migrations/141`; order state machine `migrations/147`; inbound payment webhook HMAC `services/webhook-service`; theme registry `packages/theme-engine`; tokens `packages/typescript/ui/src/tokens.ts` (303 `--lb-` vars, 9/9 app adoption). |
| **PARTIAL** | Real spine, faked edge | Checkout (handoff real, confirm creates no order); settlement (posts ledger, off `orders.total`); WhatsApp (Twilio path real, sandbox default). |
| **FAKE** | Returns simulated success | Payouts (fabricated UTR, no provider call) `packages/infrastructure/payout-transfer-adapter/index.ts:82-103`; default `mock` payment capture `routes/payments.ts:130,604`; KYC sandbox auto-verify `routes/kyc.ts:71-79`; logistics labels `logistics-adapter/index.ts:146-158`. |
| **DORMANT** | Built, wired to nothing | distributed-runtime/projection-runtime tower (0 product call-sites); `identity-foundation` V2 (in-memory Maps); OIDC provider (`FEATURE_IDENTITY_PROVIDER` default false, mock JWKS). |
| **DANGEROUS** | Silent-failure / breach surface | Service-role everywhere → 685 RLS policies inert (`lib/supabase.ts`: `getSupabaseUser` 0 call-sites vs `getSupabaseAdmin` 98); gateway trusts HMAC `X-LetBuyy-Internal-User-ID` headers; static `super_admin` token `middleware/auth.ts:216-231`; `integer` money overflow `migrations/119`. |

**Composite maturity: ≈45/100. Verdict: REQUIRES RESTRUCTURING — a two-quarter foundation step-up, not a rewrite.**

---

# PHASE A — REPOSITORY FORENSICS (the autopsy)

**Method:** 4,419 tracked files; real-source counts per workspace; import-graph tracing; runtime call-site verification (type-import ≠ runtime use).

## A.1 The headline finding: the code violates its own Architecture Freeze

`LETBUYY_FINAL_ARCHITECTURE_FREEZE.md` (ARB decision, 2026-06-08) froze **“ship a monolith, rent rails”**: one modular monolith + `queue-workers` + `mobile-bff`, merchants bring their own Razorpay, a **licensed PA (Razorpay Route / Cashfree) custodies and disburses all money — LetBuyy never custodies funds**, and it explicitly **REJECTS** the 13-service “checkout platform” framing (§1 decisions #1, #3, #13). The code has drifted *away* from this freeze:

- It built a **distributed-runtime / orchestration / projection tower** (114+ files) the freeze never asked for — and it runs in **zero** product paths.
- It carries **six manifest-only “services”** — the ghost of the rejected 13-service platform.
- It built an **in-house payout *mover*** that fabricates bank UTRs, instead of the thin **split-instruction + reconciliation layer over a licensed PA** the freeze mandated.
- It stood up an **OIDC provider skeleton** the freeze defers.

This is the central architectural pathology: **effort flows to the impressive-looking layer the freeze rejected, while the load-bearing rails the freeze required (real money-out via PA, server cart, mobile login) stay faked or unbuilt.**

## A.2 Real vs paper topology (verified)

- **Backend:** `services/api-gateway` only (248 ts, 62 routes). `queue-workers` (9), `webhook-service` (4), `mobile-bff` (2) are minimal-but-real.
- **Paper services (manifest-only — `runtime.manifest.json` + `AGENTS.md`, zero source):** `analytics-pipeline`, `checkout-runtime`, `event-bus`, `media-service`, `notification-service`, `search-service`.
- **Contract-only packages (Zod/TS types, no runtime logic):** `commerce-core` (1188L), `cms-core` (878L), `tenant-core` (629L), `notification-core` (419L), plus the identity contracts `identity-core/session-core/token-core/permission-core/organization-core/audit-core`.
- **The distributed-systems tower self-consumes:** `distributed-runtime` (74 files) imported only by `orchestration`+`projection-runtime`; `projection-runtime` (15) only by `runtime-composition` (1 edge). **Runtime product call-sites into the tower: ZERO** — product mutations go route → `*ExecutionAdapter` → raw `db.from(table)` + `outbox_events`. It is in the build closure anyway (`tsconfig.workspace.json:24,26`).

## A.3 Duplicate / parallel systems (the “two of everything” pattern)

Per `docs/auth/.../AUTH_SYSTEM_MAP.md` (evidence-anchored) and confirmed in code:
- **3 parallel session systems:** merchant opaque token (`lb_session`), customer JWT (`lb_customer_session`), console signed token (`lb_console_session`).
- **2 parallel identity stores:** legacy `users` + `users_custom`.
- **2 parallel server auth systems** in the gateway: custom sessions + legacy Supabase Auth (`routes/auth.ts:411-480` vs `:1244-1268`).
- **2 parallel CSRF cookies:** `letbuyy_csrf` + legacy `lb_csrf`.
- **Dormant parallel identity stack:** `services/api-gateway/src/identity-foundation/` + `apps/identity-platform/src/lib/identity-foundation/` (V2, reachable from nothing real).
- **UI duplication:** `console-workspace.tsx` ≡ `ops-workspace.tsx` (char-identical, self-tagged `[CONSOLIDATE -> @letbuyy/ui]`); 4 `Header` implementations; 2 `Sidebar`; 8 hand-rolled `IndexTable`s in console/ops bypassing the shared `Table`.

## A.4 Classification ledger — KEEP / REFACTOR / QUARANTINE / DELETE / FREEZE

| System / Asset | Class | Severity | Owner | Risk if untouched | Action |
|---|---|---|---|---|---|
| `api-gateway` modular monolith | **KEEP / FREEZE shape** | — | Platform | — | Enforce module boundaries; do not split into services. |
| Ledger kernel `migrations/139` | **FREEZE** | — | Money | — | Use as system-of-record; never redesign. |
| Inventory locking `migrations/141`, order SM `migrations/147` | **FREEZE** | — | Commerce | — | Protect. |
| Theme engine `packages/theme-engine` | **KEEP** | — | Storefront | — | Extend (registry↔renderer contract). |
| Design tokens `@letbuyy/ui` | **KEEP / FREEZE source** | — | Design | — | Enforce, add semantic tokens only. |
| distributed-runtime / projection-runtime tower | **QUARANTINE** | HIGH | — | ~10K LOC dead in build, inflates platform claims | Remove from `tsconfig.workspace.json`; move to `quarantine/`. |
| `identity-foundation` V2 (gateway + app) | **QUARANTINE** | HIGH | Identity | Presented as identity capability; isn’t | Quarantine until real wiring decision. |
| 6 paper services | **QUARANTINE (reserved)** | MED | Platform | Shipped as topology; deploy risk | Exclude from build/deploy/topology filters. |
| In-house payout *mover* (`payout-transfer-adapter`) | **DELETE → REFACTOR to PA rail** | **CRITICAL** | Money | Fabricated UTRs; fake money movement | Replace with Route/Cashfree split-instruction + reconciliation (per Freeze). |
| Default `mock` payment mode | **REFACTOR (fail-closed)** | **CRITICAL** | Money | Marks orders paid w/ no provider | No `mock` default; reject in prod. |
| `integer` money columns `migrations/119` | **REFACTOR** | HIGH | DB | Overflow at ₹21,474,836.47 | Migrate to `bigint`. |
| Service-role-only data path | **REFACTOR (fail-closed tenancy)** | **CRITICAL** | Security | Silent cross-tenant IDOR | Tenant-scoped data layer that refuses unscoped queries. |
| Static `super_admin` token | **DELETE** | HIGH | Security | God-mode + fake audit subject | Per-principal identity + real audit. |
| OIDC 501 skeleton + mock JWKS | **QUARANTINE (honest 501)** | HIGH | Identity | Advertises non-existent capability | Gate off honestly; defer real build. |
| Legacy `users` store, `lb_csrf`, legacy Supabase Auth | **DELETE after migration** | HIGH | Identity | Parallel-system ambiguity | Collapse to one path (Phase E). |
| Name-grep validators (~81/177) | **REFACTOR (demote to report)** | MED | Governance | False confidence | Split `gate` vs `report` lanes. |
| `marketing-site` parallel CSS tokens | **REFACTOR** | MED | Design | 2nd token system | Migrate or exile from design surface. |
| Mobile 5 hand-authored color files (334 literals) | **REFACTOR** | MED | Mobile | Token fork | Generate from token bridge. |

---

# PHASE B — FOUNDATION AUDIT (per-module scoring, 0–10)

Dimensions: **Arch**itecture · **Corr**ectness · **Prod**uction-readiness · **Sec**urity · **Scal**ability · **Maint**ainability. Scores are evidence-anchored and deliberately harsh on faked edges. “Avg” is the unweighted mean.

| Module | Arch | Corr | Prod | Sec | Scal | Maint | Avg | Evidence & verdict |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|---|
| **Ledger kernel** | 8 | 8 | 6 | 7 | 7 | 7 | **7.2** | Append-only double-entry, idempotent, drift detector `migrations/139`. Strong — but only settlement/payout post to it; capture leg absent. |
| **Money (system-wide)** | 5 | 3 | 2 | 5 | 5 | 5 | **4.2** | Ledger internally consistent but **externally false**: capture not posted, payout fabricated. |
| **Payments (inbound)** | 6 | 6 | 5 | 6 | 6 | 5 | **5.7** | Real webhook HMAC + idempotency `webhook-service`; `/subscription/verify` re-check. **Default `mock`** `payments.ts:130`. |
| **Settlement** | 6 | 6 | 4 | 6 | 6 | 6 | **5.7** | Posts canonical ledger `settlements.ts:121,235`; computed off `orders.total`, not capture. |
| **Payouts** | 4 | 2 | 1 | 4 | 4 | 4 | **3.2** | **Fabricated UTR, no provider call** `payout-transfer-adapter:82-103`; wallet debited + ledger “release” for money that never moved. |
| **Inventory** | 8 | 8 | 6 | 6 | 6 | 7 | **6.8** | Real `SELECT…FOR UPDATE` + SKIP LOCKED sweeper `migrations/141`. Genuine strength. |
| **Orders** | 7 | 7 | 6 | 6 | 6 | 6 | **6.3** | DB-enforced state machine `migrations/147`; `OrderExecutionAdapter`. |
| **Checkout** | 5 | 4 | 3 | 5 | 5 | 5 | **4.5** | Handoff HMAC real; **confirm creates no order/payment** `checkout.ts`; client cart per Freeze §3. |
| **Customers / CRM** | 7 | 7 | 6 | 6 | 6 | 6 | **6.3** | Segments+rules, merge, real email send `customers.ts:35`. |
| **Identity** | 4 | 5 | 4 | 3 | 4 | 4 | **4.0** | Real authority is the gateway; no central issuer; 3 session systems, 2 stores. |
| **Sessions** | 5 | 6 | 4 | 4 | 5 | 5 | **4.8** | Opaque server-revocable (good); **30-day absolute, no idle, no rotation**. |
| **RBAC** | 5 | 5 | 4 | 4 | 5 | 4 | **4.5** | Mature ops-RBAC (break-glass/SoD/dual-control); merchant coarse; `requireRole` trusts JWT role; static god-token. |
| **MFA** | 4 | 4 | 2 | 3 | 4 | 4 | **3.5** | Correct TOTP construction but **not enforced at login** `auth.ts:411-480`; shared admin secret `admin-mfa-scaffold.ts:8`. |
| **Passkeys / WebAuthn** | 1 | 1 | 1 | 1 | 1 | 1 | **1.0** | Target-only (`TARGET_AUTH_ARCHITECTURE`); **no implementation**. INSUFFICIENT runtime evidence. |
| **Consent / grant registry** | 1 | 1 | 1 | 1 | 1 | 1 | **1.0** | **Absent**; no consent store. |
| **Notifications** | 6 | 5 | 4 | 5 | 5 | 5 | **5.0** | `notification-core` schemas real; `notification-service` is zero-file. |
| **WhatsApp** | 6 | 5 | 4 | 5 | 5 | 5 | **5.0** | Real Twilio POST; sandbox default; `WHATSAPP_WEBHOOK_SECRET=SKIP_NEEDS_HUMAN` `wrangler.toml:260`. |
| **Domains** | 6 | 6 | 5 | 6 | 6 | 6 | **5.8** | Vercel attach/verify real `domains.ts`; registrar mock. |
| **Themes** | 7 | 6 | 5 | 6 | 5 | 6 | **5.8** | Real section/block registry; renderer decoupled from registry (silent-render risk). |
| **Billing / Subscriptions** | 5 | 4 | 3 | 5 | 5 | 5 | **4.5** | `mock_payment_status` `billing.ts:232`; real path = `/subscription/verify`. |
| **Shipping / Logistics** | 4 | 2 | 2 | 4 | 4 | 4 | **3.3** | **Stub** — synthesized labels, no carrier fetch `logistics-adapter:146-158`. |
| **Tax / GST** | 6 | 5 | 4 | 5 | 5 | 5 | **5.0** | GST invoice real; IRP/e-invoice mock `tax.ts:113-115`. |
| **Analytics** | 5 | 5 | 4 | 5 | 4 | 5 | **4.7** | Real rollups + MV `analytics.ts`; pipeline service empty; scale-bound. |

**Foundation read:** the deterministic **commerce** core (ledger/inventory/orders/customers/themes) averages ~6.5 — genuinely good. The **money rails** (payouts 3.2, money-system 4.2, billing 4.5) and **identity** (4.0, MFA 3.5, passkeys/consent 1.0) are where the platform is unsafe. **Schema maturity exceeds runtime maturity** — the controls are more built than the rails they guard.

---

# PHASE C — UI / UX FORENSICS → (satisfies `UI_GOVERNANCE_AUDIT.md`)

**Central question — one design system or many?** **Verdict: ONE design *system*, but NOT one design *authority*.** The token layer is genuinely unified; *enforcement* and several *surfaces* have drifted into parallel systems.

### C.1 What is unified (real, protect it)
- **9/9 apps import `@letbuyy/ui`** (call-site counts: merchant-control-plane 75, app-marketplace 59, theme-marketplace 45, storefront 42, console 18, ops 17, identity 13, developer-portal 13, marketing 11).
- **One token source:** `packages/typescript/ui/src/tokens.ts` — 303 `--lb-` tokens (primitive→semantic→component→density).
- **One `LetbuyyThemeProvider`**; ESLint raw-element rule holds **0 hardcoded hex in any `.tsx`**.

### C.2 Where it has fractured (the “authority” gap)
| Divergence | Evidence | Severity |
|---|---|---|
| `marketing-site` runs a **parallel CSS token system** | `apps/marketing-site/src/app/globals.css` (5,319 lines, 25 hex, raw rgba locals) | HIGH |
| **Mobile forks tokens** by hand | 334 `Color(0xFF…)` literals across 5 Dart files (not generated from the bridge) | HIGH |
| **storefront-runtime inline-style sprawl** | **574** `style={{…}}` (vs 0 in console/ops) | MED |
| **Arbitrary scale bypass** (no central Tailwind config: **0** `tailwind.config.*`) | `rounded-[…]`: merchant 152, theme-marketplace 106, ops 54, console 26 | MED |
| **Giant per-app `globals.css`** | merchant-control-plane **10,335 lines**, app-marketplace 7,475 | MED |
| **Duplicate shells/components** | `console-workspace.tsx` ≡ `ops-workspace.tsx`; 4 `Header`s; 2 `Sidebar`s; 8 hand-rolled `IndexTable`s | MED |
| **Bypass of primitives** | developer-portal renders tables as raw HTML, not `<Table>` | MED |

### C.3 Component canonical-vs-fork matrix
Canonical primitives exist in `@letbuyy/ui` (`button.tsx`, `input.tsx`, `controls.tsx` [select], `overlays.tsx` [modal/drawer/dialog], `table.tsx`, `feedback.tsx` [toast/badge], `navigation/app-navigation.tsx`, `app-shell.tsx`). Status:

| Component | Canonical? | Duplicated / Forked | Dead? |
|---|---|---|---|
| Button / Input / Select | ✅ `@letbuyy/ui` | Feature-buttons only (`SaveAppButton` etc.) — acceptable | No |
| Modal / Drawer / Dialog | ✅ `overlays.tsx` | — | No |
| Table | ✅ `table.tsx` | **8 hand-rolled `*IndexTable`** in console/ops; developer-portal raw HTML | No |
| Card / Badge | ✅ | app-marketplace `AppCard`, `QualityBadge` (feature wrappers) | No |
| Sidebar | partial (`app-shell`) | **2** (`Sidebar.tsx`, `AISidebar.tsx`) | No |
| Header | partial | **4** (`Header.tsx` ×2, `HeaderBar.tsx`, `dynamic-header.tsx`) | No |
| Workspace shell | should be canonical | **`ConsoleWorkspace` ≡ `OpsWorkspace`** (char-identical) | dup |
| Tabs / Toast / Avatar | ✅/✅/INSUFFICIENT | — | — |

**UI consistency score: 68/100. Design-system score: 54/100.** A near-Polaris token core whose enforcement layer is weaker than the library itself.

---

# PHASE D — DARK MODE FORENSICS → (satisfies `DARK_MODE_FORENSICS.md`)

**Verdict: one token-driven dark mode *in principle*, partially forked *in practice*.**

### D.1 Current state
- **Theme switching:** a single canonical `packages/typescript/ui/src/theme-provider.tsx` flips token values; **no `next-themes`** (0 usages) — bespoke. But **parallel theme contexts exist**: storefront `src/lib/theme-engine/composition-engine.tsx`, identity `src/lib/useAuthTheme.ts`, and theme-marketplace contexts — i.e. **≥4 theme-provider-shaped surfaces**, not one.
- **Dark-mode mechanisms are mixed:** 51 `.dark` class selectors + 74 `prefers-color-scheme` + 10 `data-theme` references — three mechanisms coexisting.
- **Adoption is uneven (files using `dark:` utilities):** storefront 6, marketing 2, ops 2, merchant 1, **everything else 0** — admin/platform apps theme via tokens (good); storefront themes via utility classes (fork).
- **CSS variables:** 303 `--lb-` canonical vs **312 distinct `--var` names across CSS** — apps (identity, marketing) define **extra, non-canonical** variables.
- **Token bypasses / raw colors:** marketing-site 22 hex `.tsx` + 25 hex `.css`; identity 96 hex `.css` + 42 inline styles; mobile 334 `Color()` literals. These will **not** respond to theme switching.

### D.2 Target state
One theming authority: every surface (web + mobile) derives light/dark from `@letbuyy/ui` tokens; storefront’s `composition-engine` and identity’s `useAuthTheme` consume the canonical provider rather than re-implementing it; zero raw hex on any themable surface; one mechanism (token-value swap), not three.

### D.3 Migration strategy & priority
1. **P1 — Eliminate raw hex on themable surfaces** (marketing 47, identity 96, mobile 334): convert to tokens; add a CI gate. *Impact: dark mode actually works on those surfaces.*
2. **P1 — Converge theme providers:** make storefront/identity consume the canonical provider; delete the parallel contexts’ theme state.
3. **P2 — Normalize mechanism:** standardize on token-value swap; retire ad-hoc `prefers-color-scheme`/`.dark` mixing where it conflicts.
4. **P2 — Generate mobile dark tokens** from `generate-mobile-tokens.mjs`; delete the 5 hand-authored color files.

---

# PHASE E — IDENTITY FORENSICS → (satisfies `IDENTITY_MASTER_PLAN.md`)

Reconciled against `docs/auth/2026-06-08-*/AUTH_SYSTEM_MAP.md`, `TARGET_AUTH_ARCHITECTURE.md`, `SESSION_MANAGEMENT.md`, `MIGRATION_PLAN.md` — which are accurate and honest. The gap is execution, not understanding.

### E.1 Single source of truth — today vs target
- **Today (code):** there is **no central identity service**. The **API Gateway is the de-facto authority** — it owns `users_custom` + `sessions` and validates every merchant session. Each frontend app reads a cookie and then **re-asserts the caller’s identity to the gateway as HMAC-signed headers** (`X-LetBuyy-Internal-User-ID` / `X-LetBuyy-Internal-Session-*`). Identity is **asserted, not verified**.
- **Target (`TARGET_AUTH_ARCHITECTURE`):** exactly **one issuer** (a real Identity Platform service); the gateway becomes a **stateless Policy Enforcement Point** verifying **signed (asymmetric/JWKS) tokens**; realms (merchant/customer/admin) isolated by construction; sessions server-side with refresh rotation + reuse detection; OIDC/OAuth2 for SSO; WebAuthn passkeys; the shared symmetric HMAC retired.

### E.2 Current fragmentation (the debt to pay down)
3 session systems · 2 identity stores (`users` + `users_custom`) · 2 CSRF cookies · 2 gateway server-auth systems · 13 auth surfaces (`AUTH_SYSTEM_MAP §1`). No OIDC, no SSO broker, no consent registry, **no organization/tenant layer** (tenancy keyed on `site_id`).

### E.3 Trust-boundary risks (security-critical)
1. **Service-role everywhere → RLS inert** (`lib/supabase.ts`: `getSupabaseUser` 0 / `getSupabaseAdmin` 98). The 685 policies don’t engage; isolation is hand-written. **CRITICAL.**
2. **Identity is asserted via HMAC headers, not verified tokens.** If the shared internal secret leaks — and crypto-key reuse is a noted finding — any app (or a request that reaches the gateway with those headers) can claim to be any user. **CRITICAL (architectural).**
3. **Static `super_admin` token** mints god-mode + a fake audit subject `middleware/auth.ts:216-231`. **HIGH.**
4. **MFA enrolled-but-not-enforced** `auth.ts:411-480`; **shared admin TOTP** `admin-mfa-scaffold.ts:8`. **HIGH.**
5. **OIDC = 501 skeleton + mock JWKS** `apps/identity-platform/src/lib/identity-foundation/oidc-disabled.ts`. **HIGH (advertises non-existent capability).**
6. **Sessions** 30-day absolute, no idle, no rotation. **MEDIUM.**
*(Positives, verified: bcrypt-12, AES-GCM TOTP, opaque server-revocable sessions, SEC-H3 weak-key refusal, the `/api/auth/switch` device-proof fix, mature ops-RBAC.)*

### E.4 Migration path (sequence to the target)
1. **Collapse stores** → one (`users_custom`); retire legacy `users`/`lb_csrf`/legacy Supabase Auth.
2. **Verify, don’t assert:** replace app-supplied HMAC identity headers with gateway-verified **signed tokens** issued by one session service.
3. **Unify the 3 session systems** behind that service; add **idle timeout + rotation + reuse detection**.
4. **Enforce MFA**; per-principal admin TOTP; remove the god-token; `requireRole` resolves server-side.
5. **Per-realm asymmetric keys + JWKS**; retire the shared internal HMAC.
6. **Introduce the org/tenant layer** above `site_id`.
7. **Build OIDC/passkeys last** (out of foundation scope; honest 501 until then).
**Identity score: 34/100. Auth-portion of Security: 41/100.**

---

# PHASE F — PRODUCTION READINESS → (satisfies `PRODUCTION_MATURITY_REPORT.md`)

**Deployment topology (coherent):** backend (`api-gateway`, `webhook-service`, `queue-workers`, `mobile-bff`) on **Cloudflare Workers** (`wrangler deploy --env production`); 9 Next.js apps on **Vercel** (`vercel deploy --prod`); infra (Queues/KV/R2/D1) via Terraform `infrastructure/cloudflare/*`. Hyperdrive is bound but under-used (`FINAL_ARCHITECTURE_FREEZE §1 #5`).

| Area | State | Evidence | Verdict |
|---|---|---|---|
| CI/CD | Mixed | `production-deploy.yml` real (credential preflight, staging E2E gate, `pg_dump`, deploy, smoke); governance/rollout majority validator-theater; staging **silently no-ops if creds absent** `staging-deploy.yml:44,162-164` | PARTIAL |
| Secrets | **Placeholders shipped** | `SKIP_NEEDS_HUMAN_*` cluster `wrangler.toml:253-262` (WhatsApp, Twilio, AI) | FAIL |
| Backups / PITR | **None continuous** | only 7-day pre-migration artifact `production-deploy.yml:234-237`; no PITR in `docs/runbooks/infra-recovery.md` | FAIL (existential) |
| Observability | **Config-only** | Prometheus/Grafana/Loki/otel YAML never applied; Grafana datasource “not found” | FAIL |
| Logging/Tracing | Thin | edge analytics only; no wired tracing/error tracker | PARTIAL |
| Scaling | Bound by Supabase | REST path bypasses Hyperdrive → connection exhaustion at scale; **no search** → full-table scans; cron throttled 15-min `wrangler.toml:229`; `hot-table-partition-maintenance.yml` | RISK |
| “certify:production” | Self-attesting | `phase4-ultimate-validate.mjs` POSTs its own `"status":"passed"` | THEATER |

**Survive at:** **100 ✅** (Workers autoscale; blocker: WhatsApp/secret placeholders). **1,000 ⚠️** (Supabase connection exhaustion; no search). **10,000 ❌** (single Supabase, no replicas/search/notification/analytics; blind ops). **Production-readiness score: 31/100.**

---

# PHASE G — COMMERCE CORE → (satisfies `COMMERCE_TRUTH_REPORT.md`)

**End-to-end money-flow trace (buyer → settlement → payout → ledger → reconciliation):**

| Stage | What the code does | Real? | Evidence |
|---|---|:--:|---|
| 1. Buyer pays | Merchant’s own Razorpay (Model C, Freeze §1 #3) **or** default `mock` | ⚠️ | `routes/payments.ts:130` (`… || 'mock'`), `:604` mock capture marks paid |
| 2. Inbound webhook | HMAC verified + idempotent | ✅ | `services/webhook-service` (`payment_webhook_events`) |
| 3. Capture → ledger | **Not posted** to canonical ledger | ❌ | `buildPaymentCaptureLedgerPosting` `packages/payments/src/index.ts:420` — **only caller is the unit test** |
| 4. Settlement | Posts canonical ledger via RPC, computed off `orders.total` | ✅(internal) | `settlements.ts:121,235` `post_settlement_ledger_transaction` |
| 5. Payout — ledger | Posts canonical + “release” ledger txns; debits wallet | ✅(internal) | `payouts.ts:179,404,385` |
| 5. Payout — **real transfer** | **Fabricated** UTR, **no provider HTTP call** | ❌ | `payout-transfer-adapter/index.ts:82-103` |
| 6. Reconciliation | `ledger_balance_breaks()` drift detector | ✅(internal) | `migrations/139` |

**The money truth in one line:** the ledger is **internally consistent but externally false at both ends** — it never records the real money-in (capture not posted) and it records money-out (“release”) that never happened (payout fabricated). Add the **`integer` overflow** at ₹21,474,836.47 (`migrations/119`) and the **default `mock` mode**, and the platform **can take money but cannot truthfully move it or fully account for it.**

**Reconciliation with the Freeze:** `FINAL_ARCHITECTURE_FREEZE` already prescribes the correct fix — **LetBuyy never custodies funds; a licensed PA (Razorpay Route / Cashfree) disburses**, and LetBuyy keeps a **split-instruction + reconciliation layer over a double-entry ledger.** So WS-1 of the remediation mission is not “build a payout engine” — it is “**wire the PA rail the Freeze mandated, post the capture leg, reconcile against PA statements**,” and delete the fabricating adapter. **Commerce-OS readiness: 40/100; money-system: 4.2/10.**

---

# PHASE H — MASTER PRIORITIZATION (P0–P3)

**P0 = existential risk · P1 = beta blocker · P2 = growth blocker · P3 = future optimization.** Effort: S(≤1wk) / M(≤1mo) / L(≤1qtr) / XL(>1qtr). “HUMAN” = needs a human-supplied secret/contract (gate the feature off until then; never fake).

### P0 — Existential (close before any real money or merchant)
| # | Item | Impact | Risk if skipped | Effort | Dependencies |
|---|---|---|---|---|---|
| P0-1 | Wire PA payout rail (Route/Cashfree); delete fabricating adapter | Money can truthfully move out | Financial fraud / legal | L | HUMAN: PA creds; ledger |
| P0-2 | Post capture to ledger; ledger = system of record | Accounting truth | Books never reconcile to reality | M | Ledger kernel |
| P0-3 | Kill default `mock` payment mode (fail-closed in prod) | No fake-paid orders | Orders marked paid w/o money | S | — |
| P0-4 | Fail-closed tenant data layer + IDOR audit of every `:id` | Prevent cross-tenant breach | Silent PII/orders/payouts leak | L | — |
| P0-5 | Continuous backups + PITR + tested restore drill | Survive data loss | Unbounded data-loss window | M | HUMAN: Supabase tier |
| P0-6 | Remove static `super_admin` token | Close god-mode | Full takeover + fake audit | S | — |
| P0-7 | Migrate `integer` money cols → `bigint` | No overflow | Corruption >₹21.47M | S | P0-5 (backups first) |

### P1 — Beta blockers (the Freeze’s “four things that must become real”)
| # | Item | Impact | Effort | Dependencies |
|---|---|---|---|---|
| P1-1 | Mobile login (replace Turnstile placeholder) | Unblocks 100% mobile usage | M | HUMAN: Turnstile cfg |
| P1-2 | Server-authoritative cart/checkout-session; confirm creates order+payment | Checkout actually transacts | L | P0-1..3 |
| P1-3 | Enforce MFA at login; per-principal admin TOTP | Account-takeover defense | M | — |
| P1-4 | Verify-not-assert identity (signed tokens; isolate/rotate internal secret) | Close header-forgery class | L | — |
| P1-5 | Deploy observability (metrics/logs/traces/alerts/error tracker) | Operable in prod | M | HUMAN: Sentry DSN |
| P1-6 | Secret preflight gate (block `SKIP_NEEDS_HUMAN`); gate features off | Can’t ship placeholders | S | — |
| P1-7 | WhatsApp order-lifecycle + COD confirm (India wedge) | Core differentiator | M | HUMAN: WhatsApp/Twilio |
| P1-8 | Session idle timeout + rotation | Session hygiene | S | — |
| P1-9 | Quarantine theater (tower, identity-foundation V2, 6 paper services); split validators gate/report | Legible, honest build | M | — |

### P2 — Growth blockers
| # | Item | Effort | Dependencies |
|---|---|---|---|
| P2-1 | Collapse parallel auth (2 stores / 2 CSRF / 3 sessions / 2 server-auth) → one | L | P1-4 |
| P2-2 | Real logistics carrier (Shiprocket/Delhivery) | M | HUMAN: carrier |
| P2-3 | Real KYC vendor; gate onboarding until verified | M | HUMAN: vendor |
| P2-4 | Tax IRP/e-invoice real | M | HUMAN: IRP provider |
| P2-5 | Design authority enforcement (ratchet gate, kill parallel tokens, generate mobile tokens, burn down 574 storefront inline styles, dedupe shells) | M | — |
| P2-6 | Theme registry↔renderer contract + section-schema migration | M | — |
| P2-7 | Search service + Supabase pooling/read-replica plan | L | — |
| P2-8 | Domain unification (`.com` vs `.store`) | S | — |

### P3 — Future optimization
Real OIDC provider + passkeys + consent registry (XL) · org/tenant layer above `site_id` (L) · notification & analytics pipelines as real services *only if scale demands* (L) · globals.css reduction + motion system + a11y pass (M).

---

# PHASE I — FINAL VERDICT

### 1. Actual maturity level
**≈45/100 — an advanced, well-modeled pre-beta foundation, not a production money platform.** The commerce *model* is genuinely strong (≈6.5/10 across ledger/inventory/orders/customers/themes); the *rails that handle money, identity, and operations are unsafe* (money 4.2, identity 4.0, production 3.1). It is further along than most pre-seed builds on the hard modeling, and further behind than its documentation implies on truthful execution.

### 2. The 25 biggest risks (ranked)
1. Fabricated payouts (`payout-transfer-adapter:82-103`). 2. Capture not posted; ledger≠SoR (`payments/src/index.ts:420`). 3. Service-role → RLS inert; latent cross-tenant IDOR (`lib/supabase.ts`). 4. Identity **asserted via HMAC headers**, not verified — secret leak = impersonation. 5. Default `mock` payment marks orders paid (`payments.ts:130`). 6. No continuous backup/PITR (`production-deploy.yml:234-237`). 7. Static `super_admin` god-token (`middleware/auth.ts:216-231`). 8. `integer` money overflow (`migrations/119`). 9. MFA not enforced (`auth.ts:411-480`). 10. Observability undeployed → blind prod. 11. Shared admin TOTP (`admin-mfa-scaffold.ts:8`). 12. Checkout confirm creates no order; client cart. 13. Mobile login blocked on prod (Turnstile placeholder). 14. `SKIP_NEEDS_HUMAN` secrets in prod (`wrangler.toml:253-262`). 15. OIDC 501 + mock JWKS advertised. 16. Logistics stub (`logistics-adapter:146-158`). 17. KYC sandbox auto-verify (compliance). 18. **Code drifting from its own Architecture Freeze** (theater built, rails faked). 19. Crypto-key reuse across purposes. 20. Single Supabase; REST bypasses Hyperdrive → connection exhaustion at 1k+. 21. No search → full-table scans at scale. 22. 3 session systems / 2 stores → ambiguous live path. 23. ~46% validators are name-grep theater → false CI confidence. 24. Billing simulated (`billing.ts:232`). 25. Tax e-invoice mock (`tax.ts:113-115`).

### 3. The 25 strongest assets (ranked)
1. Double-entry ledger kernel (`migrations/139`). 2. Concurrency-safe inventory (`migrations/141`). 3. DB-enforced order state machine (`migrations/147`). 4. Real inbound webhook HMAC + idempotency (`webhook-service`). 5. Section/block theme engine (`theme-engine`). 6. Four-layer tokens, 9/9 adoption, 0 hex in `.tsx`. 7. Acyclic package graph; 0 app↔app imports. 8. Right-sized modular monolith on Cloudflare. 9. Opaque server-revocable sessions + real logout. 10. Mature ops-RBAC (break-glass/SoD/dual-control). 11. Correct AES-GCM TOTP construction. 12. bcrypt-12 hashing. 13. SEC-H3 weak-key refusal + `/api/auth/switch` fix. 14. Cross-realm cookie isolation. 15. Real CRM + email. 16. Real analytics rollups + MVs. 17. Vercel custom-domain attach/verify. 18. Real GST invoice generation. 19. Coherent Workers+Vercel deploy + real E2E gate + pre-migration `pg_dump`. 20. Honest, evidence-anchored auth governing docs. 21. The Architecture Freeze’s “rent rails, never custody” regulatory call. 22. Portable theme bundle + draft→publish. 23. 89-migration normalized schema. 24. Settlement/payout ledger postings wired. 25. Real coupons/returns/reviews.

### 4–7. Disposition
- **NEVER rewrite (the crown jewels):** ledger kernel, inventory locking, order state machine, theme engine, design-token source, package-boundary discipline, the auth primitives (bcrypt/TOTP/opaque sessions/SEC-H3).
- **FREEZE:** the modular-monolith shape; `migrations/139` as the money primitive; the cross-realm cookie model; the “rent rails, never custody” regulatory decision.
- **DELETE:** the fabricating payout adapter; the static `super_admin` token; legacy `users` store / `lb_csrf` / legacy Supabase Auth (after migration); the default `mock` money path.
- **QUARANTINE:** distributed-runtime/projection-runtime tower; `identity-foundation` V2; the 6 paper services; the OIDC skeleton (honest 501); name-grep validators (demote to report lane).

### 8. What to build next (in order)
Money truth (PA rail + capture-to-ledger) → fail-closed tenancy → backups/observability → mobile login + server checkout → MFA + verify-not-assert identity → WhatsApp lifecycle. **Not** OIDC, marketplace, AI, or new surfaces — those are post-foundation.

### 9. Scale honesty (design envelope: India, 100→10k merchants — `FINAL_ARCHITECTURE_FREEZE §0`)
- **100 merchants — YES**, once mobile login + real money-out + backups land. Workers autoscale; Supabase comfortable.
- **1,000 — CONDITIONAL.** Binding blockers: Supabase connection exhaustion (REST path bypasses Hyperdrive) and no search (full-table scans). Needs pooling/read-path work.
- **10,000 — NO (today).** Single Supabase without replicas, no search/notification/analytics services, undeployed observability. Reachable with P2-7 + the deferred services, not before.

### 10. Realistic path to production
- **Q1 — Make it true & safe:** P0 (money rail + ledger SoR + fail-closed tenancy + backups + bigint + kill god-token/mock) and the WS-0 quarantine. *Exit: a merchant can be paid truthfully and no tenant can see another’s data.*
- **Q2 — Make it shippable:** P1 (mobile login, server checkout, MFA + verify-not-assert, observability, secret preflight, WhatsApp wedge). *Exit: closed beta with real merchants.*
- **Q3+ — Make it scale & consolidate:** P2 (auth consolidation, logistics/KYC/tax rails, design authority, search/pooling). *Exit: 1,000-merchant GA.*
- Composite trajectory: **≈45 → ≈70 after Q1–Q2** (production-trustworthy); GA-grade is the Q3 work plus a real app ecosystem later.

---

## FINAL SCORECARD

| Dimension | Score |
|---|---:|
| Architecture | 41/100 |
| Identity | 34/100 |
| Security | 38/100 |
| Design System | 54/100 |
| Theme Editor | 62/100 |
| Monorepo Governance | 48/100 |
| Commerce OS | 40/100 |
| Production Readiness | 31/100 |
| Foundation | 58/100 |
| **COMPOSITE** | **≈45/100** |

## RECOMMENDATION

# → REQUIRES RESTRUCTURING
**A two-quarter, truth-first foundation step-up — explicitly NOT a rewrite.** Keep the chassis (the crown jewels above), rebuild the rails (money-out via PA, fail-closed tenancy, verify-not-assert identity), delete the theater, and deploy the safety net (backups, observability). The platform’s problem was never engineering capability — it is, exactly as its own Architecture Freeze said, *“designing the destination instead of the road.”* Build the road.

> **The definitive truth:** LetBuyy is a genuinely good commerce core that has been dressed as something five times its size. Take off the costume, wire the money, lock the tenants, turn on the lights — and the foundation underneath is worth building on.

---
*Every claim above traces to a repository `path[:line]` or a named governing doc; conflicts were resolved in favor of the code. Companion evidence: `FOUNDATION_FORENSICS_2026_06_09/` (17 reports), `CODEX_FOUNDATION_REMEDIATION_MISSION.md` (the execution plan), `docs/auth/2026-06-08…/` and `2026-06-09…/` (identity authorities).*
