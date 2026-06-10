# Production Readiness Assessment (Deliverable 26)

Two parts: (A) readiness of **today's** platform to host third-party apps; (B) the GA gate checklist for the target platform (roadmap Phase 12 exit criteria).

---

## A. Current-State Readiness Verdict

**Verdict: NOT READY for third-party apps in production. Ready-with-caveats for first-party/internal apps only.**

| Dimension | Grade | Determining evidence |
|---|---|---|
| Core commerce serving (stores/products/orders/payments) | B | Gateway production-grade; 4 payment providers verified; outbox+webhooks real |
| App distribution (catalog→install→OAuth) | C− | Flow exists end-to-end but tokens-in-JSONB (C3), no scope enforcement (C5), silent marketplace fallbacks (H5) |
| Extension delivery to storefront | D | Slot/iframe only; sandbox flaw C6; no versioning/kill-switch honored (H11) |
| Embedded admin apps | C− | Endpoints + admin host page exist (`EmbeddedAppBridgeClient.tsx`); client SDK + protocol docs absent, chain untested e2e (H6) |
| App monetization | D+ | Charges+approval real; no subscriptions/usage/payouts |
| Developer experience | F | Portal shell; no credentials mgmt, validation feedback, webhook debugging |
| Multi-tenant isolation | C− | RLS broad-bypass policies (C1) + ambient service role (C2); no found leak, but un-defended in depth |
| Operability (CI, observability) | C− | typecheck+governance gates failing (H10); 97 console.log; no tracing collector; queue consumers missing (H4) |
| Governance/process | B+ | Import boundaries enforced; manifests; 98 validators; zero deprecated-alias leakage — genuinely strong |

**Minimum bar to pilot even ONE trusted external app on today's code:** close C1–C6 + H5/H6/H11 (≈ roadmap P1 + P4 slice). Anything less exposes merchant data to the app author's competence.

## B. GA Gate Checklist (Phase 12 sign-off; each item = named owner + artifact)

### Security (gate: all CRITICAL/HIGH closed)
- [ ] C1–C6 closed with evidence links (migrations, PRs)
- [ ] Isolation test matrix (doc 18 §3) automated in CI, 100% pass, RLS fuzz included
- [ ] Pen test on OAuth + proxy + bundle ingestion (external vendor) — no high findings open
- [ ] Secrets: gitleaks clean, rotation runbook executed once, dual-secret rollover proven
- [ ] CSP enforced (not report-only) on ≥95% storefront cohort, violation rate <0.1%

### Reliability
- [ ] SLOs armed w/ alerts: storefront render P95 ≤ pre-TAE baseline; webhook delivery success ≥99.5%/24h; token endpoint P99 <150ms; manifest publish <30s
- [ ] Failure containment verified by chaos drills: block-render-fail, proxy-timeout circuit breaker, revocation ≤60s, manifest-corrupt fallback (doc 13 §6 matrix — each drill has a run record)
- [ ] Queue consumers exist for every bound queue (H4 closed) + dead-letter alarms
- [ ] Load suite passing at 5× current peak on storefront + install endpoints (`load/` harness)

### Data
- [ ] Fresh-migration-replay CI job green 14 consecutive days
- [ ] Backup/restore drill for app-platform tables executed; RPO ≤15m documented
- [ ] Purge pipeline verified (uninstall → T+48h evidence) — GDPR-posture artifact
- [ ] Zero `USING(true)` policies on app-platform tables (validator-enforced)

### Product completeness (Shopify-parity floor for launch)
- [ ] TAE: upload→validate→review→publish→place→render e2e by an external tester
- [ ] App embeds on/off across both renderers; reference pixel + chat apps live
- [ ] Token exchange + App Bridge SDK consumed by ≥2 pilot embedded apps
- [ ] Billing: subscription w/ trial + usage records + first real payout statement generated
- [ ] Review pipeline: ≤5-business-day turnaround proven on 10 pilot submissions
- [ ] Developer portal: self-serve org→app→dev-store→submission with zero staff intervention (timed test)

### Operations & process
- [ ] Runbooks: extension kill, app mass-token-revoke, payout freeze, marketplace read-only — each drilled once
- [ ] On-call rota covering gateway/webhook-service/media-service; paging tested
- [ ] CI fully blocking: typecheck, lint, governance, unit, contract, isolation matrix, e2e (H10 permanently closed)
- [ ] Docs current: developer docs generated from shared-types; doc 02 §11 stale-claims corrected; AGENTS.md amended (doc 19 §5)
- [ ] Support: developer support channel + merchant app-issue escalation path defined

### Launch controls
- [ ] Feature flags: install-freeze, marketplace read-only, global embed-off — tested
- [ ] Staged rollout plan executed: internal (2 wks) → 5 partners (2 wks) → open
- [ ] Quotas armed (doc 15 §5); anomaly alerts on scope-heavy installs + webhook storms
- [ ] Rollback rehearsal: one full release rolled back on staging within 15 minutes

**GA = every box checked, signed by platform-eng lead + security owner + product owner; partial launches use the staged-rollout flags, never checklist waivers.**
