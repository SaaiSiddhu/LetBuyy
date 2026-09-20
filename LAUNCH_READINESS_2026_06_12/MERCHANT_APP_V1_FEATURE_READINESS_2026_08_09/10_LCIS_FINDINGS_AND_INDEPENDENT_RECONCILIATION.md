# 10 — LCIS FINDINGS AND INDEPENDENT RECONCILIATION

**Package:** `MERCHANT_APP_V1_FEATURE_READINESS_2026_08_09` · **Date:** 2026-08-09
**Audited commit:** `bf35062e` (`stepup/main`)
**Authority:** Evidence package. Subordinate to DOC 01 (Constitution), root `AGENTS.md`, DOC 03.

**LCIS is a source-derived intelligence aid. It is not authority and it is not runtime proof**
(DOC-R1, DOC-R2, ANTI-R8). Nothing in this package is accepted because LCIS said it. Every LCIS
claim below carries an independent verdict established by reading source at `bf35062e` or by
executing a command.

---

## 1. LCIS runs performed

`pnpm lcis --help` was read first, then each subcommand's own help. Outputs are retained under
`/tmp/letbuyy-v1-run-2026-08-09/lcis/`.

Executed (all exit 0): `health` · `readiness` · `decision readiness` · `decision launch` ·
`decision risks` · `governance` · `drift` · `domain-health` · `architecture-health` ·
`security-drift` · `live health` · `live status` · `live adapters` · `db health` · `db tables` ·
`db policies` · `db migrations` · `db drift`; plus `engineering`, `agent-plan`, `rollout`,
`rollback`, `compliance`, `ownership`, `verify architecture`, `verify production` by the LCIS
reconciliation auditor.

## 2. The four structural problems with LCIS at this commit

### 2.1 The code graph is stale, and the engine does not know it

```
pnpm lcis health
  nodeCount 52246 · edgeCount 66761 · status "healthy"
  graphCommit 0f257ca1992d4473634c3893f87f633c48eff470

git rev-parse HEAD
  bf35062eda22f4d881efd61fb1d36c8fc83baed1
```

The graph was built at a **different commit** — 77 commits and ~2,549 files behind HEAD — and the
engine reports `status: "healthy"` regardless. There is **no staleness detection**. Every structural
answer LCIS gives is silently from an earlier repository.

**Verdict: CONFIRMED.** This alone disqualifies LCIS as evidence for any "is it there now" question.

### 2.2 LCIS's headline governance claim is false

LCIS reports the governance gate as green (its "107/107 validators, hardViolations 0" line).

```
LOCAL RUNTIME  pnpm validate:governance  ->  exit 1
  ✖ Design-system governance FAILED: 2 HARD violations + 9 ratchet regressions
```

Worse, the runner is **fail-fast** (`scripts/validate-governance.mjs:201-203`) and aborts at
validator **index 5 of 108**, so **102 validators never execute**. LCIS's "all green" is not merely
stale — it is unobtainable at HEAD.

**Verdict: CONTRADICTED.**

### 2.3 `decision launch` contradicts itself and is derived from generated documents

```json
{ "verdict": "NO-GO", "openBlockers": 6, "overallReadiness": 98,
  "certificationDocs": [
    {"doc":"docs/final-v1-certification/FINAL_V1_CERTIFICATION.md","verdict":"certified"},
    {"doc":"docs/implementation/FINAL_V1_CERTIFICATION.md","verdict":"blocked"},
    {"doc":"V1_SCOPE_LOCK_2026_06_12/LETBUYY_V1_BLOCKER_REPORT.md","verdict":"NO-GO"},
    {"doc":"docs/central-intelligence/LCIS_V3_CERTIFICATION.md","verdict":"CERTIFIED"} ] }
```

`overallReadiness: 98` beside `verdict: "NO-GO"` is incoherent, and the inputs are **markdown
certification documents**, one of which is LCIS's own certification of itself. This is
generated-doc-as-evidence, the precise failure mode DOC-R2 and ANTI-R8 exist to prevent.

`decision risks` ranks LB-8 ("Announcement bar") and LB-9 ("Appearance bridge") as the top two
risks, with evidence timestamps of `2026-06-14T05:53:49Z` — **roughly two months stale**. The
forensic auditors found both capabilities now largely implemented.

**Verdict: CONTRADICTED / STALE.**

### 2.4 `--format markdown` is unusable for nested payloads

Every nested object renders as `[object Object]`:

```
| scores | overall | summary | ...
| [object Object], [object Object], [object Object], ... | 60 | ...
```

`--format json` works correctly. All useful LCIS extraction in this program used JSON.
**Verdict: CONFIRMED (tooling defect, low severity).**

## 3. Where LCIS is genuinely good

Credit where due — the **live-data honesty contract holds**. `pnpm lcis live adapters` returns, for
each provider, the exact environment variables it needs and reports **NOT CONNECTED** rather than
fabricating a value:

| Adapter | Required env (names only) |
|---|---|
| supabase | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| github | `GITHUB_TOKEN`, `GITHUB_REPOSITORY` |
| cloudflare | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` |
| vercel | (project/token pair) |

No provider credential is present in the repository, so **every live adapter is NOT CONNECTED**, and
this package records it as such. **NOT CONNECTED is not a pass** — it means unknown.

## 4. Claim-by-claim reconciliation

| # | LCIS claim | Verdict | Independent evidence |
|---|---|---|---|
| 1 | Governance gate 107/107 green, hardViolations 0 | **CONTRADICTED** | `pnpm validate:governance` exit 1; aborts at index 5/108 |
| 2 | `overallReadiness: 98` | **CONTRADICTED** | Derived from generated certification markdown, incl. LCIS's own; contradicts its own NO-GO |
| 3 | Launch verdict NO-GO | **CONFIRMED** (right answer, wrong method) | Independently NO-GO — see doc 15 |
| 4 | LB-8 "Announcement bar — missing" is a top risk | **STALE** | Evidence stamped 2026-06-14; capability now largely present |
| 5 | LB-9 "Appearance bridge — dead island" | **STALE / PARTIAL** | Implemented on both sides; proven only by a single narrow test |
| 6 | LB-12 shopper registration missing | **STALE** | Vertical slice real: UI → storefront route → gateway → session mint, with Turnstile |
| 7 | `rls-force-coverage-validator` is authoritative and GREEN | **CONTRADICTED — the validator is a no-op** | See §5.1 |
| 8 | Money ledger tables are tenant-isolated | **PARTIALLY CONFIRMED** | Writes go through a SECURITY DEFINER RPC with a GUC check; table-level RLS/policies are a separate question — see §5.2 |
| 9 | Code graph healthy | **CONTRADICTED** | 77 commits stale; no staleness detection |
| 10 | 20 domains untested (R004) | **MISLEADING** | The code graph does not index test files at all, so "untested" is unmeasurable, not measured |
| 11 | R001 critical money-RPC violations | **PARTIALLY REFUTED** | Misclassifies trigger functions and read-only helpers as money RPCs |
| 12 | App-marketplace / developer surface mounted and ungated in the canonical gateway | **CONFIRMED — independently, and worse than stated** | See §5.3 |
| 13 | `validate:governance` is destructive | **CONFIRMED, but it did not fire here** | See §5.4 |
| 14 | The executable Postgres tenant red-team is the repo's only real RLS proof | **CONFIRMED** | RT-1…RT-9 pass on real Postgres (doc 09 §7) |
| 15 | That red-team is never executed by any CI workflow | **CONFIRMED** | `ci.yml` does not invoke `tests/executable/**`; and `ci.yml` does not run on `stepup/main` at all |

## 5. The findings I verified personally, in detail

### 5.1 `rls-force-coverage-validator` is a no-op (LCIS-B1, S0-class)
The claim is that the FORCE-RLS ratchet *can only ever pass* on real repository content — i.e. the
constitutional guarantee R-1 ("every tenant table MUST have RLS ENABLE+FORCE") is machine-unenforced.
This is the most serious governance finding in the whole audit, because it means a green tenancy
gate proves nothing. It is under adversarial re-verification (doc 07) and, pending that, is treated
as **CONFIRMED-PENDING** and recorded as a blocker rather than a fact.

Corroborating independent datum: the same auditor reports **326 tables with `ENABLE ROW LEVEL
SECURITY` but no `FORCE`**. Under ART-08/R-1 a non-FORCE table is bypassed by the table owner, so
the "layered, fail-closed" tenancy story is weaker than the Constitution asserts — while the
*behavioural* proof (RT-1…RT-9 on real Postgres, doc 09 §7) genuinely passes for the tables it
covers. Both are true: the tested surface is sound, the untested surface is unmeasured.

### 5.2 Money-ledger tenancy
Writes are funnelled through `SECURITY DEFINER` RPCs that derive tenant from the source row rather
than a caller-supplied parameter (IDN-R5), and append-only enforcement is **behaviourally proven**
on real Postgres (`ERROR: ledger is append-only; use reversing entries` on both UPDATE and DELETE).
The open question is table-level RLS/policy coverage on `ledger_accounts` / `ledger_transactions` /
`ledger_entries`, which the red-team does not cover. Recorded as a blocker, not resolved here.

### 5.3 The forbidden marketplace surface — independently confirmed, and larger than LCIS said
This is the most consequential constitutional finding of the program, and I verified every link:

- `services/api-gateway/src/index.ts:727` — `api.route('/app-store', appStoreRouter)`. The
  marketplace is **mounted in the canonical monolith**.
- `services/api-gateway/src/routes/app-store/` contains `extension-routes.ts`,
  `developer-routes.ts`, `developer-tooling-routes.ts`, `billing-oauth-routes.ts` — i.e. checkout
  extensions **and** the developer platform, both frozen by ART-22 / ART-16 / NEVER-R3.
- Production **does** disable the flags: `services/api-gateway/wrangler.toml:246-249`
  `FEATURE_GRAPHQL="false"`, `FEATURE_EXTENSIONS="false"`, `FEATURE_LIQUID="false"`.
  But `[vars]` (default, lines 39-41) and `[env.staging.vars]` (lines 130-132) set all three to
  `"true"` — so a deploy without an explicit `--env production` ships extensions **on**.
- **The flag does not cover the App Bridge.** `extensionsFeatureGate` is applied at
  `index.ts:714-716` to `/storefront/:subdomain/checkout/extensions` and
  `/app-store/installations/:id/extensions[/:registrationId]` only. It is **not** applied to
  `POST /app-store/installations/:id/embed-session` (`extension-routes.ts:298`, guarded only by
  `authMiddleware`) or `POST /app-store/bridge/fetch` (`extension-routes.ts:403`, rate-limited only
  at `index.ts:720`). **Both remain reachable in production with `FEATURE_EXTENSIONS="false"`.**
- On the client, `apps/mobile/merchant-app/lib/screens/apps/app_bridge_runtime_screen.dart` runs a
  `WebViewController` that loads a third-party `app.appUrl`, calls `_injectBridge()` and
  `runJavaScript(...)`, and routes messages into
  `_handleBridgeFetch` → `AppMarketplaceService.fetchEmbeddedBridgeData(session, path)` — where
  `path` comes from the embedded page's own JavaScript. That is remote third-party code driving a
  merchant-session-scoped data proxy.
- The `CapabilityGate` on that screen (`:100`) renders only an **error state**; it does not gate the
  WebView.
- `AppsScreen` is reachable by **three** registered routes (see doc 05 §route aliasing).

**Verdict: CONFIRMED, and the flag-based mitigation is incomplete.** ART-16, NEVER-R3 and R-12
forbid third-party code execution in a live path; this is both a constitutional violation and an
S1 security exposure.

### 5.4 `validate:governance` deletes generated directories
`scripts/validate-governance.mjs:170-188` recursively `rmSync`s any directory named `.dart_tool`,
`build`, `coverage`, `.cache`, `.wrangler`, `.vercel`, `.symlinks`, `Pods` beneath `apps`,
`packages`, `services`, immediately before `stale-artifact-validator.mjs`.

**It did not fire during this program.** `stale-artifact-validator.mjs` is at **index 70** in the
validator list while `validate-design-system.mjs` is at **index 5**, and the runner is fail-fast —
so the gate aborted 65 validators before reaching the cleanup. `git status` reports **0 deleted
tracked files**, confirming no source loss.

It remains a latent hazard: the moment the design-system failure is fixed, a routine gate run will
silently delete every local build cache and iOS `Pods` directory. **Verdict: CONFIRMED (latent).**

## 6. What LCIS should be used for, and what it must not be

| Use | Verdict |
|---|---|
| Breadth discovery — "what exists, roughly where" | Useful, subject to graph staleness |
| Naming the exact env var a live adapter needs | **Genuinely good** — the honesty contract holds |
| Deciding whether a capability is complete | **Do not.** Use source + an executed test |
| Deciding whether the gate is green | **Do not.** Run the gate |
| Launch verdicts / readiness percentages | **Do not.** They are parsed from generated markdown, including LCIS's own certification |

**Refresh required before LCIS is trusted again:** rebuild the graph at HEAD, add staleness
detection that refuses to answer against a stale commit, stop ingesting certification markdown as
evidence, and fix the `[object Object]` markdown renderer.
