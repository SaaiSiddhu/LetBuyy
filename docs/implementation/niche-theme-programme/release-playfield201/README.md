# Playfield2.0.1 distribution preparation — semantic blocker

The exact Root-admitted source still produces raw bundle SHA-256 `c8a1defdf97a0d8d9bf1060c86d5a1727d458747e56353db88f44b456a8bfc5d`. Distribution preparation found an additional source regression before writing an immutable capture or SQL artifact.

`first-party-theme-catalog.ts:77` calls `withNicheOrderPresentation(createPlayfieldThemeV201(configured))`. The new factory sets package version2.0.1; `niche-order-presentation.ts:10` returns immediately unless the version is exactly2.0.0. The new package therefore drops:

- `<!-- lb:niche-order-presentation:v1 -->` and the saved niche-facts disclosure from `sections.customer-order-detail.source`.
- Its `data-niche-order-presentation="1"` CSS from `layout.theme.source`.

The expected product-detail/version changes are present, but the complete semantic delta has **five paths instead of three**. The old2.0.0 artifact and all historical captures remain unchanged. This is an observed difference in the admitted raw factory output, not a serializer or migration effect. [Exact source hashes, markers and paths](semantic-blocker.json).

The initial [pure test result](proposal-tests-01.tap) preserves the fail-closed module-setup assertion: no named case executed, one file failure, zero skips. The historical20 builder outputs and nine immutable descriptor comparisons completed before that assertion. Those checks are conservation observations, not new installed/native qualification. The six proposed packaging tests have not reached a green run.

Prepared code is limited to the offline [release-specific generator](generate-playfield201.ts) and its [tests](generate-playfield201.test.ts). It reuses the existing canonical factory/persistence builder and389 JSON/dependency helpers. It has no SQL execution or migration-emission interface. The strict three-path semantic assertion remains intact; no source owner, global wrapper, historical generator, migration or moving hydration-islands file was edited. SQL rendering logic is still unqualified preparation, not an emitted/applied migration.

Root/source owner must decide the narrow shared-order-presentation preservation repair and refresh the admitted source hashes/raw bundle digest. A bounded repair could apply the existing presentation wrapper to the old-version base inside the new factory before setting version2.0.1; the source owner must review that placement. This task has not applied such a change or broadened the global version gate.

After that source checkpoint, the generator can produce a content-addressed Playfield-only descriptor, manifest, semantic diff and paired393 **draft** SQL under this directory. The [native qualification plan](NATIVE-TEST-PLAN.md) specifies the existing install/update/rollback paths and expected proof classes. No native test, database, browser, runtime, candidate copy or migration393 emission has run. Actual migration maximum remains392. Existing owner/Editor/Marketplace fixtures, sessions and tabs remain untouched.
