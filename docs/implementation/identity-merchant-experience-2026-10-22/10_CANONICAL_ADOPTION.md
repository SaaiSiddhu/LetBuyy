# Premium purple and canonical Merchant/Settings adoption

23 October 2026 · implementation tranche in the existing programme · HEAD `85aac99043d8dc10469e12cbb810609a3b6f1b0d` plus the pinned working changes.

The premium purple palette role mapping is now authorized for Merchant and Settings. Existing layouts, architecture and domain behavior remain preserved.

## Shared ownership and delivered contracts

| Concern | Canonical owner and change |
| --- | --- |
| Color roles | `packages/typescript/ui/src/tokens.ts`, existing admin light surface identity. Rail/header/save context `#1E1A2D`; primary action `#2C2642`, hover `#362C58`, pressed `#181524`; links `#523F97`; focus `#6C54C4`; light selection `#E7E3F7`. Status palettes remain semantic. Solid admin badges/banners/toasts use blue700, green700, amber800 and red700 so white text remains legible; the admin description-opacity role is 1 to avoid losing contrast through the legacy 90% treatment. |
| Work surfaces | Existing white Card on `#F6F7F9`, 16px outer radius, shared border/shadow. Card supports semantic section/div/article compositions. Grouped Section now delegates its single boundary to Card and shares the main Section heading, description, padding and columns. |
| Widgets | MetricCard delegates its surface to Card. Settings overview hero/phase cards, billing statistics, Settings forms and domain wizard/detail cards use shared owners. Availability counts remain availability, not business readiness. Broad dashboard glow blobs were removed. |
| Headers/actions | Existing PageHeader supports explicit index/record/editor/settings/workbench metadata and overflow composition. Actions use canonical Button, retaining loading labels and disabled links. Titles can wrap. Known route families carry explicit icon identity; Settings uses explicit navigation keys with a compatibility fallback. |
| Fields | Existing Input/Textarea/Select/Combobox owners remain. The essential input boundary is `#8F88A9`, after the white-on-white rendered boundary was measured as too weak. Select/Combobox use the input role. Labels/help/errors and existing responsive field grids remain. Missing product title gets an associated inline error and useful focus without dispatch. |
| Contextual save | Shared SaveBar has inverse plum context, white Save action, quiet Discard, inverse focus and accurate disabled/saving capabilities. Clean bars leave the DOM. SettingsPane forwards the supported contract, including save/discard safety and async callbacks. Domain owners retain acknowledgement and reconciliation authority. |
| Shell integration | Existing shell curves, sidebar arrangement, Settings navigation and scroll ownership remain. Header aliases resolve inside the admin token scope. Settings targets the Page marker rather than a removed nested main. The theme library's inner main was removed. |
| Theme work | Existing library grid/media/footer layouts remain. Current-theme and installed-theme boundaries use Card; theme library header uses PageHeader. Catalog artwork tiles remain task-specific interactive image compositions. Draft save and publication commands remain distinct; no publication protocol was replaced. |
| Interchange | The existing generator projects admin literal color roles and brandInk primitives from tokens.ts into DTCG. Dart exports the primitives without switching its application theme. No second authoring source. Compact theme toolbar fields preserve their existing adapter layout while consuming canonical input roles. |

## Consumer adoption and dispositions

“Verified” below means the representative composed routes and their shared contract were checked, not that every individual record, permission or provider state was certified.

| Family | Disposition | Verification / exception |
| --- | --- | --- |
| Dashboard and metrics | Adopted and verified | Shared MetricCard, section/cards and quieter setup artwork. Existing readiness logic unchanged. Desktop/tablet/mobile composition checks. |
| Products index/create/edit | Adopted and verified | Header/actions, cards, controls, validation, one active dirty-save surface, main-sidebar guard, saved record readback and discard. One clearly named draft fixture created; no publication. |
| Inventory and purchasing | Already compliant and verified, metadata adopted | Stock levels and purchase-orders representative pages at three viewport sizes; existing table/domain behavior retained. |
| Orders and customers | Already compliant and verified, metadata adopted | Order queue/customer list, empty-state and shared surface contracts at three sizes. No customer/order mutation. |
| Marketing and content | Already compliant and verified, metadata adopted | Coupons/pages represent the existing list composition at three sizes. Additional vertical pages inherit shared owners and explicit metadata; not individual-record E2E certification. |
| Analytics | Already compliant and verified, metadata adopted | Reporting period/widgets at three sizes. No invented deltas or change to aggregation definitions. |
| Settings overview | Adopted and verified | Six shared surfaces, h1/h2 hierarchy, natural task rows and availability labels. Three sizes. |
| General/business/domains | Adopted and verified | Shared grouped sections, original field grids and domain-task containers. General safe-field save/leave/readback/restore and discard at three sizes. Domain provider actions were not executed. |
| Billing/plan/users | Adopted and verified | Shared ordinary cards, section headings and billing stats; three sizes. No financial, subscription, invite or permission mutation. |
| Security/payments/checkout/shipping/tax/loyalty/notifications/policies | Already compliant and verified, shared role/header adoption | Existing Card/Section forms inherit the same palette/heading/save contract; three-size composed checks. Security factors and provider settings were not changed. |
| Apps and custom data | Intentional exception | App routes fail closed with FEATURE_APP_PLATFORM disabled under ART-22; no activation to satisfy visual acceptance. Custom data remains deferred. Advertised unavailable destinations remain UX-14/15 work. Source consumers retain shared owners; runtime availability is not claimed. |
| Themes library/editor | Adopted and verified within this tranche | Library header and primary boundaries converge while preview artwork/grid and editor commands retain their task-specific layout. The installed-theme Customize action now uses the shared primary Button; its undefined legacy text alias was removed. Tablet editor toolbar groups reflow into two rows without overlap; Publish consumes canonical primary roles while preserving its separate command. The production verification port is not an approved storefront framing ancestor; configured-origin browser acceptance separately verifies preview loading and mobile panel switching. An existing, isolated-tested migration (383) was applied only to the retained development database to restore its missing catalog function; the product row count stayed 20. Storefront header styling and an unresolved footer template literal visible inside the iframe remain separate renderer defects, not accepted theme parity. |
| Identity/console/mobile | Intentional scoped inheritance | Identity remains light-only; console retains its existing surface; Dart exports primitives only. Typechecks/token tests cover shared propagation; no auth journey or mobile application redesign. |

## Responsive and behavioral evidence

The retained local database/backend was used. Browser authentication followed normal identity login. Product and General Settings journeys exercised actual UI saves, guarded departures, Stay, acknowledgement-dependent save-and-leave, readback and discard. General's temporary tagline was restored to empty. The product fixture is `UX Premium Canonical Acceptance 2026-10-23`, Draft, price ₹1,290. It is intentionally retained rather than permanently deleted.

Actual CSS viewports were 1440×1000, 768×1024 and 390×844, DPR 1; the editor also uses 1920×1080. This is viewport emulation, not physical-device or mobile-keyboard certification. Mobile SaveBar controls measured 44px high. Settings bar stayed within its content column and all measured ordinary page families had zero document horizontal overflow. Raw route measurements are in [route-compositions.json](evidence/premium-canonical/route-compositions.json).

Screenshots are implemented UI, separate from the proposed mockup boards. The intermediate transparent-header capture is retained under an explicit defect filename, not passed as final evidence. The 1280px dirty capture is named for its actual viewport. The final screenshot review and source hashes are in the evidence manifest/results.

The latest [final composition measurements](evidence/premium-canonical/final-compositions.json) supersede the intermediate theme-library landmark/card measurements in the earlier route sweep. Theme library now has one main, a 24px workbench heading and 16px shared section/article boundaries at all three sizes. Tablet editor toolbar group rectangles do not overlap. Preview loading does not certify storefront typography, section parity or publication.

## Validation and limits

See the current results in [09_IMPLEMENTATION_RESULTS.md](09_IMPLEMENTATION_RESULTS.md) and retained logs in `evidence/premium-canonical/`. Unit/component tests establish disabled/busy, inline errors, acknowledgement ownership, conflicts, original-command replay, late replies, scoped recovery and related alternate states. Those synthetic transport tests are not claims of real-provider or browser fault-injection acceptance.

The full 46-finding programme remains open. In particular: product-create uncertain outcomes are not edit-equivalent reconciliation; whole-catalog (>100 records) behavior, unavailable Apps navigation, all role/provider states, actual keyboard occlusion, text-enlargement/reduced-motion device acceptance and remaining identity/AI/theme-publication matrices are not closed by this palette tranche. Development cold compilation and automatic memory restarts are separate from warm production route response. No consistent total latency speedup is asserted.
