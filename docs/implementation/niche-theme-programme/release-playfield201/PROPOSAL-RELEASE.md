# Playfield2.0.1 immutable capture and proposed393 pair

**Ready for Root proposal review; not database-qualified or installed.** The current source gate is Root's repaired-order interim admission `c8420182…`; the original c8/73 receipt remains historical and non-promotable. Final combined runtime qualification after the separately owned cart patch is still pending and is not implied by this capture.

Content-addressed proposal: [`6bd27e70ca6f…`](proposals/6bd27e70ca6f0a2169a15c3fe850d07bebb948a276002a483f730ac1f690885c/manifest.json).

| Artifact | SHA-256 |
| --- | --- |
| Manifest identity | `6bd27e70ca6f0a2169a15c3fe850d07bebb948a276002a483f730ac1f690885c` |
| Manifest file | `3908686ae847a493df721538bdc47afd69f1e9fbe72dfd8edda710621b130928` |
| Playfield2.0.1 descriptor | `68bd7e7031f4e330d09fa7a7643c4159266c7ef04885917fe40320e4f9810c23` |
| UP393 draft | `d4c0a6cc909709b07702cc2bc730bb1ff9f7f89bc8ad1ade486afa74f63da783` |
| DOWN393 draft | `75a2288863c1a1b5e1082e5cba5b1e76db1c9a95c79fb505955288b68e5a35e8` |

The stable catalog identity remains `letbuyy-bloom` / `7b669c70-0000-4000-8000-000000000008`; the new version is2.0.1, sequence3. Fresh raw factory digest is `91dd7e6239aefa6a341dfc04ba5d8cc79d8136f1c4d46b48fda66799ecbbe9d7`. Canonical JSON bundle digest is `63fdb0ebefb7312d0a227f64aa8b53a239ef3430aab9c12946909e4c7f08ffeb`; the different digests identify serialization order, with semantic equality independently checked.

The only bundle differences from the accepted2.0.0 descriptor are `/package/version`, `/package/version_number` and `/sections/product-detail/source`. The complete prior layout and customer-order-detail source, including saved niche facts and CSS, are exact. All20 default/2.0.0 builder outputs, nine previous descriptor files and616 protected historical source/artifact/migration inputs remain unchanged. All61 current stable source pins match. The moving hydration/cart and variant-URL files are absent from the capture closure.

## Distribution semantics proposed

The release-specific offline generator reuses the canonical first-party factory, Liquid bundle validation/persistence builder and389 canonical JSON/dependency helpers. It does not invoke the historical generator CLI or rewrite382/389. Its only CLI mode writes immutable content-addressed proposal files under this release directory; there is no database connection or active migration-emission interface.

UP validates the one global Playfield identity, existing canonical package, exact prior2.0.0 catalog and immutable captures. It appends only a new package-version/schema/renderer triple and moves Playfield's managed catalog fields. Replay verifies exact state and does not rewrite it. Existing merchant instances, drafts, releases, other theme catalog rows and earlier captures are not SQL mutation targets. A catalog pointer change does not itself upgrade an installation.

DOWN validates the current capture/catalog/checkpoint, then restores the prior managed catalog fields and full config. It retains the new immutable captures and every installed/draft/release history row. It refuses stale or corrupted managed state. As in389, `updated_at` follows the migration update convention and legitimate installation statistics are retained. Exact restoration here means distribution-managed metadata/config, **not full-row timestamp identity**; native tests must independently verify these statistics/timestamp effects.

Both draft SQL payloads were reparsed independently and match the exact new descriptor and historical prior descriptor. SQL execution, actual PostgreSQL admission/refusal behavior and transaction/data conservation remain **NOT_RUN**. The native gate is required before migration393 can enter the database source scan.

## Checks and handoff

Six strict proposal tests pass with zero failures/skips. They check stable identity/wire persistence, historical preservation, tamper refusal, SQL mutation targets/guards and content-addressed writer replay/refusal. Scoped generator/test TypeScript no-emit exits0. The initial standalone config lacked Node type discovery; that failure is preserved, and the config now explicitly uses existing Commerce-declared Node typings without installing a dependency. Repeated six-test runs are not summed as unique coverage.

The [proposal release receipt](proposal-release.json) and [independent integrity review](proposal-integrity-review.json) bind artifacts, source/test/config hashes, checks and preserved earlier evidence. [Native qualification plan](NATIVE393-QUALIFICATION-PLAN.md) retains eight planned child phases plus parent, using the existing owned runner/helpers and real install/update/rollback routes. Native test source still needs preparation, review and an exact admission before the later one-run allocation; no native test source or run is claimed here.

Actual migration-source maximum remains392; no393 UP or DOWN file was emitted there. No current fixture, hosted database, application, browser, owner tab or login was touched. PF05 installed/visual acceptance and the final post-cart runtime gate remain open. Root's next step is review of this immutable proposal, then native-test source/admission and the separately allocated default-LATEST392 qualification lane.
