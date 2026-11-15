# Merchant media recovery — qualified local result

Current source28 is `85d02ae353b98bb27f6746697499258425174b6c47f854f063386134c3b1e60a` (8,476 inputs). The [structured readback](verification-2026-11-05/media-recovery-v28-local-readback.json) records exact gates and limits.

Three failures were reproduced against the mounted Gateway and owned Postgres before repair: identical upload retries conflicted when multipart boundaries changed; changed bytes could receive the original success under a fixed envelope; revoked owners could replay a media mutation after fresh reads were denied. Receipts now bind actual file SHA256 and metadata, with current authority checked before replay. Public MIME rules and 10/100/50 MB limits remain shared with the original storage route.

Mobile keeps original upload/create keys and stages through the existing encrypted SecurityCommandStore. A lost app upload acknowledgement can recover the completed server receipt and verify the stored object without resending bytes. A lost library-create acknowledgement resumes its original payload/key without the file. Unfinished server receipts remain held for review. Changed context cannot dispatch follow-on creation. No file bytes, file paths, inline data URLs or credentials enter the recovery record.

The visible recovery notice scrolls with the library, presents an explicit receipt/confirmation action, and blocks a new upload until acceptance is resolved. Page/search, stale-dialog retirement, safe library removal and video lifetime tests remain green.

Validation: 1,640 Flutter tests;12 owned Gateway/compiled Workerd tests;2,087 Gateway tests;23 shared-type tests;16 lane guards;four actual-font light/dark320dp/2.4text recovery renders;114 governance validators. App and Dart analysis report0issues. Dart SDK has135passing tests and6existing opt-in integration skips. Counts overlap and are not feature totals. Source/index equality and empty owned-container/network/volume cleanup are recorded. Current Android debug APK compiles and its new recovery markers are verified; no install/native journey is claimed.

Still open: strict canonical KYC public DTOs; actual native encrypted process-death/file selection/playback; complete web/mobile Media Library readback; safe resolution of storage acceptance before failed server receipt completion; historical long startup-wait root cause; remaining feature journeys. All119applicable entries remain open;120/121excluded,122paused,51frozen. No full122 or release certification.
