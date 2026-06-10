# Merchant Trust Scorecard (Phase 13)

**Parent:** [`../LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md`](../LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md) · **Date:** 2026-06-07

**Question:** *Would a merchant trust installing apps from LetBuyy today?* **Scoring:** 0–10 per signal, weighted. **Overall: 4.1 / 10 — "not yet trustworthy enough to rely on."** The install/permission moment is genuinely trustworthy; almost everything around it (catalog emptiness, unbacked badges, invisible billing, leaked internal copy) erodes confidence.

## Scorecard

| Trust signal | Score | Why | Evidence |
|---|---|---|---|
| **Permissions transparency** | 9/10 | Best surface in the product: consent modal lists each scope (label + raw code), names target store, states billing terms before granting | `AppInstallConsentPanel.tsx:185-279` |
| **Safe install/uninstall** | 8/10 | Session-gated install; uninstall confirm with explicit data-loss note; backend revokes token + fires `shop/redact` | `InstalledAppsGrid.tsx:153`; `install-lifecycle-routes.ts:257,344` |
| **Authentic reviews** | 6/10 | Reviews are real (install required), histogram derived from data, honest "No reviews yet" — but none exist yet and abuse reporting is disabled | `apps/[slug]/page.tsx:464-506,493` |
| **Honest data (no fakery)** | 8/10 | No fabricated catalog/metrics/reviews anywhere; honest empty states | `page.tsx:274`; `AppCard.tsx:31-42` |
| **Catalog depth / social proof** | 1/10 | Empty catalog; 0 installs, 0 reviews to learn from | `page.tsx:274` |
| **Quality/vetting signals** | 2/10 | "Built for LetBuyy" badge has **no program and no DB column**; "Verified partner" has no verification workflow; no security/perf signals | `marketplace-display.ts:25,49` |
| **Pricing clarity** | 5/10 | Pricing rows + "merchant approval required" clear; but `usage_based`→"not supported yet", taxonomy inconsistent, **no charge-approval UI** so paid apps can't actually be billed | `marketplace-display.ts:33-47` |
| **Developer accountability** | 2/10 | Public developer profiles are placeholder shells that print a flag name; no track record, no support SLA enforced | `developers/[slug]/page.tsx:28,38` |
| **App quality over time** | 1/10 | No versioning/update path → merchants can't trust apps get fixed; changelog UI has no data source | Master flow 5 |
| **Support & recourse** | 2/10 | Only a developer support email; no ticketing, no merchant→developer channel, disabled "Report" buttons | `apps/[slug]:617` |
| **Professional polish** | 5/10 | Detail page & consent are polished; but placeholder pages leak `Flag: NEXT_PUBLIC_*` to users, stale `letbuyy.store` domain, dead upload boxes | `partners/page.tsx:26`; `Footer.tsx:34` |

**Weighted overall: ~4.1 / 10.**

## What builds trust here (keep)

The **install decision moment** is the product's trust high-water mark: clear permissions, explicit target-store context, billing-approval guarantee, data-loss-aware uninstall, and a refusal to fake data. A merchant who reaches the consent modal is treated honestly.

## What breaks trust (fix)

1. **Emptiness** — a store with nothing in it reads as abandoned; there's no social proof to lean on.
2. **Unbacked badges** — "Built for LetBuyy"/"Verified partner" imply vetting that doesn't exist; this is the most damaging trust issue because it's *actively misleading*, not merely absent.
3. **Leaked internal state** — pages that print feature-flag names and "contract-gated"/"SKIPPED (HUMAN-APPROVAL)" copy make the product feel like a staging build.
4. **Invisible billing** — a merchant can install a paid app but never see/approve a charge, undermining confidence that money is handled correctly.
5. **No accountability** — placeholder developer profiles, no support channel, disabled reporting.
6. **No quality-over-time signal** — without versioning, a merchant can't trust apps are maintained.
7. **Stale domain** — `letbuyy.store` vs canonical `letbuyy.com` reads as inconsistency/неglect.

## Path to a trustworthy 8/10

In priority order: seed a real catalog with real installs/reviews (Master #1); make "Built for LetBuyy"/"Verified" true or remove them (#17, #31); ship charge-approval UI so billing is visible (#10); remove all leaked-flag/governance copy (Content #1); build real developer profiles + support + reporting (#19, #26, #27); ship versioning so quality-over-time is visible (#2); migrate the domain (#28). The foundation (consent UX, honesty) is strong enough that trust can rise quickly once the surrounding signals become real.
