# One fresh release dry run — authorization and outcome

Root subsequently admitted checkpoint 03 and authorized exactly one fresh dry run. It executed once and produced immutable manifest `0cf62a07290706e8dd8a3a0d24928cdd10bce0f7468ed8c8a94ffe3219f5639d`. **The candidate is on review hold because the integrity guard fails after loading its emitted JSON.** See [the review receipt](./DRY-RUN-CHECKPOINT-03-REVIEW.md). No further generation is authorized by this document.

The held proposal remains `1686be9e72bd721b6bcb553951f6fd0cf26bcf7e91af49d714041bee03307615`, status `PROPOSED_NOT_FROZEN`. Preserve that immutable directory and the current `PROPOSAL.json`; do not regenerate them in place.

The admission used the final tested registry compatibility repair and Editor checkpoint 03: 210 templates, 88 unchanged inputs. Root's receipt is `docs/implementation/niche-theme-programme/editor-post390-source-admission-checkpoint03.json`. Measurement migration 390 database qualification is a separate gate; this dry run did not qualify or apply it.

The following existing command executed once from `/Volumes/Projects/LetBuyy`:

```sh
node --import tsx docs/implementation/niche-theme-programme/release-v2/generate-release.ts --dry-run
```

The CLI read the canonical factories and persistence builder and wrote a content-addressed proposal directory. Its [actual stdout](./dry-run-checkpoint-03.stdout.json) reports nine artifacts, `sqlWritten=false` and `databaseTouched=false`. The before/after guard found no changes to the admitted 88 Editor or 47 generator inputs.

The admitted output must retain the nine stable catalogue identities, distinct v2 designs, complete canonical journey templates, unchanged default-v1 factory bytes, and the excluded frozen Threadline 382 capture. The new manifest must describe the actual emitted bytes, including the released discovery, factory and accessibility changes.

The existing deterministic generator checks ran once and passed 10/10:

```sh
node --import tsx --test docs/implementation/niche-theme-programme/release-v2/generate-release.test.ts
```

The additional disk reload check failed on the order of `approved_renderer_keys`, as recorded in the review receipt. No source correction or second proposal was made. Root must resolve that finding and accept the exact resulting manifest before any reserved 389 UP/DOWN emission. The current CLI implements no SQL writer. SQL qualification, catalogue promotion, installation and buyer acceptance retain their own gates and owners.
