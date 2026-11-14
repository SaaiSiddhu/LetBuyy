# Mobile performance acceptance

The final accessibility candidate `1iA7dvwq_bIyb4K8i8XV0` fails the required simulated LCP budget on every pricing and first-store guide sample. All six applied-throttling samples pass. All 12 final TBT and CLS samples pass. The runner exits 1. The final build retains the verified contrast and link repairs, with no experimental performance change.

| Build | Page | Mode | LCP samples (seconds) | Median | Max TBT | Max CLS | Passes |
|---|---|---|---|---|---|---|---|
| Previous preserved build | Pricing | Simulated | 3.080, 3.562, 3.006 | 3.080s | 36.5ms | 0.000 | 0/3 |
| Previous preserved build | First-store guide | Simulated | 3.826, 3.826, 3.828 | 3.826s | 23.0ms | 0.000 | 0/3 |
| Previous preserved build | Pricing | Applied DevTools | 1.977, 1.984, 1.972 | 1.977s | 60.2ms | 0.000 | 3/3 |
| Previous preserved build | First-store guide | Applied DevTools | 2.107, 2.146, 2.102 | 2.107s | 69.6ms | 0.000 | 3/3 |
| Final accessibility candidate | Pricing | Simulated | 3.450, 3.009, 3.451 | 3.450s | 33.0ms | 0.000 | 0/3 |
| Final accessibility candidate | First-store guide | Simulated | 3.830, 3.829, 3.752 | 3.829s | 24.0ms | 0.000 | 0/3 |
| Final accessibility candidate | Pricing | Applied DevTools | 1.964, 1.978, 1.938 | 1.964s | 64.2ms | 0.000 | 3/3 |
| Final accessibility candidate | First-store guide | Applied DevTools | 2.146, 2.150, 2.140 | 2.146s | 62.5ms | 0.000 | 3/3 |

Both batches used the existing repository runner, Lighthouse 13.6.0, installed Chromium, mobile form factor and three repetitions per route in each mode. The rules are LCP ≤2,500ms, TBT ≤200ms, CLS ≤0.1 for every sample. All sample output, including failures, is in the corresponding run folders. The two modes are lab measurements. Real-user LCP, INP and CLS remain unmeasured. [Final run summary](evidence/candidate/performance/run-gixKws/summary.json) · [Preserved build run](evidence/performance/run-wZZhGc/summary.json) · [Sample CSV](PERFORMANCE-SAMPLES.csv)

## What the targeted trials showed

- Saved traces identify server-rendered, eagerly discovered hero images with high fetch priority. In the preserved guide's applied second sample, the 55 KB compressed shared CSS finished around 2.00s while LCP landed at 2.146s. Both routes also transfer more than 220 KB of initial scripts. The simulation predicts a longer render dependency path than the applied run. The previous Lantern trace analysis records how the simulator accounts for JavaScript around paint. [Earlier investigation](../PERFORMANCE-INVESTIGATION.md) · [Lighthouse throttling methods](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md)
- An isolated Webpack build moved strictly matched rules into their route-owned stylesheets. CSS transfer fell from 55,042 to 38,347 bytes on pricing and from 72,341 to 59,392 bytes on the guide. A paired diagnostic simulation measured 2.904 → 2.868s on pricing and 3.753 → 3.751s on the guide. Both missed the target, so the route split was excluded. [Route CSS build](evidence/route-css-build.log) · [Diagnostic samples](evidence/route-css-diagnostic.json)
- An isolated Webpack build removed only the Latin font's preload. One diagnostic simulation measured 2.935s pricing and 3.758s guide, with small new shifts of 0.002438 and 0.000079 respectively. The existing preload remains in the release candidate. [Font trial](evidence/font-diagnostic.json)
- A bounded compiler trial on the pinned Next 16.1.6 stayed in the Turbopack optimization phase without producing an acceptance build. The task-owned process was stopped. The accepted accessibility change was built with the repository's Webpack command. [Compiler trial log](evidence/turbopack-build.log) · [Candidate build log](evidence/access-build.log)

The measured CSS savings did not close the release gate. The remaining performance investigation is to identify which shared framework and application modules actually delay initial paint and reduce the initial download or execution cost without changing presentation or interactions. Keep the same URLs, mobile settings, LCP element, limits and all sample evidence when evaluating a new source change.
