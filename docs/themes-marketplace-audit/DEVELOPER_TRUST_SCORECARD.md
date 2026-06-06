# Theme Developer Trust Scorecard (Phase 13)

**Question:** would a professional theme developer/studio publish here? **Score: 1.4 / 10.** There is no developer *product* — only a JSON upload endpoint. A serious studio has no path to list, price, support, or get paid.

## Scoring

| Dimension | Weight | Score /10 | Evidence |
|---|---:|---:|---|
| Submission workflow | 15% | 2 | One hidden file input uploads raw JSON (`theme-upload-panel.tsx`) |
| Listing builder (assets/screens/pricing/category) | 12% | 0 | None in app |
| Documented approval / review bar | 12% | 0 | No states, feedback, or criteria surfaced; ops queue elsewhere (`api-client:1179-1182`) |
| Revenue model / payouts | 15% | 0 | None; price fields exist (`theme-engine:965-970`) with no author pricing UI |
| Analytics (views/installs/conversion/revenue) | 12% | 0 | None |
| Versioning / updates / rollback | 8% | 1 | Gateway has `releases`/`rollbackRelease`; not exposed to developers here |
| Preview / test before publish | 8% | 1 | `previewSession` exists but unwired (`api-client:1490`) |
| Support tooling / buyer comms | 6% | 0 | None; no reviews to reply to |
| Author identity / profile / reputation | 6% | 1 | `author_name` plain text; no profile/verification |
| Docs / SDK / dev experience | 6% | 1 | Docs/API/Changelog footer links `#` (`footer.tsx:11-16`) |
| Trust & safety (agreement, anti-piracy) | 0%* | 1 | JSON sanitization only; no dev agreement/anti-piracy |
| **Weighted total** | 100% | **1.4** | |

\*folded into other weights; listed for visibility.

## The developer journey, as it exists
1. Log in → open `/themes` → in the sidebar, the "Theme package upload" panel.
2. Select a `.json` bundle → `POST /themes/packages/upload` → toast "Uploaded {name}" or an inline error.
3. …that's it. No listing details, no pricing, no screenshots, no preview, no submitted/in-review/approved status, no analytics, no earnings.

## What a professional studio needs (and Shopify provides) — missing here
- **A listing builder:** name, descriptions, screenshots, demo store, presets, category/industry tags, pricing, license tiers.
- **A documented, multi-stage review** with written feedback (Shopify: 5 stages; LetBuyy: none surfaced).
- **A revenue share + payouts** (Shopify: 15% + 2.9% processing, scheduled payouts; LetBuyy: undefined).
- **Analytics:** listing views → install/purchase funnel, refunds, revenue over time.
- **Version management:** publish updates, see adoption, roll back (APIs exist; no developer UI).
- **Support tooling:** buyer questions, review replies (no reviews exist).
- **Identity & reputation:** verified author profile, portfolio, ratings.
- **Legal:** developer/distribution agreement, IP/anti-piracy protections, payout terms.

## Why a developer would walk today
- No way to set a price or get paid.
- No way to present the theme well (assets/demo/description).
- No transparency on whether/why a theme is accepted.
- No reach: the catalog is effectively empty, so there's no audience.
- No analytics to justify the build effort.

## Minimum viable developer program (to become listable-worthy)
1. **Partner onboarding** + developer agreement gate before upload.
2. **Listing builder** (assets, demo, pricing, license tiers, tags).
3. **Submission pipeline** with explicit states + written feedback + published acceptance criteria.
4. **Revenue share + payouts** with a clear earnings dashboard.
5. **Developer analytics** (funnel + revenue) and **version/rollback** UI.
6. **Author profiles** + verification; **review replies** once reviews exist.
7. **Safety:** malware/asset scanning, anti-piracy, rate-limited/authn'd upload route (`api/themes/route.ts:43-64`).
