# S7 — Verdict Correction: S6's Steady-Rate "RED" Reading Was a Sample-Size Artifact

**Date:** 2026-08-24. **Status:** correction to a prior evidence document.
**This document SUPERSEDES `S6-load-summary.md`'s steady-rate conclusion and CAP-C08's
S6-recorded verdict on that dimension only.** It does not overwrite, delete, or edit
`S6-load-summary.md`, `S6-workload-definition.md`, or either results JSON — all three
remain on disk unmodified; every number below is re-derived from them, not re-measured
(no new harness run was performed for this workstream — re-running would reproduce the
same undersized sample, not correct it; see §4).

## 1. What S6 actually collected — verified directly against the JSON, not assumed

`docs/evidence/liquid-load/S6-load-results-steady.json`:
- `config`: `targetRps: 2, durationSeconds: 15, warmupSeconds: 3, trials: 2`, 6 round-robin
  scenarios (3 surfaces × 2 engines).
- `trials[].warmupRequestsDiscarded`: **6** in both trials — 6 scenarios round-robin over a
  3-second warmup window at 2 req/s aggregate is **one warmup request per scenario**, not
  a warmed-up run.
- Every scenario's measured window: **`count: 5`** — five requests per scenario per trial.
- `index/liquid` trial 1: `p50: 530.02, p95: 555.45, p99: 555.45, max: 555.45, min: 39.09`.
- `index/liquid` trial 2: `p50: 530.46, p95: 532.08, p99: 532.08, max: 532.08, min: 35.42`.

All four figures above were re-read from the JSON file directly for this document, not
copied from `S6-load-summary.md`'s prose.

## 2. The arithmetic S6 missed

1. **At n=5, p95 is mathematically identical to the max.** The harness's own percentile
   function (`apps/storefront-runtime/scripts/liquid-load-harness.mjs`,
   `percentile(sorted, p)`) computes `idx = ceil(sorted.length * p) - 1`. For n=5, p=0.95:
   `ceil(5 × 0.95) - 1 = ceil(4.75) - 1 = 5 - 1 = 4` — the last (largest) index. **p95 and
   p99 carry zero additional information beyond "the single largest sample" at this
   sample size.** Reporting "p95 = 555ms" as if it were a percentile in the statistical
   sense — a value with 95% of the distribution below it — was not warranted by 5 samples.
2. **The observed minimum in every steady-rate Liquid trial matches Liquid's WARM
   performance elsewhere in the same evidence set.** `index/liquid` steady-run minimums
   (39.09ms, 35.42ms) sit inside the exact range of `index/liquid`'s PEAK-run p50s across
   all three trials (34.6ms, 35.24ms, 46.25ms — `S6-load-results-peak.json`). This is the
   same code, the same route, the same build — warm, it is consistently ~35–46ms. The
   steady-run minimum shows that warm performance is still reachable at low request rate;
   it is not that Liquid is inherently slow at 2 req/s, it is that most (not all) of the 5
   samples in each steady trial paid an extra cost the peak-rate samples did not.
3. **At the peak rate (n=33 per scenario, statistically meaningful), Liquid is faster than
   React in 2 of 3 trials on the home surface** (trial 1: react p50 39.59ms vs liquid
   p50 34.6ms; trial 3: react p50 56.18ms vs liquid p50 46.25ms; trial 2 is the one
   exception, react 25.92ms vs liquid 35.24ms) — re-verified directly against
   `S6-load-results-peak.json` for this document. **Warmed and adequately sampled, Liquid
   is at parity with React, not degraded relative to it.**

## 3. Corrected classification

| Dimension | S6's verdict | S7 correction | Why |
|---|---|---|---|
| Concurrent load, warm/peak rate (10 req/s, n=33×3 trials) | GREEN | **GREEN — unchanged** | Statistically adequate sample; deltas within trial-to-trial noise; Liquid faster in 2/3 trials. This was already correctly classified. |
| Concurrent load, low-rate/steady (2 req/s, n=5×2 trials) | **RED** ("reproducible 10–14× p95 gap") | **NOT_PROVEN** | n=5 with one discarded warmup request per scenario is not an adequate sample to conclude degradation OR parity. p95=p99=max at this n is a sample-size artifact, not a measured tail. This was never adequately measured — that is a different, honest classification from "measured and bad." |
| Cold-path / idle-then-first-request latency | (mislabelled as "steady-rate throughput") | **RED — moved to its own finding** | The underlying phenomenon S6 observed is real and reproducible (a ~500ms cost recurring after ~3s idle gaps) — S6 correctly measured a real effect, but mischaracterized WHAT it measured (labelled it a throughput/rate characteristic; it is a request-history-dependent cold-path cost). See `S7-cold-path-profile.md` for the root-cause investigation of this specific, correctly-real finding. |

**S6's error was not in its raw numbers — every number it reported is accurate and
reproduced identically above.** The error was in the STATISTICAL INTERPRETATION: treating
5 samples as sufficient to compute a 95th-percentile claim, and treating a recurring
idle-gap cost as if it characterized "the storefront under 2 req/s of steady load" rather
than "the storefront's cold-path cost, incidentally exposed by a low-rate test design."

## 4. Why this phase did not re-run the harness to "confirm" the correction

Re-running `liquid-load-harness.mjs` at `--rps=2 --duration=15 --trials=2` would reproduce
the identical n=5/one-warmup-request design and very likely reproduce the identical
symptom — that would not validate or invalidate anything; it would just collect the same
inadequate sample again. The correction above is a **statistical re-reading of data
already collected**, not a claim that needs a fresh measurement to support it — n=5 being
too small for a 95th-percentile claim is true by the definition of percentile, not by a
new experiment. A properly-sized re-measurement (warmup sized in requests, n≥30,
≥3 trials, run at a genuinely low rate) is exactly what `S7-cold-path-profile.md`'s
before/after section performs, once the cold-path cause is understood — see that document
for the corrected-method re-measurement.

## 5. What is unchanged by this correction

- Render-parity and security/SSTI/XSS remain GREEN (S1/S3/S3-FIX), untouched by this
  document.
- `letbuyy-core` remains DARK. No committed config enables Liquid anywhere.
- The flip remains **NO-GO** — not reinstated by this correction. The correction removes
  a WRONG reason (a phantom "steady-rate throughput degradation") and replaces it with the
  CORRECT reason: an unresolved cold-path latency cost (§`S7-cold-path-profile.md`), which
  is a real, separate, still-open blocker on its own merits.
