# Mobile LCP acceptance is still failing

The required acceptance command exited **1** on the restored, freshly built source `Nr2bD-AZ_XyFXsUJdc2FD` (Next.js 16.1.6, loopback 9016, production canonical metadata, real local plan data). Lighthouse **13.6.0** used its existing mobile settings and a fresh disposable browser per run. The unchanged budget is **LCP ≤2,500ms, TBT ≤200ms and CLS ≤0.1 for every sample**.

| Page | Throttling | LCP samples, seconds | Median | Passes |
|---|---|---:|---:|---:|
| Pricing | Simulated | 2.918, 3.451, 3.563 | 3.451s | 0/3 |
| Pricing | Applied DevTools | 1.938, 1.944, 1.985 | 1.944s | 3/3 |
| First-store guide | Simulated | 3.830, 3.827, 3.828 | 3.828s | 0/3 |
| First-store guide | Applied DevTools | 2.138, 2.142, 2.150 | 2.142s | 3/3 |

All twelve TBT/CLS checks pass (maximum TBT 73.0ms, CLS zero throughout). The six applied LCP runs pass. The six original simulation runs fail. No diagnostic, different throttling method or median substitutes for a failed sample. This is local lab evidence; field LCP, INP and CLS were not measured.

## What changed in the investigations

The isolated bundle inventory confirmed that the shared client chunk carries common UI controls, tokens, header/footer and animation code. The existing fast trace shows the LCP images are server-rendered, eager and high priority. Earlier retained Lantern graphs put framework JavaScript and its CPU task on the simulated LCP path even after the image resource completes. A previous unchanged-body latency diagnostic showed model sensitivity; it is explicitly excluded from acceptance and was never deployed or repeated here.

| Trial | Pricing LCP | Guide LCP | Disposition |
|---|---:|---:|---|
| Paired root baseline, diagnostic | 3.487s | 3.906s | Same task-start application source; not acceptance. |
| Load closed privacy dialog on demand | 3.449s | 3.691s | Both over budget. Pricing script transfer decreased by about 4.7kB in the single trial; guide script transfer did not decrease. No safe accepted improvement. |
| Isolated Next.js 16.4.5, unchanged marketing source | 2.929s | 3.907s | Both over budget. App script transfer grew in this trial. Shared UI has an exact 16.1.6 peer constraint, so this was diagnostic and never treated as a supported release closure. Original manifest/lock restored and frozen build passes. |

The newer framework was tested because the [official Next.js 16.4 notes](https://nextjs.org/blog/next-16-4) describe smaller production bundles. That vendor claim was a hypothesis, not a finding for this site. The observed transfer and LCP results did not justify the upgrade. Neither trial changed the working application, CSS or animation source. [Candidate receipts](evidence/candidate-dispositions.json) retain outcomes and setup limitations.

## Why the result remains open

The recorded upstream [fast-finish dependency issue](https://github.com/GoogleChrome/lighthouse/issues/17436) and [JavaScript graph overestimation issue](https://github.com/GoogleChrome/lighthouse/issues/17437) were still open in the current official API read. The saved local trace is consistent with these failure modes; that is an inference, not an upstream diagnosis or a waiver. The same source produces materially different simulated results across runs. The November3 medians (pricing 3.126s, guide 3.356s) and this new run also used different build/runtime conditions. The comparison does not establish a source regression or an improvement.

Next local step: reduce a demonstrated render dependency or validate a supported upstream simulator correction against the unchanged requirements. Maintain exact source/build identity, original LCP element, no-JavaScript content, first interaction, visual/animation behavior and all repetitions. No artificial delay, patched benchmark, reduced sample count, hidden content or browser-specific path was adopted. The gate remains failed until evidence actually passes.

[All samples and CLI settings](evidence/final-performance/run-LyAU2I/summary.json) · [CSV](PERFORMANCE-RESULTS.csv) · [Earlier graph investigation](../../letbuyy-lcp-repair-2026-11-02/MEASUREMENT-INVESTIGATION.md)
