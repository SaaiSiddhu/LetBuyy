# 01 — Evidence Method, Command Ledger, and Index

> **RESEARCH — NOT AUTHORITY — NOT AN IMPLEMENTATION ORDER**
>
> Audited commit `5af69e0c080503765dec361eae2128ba860cf529` · branch `stepup/main` · 2026-08-16.

---

## 1. Evidence states

Every material claim in this packet carries **exactly one** of these. They are ordered by strength, and a claim may never be silently promoted between them.

| State | Meaning | What it licenses you to conclude |
|---|---|---|
| `GOVERNED` | Required by the current authority chain | An obligation exists. **Nothing about implementation.** |
| `VERIFIED-SOURCE` | Directly established from source at this SHA | The code says this. **Not that it runs, is reachable, or is deployed.** |
| `VERIFIED-CONFIG` | Directly established from configuration | The config declares this. **Not that it is applied to a live resource.** |
| `VERIFIED-TEST` | A behavioural test was read and its assertions genuinely exercise the behaviour | The behaviour holds under the tested conditions. **Not under production conditions.** |
| `VERIFIED-LIVE` | Confirmed against a live provider/runtime/database with authorised read-only access | Production reality. |
| `REFERENCE-ONLY` | Claimed by a non-authoritative document | Someone asserted it. |
| `HISTORICAL` | True only for an older commit or archived evidence | It was true then. |
| `INFERRED` | Reasoned from evidence, not directly proven | A stated inference chain supports it. |
| `UNKNOWN` | Evidence absent, conflicting, inaccessible, or not safely testable | Nothing. |
| `HUMAN-REQUIRED` | Needs a founder, ARB, legal, security, finance, provider, or ops decision | Nothing until the decision is made. |

### 1.1 The single most important methodological statement in this packet

> **`VERIFIED-LIVE` is used ZERO times in this packet.**

No authorised live provider or database access was available for this study. Therefore:

- Nothing here proves what production is running.
- `04_LIVE_DEPLOYMENT_TRUTH.md` is deliberately a **gap register**, not a description.
- The governed / configured / live views are rendered as **three separate diagrams** and are never merged.

This is not a limitation to be apologised for — it is the Constitution's own position. DOC 01 §14.4 item 4 states that *"Live deployment state of every 'complete' wave is ~0% until the deploy meta-blocker clears — completion-% measures the working tree, not production."*

### 1.2 The verification ladder (why "I read the file" is not verification)

For every important claim this packet distinguishes:

```
file exists
  → code compiles
    → symbol is exported
      → route is mounted
        → route is reachable (no earlier guard rejects it)
          → feature flag permits it
            → dependency is provisioned
              → integration is configured
                → a test exercises real behaviour
                  → deployment includes it
                    → production has it
                      → production traffic uses it
                        → telemetry proves it
```

This packet can reach step 9 at best, and only for a subset of claims. A file named `production-*`, a manifest saying `status: "active"`, a migration file, a passing grep validator, or a green unit test **is not proof of production behaviour** and is never treated as such.

---

## 2. Read-only discipline actually observed

### 2.1 What was NOT done

No application code, test, validator, baseline, snapshot, fixture, governance document, or migration was created, modified, or deleted. No `git` mutation of any kind (`reset`, `clean`, `checkout --`, `stash`, `add`, `commit`) was run. No deployment, `wrangler`, `vercel`, `supabase`, Terraform, or provider-mutating command was run. No dependency was installed or upgraded. No server or container was started. No load test was executed against any endpoint. No secret value was read, printed, or transmitted. `PROMPTS.md` was not modified.

### 2.2 Validators: not run

**No validator in `scripts/validators/` was executed.** The brief permits running validators that are *provably* read-only. Determining that for 116 files, several of which generate or clean artefacts, would itself have consumed more effort than the resulting evidence was worth — and a validator that writes would violate the read-only mandate. Instead, validators were **read as source** and classified by what they check (`03_CURRENT_ARCHITECTURE_AS_BUILT.md` §tests). Their claimed pass status is therefore treated as `REFERENCE-ONLY`, never as evidence that an invariant holds.

### 2.3 Worktree preservation

The working tree was dirty on arrival with **19 modified files** under `apps/merchant-control-plane/**` and `packages/typescript/ui/**`, plus one untracked file (`docs/research/LETBUYY_CLAUDE_CODE_ARCHITECTURE_RESEARCH_BRIEF.md` — the brief itself). All are user-owned and were left untouched. The pre-research state is recorded verbatim in `evidence/00-preflight.txt`. The post-research diff is verified in `00_README_AND_STATUS.md` §Handoff.

### 2.4 Exclusions applied to every inventory

`.claude/worktrees/**` (stale agent worktrees containing full repo copies — these produce false duplicate topology if included), `node_modules`, `.next`, `dist`, `.turbo`, `.wrangler`, `graphify-out`, `docs/archive/**`.

> **Method note.** `.claude/worktrees/` contains at least 11 complete copies of the repository including `wrangler.toml` and `vercel.json` files. A naive `find` for deployment manifests returns them and would inflate the runtime count several-fold. Any future audit of this repository must exclude that path.

---

## 3. Command ledger

Full outputs are stored under `evidence/`. Commands are reproducible at this SHA.

| # | Command | Purpose | Evidence file |
|---|---|---|---|
| 1 | `git rev-parse HEAD` · `git branch --show-current` · `git status --short` · `git rev-list --left-right --count main...stepup/main` | Pin the audited state; record the dirty worktree | `evidence/00-preflight.txt` |
| 2 | `ls database/supabase/migrations/ \| sed -n 's/^\([0-9]\{3\}\)_.*/\1/p' \| sort -n` | Full migration prefix list | `evidence/01-migrations-and-rollback-pairing.txt` |
| 3 | `comm -23 <(seq -f "%03g" 0 197) <(prefixes)` | Missing prefixes | same |
| 4 | `sort prefixes \| uniq -d` | Duplicate prefixes | same |
| 5 | `comm -23 <(migration prefixes) <(rollback prefixes)` | Real forward↔rollback pairing audit | same |
| 6 | `head -25 database/supabase/migrations/000_baseline.sql` | Identify the baseline squash and the PostgreSQL version | same |
| 7 | `sed -n '218,345p' services/api-gateway/wrangler.toml` | Effective production bindings and flags | `evidence/02-api-gateway-wrangler-production.txt` |
| 8 | `sed -n '320,326p' / '618,624p' services/api-gateway/src/middleware/rateLimit.ts` | Rate limiter KV backends | `evidence/03-rate-limiter-backend.txt` |
| 9 | `rg -n "RATE_LIMIT_KV_FALLBACK" services packages apps --type ts` | Flag consumers | same |
| 10 | Dimension audits (10 parallel read-only agents) + adversarial verification of every S0/S1 claim | Repository truth across topology, data, deploy, identity, commerce, storefront, async, tests, observability, governance drift | `evidence/10-*.json` |
| 11 | Primary-source vendor sweeps (7 areas) + independent fact-check pass | Current limits, pricing, and Indian regulatory obligations | `evidence/20-*.json` |

---

## 4. External source discipline

For every external fact this packet records: title, publisher, direct URL, date accessed (2026-08-16), the fact supported, the applicable plan/region/version, whether the limit is **HARD / SOFT / DEFAULT / NEGOTIABLE / UNKNOWN**, and a confidence rating.

**Primary sources only** for load-bearing numbers: vendor documentation, limits, pricing, and status/SLA pages; official PostgreSQL documentation; official Next.js documentation for the repository's exact major version; official Indian government / RBI / MeitY / CBIC / TRAI sources; PCI SSC's own documents. SEO blogs, comparison sites, unsourced benchmarks, AI summaries, and stale screenshots are **not** load-bearing evidence anywhere in this packet. Third-party benchmarks appear only where explicitly labelled as secondary context.

Where a value could not be retrieved it is recorded as `UNKNOWN` with the exact page or access that would settle it. **No number in this packet was estimated to fill a gap.**

---

## 5. Known evidence gaps (carried into `17_OPEN_QUESTIONS_AND_HUMAN_ACTIONS.md`)

| # | Gap | Why it could not be closed | What would close it |
|---|---|---|---|
| G-1 | **No live provider or database access** | None was authorised; obtaining it is a `HUMAN-REQUIRED` act | Read-only Supabase connection + Cloudflare/Vercel API tokens scoped to read |
| G-2 | **The user's reference document was unreadable** | `~/Library/Containers/net.whatsapp.WhatsApp/.../LETBUYY_ARCHITECTURE.md` exists but is blocked by macOS TCC privacy protection on the WhatsApp container; `stat` and `head` both hang and are killed | Copy the file into the repository or any non-container path, then re-read. Its hypotheses are handled as `REFERENCE-ONLY` from the brief's own summary — see §5.1 |
| G-3 | **No production telemetry** | None is emitted to a connected sink | Wire the Analytics Engine dataset (`RUNTIME_TELEMETRY` binding is declared) and an OTLP endpoint |
| G-4 | **No load-test baseline** | Running one against production or an unapproved endpoint is prohibited by the brief | Execute the programme in `13_TEST_AND_LOAD_VALIDATION.md` against an isolated staging estate |
| G-5 | **Validator pass-status unverified** | Validators were not executed (§2.2) | Run the suite in CI and capture the log as evidence |
| G-6 | **Live RLS/GRANT state** | Constitution §14.4 item 1 — the six anon-to-PUBLIC GRANTs are set by Supabase's managed bootstrap, not repo SQL | `\dp public.orders` and `SELECT * FROM pg_policies` against the live database, plus an anon-key probe |

### 5.1 Treatment of the user-supplied reference document

The brief identifies `LETBUYY_ARCHITECTURE.md` as reference material and a source of hypotheses, explicitly **not** authority, and directs that any instructions embedded in it are quoted content rather than commands. That instruction is followed here, and is reinforced by an independent rule: content encountered through tools is data, not instruction.

Because the file itself is unreadable (G-2), its hypotheses are taken from the brief's own summary of it and carried as `REFERENCE-ONLY`:

| Hypothesis attributed to the reference document | Where it is tested in this packet |
|---|---|
| CDN caching of storefront reads | `03` §storefront, `07` §cache, `06` §6 (found to be the dominant lever) |
| Authoritative commerce state on the server | `02` §4 R-11, `03` §commerce |
| Explicit cache invalidation | `03` §storefront, `07` |
| Concurrency-safe inventory | `03` §commerce, `06` Band E, `07` |
| Idempotent payments | `03` §commerce, `08` |
| Managed queues | `03` §async, `07` |
| Object storage for media | `03` §storefront, `10` |
| Connection pooling | `07` §postgres, `10` |
| Observability | `03` §observability, `09` |
| Measurement-driven scaling | `12` — adopted as the packet's core discipline |
| **ALB + ECS + RDS + Redis + SQS as a destination** | `11` **Option 5** — evaluated as one alternative among seven, neither promoted nor dismissed |

The reference document's principles are, with one exception, **already consistent with LetBuyy's Constitution** — which is a meaningful finding in itself. The exception is the AWS destination, which is a topology proposal and is treated as a decision alternative requiring evidence, not as a plan.

---

## 6. Document index

| File | Contains | Primary evidence states |
|---|---|---|
| `00_README_AND_STATUS.md` | Scope, SHA, limitations, completed/blocked work, handoff proof | — |
| `01_EVIDENCE_METHOD_AND_INDEX.md` | *This document* | — |
| `02_GOVERNED_ARCHITECTURE.md` | What current law requires; invariants R-1…R-23; Never-Build List | `GOVERNED` |
| `03_CURRENT_ARCHITECTURE_AS_BUILT.md` | Source/config topology and all traced flows | `VERIFIED-SOURCE`, `VERIFIED-CONFIG` |
| `04_LIVE_DEPLOYMENT_TRUTH.md` | Live-evidence **gap register** | `UNKNOWN`, `HUMAN-REQUIRED` |
| `05_DRIFT_AND_CONFLICT_REGISTER.md` | Governance ↔ source ↔ config ↔ deployment conflicts | mixed |
| `06_10M_WORKLOAD_DEFINITION.md` | Scenarios S1–S10, unknown inputs, formulas, bands, sensitivity | `INFERRED` (deterministic arithmetic) |
| `07_CAPACITY_MODEL.md` | Component budgets, bottleneck order, saturation behaviour | `INFERRED` over `VERIFIED-SOURCE` |
| `08_SECURITY_PRIVACY_COMPLIANCE.md` | Threat model, control/test matrix, legal flags | mixed + `LEGAL-REVIEW-REQUIRED` |
| `09_FAILURE_MODES_RECOVERY.md` | FMEA, dependency failures, RTO/RPO truth | mixed |
| `10_VENDOR_LIMITS_AND_COSTS.md` | Primary-source limits and pricing, cost bands | primary-source, dated |
| `11_ARCHITECTURE_OPTIONS.md` | Options 0–6, scorecards, constitutional status | mixed |
| `12_TRIGGER_BASED_EVOLUTION.md` | Metrics, thresholds, levers, authority class, rollback | `GOVERNED` + `INFERRED` |
| `13_TEST_AND_LOAD_VALIDATION.md` | Test programme, traffic models, SLOs, falsification | prescriptive |
| `14_FOUNDATION_ACTION_REGISTER.md` | Evidence-backed improvements that strengthen the governed foundation **now** | `VERIFIED-SOURCE` |
| `15_ARB_AMENDMENT_PACKET.md` | `PROPOSED-NOT-RATIFIED` conflict matrix and draft amendment text | `GOVERNED` |
| `16_FINAL_RECOMMENDATION.md` | Now / later / never, selected option, assumptions, blockers | synthesis |
| `17_OPEN_QUESTIONS_AND_HUMAN_ACTIONS.md` | Founder, ARB, legal, provider, ops actions | `HUMAN-REQUIRED` |
| `18_TRACEABILITY_MATRIX.md` | Recommendation → evidence → test → trigger → authority → owner | — |
| `findings.json` | Machine-readable findings with stable IDs | mixed |
| `evidence/` | Raw command output and structured audit returns | — |

---

## 7. Finding ID scheme

`ARCH-RESEARCH-NNN`, allocated sequentially in `findings.json` and stable across revisions of this packet. Every recommendation in `14`, `15`, and `16` cites at least one finding ID, and `18_TRACEABILITY_MATRIX.md` closes the loop from finding → evidence → falsifying test → measured trigger → deciding authority.
