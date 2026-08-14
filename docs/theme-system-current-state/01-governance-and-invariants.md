# 01 — Governance & Invariants Binding the Theme System

> **Read this before touching any theme code.** It is a *navigation and binding* document: it
> states which law applies to theme work, cites where that law lives, and translates each rule
> into a concrete "you may / you may not" for the theme system.
>
> **This document is not law.** It is subordinate to, and cites, the real authorities. Where this
> summary and the source disagree, **the source wins** (`AUTH-R1`, `PRIME-R1`).

---

## 1. The authority chain, as it actually resolves in this repository

| # | Document | Exists? | Path | Role for theme work |
|---|---|---|---|---|
| 1 | **`LETBUYY_CONSTITUTION.md`** | ✅ 471 lines | `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` | **Supreme.** ART-17/18 decide the renderer; ART-14/15 decide checkout; ART-08/09 decide tenancy. |
| 2 | **root `AGENTS.md`** (`LETBUYY_AGENTS_V2`) | ✅ 405 lines | `AGENTS.md` | Operating rules. `§11 THEME` (THEME-R1…R6) is the theme rulebook. |
| 3 | `LETBUYY_CANONICAL_SYSTEMS.md` (DOC 03) | ⚠️ referenced | `GOVERNANCE_REWRITE_2026_06_10/` | Winner registry. `AGENTS.md` Appendix B states that until it physically exists, the `STRATEGIC_CANONICALIZATION_2026_06_10/` winner matrix + ADR set serves as DOC 03. |
| 4 | Legacy-elimination plan + foundation roadmap | ✅ | `GOVERNANCE_REWRITE_2026_06_10/` | Convergence sequencing. |
| 5 | UI/UX governance + `docs/governance/*` | ✅ | — | Domain governance (`--lb-*` tokens, ratchet). |
| 6 | Evidence base | ✅ | `STRATEGIC_CANONICALIZATION_2026_06_10/`, `FORENSIC_MASTER_*` | **The "why", not authority.** |
| — | `CLAUDE.md` | ✅ | repo root | AI operating context. Ranks the Constitution first; adds the LCIS query protocol. |
| — | `packages/theme-engine/AGENTS.md` | ✅ 26 lines | — | Local boundary: no imports from `apps/*`, `services/*`, `legacy/*`, repo-level `infrastructure/*`. |

**Consequence for this engagement.** Every theme decision is checked against (1) then (2). Nothing
in `docs/theme-discovery/`, `V1_SCOPE_LOCK_2026_06_12/`, `FINAL_TRUTH_AUDIT_2026_06_11/`, or
`STRATEGIC_CANONICALIZATION_2026_06_10/` is authority (`AUTH-R2`, `DOC-R2`) — those are leads to
verify against source and the database.

---

## 2. The theme decision that governs everything else — ART-17

> **ART-17 — Theme is Liquid-first (the ecosystem winner over the more-complete React renderer).**
> *`LETBUYY_CONSTITUTION.md:253-257`*

Decoded into operative terms:

| ART-17 clause | What it permits | What it forbids |
|---|---|---|
| "Liquid / portable-theme (OS-2.0-shaped) is the **canonical renderer**" | Completing `letbuyy-core` as Liquid/JSON is the *encouraged* work (`WIN-R6`, `AGENT-R2`) | Crowning React as canonical |
| "React is kept as a **first-party compatibility fast-path**, frozen at parity" | React keeps serving; it is the fallback | Adding **new** React-per-section capability (`THEME-R2`; enforced by `no-new-react-sections-validator`, **PASSING** at baseline) |
| "deleted-or-frozen **by data** at the hardening wave" | Leaving React in place | Deleting React now "for completeness" |
| "`theme-engine` is canonical for contracts/schema/validation/bundle" | All schema/contract work lands in `packages/theme-engine` | A fourth schema source (`THEME-R3`) |
| "Both editors (web + Flutter) are the differentiator and are **protected**" | Improving the editors | Breaking or bypassing them |
| "The Liquid default-flip is **per-theme + canary**, gated on a sanitizer + section ports + a parity/security/perf harness" | Per-theme `rendererEngine: 'liquid'` opt-in | **Flipping the platform-wide Liquid default ON** without the gate — this is a Class-A constitutional act requiring ARB (`§11.2`, `THEME-R6`) |

**Machine-checked current state.** `scripts/validators/theme-governance-validator.mjs` passes and
reports verbatim:

```
Theme governance validator passed (25 built-in section schemas, WARN mode, Liquid default OFF,
fallback placeholder, schema migration runner).
```

That line is the authoritative statement that **the Liquid default is OFF**. It stays off in this
engagement.

---

## 3. The six theme rules (`AGENTS.md §11`) — verbatim obligations

| Rule | Obligation | Enforcement at baseline |
|---|---|---|
| **THEME-R1** | Liquid is canonical; React is a **frozen** first-party fast-path, not deleted now | `no-new-react-sections-validator` ✅ PASS |
| **THEME-R2** | MUST NOT add new sections to the React renderer; port sections to Liquid instead | `no-new-react-sections-validator` ✅ PASS |
| **THEME-R3** | **One** schema source (engine `BUILT_IN_SECTION_SCHEMAS`), **one** draft system (`theme_editor_drafts`), **one** compose path (`composeStorefrontTheme`). Storefront `RUNTIME_SECTION_SCHEMAS` and DB manifests are LEGACY; the storefront `template-resolver` re-impl is LEGACY | see `05-rendering-pipeline.md` for the measured state |
| **THEME-R4** | Branding/theme settings are **DATA, never executable code**. Data-only sandbox (`ownPropertyOnly`, drop scrub, upload-time `{% render %}` forbidding). Output through DOMPurify/allowlist, **not a regex** | see `13-security-and-tenant-isolation.md` |
| **THEME-R5** | `theme-engine` is canonical for contracts/schema/validation/bundle. MUST NOT label deterministic stubs as "AI" | `packages/theme-engine/src/ai-*.ts` exist — naming reviewed in `09-settings-schema-and-editor.md` |
| **THEME-R6** | The per-theme `renderer.engine` switch **is** the rollback. MUST NOT flip the Liquid default cohort-wide without Security (HARD) + ~20 section ports + parity harness green | Liquid default OFF ✅ |

---

## 4. Hard invariants this engagement must not break

These are the lines that convert "safe implementation" into "escalate to ARB". Each is quoted to
its source.

### 4.1 Tenancy — `ART-08`, `ART-09`, `R-1`…`R-4`

- Every tenant table: RLS `ENABLE` **+ `FORCE`** + per-transaction tenant GUC; **unset/wrong GUC ⇒ zero rows** (`R-1`).
- **No** tenant query under a `BYPASSRLS`/blanket `service_role` connection (`R-2`).
- **No** `USING(true)` policy to PUBLIC/anon/authenticated; no anon write to tenant or ownership columns (`R-3`).
- The tenant GUC comes only from a **validated** claim, never a raw request param (`R-4`, `IDN-R5`).

**Theme translation.** No theme read path may fall back to "any theme" or "the first theme" when a
site has none — that is the shape of the historical *Urban Kicks leak*. Two-site proof is mandatory.

**Baseline:** `no-public-using-true-validator` ✅, `rls-force-coverage-validator` ✅,
`no-blanket-service-role-validator` ✅. `tenant-isolation-validator` ❌ (**pre-existing**, registry drift — see `14-…-baseline.md §3.1 #1`).

### 4.2 Identity — `ART-05`, `R-14`, `IDN-R4`, `ARCH-R18`

- `identity-platform` is the **sole asymmetric issuer** (ES256, verified via `LETBUYY_IDENTITY_PUBLIC_JWKS`); every other runtime is **verify-only**.
- Customer/shopper sessions are the separate HS256 realm minted by `issueCustomerSession` (`CUSTOMER_SESSION_SECRET`).
- **Storefront/buyer auth MUST NOT grant merchant/admin privileges** (`ARCH-R18`, `IDN-R4`).

**Theme translation.** The Liquid theme renders auth *screens*; it never mints, refreshes, or
verifies a token. Turnstile + rate limiting stay on register/login. No-JS form paths are preserved.

**Baseline:** `identity-sole-issuer-validator` ✅.

### 4.3 Money — `ART-10`…`ART-14`, `PAY-R1`…`R-10`

- Money mutations only through canonical `SECURITY DEFINER` RPCs via `db.rpc`; **never** `.insert()`/`.update()` on a money table.
- Server-authoritative totals/tax/shipping/GST; `bigint` paise; idempotency keys; `ON CONFLICT`; `FOR UPDATE`.
- Razorpay signature verified **server-side**; step-up is real cryptography.
- `commission_bps = 0`, permanent.

**Theme translation — the boundary.** The theme **may** link to, initiate, and visually integrate
with checkout. The theme **may not** compute a total, a tax, a shipping amount, a discount, or a
payment state, and **may not** contain Razorpay or COD business logic. `R-12` additionally forbids
third-party/extension/Wasm code executing in the live checkout or storefront path.

**Baseline:** `canonical-ledger-only-validator` ✅, `stepup-crypto-validator` ✅, `commission-bps-zero-validator` ✅.

### 4.4 Sanitizer — `THEME-R4`, `SEC-R11`, `R-12`

- Output renders through an **allowlist/DOMPurify** sanitizer, *not a regex*.
- The data-only sandbox (`ownPropertyOnly`, drop scrub, upload-time `{% render %}` forbidding) is
  the security-load-bearing render contract.

**Theme translation.** `FORBID` lists and `outputEscape:'escape'` are **locked**. Loosening any of
them is an ARB gate, not an implementation choice.

### 4.5 Architecture / single-source — `R-15`, `WIN-R4`, `ANTI-R1`

> **R-15 (MUST).** There MUST be exactly one canonical system per domain (one ledger, one
> renderer-canonical, one auth issuer, one storefront runtime, one token source, one app shell,
> one ops console).

**Theme translation.** If discovery finds two (or three) representations of one theme fact — e.g.
several competing "which theme is active" stores — that is an `ANTI-R1` defect to **report and
collapse to the named winner**, never to "bridge indefinitely" (`WIN-R5`).

### 4.6 Route ownership & the proxy rule

- App API routes are **thin same-origin proxies** to the canonical Hono `/v1` gateway; Next.js apps
  **never** write the database directly (`CLAUDE.md`; `ARCH-R17`).
- Enforced by `scripts/validators/route-ownership-validator.mjs` and
  `scripts/validators/domain-boundary-validator.mjs`.

**Baseline:** both ❌ **pre-existing** — `custom-domains.ts:GET:/domains:483` (out of theme scope) and
`services/api-gateway/src/schemas/theme.schema.ts` (**in** theme scope).

### 4.7 Design system — `UI-R1`, `UI-R7`, `ART-20`

- One token source: `packages/typescript/ui/src/tokens.ts` → `--lb-*`.
- The ratchet **blocks** new drift; MUST NOT add naked `rgb()/hsl()`, raw px, or arbitrary radius
  where a `--lb-*` token exists.
- WCAG AA floor; **no migration may regress accessibility** (`UI-R4`, `R-23`).

**Baseline:** `validate-design-system` ❌ **pre-existing** (1 HARD violation; ratchet at 98 raw hex,
849 naked `rgb()/hsl()`, 604 raw-px font sizes, 1 568 raw-px spacing, 387 arbitrary radii). Because
the ratchet is a *non-regression* gate, this engagement must not raise those numbers.

---

## 5. What requires ARB / human authorization (the stop line)

Derived from `Constitution §11.2` and `AGENTS.md AGENT-R15`. Work stops and asks before any of:

1. Modifying payment, OAuth, RLS, step-up, or issuer behaviour.
2. Altering a canonical money RPC (`create_checkout_order`, `confirm_order_payment_with_ledger`, `complete_order_refund`, `issue_gift_card`, `set_gift_card_status`, `restore_gift_card_on_refund`).
3. Loosening a sanitizer rule (`FORBID` list, `outputEscape`).
4. **Flipping the Liquid default globally** (`THEME-R6`, ART-17).
5. Changing a public API contract or the frozen `theme-registry.ts` contract.
6. Requiring a production data migration.
7. Deleting business logic, or deleting any load-bearing system before its gate is green (`DEL-R1`).
8. Modifying production secrets.
9. Deploying, pushing, merging, or initiating a live payment.
10. Introducing a second canonical system for any domain (`R-15`).
11. Resolving an `UNVERIFIED` item by upgrading it to "fact" without verification (`§14.4`).

Everything else in this engagement is **Class C — Implementation** (`Constitution §11.1`): routine
engineering inside an already-canonical system, decidable without escalation provided it conforms to
every Article, builds nothing on the Never-Build List, does not design past the 10 k envelope, and
passes the validator suite.

---

## 6. Scale envelope — the sizing constraint on every theme decision

> **India-only. Design for 100 → 1 000 → 10 000 merchants. NEVER optimize for 100 000+.**
> *`LETBUYY_CONSTITUTION.md:108`*

**Theme translation.** No theme-side sharding, no multi-region asset strategy, no third-party
app-block runtime, no Wasm section execution, no headless tier. `ENV-R3`: *if a capability imitates
Shopify's end-state and no beta merchant would notice its absence, it is forbidden until a named
trigger fires.*

This directly bounds Phase 3: **complete the presets the repository already declares**; do not
invent new industries (`PRIME-R3` — *deletion and completion over new construction*).

---

## 7. Frozen surfaces adjacent to the theme system

`ART-22` and `CLAUDE.md` freeze these; they are **reference material, not deploy targets**:

- `apps/app-marketplace`
- `apps/developer-portal`
- `apps/theme-marketplace`
- `apps/platform-operations-portal`

`AGENT-R13`: *"When the architecture is frozen at a seam, MUST leave the seam empty and MUST NOT
fill it."* Theme-marketplace contracts in `packages/theme-engine/src/theme-marketplace-contract.ts`
are a **seam**: the interface is preserved, nothing is implemented behind it.

Deprecated aliases that must never be recreated as active topology (`ARCH-R10`): `apps/admin`,
`apps/auth`, `apps/checkout`, `apps/internal`, `apps/merchant`, `apps/storefront`, `apps/analytics`,
`apps/mobile/operator-team-app`, `apps/storefront-runtime/consumer-storefront`.

---

## 8. The required validation posture after theme changes

Per `DOC-R5` and `CLAUDE.md`:

1. Governance validation after topology / import / package / environment / generated-artifact / governance-memory changes.
2. **Real** `pnpm --filter <app> build` for every affected app — the validator gate does **not** cover `next build`.
3. `TEST-R2` rigor escalation: **Theme is one of the five FULL 9-class domains** (Money, Tenancy, Auth, Checkout, Theme-Liquid) — Unit · Integration · Contract · E2E · Security · Performance · Regression · Rollback-Validation · Deletion-Validation.
4. `TEST-R6`: *"Theme MUST have sandbox-escape + render-parity as a **HARD** gate… Liquid MUST NOT reach a real buyer until this is green."*

> ⚠️ **Operational warning, proven in `14-…-baseline.md §2`.** `node scripts/validate-governance.mjs`
> **deletes** every `node_modules`, `.next`, `dist`, `.turbo`, `build`, `coverage`, `.cache`,
> `.wrangler`, `.vercel` directory under `apps/`, `packages/`, `services/`
> (`scripts/validate-governance.mjs:169-192`, gate-lane member at line 86). Run the 107 validators
> individually instead, excluding `stale-artifact-validator.mjs`, unless a full `pnpm install`
> afterwards is acceptable.

---

## 9. Change-control hotspots requiring LCIS blast-radius before edit

`CLAUDE.md` names four highest-blast-radius symbols. Any PR touching them runs
`pnpm graph:intel blast "<symbol>"` first:

| Symbol | Blast radius | Relevance to theme work |
|---|---|---|
| `getSupabaseAdmin` | 115 files | **Direct** — used by every gateway theme route (`services/api-gateway/src/routes/themes.ts`) |
| `@letbuyy/shared-types` | cross-runtime | **Direct** — theme DTOs (`CODE-R1`) |
| `@letbuyy/api-client` | cross-runtime | **Direct** — merchant/storefront theme calls |
| `create_checkout_order` | money kernel | **Indirect** — the checkout boundary only; not edited here |

If LCIS (`:3333` / `:3334`) is unavailable, that limitation is recorded and a conservative
code-level dependency analysis is performed instead (see `18-source-index.md`).
