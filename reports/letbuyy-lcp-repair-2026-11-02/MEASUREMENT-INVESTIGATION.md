# Why the two lab methods disagree

This is an investigation, not a waiver of the requested simulated LCP budget. The site must not be called all-green while either original simulation lane fails.

## Repeated observations

The unchanged task-start production source was measured twice, with three fresh browser launches per page and method in each batch. Both batches retain all failures. The first batch's simulated medians were 3.127s (pricing) and 3.356s (guide); applied DevTools throttling medians were 1.928s and 2.082s. Every applied sample passed LCP; every simulation in that first batch failed. Full reports, traces, logs and actual configuration are under `evidence/paired-baseline/` and `evidence/verified-runner/`.

These are two lab methods with different models. The applied results are neither field Core Web Vitals nor proof that the simulation warnings can be dismissed. The unchanged source across batches also means a numerical change between runs cannot be attributed to a source repair.

## Dependency graph

`evidence/paired-baseline/pricing-simulate-2-lantern.json` recomputes the pinned Lighthouse LCP graph from its saved trace and DevTools log. The actual LCP node is the server-delivered pricing illustration. Its discovery audit passes all three checks: present in initial HTML, high priority, and eager loading. The graph nevertheless finishes on framework JavaScript and a dependent CPU task. Its optimistic/pessimistic estimates are 3.112s/3.142s while the image network node completes at 1.860s in both schedules.

This is evidence about the simulator's dependencies; it does not establish that every script is unrelated to rendering or interactions.

## Controlled diagnostic, excluded from acceptance

A loopback-only proxy forwarded the unchanged baseline, adding 250ms of latency to app JavaScript. It did not rewrite JavaScript, CSS, images or markup. All 11 initial pricing script bodies were compared using SHA-256 and matched exactly; timings, sizes and hashes are in `evidence/diagnostic-byte-equivalence.json`. The proxy's source is preserved as `evidence/fast-finish-all-diagnostic.cjs`.

With that extra delay, a single diagnostic simulation per page reported 2.168s and 2.038s. This does not make the site faster and is not an accepted fix. The experiment was stopped; no delay, browser detection, alternate Lighthouse content or delivery proxy was added to the marketing application. These samples are explicitly excluded from acceptance.

The prediction improving when delivery is slowed supports a model sensitivity hypothesis. It is not proof that all real-world performance problems are absent.

## Upstream primary evidence

Checked on 2 November 2026 UTC:

- [Lighthouse issue #17436](https://github.com/GoogleChrome/lighthouse/issues/17436), open when checked, describes fast unthrottled requests being included in the predicted LCP graph even when they are not prerequisites for the LCP resource. This closely matches the local diagnostic; the connection is an inference, not an upstream diagnosis of LetBuyy.
- [Lighthouse issue #17437](https://github.com/GoogleChrome/lighthouse/issues/17437), also open when checked, investigates excessive dependencies in JavaScript-heavy pages.
- [Lighthouse throttling documentation](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md) explains that default simulation predicts a slower load from a fast trace, and that applied request throttling also has limitations. It recommends packet-level testing for deeper accuracy investigations. No system-wide network shaping was performed here.

No upstream issue was filed, no vendor source was patched, and no newer Lighthouse release was assumed to resolve this behavior.

## Acceptance and remaining work

Keep the exact final-build simulated results in the main verification report. Three passing applied runs do not close a failing simulated lane. The reusable local verifier exits nonzero if any required sample fails or is missing; its four regression tests protect against hiding a failure with a median, a different method, a duplicate sample, or a diagnostic experiment.

Further meaningful optimization should use the retained dependency traces to isolate a real rendering dependency, then compare the same build, browser, settings and visual/functional matrix. A smaller payload or one passing run alone is insufficient. Packet-level/physical-device testing and authorized production field data would help assess real-world performance, but their absence is not a reason to mark the local simulation issue resolved.
