# Trailmark fresh-factory validation gate

The replacement activity category grid never renders Core’s inherited `subtitle`. The fresh-factory list-collections instance now omits that one default. Its title/order/type/blocks remain intact. The factory’s existing captured-v2 early return remains unchanged; no runtime sanitizer strips arbitrary merchant data, and no schema, renderer, normalizer, index, registry, buyer section, asset or frozen visual artifact changed.

`probe.mjs` extracts the actual current registry builder and Editor helpers as source tooling, then runs the real theme persistence manifest, template validator, document identity index and compiler. `before.json`/`before.log` reproduce the defect: all 21 draft roundtrips fail the undeclared subtitle gate, including the raw registry config before normalization and JSON serialization. After the bounded fix, `roundtrip.json`/`after.log` show **21/21 clean**, zero raw/wire validation issues, zero lost stable section groups and no undefined baseline settings.

Trailmark’s full leaf suite passes **11/11**, including the new document JSON-wire/source-purity/captured-value regression. Theme package noEmit and the focused factory+test noEmit pass. The test fixture now supplies complete canonical nested block defaults and checks the actual JSDOM close function through a local structural guard. Exact two-file source bytes and their baseline diff are in `source-release.json`/`source.diff`.

This is source-only evidence. Coordinator migration 389 generation, installed Editor and published-store/browser acceptance remain separate gates. No DB, browser, build, provider, publication, push, merge or deployment was run. Previous visual artifacts remain historical evidence for their recorded source pins.
