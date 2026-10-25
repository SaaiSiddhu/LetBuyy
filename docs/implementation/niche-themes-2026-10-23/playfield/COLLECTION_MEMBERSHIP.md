# Playfield sample collection membership

The owned demo file exports **`PLAYFIELD_DEMO_COLLECTION_PRODUCT_IDS: Record<string, string[]>`**. It uses only existing synthetic sample catalog IDs; it creates no product, installation seed or API.

| Collection | Handle | Membership in shelf order | Count |
|---|---|---|---|
| `7b669c70-8200-4000-8000-000000000001` — Art & making | `art-making` | Pattern Studio (`7b669c70-8000-4000-8000-000000000001`), Paper Play (`…0002`), Make a Story (`…0004`) | 3 |
| `7b669c70-8200-4000-8000-000000000002` — Building | `building` | Arch Paths (`7b669c70-8000-4000-8000-000000000003`) | 1 |

The actual demo collection rows declare these handles and matching `product_count` values. Demo category navigation and bento links now target `/collections/art-making` and `/collections/building`. Both named-handle and existing-ID routes resolve the same membership through the actual common pure resolver. No existing public sample collection is intentionally empty; the tests construct an explicit empty membership case without adding a new sample collection.

Four tests in `playfield-collection-membership.test.ts` pass: positive membership/order/counts and route scoping, intentionally empty `[]`, foreign product membership and missing membership for an otherwise valid collection. Empty stays empty; foreign/missing/unknown stays unavailable and never substitutes all products. Focused demo/harness TypeScript checking passes.

Marketplace owns importing/cloning this map into the common dispatcher. The tests attach a cloned map to a bounded existing sample context to exercise its pure lookup before that integration. They do not certify a trusted route, HTTP request or category page end to end. No common dispatcher/helper was edited.

These link-only changes were made after the archived static browser review. That review's input HTML and PNG hashes are retained; current category navigation and shared dispatcher acceptance remain separate. M1 artifacts are unchanged.

```sh
node --import tsx --test docs/implementation/niche-themes-2026-10-23/playfield/playfield-collection-membership.test.ts
```
