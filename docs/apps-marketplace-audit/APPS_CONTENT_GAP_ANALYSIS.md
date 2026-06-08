# Apps Content Gap Analysis (Phase 6)

**Parent:** [`../LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md`](../LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md) · **Date:** 2026-06-07

Audit of every user-facing string, empty/error state, and onboarding copy in the marketplace front-end. The headline finding: **content *integrity* is good (no fabricated apps, reviews, or metrics), but content *theater* is pervasive** — placeholder pages, "contract-gated"/"pending approval" hedges, and copy that leaks internal governance state to end users.

## 1. Integrity — what's honest (credit)

- **No fabricated data.** Cards/detail render whatever the API returns and default numbers to 0; ratings/histograms derive from real reviews; dashboard metrics come from the live `partnerDashboard()` (`AppCard.tsx:31-42`, `apps/[slug]/page.tsx:464-506`, `developers/dashboard/page.tsx:107-141`). No mock catalog, no seeded reviews, no fake install counts.
- **Honest empty states.** Home: *"The marketplace shell is ready, but the app catalog API returned no rows in this environment."* (`page.tsx:274`). App detail: *"No reviews yet."* (`apps/[slug]/page.tsx:503`).
- **Honest fallbacks.** Developer name → "LetBuyy Partner" (`marketplace-display.ts:22`); tagline → "No app summary has been provided yet." (`AppCard.tsx:94`); API key → "Key rotated. Secret is not returned by this backend." (`ApiKeyPanel.tsx:40`).

No `lorem ipsum`, `TODO`/`FIXME`, `coming soon`, or `mock`/`stub` literals were found in front-end source.

## 2. Theater inventory (placeholder / "pending" / contract-gated copy)

Each is real shipped copy with a citation:

| Surface | Copy (verbatim) | File:line | Problem |
|---|---|---|---|
| Pricing display | "Pricing unavailable" / "Usage billing is not supported yet" | `marketplace-display.ts:38` | A pricing model the catalog can hold but the product can't bill |
| i18n string | "Final policy text requires human approval." | `i18n/messages.ts:8` | Internal governance state surfaced as product copy |
| Review-requirements | "Final policy text requires human approval. This page lists the product-owned checks…" | `review-requirements/page.tsx:18` | Whole page is a placeholder |
| Review-requirements banner | `SKIPPED (HUMAN-APPROVAL)` / "Final review rubric, SLA, and legal policy wording must be supplied by LetBuyy governance." | `review-requirements/page.tsx:35` | Ledger status string leaked to users |
| Submit app | "Usage-based pricing is unavailable until the billing contract supports it." | `apps/new/page.tsx:293` | Hedge |
| Submit app | "Annual billing persistence is tracked in the pricing contract." | `apps/new/page.tsx:322` | Internal contract reference in user copy |
| Submit app + Register | "Final marketplace commission is pending business approval…" | `apps/new/page.tsx:307`, `register/page.tsx:200` | Core economics unknown to developer |
| Developer landing | "Earn Revenue … Usage billing is pending platform support." | `developers/page.tsx:14` | Hedge on the headline benefit |
| Developer landing | "Extension APIs … as platform capabilities become available in-product." | `developers/page.tsx:17` | Hedge |
| Submit app | distribution option "Private app install link (contract-gated)" | `apps/new/page.tsx:358` | "contract-gated" shown as a selectable option label |
| Dashboard | "Edit unavailable" + "Editing and new versions are gated on the app-update contract." | `developers/dashboard/page.tsx:309,312` | The update gap, surfaced as copy |
| Partner directory | "Partner directory data is not exposed by the platform yet…" + `Flag: NEXT_PUBLIC_MP_PARTNER_DIRECTORY default off.` | `partners/page.tsx:19,26` | **Prints the env-var name to users** |
| Developer profile | "Public developer profiles require a gateway endpoint…" + `Flag: NEXT_PUBLIC_MP_DEVELOPER_PROFILES default off` | `developers/[slug]/page.tsx:28,38` | **Prints the env-var name to users** |
| Collections | "Currently sorted by rating until LetBuyy editorial curation is connected." | `collections/[slug]/page.tsx:13` | "Staff Picks" admits it isn't curated |
| Collections | "India developer filtering is not connected yet; this view currently shows recent marketplace apps." | `collections/[slug]/page.tsx:25` | "Made in India" with no India filtering |
| Install panel | "OAuth install is contract-gated until the marketplace BFF route is approved by governance." | `AppInstallConsentPanel.tsx:91` | Thrown as an error if the flag is on |
| App detail | "Report review unavailable" / "Report listing unavailable" (disabled) | `apps/[slug]/page.tsx:493,617` | Dead controls |
| App detail | "Awaiting approved media from the app partner." | `apps/[slug]/page.tsx:322` | Placeholder screenshots |

## 3. Misleading / inaccurate content

- **"Built for LetBuyy"** badge implies a vetting program; there is no program and no `built_for_letbuyy` DB column behind it (`marketplace-display.ts:49`, schema). Either build it or remove it.
- **"Verified partner"** badge is sourced from `app_developers.verified` (`marketplace-display.ts:25`) — fine *if* verification is a real process, but no verification workflow exists in the gateway, so the badge currently has no path to becoming true.
- **Revenue economics are unstated to developers** while the code has already decided 20% (`billing-core:269`). A developer cannot make a business decision on "pending business approval."
- **Stale domain** in user-visible copy: submit slug hint `apps.letbuyy.store/apps/...` (`apps/new/page.tsx:176`); footer `docs.letbuyy.store`, `letbuyy.store`, `admin.letbuyy.store`, `themes.letbuyy.store`, `support@letbuyy.store` (`Footer.tsx:28-37`) — versus canonical `letbuyy.com`.

## 4. Missing content (gaps that should exist)

- **No developer documentation** (the footer links to `docs.letbuyy.store/apps` and `/api`, which are external and likely unpublished). A developer marketplace cannot function without API docs, manifest reference, and a getting-started guide.
- **No published review policy / app guidelines** (the page that should hold it is a placeholder).
- **No pricing/economics page** stating the revenue share, payout schedule, GST handling, and supported billing models.
- **No "request an app" demand-capture** on empty states — a missed signal-collection opportunity while the catalog fills.
- **No category landing copy** for SEO/merchant education.
- **No trust/security page** (data handling expectations, what review covers).

## 5. Recommendations (content)

1. **Stop leaking governance state.** Remove every `Flag: NEXT_PUBLIC_*`, `SKIPPED (HUMAN-APPROVAL)`, and "contract-gated/contract" string from user-facing copy. If a feature isn't ready, hide it — don't narrate the internal reason.
2. **Decide and publish the economics.** One revenue-share number, payout schedule, and billing-model list — in code, docs, and UI.
3. **Make badges true or remove them** ("Built for LetBuyy", "Verified partner").
4. **Fix the stale domain** everywhere it appears in copy.
5. **Write the missing pages:** review policy, developer docs, pricing/economics, trust/security.
6. **Replace "fake collection" copy** with either real curation or no collection at all.

Content integrity is a real asset here — the team resisted faking data. The work is to **remove the scaffolding language** and **write the substantive pages** a marketplace needs.
