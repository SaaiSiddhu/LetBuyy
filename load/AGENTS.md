# Load Engineering Ownership

## Purpose

`load/` is the operator-facing load validation surface for LetBuyy. It defines internet-scale load scenarios, tool-specific entrypoints, and evidence envelopes. It does not certify production by itself.

## Rules

- Load execution must use real tools: k6, Locust, or Gatling.
- Execute mode requires an explicit target URL, operations token, and production survivability approval before touching production.
- Generated reports belong under `load/reports/` and must remain ignored.
- Load evidence can be used as an input to certification only after operations control-plane evidence is recorded and all survivability gates pass.
- Do not hardcode secrets, tenant tokens, payment credentials, or production-only keys.

## Forbidden

- Fake latency, throughput, error-rate, saturation, or queue-lag metrics.
- Marking planned load as passed.
- Treating local load evidence as production certification.
- Running production load without operator approval.
