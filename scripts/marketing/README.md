# Local marketing performance verification

Use a production build with the real local gateway running. Development mode is
useful for functional checks but does not establish production performance.
The runner requires Node 22.19 or later, an installed Lighthouse CLI, and the
installed Playwright Chromium browser. It does not download dependencies.

```sh
node scripts/marketing/verify-performance.mjs \
  --origin http://127.0.0.1:9006 \
  --lighthouse /absolute/path/to/lighthouse/cli/index.js \
  --output /tmp/letbuyy-performance
```

Only loopback origins are accepted. Optional arguments: `--chrome` for an
existing browser executable, `--locale` (`in`, `in-hi`, `in-ta`), and `--repeats`
(3–5; default 3). Each run creates a separate output directory. JSON reports,
traces, DevTools logs, command logs and a rolling summary are retained.

The two targets are pricing and the first-store guide. Each receives three
fresh browser launches per method: the original Lighthouse mobile simulation
and separate applied DevTools throttling. Lighthouse defaults are preserved and
the actual versions and complete configuration are recorded. Pin the same
Lighthouse and browser versions when comparing builds. The server's optimizer
cache can warm between requests; this does not certify a cold production edge.

Every acceptance sample must satisfy LCP ≤2,500 ms, TBT ≤200 ms and CLS ≤0.1.
Missing measurements, tool errors, duplicate repeat IDs, fewer than three
samples per lane, or any failing sample prevent an overall pass. Medians are
descriptive only. A passing applied measurement cannot erase a failing
simulation. Diagnostic experiments cannot satisfy acceptance. The process exits
1 for incomplete or failing acceptance; a successful Lighthouse process alone
does not mean the performance budget passed.

Both methods produce lab measurements. Neither establishes real-user Core Web
Vitals or INP. Lighthouse documents differences and limitations in its
[throttling guide](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md).
