# Nine-theme v2 release proposal — reserved migration 389

The offline generator produces the canonical nine explicit v2 packages and persistence payloads. **This is a proposed freeze, not a promoted release.** Current manifest: `1686be9e72bd721b6bcb553951f6fd0cf26bcf7e91af49d714041bee03307615`. [PROPOSAL.json](PROPOSAL.json) points to the nine content-addressed artifact files and their exact hashes. Ten tests and the focused no-emit check pass.

The generator reads Threadline's existing migration generator as its document/promotion precedent, calls the existing `createFirstPartyCatalogBundle(slug, {designVersion:'2.0.0'})` and `buildLiquidThemePackagePersistencePayload`, and follows the current schema-registry/install contracts. There is no new catalog, package table, install API, runtime or picker protocol. The approved opt-in order-snapshot presentation is required in each package; every default-v1 journey template must survive.

| Name | Stable slug | Existing catalog UUID | Approved category |
|---|---|---|---|
| Dewdrop | `letbuyy-aura` | `7b669c70-0000-4000-8000-000000000003` | beauty |
| Playfield | `letbuyy-bloom` | `7b669c70-0000-4000-8000-000000000008` | toys |
| Habitat | `letbuyy-craft` | `7b669c70-0000-4000-8000-000000000004` | furniture |
| Marginalia | `letbuyy-dawn` | `7b669c70-0000-4000-8000-000000000007` | books |
| Circuit | `letbuyy-forge` | `7b669c70-0000-4000-8000-000000000001` | electronics |
| MadeYours | `letbuyy-nova` | `7b669c70-0000-4000-8000-000000000009` | personalized |
| Pantry | `letbuyy-refresh` | `7b669c70-0000-4000-8000-000000000005` | food |
| Trailmark | `letbuyy-ride` | `7b669c70-0000-4000-8000-000000000006` | sports |
| Kindred | `letbuyy-summit` | `7b669c70-0000-4000-8000-000000000010` | gifts |

## Immutable artifacts and conflicts

`generate-release.ts --dry-run` writes only JSON under `proposals/<manifest-sha256>/`. Repeating an equal proposal reuses identical files; differing bytes at an existing path fail. Existing proposed checkpoints are retained. Canonical sorted JSON gives deterministic file/payload hashes. The nine identities are checked against frozen migration 372 and the current registry; the SQL resolves and retains any existing canonical `theme_packages.id`, and a new version gets the schema's normal UUID once. No existing package/version ID is replaced.

Threadline (`letbuyy-sense`, catalog UUID ending `002`) is excluded from the promotion. Its exact migration-382 bundle hash remains **`61082be647eadae9b6e42002be241a82ba6c3627427568f6e64e2cf961c3742e`**. The frozen SQL payload and file hashes are pinned independently; the generator never regenerates 372/382, changes a default-v1 factory or rewrites old captures.

An existing same-version version, package manifest (including both captured aliases), schema manifest or renderer manifest must equal the intended canonical content or fail. The SQL inserts with `ON CONFLICT ... DO NOTHING` followed by exact content checks; it never uses an update to replace immutable version/manifests. Revoked/deleted captures stay unavailable. Offline capture fixtures exercise rejection, but **no actual database captures were inspected** in this allocation. PostgreSQL JSONB content equality is paired with canonical deterministic file hashes; JSON object key ordering is not a new persistence protocol.

## Proposed UP and DOWN

`renderPromotionPair(proposal)` returns the paired SQL strings for tests/review only. No CLI SQL writer exists and **no 389 file has been emitted into the migration or rollback scan**.

UP locks the nine existing public catalog rows, checks stable identities and the expected prior catalog version (currently the default-v1 version), resolves the same canonical package UUID, appends the nine v2 captures and matching manifests, and verifies exact same-version equality before moving catalog version/doc/schema/renderer pointers plus the approved names/categories. It snapshots the exact prior affected catalog fields/config in the existing `themes.config`, following Threadline's rollback pattern. It preserves prices, descriptions, thumbnails, visibility, installed instances, drafts and merchant releases. An unexpected prior catalog version or conflicting same-version capture aborts the transaction.

DOWN restores those prior catalog pointers/names/categories/config under a promotion marker/version guard. It deletes no captured package/version, schema/renderer manifest or installed instance. Retained v2 captures can be reused only when their content is identical. Actual PostgreSQL up/down/up, concurrency and live lifecycle acceptance have not run; the paired-generation tests prove emitted intent/guards, not database execution.

## Exact freeze dependencies and next step

[freeze-dependencies.json](freeze-dependencies.json) names all **47 exact source/tool/lock hashes**. These cover all nine factory/discovery/style modules, the existing registry/Core factory, bundle/schema/document/persistence helpers, experience composition/fonts/settings, the opt-in order presentation, Threadline's imported source dependencies, this generator, the theme-engine manifest and lockfile. Frozen 372/382 inputs and all default factory output hashes are separately pinned.

The coordinator must accept this exact manifest after all nine factory owners have released their final bytes. Any source/artifact change requires a new proposed hash. Only after that explicit freeze acceptance may the paired 389 files be written. Shared mapper/controller/renderer behavior, asset delivery, merchant persistence, order snapshots, live install/editor/publish/rollback and programme build/security/performance acceptance remain their existing owners' gates; generating package bytes does not certify them.

```sh
node --import tsx docs/implementation/niche-theme-programme/release-v2/generate-release.ts --dry-run
node --import tsx --test docs/implementation/niche-theme-programme/release-v2/generate-release.test.ts
node node_modules/typescript/bin/tsc -p docs/implementation/niche-theme-programme/release-v2/tsconfig.json
```

Evidence: [validation.json](validation.json), [tests.tap](tests.tap), [STATUS.json](STATUS.json). No database, browser, server, full build, deployment or SQL application was started.
