# Merchant buyer inventory and recommendations — source 113

**Bounded local acceptance passed. Full 122-feature acceptance remains open.**

Source SHA-256: `ad36cabb72ba7d40cb240194e1f1a749f7e97dba355d0cff6c9554c7a3b54f32` (8,536 inputs). No hosted activation, push, merge or release was performed.

Public detail and discovery now use the same canonical free inventory as Merchant. The existing buyer mapper carries that quantity through Liquid, purchase controls and Offer metadata while preserving the editable base quantity. A product with base quantity 0 and live variants 3 + 4 is available. Confirmed zero remains sold out. Missing inventory remains unknown, omits Offer availability and cannot submit cart or checkout changes, including through stale enabled controls.

The existing render adapter applies these controls before JavaScript without changing frozen theme packages. The product page also excludes its current product from recommendations, preserving the other confirmed records, their order and their availability. Migration 440 and its guarded rollback preserve the reader identity, grants and complete predecessor catalog profile, and require 440 to unwind before 439.

| Validation | Result and scope |
| --- | --- |
| Normal Commerce test command | 2,217 passed, 0 failed or skipped; new stock tests are registered |
| Commerce types | Passed |
| Current inventory, retirement and rollback | 25 passed; run `d85118ec179f` |
| Governance | 114 passed, 1 not applicable; original source and index preserved |
| Commerce mutation regression | 134 passed, including 92 atomic recovery cases with two owned prepared-transaction slots; run `ffc433894c46`; unchanged consumed inputs |
| Gateway public security and types | 42 security checks and types passed on checked unchanged inputs |
| Shared theme regression | 2,222 passed on 363 unchanged package inputs, including frozen fingerprints |
| Authored 2.1.0 theme renders | 20 passed on source 113; separate from the ten Core preset browser checks |

The full freshly compiled Accounts → Merchant → Core Liquid → buyer journey passed in run `2e189895cd31`. It exercised normal signup and recovery, one-time verification, the saved 14-day trial, image and variant creation, manual and smart collections, scheduled search, private preview, publication, ten Core presets, local TLS, COD orders, repeat shopping, buyer profile/address/privacy/access recovery, stock states and no-self-recommendation assertions. Three canonical orders were created; the first totaled 26,900 minor units. Providers, email and challenges were explicit local fixtures.

The complete 36-sample public-read lab profile is retained at `verification-2026-11-05/buyer-inventory113-accepted-artifacts/public-read-profile.json`, SHA-256 `485732a0b9a3ee974f86ef909bb15a4786ffa686d1003a849597f9e94f9be379`. Capability and credential query parameters are redacted. These are local lab measurements, not physical-device or field metrics. Zero and unknown screenshots are retained in the same directory. The full readback is `verification-2026-11-05/compiled-buyer113b-readback.json`.

All owned runs are terminal, cleanup is empty and source readback matches. Docker recovered without exercising the approved force kill. Existing source, index, volumes, backups and device data were preserved. Host 9002 was untouched. Earlier failures and corrected fixture controls remain available.

The prior Flutter 1,789-pass result, zero-issue analysis and Android 138/iOS 139 functional journeys retain their original scope: 884 mobile/Dart inputs are byte-identical. No fresh source-113 native run or generic iOS accessibility acceptance is claimed.

Continue the complete product/media/variant/collection and current-role/store-switch/revocation/concurrency matrices, generic iOS accessibility, and every remaining Accounts/store/theme/domain/order/shipping/tax/money/growth/settings criterion. Existing frozen and outside-Merchant entries retain their scope. Zero whole features have been accepted; no hosted, real-provider, physical-device, signed-release, production or full-122 certification is asserted. Machine detail is in `BUYER_INVENTORY_LOCAL_V113_QUALIFICATION.json`.
