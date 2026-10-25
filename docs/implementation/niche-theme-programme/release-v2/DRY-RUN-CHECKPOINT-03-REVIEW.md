# Fresh 389 proposal: review hold

Exactly one authorized CLI dry run generated candidate **`0cf62a07290706e8dd8a3a0d24928cdd10bce0f7468ed8c8a94ffe3219f5639d`**. Its [immutable manifest](./proposals/0cf62a07290706e8dd8a3a0d24928cdd10bce0f7468ed8c8a94ffe3219f5639d/manifest.json) remains `PROPOSED_NOT_FROZEN`. No 389 SQL was emitted; no database, build, browser or deployment was started.

The existing generator suite passed **10/10**, but an additional check of the actual emitted JSON found that **the reloaded proposal fails `assertProposalIntegrity`**. This candidate must not be described as fully passing disk reload validation.

## Verified results

- Nine distinct v2 artifacts retain their stable catalogue UUIDs, preset aliases and package slugs. Their canonical persistence schemas/defaults exactly match the current raw factory outputs.
- All nine raw factory bundle hashes match Editor checkpoint 03. Editor uses SHA-256 of `JSON.stringify(bundle)`; the distribution manifest uses SHA-256 of sorted canonical JSON. The verification receipt records both conventions explicitly and proves semantic equality of the stored bundles.
- All 88 Editor inputs and 47 generator dependencies remained byte-identical before/after generation and tests. The admission checkpoint/report/probe and generator test source also remained unchanged.
- All 30 files belonging to the three earlier proposal directories remain unchanged, including held `1686…`. The existing `PROPOSAL.json` still points to that older held candidate.
- Default-v1 factory hashes, frozen catalogue 372 and Threadline's pinned `61082be647eadae9b6e42002be241a82ba6c3627427568f6e64e2cf961c3742e` capture remain exact.
- Relative to held `1686…`, 18 source dependencies changed, with no added/removed dependency paths. The machine receipt lists each old/new hash and every artifact hash difference.

## Actual disk reload finding

`writeDryRun` writes sorted canonical JSON. Loading that JSON changes the insertion order of keys in `bundle.sections`. The canonical persistence builder derives `rendererManifest.approved_renderer_keys` using `Object.keys(bundle.sections)`, so rebuilding persistence from the loaded bundle yields the same approved key membership in a different array order.

This affects all nine artifacts. The only persistence difference is the order of `approved_renderer_keys`; bundle semantics, schemas, defaults, approved key membership, stored file hashes and payload hashes match. Nevertheless, the existing integrity function compares those arrays exactly, so it rejects a proposal reconstructed from its emitted files. The existing ten tests exercise in-memory proposals and do not detect that wire round-trip mismatch.

The failing check is equivalent to:

```ts
const stored = JSON.parse(readFileSync(manifestPath, 'utf8'));
const { manifestSha256, ...manifest } = stored;
const artifacts = manifest.artifacts.map(row =>
  JSON.parse(readFileSync(join(proposalDirectory, row.file), 'utf8')));
assertProposalIntegrity({ manifest, manifestSha256, artifacts }); // fails
```

No source correction, relaxed comparison, artifact overwrite or second generation was performed. Root needs to allocate a bounded generator correction with an actual serialized-artifact regression check, or approve and qualify the precise consumption path before accepting a release. Preserve this candidate as evidence in either case.

## Evidence and remaining gates

[Full verification and diff](./dry-run-checkpoint-03-verification.json), [pre-generation guard](./dry-run-checkpoint-03-source-before.json), [CLI stdout](./dry-run-checkpoint-03.stdout.json), and [10-test TAP output](./dry-run-checkpoint-03.tests.tap) contain the exact hashes and outcomes.

Actual database package UUIDs and existing immutable captures were not observed. The generator preserves stable catalogue identities and resolves package identity in its proposed SQL with ambiguity/status/conflict guards; that code was not applied or database-qualified here. Repaired 387 catalogue qualification, 390 native SQL qualification, root acceptance, actual capture verification and installed Editor/buyer lifecycle acceptance remain separate gates.

The independently prepared [Marginalia lifecycle plan](../../niche-themes-2026-10-23/marginalia/INSTALLED-LIFECYCLE-PLAN.md) has seven passing canonical schema checks and sixteen actual cases marked NOT_RUN. It creates no alternate fixture harness or runtime identities.
