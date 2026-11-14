# Human and device acceptance

The current source retains **202 pending Hindi/Tamil review rows** from the November3 pack. [The exact review CSV](evidence/native-language-review.csv) includes source/localized passages and source hashes. Automated translation/hash/sequence tests pass; they are not native editorial sign-off. Eight newer corrected passages are already included in the 202, not an additional eight.

| Review | Reviewable material | Who/what is missing | Acceptance evidence |
|---|---|---|---|
| Hindi/Tamil |202 passages, with emphasis on payment/tax/task wording | Native editors | Reviewer,date,current source hash,comments,resolution and actual sign-off. |
| Legal/tax | Existing merchant legal documents and GST/invoice/payment guides; public sources retained | Appropriate qualified reviewer | Scoped review of the actual current version; no model-generated professional approval. |
| Physical devices | Pricing → signup,guide/contents,navigation,forms,Back/refresh,billing recovery | Named Android/iPhone devices and testers | Device/OS/browser/build/network plus actual positive/error-path receipts. |
| Native Safari/Firefox | Same key flows and animation/layout cases | Actual browser execution | Browser/version/build and observed results; Chrome emulation is separate. |
| Assistive technology | Keyboard/focus,menus,dialog,guide controls,form status/errors | Real screen-reader/device test | Named technology,actual task results and fixes. |
| Article timestamps | Optional exact publication/modification instants | Actual editorial records,if they exist | Truthful visible/markup consistency; do not invent midnight/timezone. |

Current Chrome desktop/mobile emulation is now verified; the former Chrome-access prerequisite is closed. CI Chromium regression is also fresh. These do not complete physical-device, native-language, legal or assistive-technology review. No new reviewer, credential or business fact was invented.

Buyer-app privacy/data-practice/support publication stays explicitly deferred. The app stays active; no retirement or Firebase production change was performed. [Previous detailed cases](../../letbuyy-seo-release-readiness-2026-11-03/HUMAN-AND-DEVICE-REVIEW-PACK.md).
