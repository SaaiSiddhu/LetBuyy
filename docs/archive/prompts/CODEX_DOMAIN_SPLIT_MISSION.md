# CODEX MISSION — Domain Split + Custom-Domain & Storefront-Access Foundation

> **You are Codex operating on the LetBuyy monorepo, locally, in one continuous mission.**
> Implement the entire two-domain split foundation and the custom-domain + storefront-access
> feature **in code**, end to end, in a single run. Where a step needs an account, secret,
> DNS/registrar, Vercel, or other human/external action, **do NOT stop** — implement the code
> so it is ready, mark that step `SKIPPED — NEEDS HUMAN`, record it in the ledger + status
> punch-list, and continue. Keep the governance gate green the whole way.

---

## 0. Canonical sources (read first, in this order)

1. `AGENTS.md` (root) — engineering constitution. Obey it first.
2. `docs/governance/domain-topology-governance.md` — the canonical design for this mission.
3. `LETBUYY_DOMAIN_SPLIT_EXECUTION.md` — sequenced runbook (code vs account split).
4. `LETBUYY_STOREFRONT_ACCESS_V1.md` — store password + preview-link model (Phase-1 = storefront
   middleware, not a Worker).
5. Local `AGENTS.md` files in each `apps/*`, `services/*`, `infrastructure/*` you touch.

If any instruction here conflicts with `AGENTS.md`, **`AGENTS.md` wins** — stop and record the
conflict in the ledger instead of guessing.

---

## 1. Locked decisions (do not re-litigate)

1. **Two domains.** `letbuyy.com` = platform control plane (accounts/admin/apps/themes/
   developer/console/team/api/webhooks). `letbuyy.store` = storefronts only
   (`*.letbuyy.store` + merchant custom domains). Storefronts **never move**.
2. **Two cookie realms, never shared.** Platform SSO cookie scoped to the platform apex
   (env `COOKIE_DOMAIN`); storefront customer cookie is **host-only** (no `domain` attribute).
3. **Custom-domain CNAME target = `cname.vercel-dns.com`** (Phase-1, Vercel-direct). No Cloudflare
   Worker storefront gateway in this mission (that is deferred Phase-2).
4. **Store gating = one shared store password + signed/expiring preview links**, enforced in
   **storefront-runtime middleware** and backed by **api-gateway** (single-writer).
5. **Env-driven, never hardcoded.** The `.com` target is expressed through env templates/schema
   and read at runtime with fail-loud missing-config. Do **not** hardcode `letbuyy.com` in
   source (the `environment-honesty` validator will fail you). Do **not** change the live
   `COOKIE_DOMAIN` default away from `.letbuyy.store` (that flip is an account action — §HUMAN).

---

## 2. Non-negotiable repo idioms (this is how this repo stays green)

- **Branch.** Work on `stream/domain-split-foundation` off `develop`. Never commit secrets.
- **Mission bookkeeping (mirror the existing CODEX_* convention).** Maintain:
  - `CODEX_DOMAIN_SPLIT_LEDGER.md` — `ARCHITECTURE-DIRECTION DECISIONS`, `BASELINE`, and a
    `PROGRESS LOG` with one timestamped entry per phase: `<ISO8601> [DS-x] <title> — DONE` (or
    `DONE/SKIPPED ...`) — followed by **exact commands run and pass counts** as evidence.
  - `CODEX_DOMAIN_SPLIT_STATUS.md` — current phase, gate state (e.g. `validate:governance -> N/N
    PASS`), and the consolidated `SKIPPED — NEEDS HUMAN` punch-list with the exact future proof path.
- **Every structural change ships with enforcement.** For each phase that changes structure, add
  `scripts/validators/<name>-validator.mjs`, **wire it into `scripts/validate-governance.mjs`**,
  and add `tests/contracts/<name>.test.ts` (or `tests/<area>/*.test.mjs`). This is the repo’s
  core idiom — a change without a validator+test that prevents regression is incomplete.
- **Single-writer ownership.** Only `services/api-gateway` writes domain/site tables. The
  storefront and any other surface **call gateway endpoints**; they never write the DB directly.
  (`single-writer-ownership-validator.mjs` enforces this — extend its owned-table list.)
- **Naming.** Database table is **`sites`** (never introduce `stores`). URLs/UI may say "store".
- **Deprecated topology.** Do not reintroduce deprecated app aliases (`apps/admin`, `apps/auth`,
  `apps/storefront`, …). Archive removed code to `docs/archive/...`; never hard-delete governed source.
- **Generated artifacts.** Before every `validate:governance` run, clean workspace-local
  `node_modules/.turbo/dist/.next` generated artifacts (the stale-artifact validator fails otherwise),
  then regenerate intelligence where required.
- **Sandbox infra flakes.** If `pnpm install`/`turbo`/`tsx` fail on sandbox-only causes (registry
  DNS `ENOTFOUND`, IPC/pipe permission, port binding), retry/escalate and record it — these are not
  real failures, but a real error surfaced after escalation **is** and must be fixed.

---

## 3. Baseline gate (DS-0) — capture before any edit

Run and record verbatim in the ledger `BASELINE`:

```
pnpm install --frozen-lockfile --force
pnpm turbo typecheck --output-logs=errors-only --log-order=grouped
pnpm lint
pnpm turbo test --output-logs=errors-only --log-order=grouped
pnpm run test:contracts
pnpm run test:behavioral
flutter analyze apps/mobile/merchant-app packages/dart/core packages/dart/models
# clean generated artifacts, then:
pnpm run validate:governance
```

Record current `validate:governance` count (e.g. `157/157 PASS`). Every later phase must end at
**≥ that count, all PASS** (your new validators raise the count).

---

## 4. Phases — implement all, in order. End each phase green; log evidence.

### DS-1 — DNS parallel stand-up (code only; apply is HUMAN)
- **Goal:** control-plane zone for `letbuyy.com` exists in Terraform, additive, non-destructive.
- **Do:** confirm `infrastructure/dns/letbuyy_com.tf` exists and is `terraform fmt`-clean and
  `terraform validate`-clean (it reuses the provider/`cloudflare_api_token` from `dns.tf`; only
  declares `cloudflare_zone_id_com`). Leave `dns.tf` (storefront zone) **unchanged** — migration
  §13 requires parallel stand-up first. Add the `*_STORE_ROOT`/redirect notes only as comments.
- **SKIPPED — NEEDS HUMAN:** add `letbuyy.com` to Cloudflare, move nameservers, supply
  `cloudflare_zone_id_com`, `terraform apply`. Record exact future command:
  `terraform plan && terraform apply` with the zone id var.
- **Enforce:** `tests/contracts/dns-letbuyy-com-zone.test.ts` asserting the file declares the
  apex+www+platform-host records and reuses (does not re-declare) the provider.

### DS-2 — Env contract target-ready (code only; live values HUMAN)
- **Goal:** the `.com` realm + storefront host root are expressed in env templates/schema, env-driven.
- **Do:**
  - Add `NEXT_PUBLIC_STORE_ROOT_DOMAIN` (default documented as `letbuyy.store`) to
    `config/env/schemas/next-app.schema.json`, `config/env/templates/next-app.env.example`, and the
    staging/production templates + examples. This is the single source for the storefront host parser.
  - In `config/env/production.env.template` + `.example` (and staging equivalents): **keep the
    current active `.store` values unchanged** (so nothing deployed from a template can break), and
    directly beneath each, add a commented cutover target line, e.g.
    `# CUTOVER (with DNS/Vercel move): COOKIE_DOMAIN=.letbuyy.com`,
    `# CUTOVER: NEXT_PUBLIC_ACCOUNTS_URL=https://accounts.letbuyy.com`,
    `# CUTOVER: NEXT_PUBLIC_API_URL=https://api.letbuyy.com`. Document that the storefront app must
    leave `COOKIE_DOMAIN` **unset**. The only **active** new key added is
    `NEXT_PUBLIC_STORE_ROOT_DOMAIN=letbuyy.store`. Update
    `config/env/staging-production-secret-matrix.json` only to list key names, never values.
  - Do **not** hardcode any `.com` literal in application/source code. Do **not** change the
    `COOKIE_DOMAIN` runtime default in `apps/identity-platform/src/lib/auth/cookies.ts`
    (stays `.letbuyy.store` until the account cutover).
- **⚠ Hazard to encode in comments + ledger:** the platform cookie domain must match the apex the
  apps are actually served from. Setting `COOKIE_DOMAIN=.letbuyy.com` while apps still serve on
  `*.letbuyy.store` breaks every login. So the env flip happens **only** in the same release as
  the DNS/Vercel move.
- **SKIPPED — NEEDS HUMAN:** set the real `.com` env values in Vercel/CI at cutover. Proof path:
  set platform project env → redeploy → verify SSO on `.com`.
- **Enforce:** `tests/contracts/env-domain-contract.test.ts` (templates carry the keys; storefront
  template leaves `COOKIE_DOMAIN` unset; no `.com` literal appears in `apps/**/src` or `services/**/src`).

### DS-3 — Cookie realm correctness (code only)
- **Goal:** prove and lock the two-realm invariant the repo already mostly satisfies.
- **Do:** keep `apps/identity-platform/src/lib/auth/cookies.ts` env-driven (already done); ensure
  `apps/merchant-control-plane/src/app/api/auth/logout/route.ts` reads `COOKIE_DOMAIN` (env) the
  same way; confirm `apps/storefront-runtime/src/lib/session.ts` sets **no** `domain`. Storefront
  gate/customer cookies must use the `__Host-` prefix where path/secure allow.
- **Enforce (critical):** add `scripts/validators/cookie-realm-validator.mjs` + wire in, and
  `tests/contracts/cookie-realm.test.ts` asserting: (a) storefront-runtime cookie writes never set
  a `domain`; (b) no source sets `Domain=.letbuyy.store` or `.letbuyy.com` on a storefront cookie;
  (c) platform cookie domain comes only from `process.env.COOKIE_DOMAIN`.

### DS-4 — Host parser + reserved-label single source (code only)
- **Goal:** one host→subdomain parser driven by `NEXT_PUBLIC_STORE_ROOT_DOMAIN`; reserved labels
  cannot be claimed.
- **Do:** add a shared helper (e.g. in `@letbuyy/tenant-core` or storefront `lib`) that strips the
  store root, returns the tenant label or `null`, and rejects reserved labels
  (`www, api, admin, accounts, apps, themes, developer, console, team, webhooks, assets, cdn,
  static, mail, dcv, connect`). Ensure `services/api-gateway` `/auth/custom/subdomains/validate`
  and `create-store` use the same reserved list (single source — export it).
- **Enforce:** `scripts/validators/reserved-subdomain-single-source-validator.mjs` + wire in;
  `tests/contracts/reserved-subdomain.test.ts`.

### DS-5 — Custom-domain + access data model (code only; migrate is HUMAN)
- **Goal:** schema for custom domains + store access, owned by `sites`.
- **Do:** add the next-numbered migration in `database/supabase/migrations/` (after the current
  highest, e.g. `085_custom_domains_and_store_access.sql`). On **`sites`** add:
  `custom_domain text unique`, `custom_domain_status text` (`none|pending|verifying|active|error`),
  `custom_domain_verification_token text`, `access_mode text not null default 'public'`
  (`public|password|preview_only|offline`), `access_password_hash text`, `access_message text`,
  `published boolean not null default false`. New tables: `site_preview_links`
  (`id, site_id, jti unique, scope, theme_id, created_by, expires_at, revoked_at, last_used_at,
  hit_count`) and `site_gate_attempts` (`site_id, ip, host, ts, ok`) for rate-limit/audit. Update
  `000_baseline.sql` references/types and any `packages/*` types (`tenant-core`, `shared-types`) and
  the single-writer owned-table list to include the new tables.
- **SKIPPED — NEEDS HUMAN:** running the migration against staging/production DB. Proof path:
  `gh workflow run` the migration workflow / `supabase db push` with the protected connection string.
- **Enforce:** extend `migration-safety-validator.mjs` expectations; add
  `tests/migrations/custom-domains-store-access.test.mjs` (forward migration shape + idempotency).

### DS-6 — api-gateway custom-domain + access endpoints (code only)
- **Goal:** the single writer for domains/access, plus host→site resolution and password verify.
- **Do (in `services/api-gateway`):**
  - `POST /v1/custom/domains` — accept a domain for the caller’s site, normalize (lowercase,
    punycode, strip scheme), reject infra/reserved/PSL/own-zone, issue a random
    `custom_domain_verification_token` (TXT), set status `pending`. Snapshot existing MX/NS via
    DNS-over-HTTPS for the apex-MX warning.
  - `POST /v1/custom/domains/verify` — check `_letbuyy-challenge.<domain>` TXT from ≥2 resolvers;
    on success map host→`site_id`, set status `verifying`→`active` once the CNAME →
    `cname.vercel-dns.com` resolves; never serve before TXT passes; guard against dangling-CNAME
    reuse (a host already mapped to another site cannot be re-claimed without fresh TXT).
  - `DELETE /v1/custom/domains/:domain` — release mapping, clear columns (offboarding GC).
  - Extend `services/api-gateway/src/middleware/store-context.ts` host→site resolver to match
    `custom_domain` and to return `access_mode`/`published` for the storefront gate.
  - Store-password: `POST /v1/internal/store-access/verify` does **Argon2id** constant-time verify
    (hash stored by a merchant-facing `PUT /v1/store-access` that sets `access_mode`+hash). Rate-limit
    via `site_gate_attempts`.
  - Preview links: `POST /v1/store-access/preview-links` (merchant) mints a signed token
    (`PREVIEW_SIGNING_KEY`, env, fail-loud) `{ sid, scope, theme_id?, exp, jti, host }`;
    `DELETE` revokes (jti). Token verify helper shared with the storefront via `@letbuyy/auth-core`.
- **Enforce:** unit/contract tests for each endpoint (`services/api-gateway/src/__tests__/…` +
  `tests/contracts/custom-domains.test.ts`), including takeover-prevention and TXT-before-active.
  Extend `single-writer-ownership-validator.mjs` owned tables.

### DS-7 — storefront middleware + access gate (code only)
- **Goal:** the storefront resolves tenant by host and enforces access before render — in Next.js
  middleware on Vercel (no Worker).
- **Do (in `apps/storefront-runtime`):**
  - Add `src/middleware.ts`: canonical host resolve via the DS-4 parser
    (`NEXT_PUBLIC_STORE_ROOT_DOMAIN`), reserved-label reject, custom-domain → `site` via a
    gateway lookup (cached), then the **access gate**:
    `public` → continue; `password` → require a valid host-only gate cookie else render the
    existing `coming-soon` password page (HTTP 401, `X-Robots-Tag: noindex`); `preview_only` →
    require a valid `?lb_preview=` token (verify via shared helper) or render the `preview`
    “not available yet” holding page; `offline` → holding page. Unknown host → 404 (no fallthrough).
  - Gate cookie: host-only, `__Host-` prefix, signed, short TTL; set after a password POST that the
    gateway verifies (storefront never reads the hash).
  - Preview: works on `*.letbuyy.store` even before custom-domain DNS; **force test-mode checkout**
    in preview; never allow real orders on an unpublished store.
  - Reuse existing `src/app/preview/*` and `src/components/coming-soon/*`; do not duplicate.
- **Enforce:** `tests/contracts/storefront-access-gate.test.ts` (each access_mode path; reserved/
  unknown host; noindex while gated; preview test-mode). Add `scripts/validators/
  storefront-access-gate-validator.mjs` (middleware exists, no DB writes from storefront, uses the
  shared parser + shared preview-token verifier).

### DS-8 — merchant admin UI (code only)
- **Goal:** merchant sets domain + access in `admin`.
- **Do (in `apps/merchant-control-plane/src/app/[store]/settings/domains/page.tsx` + a new
  store-access panel):** show the TXT + CNAME records with copy buttons and a live status card
  (Ownership → DNS → SSL → Live) driven by the gateway; a Store-access panel (Public / Password /
  Preview-only, password field + message, create/revoke preview links). Use existing UI primitives
  and the shared INR/date/formatting helpers (do not add app-local formatters — validators forbid it).
- **Enforce:** `tests/contracts/merchant-domains-settings.test.ts` (renders states; calls gateway
  endpoints; no direct DB access).

### DS-9 — mobile parity (code only)
- **Goal:** the merchant mobile app mirrors the same states from the same API.
- **Do (in `apps/mobile/merchant-app/lib/services/custom_domains.dart` +
  `…/domain_settings_screen.dart`):** consume the DS-6 endpoints; show verification records,
  status, and the access/preview controls. No new topology.
- **Enforce:** `flutter analyze apps/mobile/merchant-app` clean; a Dart test for the service client.

### DS-10 — SEO / robots transitions (code only)
- **Goal:** correct indexing across gated/preview/published.
- **Do:** storefront `robots.ts`/metadata: `noindex` while `access_mode != public` or unpublished;
  on publish, allow index, set canonical to the custom domain when active, 301 the `.store`
  subdomain to the custom domain. Keep `robots.ts` authoritative; preview hosts never index.
- **Enforce:** `tests/contracts/storefront-seo-access.test.ts`.

### DS-11 — Governance finalize
- Regenerate intelligence: `node scripts/generate-repository-intelligence.mjs` (refresh
  `domains/ subdomains/ routing/` READMEs + AGENTS where generated).
- Ensure every new validator is wired into `scripts/validate-governance.mjs`.
- Clean generated artifacts; run the **full gate** (the DS-0 command block) to green.
- Update `CODEX_DOMAIN_SPLIT_LEDGER.md` (final progress entry with full evidence) and
  `CODEX_DOMAIN_SPLIT_STATUS.md` (final gate count + the SKIPPED punch-list).

---

## 5. Consolidated `SKIPPED — NEEDS HUMAN` (record in STATUS; do NOT block on these)

1. Add `letbuyy.com` to Cloudflare + move registrar nameservers; supply `cloudflare_zone_id_com`;
   `terraform apply infrastructure/dns/letbuyy_com.tf`.
2. Attach `*.letbuyy.com` production hosts to their Vercel projects (`config/vercel/projects.json`);
   confirm certs.
3. Cutover env flip: set platform `.com` env values (`COOKIE_DOMAIN=.letbuyy.com`,
   `NEXT_PUBLIC_*_URL=…letbuyy.com`) in Vercel/CI **in the same release** the apps move to `.com`;
   storefront `COOKIE_DOMAIN` stays unset.
4. 301 old control-plane hosts + apex (`letbuyy.store` → `letbuyy.com`); move Worker routes
   (`api`/`webhooks`) to `.com` in `wrangler.toml` + `config/runtime/cloudflare-topology.json`
   (validator-checked — change deliberately and re-run the gate).
5. Run the DS-5 migration against staging/production DB (protected connection string).
6. Per-merchant custom-domain TLS issuance is automatic via Vercel once the host is attached; if a
   merchant brings a domain, attaching it to the storefront Vercel project is the only manual step
   (or automate later via Vercel Domains API — a separate mission).

For each, write the **exact future proof command** in STATUS, matching the existing CODEX status style.

---

## 6. Definition of done

- All DS phases implemented in code; each shipped with a validator + contract test wired into the gate.
- `pnpm run validate:governance` ends green at **≥ baseline count** (new validators raise it).
- `pnpm turbo typecheck`, `pnpm lint`, `pnpm turbo test`, `pnpm run test:contracts`,
  `pnpm run test:behavioral`, and `flutter analyze` all pass (sandbox infra flakes excepted + recorded).
- No hardcoded `.com`; no storefront DB writes; `sites` naming preserved; no deprecated aliases;
  storefront cookies host-only; live `COOKIE_DOMAIN` default still `.letbuyy.store`.
- Ledger + status complete, with the SKIPPED punch-list and exact future proof paths.
- One PR on `stream/domain-split-foundation` summarizing DONE vs SKIPPED — NEEDS HUMAN.

---

## 7. Decision defaults (override only if instructed; mirror ledger “DEFAULT … is [SKIP]” style)

- **Shopper login domain:** DEFAULT first-party per storefront host (cookie host-only). A shared
  `accounts.letbuyy.store` OIDC customer-accounts domain is **deferred** (separate mission).
- **Store password verify:** DEFAULT Argon2id in `api-gateway` on submit; edge/middleware checks the
  signed gate cookie thereafter.
- **Preview link default expiry:** DEFAULT merchant-preview 30 min, share-link 7 days, revocable.
- **Custom-domain TLS:** DEFAULT Vercel-managed via host attachment (Phase-1). Cloudflare-for-SaaS
  gateway is **deferred** Phase-2.
