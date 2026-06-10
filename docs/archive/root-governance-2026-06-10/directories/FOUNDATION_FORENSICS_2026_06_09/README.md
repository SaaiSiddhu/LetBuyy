# LetBuyy — Ultra-Deep Foundation Forensics (2026-06-09)

Read-only, code-only forensic due diligence of the LetBuyy commerce platform, posed as $100M acquisition due diligence. **Trust code, not documentation** — every claim is traced to a `file:line`. Where prior internal audit notes conflicted with the current working tree, the current code was trusted and the finding corrected.

## Start here
- **[LETBUYY_FINAL_CTO_VERDICT.md](LETBUYY_FINAL_CTO_VERDICT.md)** — the verdict, the 9-dimension scorecard, real-vs-theater table, remediation timeline, and the single recommendation. Read this first.

## Headline
> A genuinely good commerce core wearing a costume three sizes too big. Real modular monolith + real ledger kernel + real theme engine + clean module graph — but it **cannot truthfully move money**, its **tenant boundary is convention-only**, and its **production plane is blind**. **Composite ≈ 45/100. Recommendation: REQUIRES RESTRUCTURING** (a two-quarter foundation step-up — emphatically *not* a rewrite).

## Scorecard
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
| **Composite** | **≈45/100** |

## The three findings that decide the deal
1. **Payouts are fabricated** — fake `UTR`, zero provider HTTP call; wallet debited for money that never moved. `packages/infrastructure/payout-transfer-adapter/index.ts:82-103`
2. **The ledger is not the system of record** — payment capture never posts to it; `buildPaymentCaptureLedgerPosting` has no caller. `packages/payments/src/index.ts:420`
3. **RLS is inert** — the request path runs as `service_role`; the RLS-respecting client has **0** call-sites vs 98 for the admin client. Tenant isolation is correct-by-convention only. `services/api-gateway/src/lib/supabase.ts`

## Reports in this folder

**Phase A–B — Structure**
- [LETBUYY_REPOSITORY_ARCHAEOLOGY_REPORT.md](LETBUYY_REPOSITORY_ARCHAEOLOGY_REPORT.md) — actual vs intended vs dead vs fake architecture; 6 paper services; the distributed-runtime tower (0 runtime call-sites).
- [LETBUYY_MONOREPO_FORENSICS.md](LETBUYY_MONOREPO_FORENSICS.md) — package/dependency/build graphs; acyclic & clean boundaries; dead packages; validator theater.

**Phase C–D — Foundation & Identity**
- [LETBUYY_FOUNDATION_FORENSICS.md](LETBUYY_FOUNDATION_FORENSICS.md) — per-subsystem real/partial/stub/absent; money-movement deep-dive.
- [LETBUYY_IDENTITY_FORENSICS.md](LETBUYY_IDENTITY_FORENSICS.md) — who owns identity today; service-role/RLS; OIDC skeleton; two auth systems.
- [LETBUYY_AUTH_SCORECARD.md](LETBUYY_AUTH_SCORECARD.md) — who-owns-X-today maturity table.

**Phase E–G — Experience**
- [LETBUYY_DESIGN_SYSTEM_FORENSICS.md](LETBUYY_DESIGN_SYSTEM_FORENSICS.md) — token core, adoption, drift.
- [LETBUYY_DESIGN_GOVERNANCE_REPORT.md](LETBUYY_DESIGN_GOVERNANCE_REPORT.md) — enforcement reality (note: a CI-empty claim here was corrected — see verdict).
- [LETBUYY_UI_CONSISTENCY_REPORT.md](LETBUYY_UI_CONSISTENCY_REPORT.md) — per-component variant inventory + consistency score.
- [LETBUYY_THEME_EDITOR_FORENSICS.md](LETBUYY_THEME_EDITOR_FORENSICS.md) — section/block engine; registry/renderer decoupling; marketplace readiness.

**Phase H–I — Operations & Trajectory**
- [LETBUYY_PRODUCTION_READINESS_FORENSICS.md](LETBUYY_PRODUCTION_READINESS_FORENSICS.md) — deploy topology, CI reality, backups/DR, scale at 100/1k/10k merchants.
- [LETBUYY_COMMERCE_OS_READINESS.md](LETBUYY_COMMERCE_OS_READINESS.md) — can it become Shopify/Wix without rewrite (yes) vs Webflow/Framer (no).

**Phase J — Constitutions (what to freeze)**
- [LETBUYY_MASTER_CONSTITUTION_CANDIDATE.md](LETBUYY_MASTER_CONSTITUTION_CANDIDATE.md)
- [LETBUYY_AUTH_CONSTITUTION_CANDIDATE.md](LETBUYY_AUTH_CONSTITUTION_CANDIDATE.md)
- [LETBUYY_DESIGN_CONSTITUTION_CANDIDATE.md](LETBUYY_DESIGN_CONSTITUTION_CANDIDATE.md)
- [LETBUYY_PLATFORM_CONSTITUTION_CANDIDATE.md](LETBUYY_PLATFORM_CONSTITUTION_CANDIDATE.md)
- [LETBUYY_MONOREPO_CONSTITUTION_CANDIDATE.md](LETBUYY_MONOREPO_CONSTITUTION_CANDIDATE.md)

**Phase K — Verdict**
- [LETBUYY_FINAL_CTO_VERDICT.md](LETBUYY_FINAL_CTO_VERDICT.md)

## Method & caveats
- 6 parallel deep-dive workstreams over 4,419 tracked files; every load-bearing claim re-verified firsthand (service-role call counts, payout adapter, the auth-switch fix, CI workflow presence).
- This is **read-only**: no source code was modified. The only files written are the reports in this folder.
- Scope honesty: subsystem classifications are based on the routes/packages/migrations that carry each capability; a route existing was never treated as the feature being real.
- One corrected error: a workstream reported `.github/workflows/` as empty — it has 10 workflows; the accurate, narrower finding (no enforced design-ratchet baseline) is reflected in the design constitution and verdict.
