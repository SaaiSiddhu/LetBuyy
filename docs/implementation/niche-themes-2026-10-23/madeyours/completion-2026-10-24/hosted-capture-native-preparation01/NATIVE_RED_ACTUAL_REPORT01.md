The single RED cohort reproduced the capture metadata defect and exited 1. It is not an all-pass result.

Run `487161ab7e7c` executed 25 TAP tests: 18 passed and 7 failed, with zero skipped, cancelled or TODO. The seven failures comprise four metadata assertions, two separate query assertions, and the parent aggregating the six failed children.

Both guest and bound webhook-first paths reached the accepted raw witness: one canonical capture tied to the original provider payment and durable key, a paid INR order, and exactly two ledger entries of 21,100 minor units, one debit and one credit. The completed hosted checkout still reported capture false. The next unchanged metadata assertion failed. Concurrent paths also showed false metadata. Browser-first paths reported true metadata and failed the separate query assertion; those failures are preserved separately. Each failed child stopped at that assertion, so its later checks are not certified.

The whole parent, including provisioning and cleanup, took 35.799 seconds of the 600-second budget. The full 322 migration hashes and order match the pinned closure through prefix 393; no ceiling was used. The accepted wrapper applies exactly the four admitted unnumbered UPs before requiring this suite.

Canonical cleanup reports zero failures and no remaining run-labelled containers, networks or volumes. Per-suite REST and database cleanup succeeded; no reaping or stray-process stop occurred. Post-run RED/GREEN source and link pins and the four frozen source pins were checked again. The artifact pins are recorded individually in the machine-readable report.

GREEN has not started. The original 23 MadeYours browser cases remain last verified as NOT_RUN; this native fake-provider suite does not count as their execution or as actual Razorpay Test Mode proof. Editor retains the browser queue. No Main or frozen source was changed by this work.

Actual result: [native-red-approved01-result.json](/Volumes/Projects/LetBuyy/docs/implementation/niche-themes-2026-10-23/madeyours/completion-2026-10-24/hosted-capture-native-preparation01/native-red-approved01-result.json)

Full suite log: [native log](/Volumes/Projects/LetBuyy/docs/implementation/niche-themes-2026-10-23/madeyours/completion-2026-10-24/hosted-capture-native-preparation01/native-red-approved01-logs/hosted-checkout-capture-proof-qualification.manual.ts.log)

All failures: [NATIVE_RED_FAILURES01.json](/Volumes/Projects/LetBuyy/docs/implementation/niche-themes-2026-10-23/madeyours/completion-2026-10-24/hosted-capture-native-preparation01/NATIVE_RED_FAILURES01.json)

Raw causal witnesses: [NATIVE_RED_CAUSAL_WITNESSES01.json](/Volumes/Projects/LetBuyy/docs/implementation/niche-themes-2026-10-23/madeyours/completion-2026-10-24/hosted-capture-native-preparation01/NATIVE_RED_CAUSAL_WITNESSES01.json)

Full report and evidence hashes: [NATIVE_RED_ACTUAL_REPORT01.json](/Volumes/Projects/LetBuyy/docs/implementation/niche-themes-2026-10-23/madeyours/completion-2026-10-24/hosted-capture-native-preparation01/NATIVE_RED_ACTUAL_REPORT01.json)
