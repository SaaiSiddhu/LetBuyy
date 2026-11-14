> **3 November follow-up:** [Latest verified repairs, source bundle and remaining work](FOLLOW-UP-FIXES-AND-REMAINING-WORK.md) supersede earlier same-day build/count/access statements below. No deployment occurred.

# Human and device review packet

## Native-language review

`evidence/native-language-review.csv` contains **194 aligned English/Hindi/Tamil passages** from four priority guides: first-store setup, GST, UPI versus COD and shipping. Every row has an exact page, language, passage index, source hash, source/localized text, consequential-wording flag and pending review status. Translation source-lock checks passed; native fluency has not been certified.

Review meaning, task sequence, plan/provider caveats, GST/invoice/return terms, transliteration and intentional technical names. Record the actual reviewer, role, date, current source hash, exact comment, resolution and remaining concern. Do not sign for a reviewer or refresh dates without review. The packet prioritizes four guides; it does not pretend all 105 article URLs received human review.

## Merchant legal/tax review

Review the current merchant documents in `src/lib/legal/content/{agreements,money,data,trust}.ts` and corrected GST/invoicing/payment guides. Check applicability, subscription/provider/tax distinctions, actual supplier facts and support/complaint commitments against dated official sources and approved operations. Source presence is not qualified legal or CA approval. Consumer-app privacy/data-practice content is explicitly deferred and excluded from this review.

## Executed browser coverage

Twelve isolated Chromium create-page comparisons were executed before the owner's later browser preference: three locales × two widths × two themes, including keyboard entry, empty-submit prevention, Back recovery and exact visual geometry. The actual current Chrome profile subsequently confirmed the English flow. Safari was attempted but no page was verified; the owner then requested current Chrome only. No physical phone, Safari/Firefox or VoiceOver/TalkBack certification is claimed.

| Case | Pending real-world task | Acceptance |
|---|---|---|
| DEV01 | Android Chrome/iOS Safari: home → pricing → signup entry | Correct plan and locale, touch/back works, no overflow; no unauthorized account creation. |
| DEV02 | Resource search → guide → tabs and contents | Visible content, correct focus and announced controls. |
| DEV03 | Desktop Safari/Firefox menu, Escape and comparison controls | Focus stays visible; opening/closing and reduced motion work. |
| DEV04 | 200%/400% zoom and text reflow | Ordinary text and primary actions remain reachable without forced horizontal page panning. |
| DEV05 | VoiceOver/TalkBack on create/pricing/support | Logical landmarks/headings, labelled fields/errors and focus recovery. |
| DEV06 | Target-phone performance | Record actual device/browser/build/network conditions and all results; distinguish physical from emulated measurements. |

Use owned synthetic fixtures for consequential actions. Do not create real accounts, send messages or make payments under an accessibility test. Physical-device availability and real reviewer assignments remain open inputs.
