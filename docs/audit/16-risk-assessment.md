# 16 — Risk Assessment

Risk register for the doc-14 program + standing platform risks found in audit. Scale: Likelihood/Impact 1–5; Exposure = L×I. Owner streams per doc 14 (A runtime, B editor/marketplace, C platform).

---

## 1. Program Risks

| ID | Risk | L | I | Exp | Mitigation | Trigger to escalate |
|----|------|---|---|-----|------------|---------------------|
| R-01 | **Dual-system persistence** — Liquid v2 ships but React engine never deleted (repo precedent: engines ×2, draft tables ×2, deploy workflows ×2) | 4 | 5 | 20 | Doc 14 rule: every phase ends with executed deletions; PR gate links deletion task; Phase 7 has explicit Wave D3 list | any phase exits with its deletion list unmerged |
| R-02 | Converter long-tail — legacy `templateConfig` shapes (3 normalizer formats) fail conversion for some stores | 4 | 4 | 16 | P3 converter dry-run report per store; batch cutover w/ manual-fix queue; legacy path retained until 100%+2wk soak | >5% stores in manual queue |
| R-03 | Visual/SEO regression at shell cutover (header/footer/meta) | 3 | 4 | 12 | screenshot-diff suite + content_for_header checklist (canonical, OG, GA tags) on fixture + top-10 stores | Lighthouse SEO drop >5 pts |
| R-04 | Editor rewrite stalls (2,067-line monolith decomposition while feature-adding) | 3 | 4 | 12 | strangler order: state extraction first, panels after; old editor behind flag 1 phase | P4 >50% over estimate |
| R-05 | Tenancy migration locks/orphans (079–081 on live data) | 2 | 5 | 10 | NOT VALID→VALIDATE, CONCURRENTLY, orphan-scan gate, 48h staging soak, down-scripts | lock >2s observed |
| R-06 | Marketplace abuse (malicious theme/app submissions) once supply opens | 3 | 4 | 12 | validation+signing+sandbox stack (docs 07§10, 09§3, 10§6); human review; revocation ≤60s path | first bypass found → freeze submissions |
| R-07 | Payout/GST compliance errors (revenue share) | 2 | 4 | 8 | reuse proven order-invoice plumbing; legal checkpoint in P5; payouts behind manual approval initially | any payout dispute |
| R-08 | Capacity: 36 ew across 3 streams assumes ≥3 strong engineers + the AI-agent workflow that built this; coordination overhead historically produced ledger sprawl | 3 | 3 | 9 | gates-not-ledgers rule; weekly demo against phase exit criteria only | 2 consecutive missed gates |
| R-09 | Hidden coupling in unexercised event-sourcing stack when services activate (P8–9) | 3 | 3 | 9 | activate via thin consumers first (search/media); contract tests on queue payloads (`event-core` schemas exist) | DLQ rate >1% |
| R-10 | Cloudflare/Vercel/Supabase quota or credential gaps discovered at P9 (deploys currently skip silently without creds) | 3 | 4 | 12 | doc 17 makes cred-present a P1 CI assertion (fail, not skip); provider quota review at P2 | any silent-skip in CI |

## 2. Standing Security Risks (pre-existing; fixes scheduled)

| ID | Risk | Sev | Fix phase |
|----|------|-----|-----------|
| S-01 | `isInternalRequest()` open fallback in non-prod (payment-state endpoints unauthenticated on staging) — `services/api-gateway/src/routes/storefront.ts` | HIGH | 1 |
| S-02 | Customer email enumeration (`/storefront/customer/by-email`, `/status`) | MED-HIGH | 1 |
| S-03 | Nullable `store_id`/missing FK on products/orders → cross-tenant orphan rows possible at DB layer | HIGH | 1 |
| S-04 | Static long-lived `PLATFORM_CONSOLE_API_TOKEN` for platform-wide console API | MED | 2–3 |
| S-05 | Stale `USING (true)` RLS in identity-platform schema file (if ever applied) | MED | 1 (delete) |
| S-06 | Parallel customer-auth stacks drift (cookie sessions in app vs gateway) | MED | 7 |
| S-07 | No SRI/CSP regime for future app embeds (pre-emptive) | MED | 6 design (doc 10 §5) |
| S-08 | Secrets rotation never exercised; INTERNAL_API_SECRET shared across services | MED | 9 runbook + per-binding secrets |

## 3. Data Risks

| ID | Risk | Mitigation |
|----|------|------------|
| D-01 | Draft convergence (082) loses unsaved editor work | run during low-traffic window; draft freeze banner; backfill is copy-not-move; 083 only after P4 verification |
| D-02 | `000_baseline.sql` non-idempotent — disaster-recovery rebuild ambiguity | doc 17 restore drill; document exact restore order (baseline → 073+) |
| D-03 | Telemetry/event tables unbounded growth (`runtime_telemetry_*`, `worker_request_logs`) | retention jobs doc 11 §8 (P2) |
| D-04 | KV release-bundle cache poisoning via unsigned private uploads | private uploads validated same pipeline; KV keys include content hash post-P5 signing |

## 4. Organizational/Process Risks

- **Documentation drift is systemic**: two prior reports were each wrong in opposite directions (stub-claims vs done-claims). Countermeasure adopted: status = CI gates only; this audit set supersedes all root ledgers (deleted in P0); docs/audit refreshed at each phase exit or marked stale.
- **Validator false-confidence**: 132 green checks ≠ working software. Countermeasure: doc 17 separates *topology lint* (keep) from *production evidence* (must be live); forbid validators that pass by asserting absence of evidence.
- **Single-maintainer bus factor** (commit cadence suggests one operator + agents): keep runbooks executable by a newcomer; phase gates double as onboarding checkpoints.

## 5. Top-5 Watchlist (review at every phase gate)

R-01 dual-system persistence · R-02 converter long-tail · S-01/S-03 until merged · R-06 marketplace abuse · R-10 silent-skip deploys. Each gets a named check in the phase-exit checklist; exposure rescored at each gate.
