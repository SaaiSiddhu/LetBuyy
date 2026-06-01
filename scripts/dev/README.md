# Developer Stack Scripts

`scripts/dev/` owns developer-only orchestration helpers that boot or stop local
multi-runtime stacks for browser and Playwright verification. Scripts here must
be deterministic, local-only, non-production, and must not require live provider
credentials.
