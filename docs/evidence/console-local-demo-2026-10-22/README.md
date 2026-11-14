# Local Console DEMO evidence

The owner requested visible mock data and a guide to recent features. [Guide and delivery record](../../../reports/CONSOLE_LOCAL_DEMO_2026-10-22.md).

`local-before.json` records the empty business tables before this task. `dry-run-4.log` is the successful full rollback. `apply.log` records the committed local seed. `repeat-check.log` records the idempotent zero-insert rerun and rollback. `postflight.json` contains only aggregate/synthetic data and security metadata. `governance.json` is the honest isolated-snapshot110-pass/four-failure matrix, not release acceptance.

The manual runner and SQL live under `scripts/dev/seed-console-demo.mjs` and `database/supabase/seeds/local-console-demo-20261022.sql`. Source SHA256 values and274-file dirty-tree preservation are in the structured delivery receipt. All retained data is explicitly local and synthetic; no credentials, raw authentication proof or real-user screenshots are stored here.
