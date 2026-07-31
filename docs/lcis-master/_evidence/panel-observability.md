# Observability Panel Review — Phase 9
**Reviewer role:** Principal SRE / Observability Architect  
**Date:** 2026-06-20  
**Scope:** Structural-heuristic relabel, live-adapter sequencing, change-event correlation, OTel/SLO boundary

---

## 1. AGREE + why

- **Relabeling detectors/predictors as structural risk heuristics is correct and necessary.** Every real anomaly-detection system (Datadog Watchdog ARIMA, Elastic ML, New Relic Lookout) is defined by a live signal stream. Calling topology-derived patterns "detection" is a credibility liability, not a feature gap. The relabel costs nothing and saves a lot of trust.
- **Supabase-first adapter sequencing is right.** Order/payment success/gift-card state are the highest-value signals LCIS can add, and Supabase is already a first-party dependency — no new vendor, no new secret surface. Cloudflare Analytics second (worker/gateway health) is the correct follow-on because it gives the request-layer signal that structural data cannot.
- **Change-event correlation as the pre-telemetry AIOps win is the single strongest near-term move.** LCIS already ingests git deploy + migration timestamps. Correlating "migration N preceded risk R by T minutes" is achievable now and directly mirrors the PagerDuty/Datadog model that practitioners trust.

---

## 2. CHALLENGE + evidence

**Sharpest challenge: change-event correlation is compelling but easily oversold.**

The PagerDuty/Datadog model works because the *alert* is live — a real spike in error rate fires, and the system correlates it against a recent deploy. LCIS has the deploy event but **no live alert to correlate against**. What LCIS can actually deliver pre-telemetry is: "migration M landed at T; the following structural risks are elevated post-M." That is a *structural pre-deployment risk score*, not correlation in the AIOps sense. If the feature ships with "change-event correlation" in the surface copy, users will expect post-deploy error signal and be disappointed by what they get.

Evidence for this bound:
- `LCIS_FUTURE_MODEL.md` §Decision 3: "LCIS already knows deploys + migrations from git" — this is true; the missing half is a live outcome signal.
- `LCIS_COMPETITIVE_RESEARCH.md` P4: "PagerDuty correlates 'a deploy 3 min before the alerts'" — the alerts are live. LCIS has the deploy but not the alerts.

**Secondary challenge: the honesty surface is proposed but not gated on the relabel.** If the Operations surface goes live before the relabel is complete, structural heuristics will render in an "Operations / Detection" context that still *looks* like live anomaly detection to users. The relabel must ship atomically with the UI label change — not sequentially.

---

## 3. MISSING

1. **OTel/SLO boundary is not drawn.** The proposal is silent on whether LCIS will ever consume OTel spans or define SLOs. The right answer is: LCIS is NOT an APM and must stay out of that lane. It should reference where SLOs/error-budgets live (Cloudflare Analytics Engine, a future Grafana/SigNoz instance) and surface only the *structural preconditions* for SLO design (which tables/RPCs are in the critical path). Leaving this undefined risks a future team wiring raw spans into LCIS and recreating Datadog poorly.
2. **No freshness/staleness indicator on structural artifacts.** Supabase data ages; the code graph becomes stale between `pnpm graph:update` runs. Users need to see "structural snapshot from build X, 4h ago / Supabase live as of 2m ago" — separate freshness labels per source, not one `NOT CONNECTED` binary.
3. **No incident writeup path.** Change-event correlation produces a hypothesis. There is no proposed surface for a human to accept/reject that hypothesis and feed the outcome back as a learning signal. Without this, every run is ephemeral and the system cannot improve.

---

## 4. Recommendations (top 5)

1. **Rename "change-event correlation" to "deployment risk attribution" in all surface copy.** It is honest (structural pre/post-deployment risk diff), defensible without live signal, and still clearly useful. When the first live adapter lands, upgrade the name.
2. **Gate the relabel atomically.** Ship the structural-heuristic label change in the same PR as the Operations surface. Do not let "Detectors / Predictors" language survive in any rendered UI path after the relabel decision is ratified.
3. **Draw the OTel/APM boundary explicitly in LCIS_MASTER_ARCHITECTURE.md.** One sentence: "LCIS consumes pre-aggregated metrics from live adapters (Supabase row counts, Cloudflare Worker analytics); it does not ingest raw traces or spans, and does not own SLO/error-budget arithmetic." This prevents the Datadog-poorly-reimplemented failure mode.
4. **Add per-source freshness timestamps to every answer that mixes structural + live data.** Structural (graph snapshot): last build time. Live (Supabase): query time. Display both independently. This is the observable extension of the honesty contract.
5. **Design a minimal hypothesis-feedback loop for change-event attribution.** Even a "Was this risk real? Yes / No" thumbs-up on the Operations surface, stored in a local append-only log, closes the loop and gives the system ground truth to improve on. This is what separates "interesting static analysis" from a system that earns operator trust over time.

---

## Path forward

Pre-telemetry: (1) relabel + gate atomically, (2) rename to "deployment risk attribution," (3) write the OTel boundary in the master architecture doc. These three steps cost <1 day and eliminate the two largest credibility risks.

First live adapter (Supabase): add per-source freshness labels at the same time. Do not ship live data without them.

Second live adapter (Cloudflare): only then does "Operations" have enough signal to justify the surface name. At that point, revisit the "correlation" language — now it will be accurate.

*This review is advisory. The 108 deterministic validators and the Constitution remain supreme. These are panel findings for the LCIS_MASTER_ARCHITECTURE.md ratification.*
