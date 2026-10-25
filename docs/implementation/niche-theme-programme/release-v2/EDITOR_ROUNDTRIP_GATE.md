# Release 389 hold — actual editor/document roundtrip

The coordinator has held final freeze and SQL emission for proposed manifest `1686be9e72bd721b6bcb553951f6fd0cf26bcf7e91af49d714041bee03307615`. That proposal and its nine artifact files remain immutable and **not accepted**. No 389 UP/DOWN exists in the applied scan.

Release now also depends on the Editor's existing source probe, `docs/implementation/theme-editor-2026-10-23/evidence/v2-editor-source-probe.mjs`, and its `v2-editor-source-roundtrip.json` report. [release-gates.json](release-gates.json) records the dependency, observed hashes and preliminary counts. This chat has not run or changed the probe and has not duplicated any schema.

The probe exercises actual editor normalization/buildDraftConfig, canonical registry settings/schema data and portable document compilation across all 21 non-group template keys. The Editor is distinguishing true factory/default/schema defects from undefined properties that disappear under the real JSON wire encoding. The initial Threadline and Habitat passes are useful controls; raw flags in the other eight themes are **not yet eight confirmed factory defects**.

Acceptance requires the existing probe to classify wire behavior, preserve declared/default typed values and header/footer/block identities, and pass the actual document roundtrip for all nine final v2 factories. Its input and bundle hashes must correspond to the final freeze. Source-only success cannot certify installed, API or browser lifecycle.

The coordinator will route confirmed fixes and request a **new content-addressed proposal** afterward. The existing proposal is preserved. This hold creates no database, browser, build, deployment or SQL work authorization.
