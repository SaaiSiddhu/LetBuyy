# From mockup boards to working components

The images are discussion references. The owner subsequently required preserving the current LetBuyy interface, branding and layout. Ship demonstrated behavioral and accessibility fixes through the existing owners; do not implement generated page layouts or incidental colors/copy as requirements. This handoff complements WP-02/WP-03/WP-05 and the [canonical comparison](../08_CANONICAL_PATTERN_COMPARISON.md).

| Slice | Boards | Existing owner | Required implementation evidence |
| --- | --- | --- | --- |
| Shared visual roles | 01, 11 | `packages/typescript/ui/src/tokens.ts`, existing exporters and primitives | Composed contrast/focus/density, DS ratchet, generated consumer compatibility |
| Shell/navigation | 02–04, 14 | `AdminShell`, `MerchantNavigationLink`, `SettingsShell`, shared `AppNavigation`/`AppFrame` | Immediate pending feedback; slow/error/retry; rapid A→B→C; Back; same-link and modified-click behavior; preserved private prefetch policy |
| Header/form semantics | 05, 08, 16–17 | Shared `PageHeader`, `Page`, `Section`, layout, fields and existing `SettingsPane` | Action loading/disabled/name forwarding; long titles/reflow; semantic section headings; one main/working skip target |
| Work protection | 09, 16–17 | Existing shared `SaveBar`, product editor and settings save owners | Clean controls absent from focus/AX; dirty departure blocked; safe explicit discard; acknowledged save before leave; reload protection; pending/unknown/conflict recovery |
| Collection workspace | 06–07, 12 | Existing `Table`, request helpers, Products BFF/domain and selection command flow | Match beyond100; sort/filter/page/return agreement; exact population; partial/unknown command outcomes; meaningful empty/error/denied states |
| Overlay and feedback | 10–12 | Existing dialogs/drawers/popovers/controls/toast/banner owners | Nested focus/restore; keyboard and safe area; truthful Undo; no focused controls obscured by promotion/toast/bar |
| Widgets and assistance | 13–14, 20 | Existing `MetricCard`, dashboard authority, capability and proposal flows | Defined metric populations and unknown states; permission/capability consistency; manual apply-to-draft; unavailable backend keeps input |
| Identity | 15 | Existing `apps/platform/identity` sole issuer and approved challenge flow | Return/context/membership and real MFA/error/recovery branches; D-AUTH-LIGHT; no new auth system |
| Product content | 16 | Existing canonical product contracts/editor/rendering | Bounded rich description safety/round-trip; media partial failure; explicit stock/status; no arbitrary executable HTML |
| Domains | 17 | Current Settings domains client/overview/wizard/detail | Owned addressable record/reload/Back; independent DNS/SSL/primary/visibility; copy/check/retry and truthful provider facts |
| Theme lifecycle/editor | 18–19 | Canonical theme library/draft/release/schema/preview clients | Wide/narrow layout; undo/redo; saved-version publish; preview scope/origin/version; security/render parity gates preserved |

## Storybook coverage

Extend the existing `packages/typescript/ui` Storybook and its component/merchant/sidebar stories. Shared-package stories may only consume shared public exports; they must not import merchant application files. Presentational recipes can demonstrate their callbacks and contract states. Route authorization, real save outcomes, history and domain commands require merchant integration/browser tests in the application boundary.

Use 1440, 768 and 390 for routine responsive stories; also verify 1920 for the wide editor, 320 reflow, enlarged text, keyboard, reduced motion, long/localized labels and the on-screen keyboard. Viewport labels on a generated image are design references, not browser verification.

Create explicit stories for primary states rather than only a polished happy path: header busy action; labeled error; clean/dirty/saving SaveBar; pending navigation/static reduced-motion cue; shaped loading; no match/unavailable/denied; nested picker; mobile action collision; partial bulk result; unknown metric; draft versus release/preview. Unknown-save recovery stays a domain-driven contract, not a fake UI-only timeout.

## Critical guard behavior

1. Capture a navigation request only when an actual same-tab departure would occur. Preserve modified clicks, download/external semantics and nested control events. Retain the initiating element for focus restoration.
2. If clean, navigate normally and acknowledge pending work. If dirty, defer departure and show the existing accessible dialog composition. Do not set a destination as current before commit.
3. Stay retains every field and restores useful focus. Explicit discard reconciles local draft ownership and then leaves. Save and leave resolves the original command successfully before departure; validation, failure, conflict and unknown outcome retain the form.
4. While a mutation is uncertain, Check status/retry means the original stable command. Never turn an ambiguous result into a fresh mutation or destructive discard action.
5. Browser reload/unload uses the supported browser prompt and scoped safe recovery. Back/forward and imperative app navigation need real acceptance, not only anchor interception. Do not patch global fetch, weaken auth checks or rewrite unrelated browser history to make a demonstration pass.
6. Pending indicators finish or transition to a useful error state according to the owning route. Separate data and iframe readiness. No fixed artificial blank duration or invented progress percentage.

## Verification and closure

Run relevant tests for the actual changes. Use the retained local database/backend and synthetic owned fixture; never reset/reseed the checkout to obtain a green result. Keep cleanup-bearing repository gates out of the running checkout. Source tests, browser acceptance, provider acceptance and deployment remain distinct statuses.

Close UX-02/03/40/43/44/45/46 only with matching source revision and observed pass conditions. Update the existing 46-finding register and 12-work-package plan rather than creating a second completion registry. Roll back presentation through ordinary Git changes; preserve canonical commands/data and release rollback.
