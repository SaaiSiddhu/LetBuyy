# Apps Feature Gap Analysis (Phase 7)

Classifies marketplace features as **Critical Missing**, **Important Missing**, or **Nice to Have**, benchmarked against Shopify. "Backend exists?" distinguishes a *product* gap (API present, no UI) from a *platform* gap (nothing at all). Parent: [Master Audit](../LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md).

## CRITICAL MISSING (blocks a functioning ecosystem)

| Feature | Backend exists? | Reality | Fix |
|---|---|---|---|
| **Catalog content / seed** | n/a | 0 seeded apps; homepage admits empty (`000_baseline.sql`, `app/page.tsx`) | Seed categories + launch-partner apps; gate launch on live-app count |
| **App update / versioning** | ❌ No | No `PATCH/PUT /developers/apps/:id`; no edit page | Add update endpoint + version records + re-review on scope change |
| **Billing UX (plan select, charge approval, usage, trials)** | ◐ charge+approve only | No UI; trials/yearly/usage rendered but not settable; `usage_based` rejected by DB | Hosted plan page + charge-approval surface + plan config in submit |
| **Truthful revenue share** | ✅ but wrong default | UI 15% vs code 20% (`revenue_share_bps=8000`) | Reconcile + publish one rate |
| **OAuth consent flow in UI** | ✅ unused | Install posts scopes directly; `/oauth/authorize` never called | Route install through OAuth; granular + re-consent |
| **Earned trust program** | ❌ | "Built for LetBuyy" hard-coded on all apps | Criteria-gated badge (installs, reviews, perf, design) |
| **Real review gating** | ◐ records only | automated_checks always pass; human-only decision | Static scan, scope justification, manifest lint, URL/TLS checks |
| **Developer per-app analytics** | ❌ | Aggregate tiles only | Build install/charge event analytics |
| **App health / API usage / rate-limit monitoring** | ❌ | None surfaced | Request volume, error rate, p95 (cf. BFS perf gates) |
| **Developer app management (edit/configure/media/keys)** | ◐ key+manifest API | Submit-once; no manage; upload zones decorative; key/manifest UI absent | App detail console + media uploads + key rotation UI |

## IMPORTANT MISSING (limits trust, conversion, retention)

| Feature | Backend exists? | Reality | Fix |
|---|---|---|---|
| Review write UI (verified reviewer) | ✅ POST reviews | No composer in product | Add on `/my-apps` per active install |
| Developer reply to reviews | ❌ | None | Reply model + UI |
| Rating distribution histogram | ❌ | Stars only | 1–5 breakdown |
| Featured / editorial / curated collections | ❌ (fake) | Re-sorts of same query | Curation tables + trending math |
| Recommendations / "similar apps" | ◐ same-category sample | No rec engine | Recommendation service |
| Compare apps | ❌ | None | Compare tray |
| Data-handling / privacy disclosure on listing | ❌ | None | Required disclosure |
| Changelog / release notes | ❌ | None | Per-version notes |
| Post-install onboarding/setup | ❌ | Drops to iframe | Setup checklist + deep link |
| Notifications (review decision, payout, new review) | ◐ events emitted | No UI/inbox | In-app + email |
| Webhooks/extension/dev-store management UI | ◐ APIs exist | None | Console surfaces |
| Manifest validation UI | ✅ endpoint | None | Pre-submit validator |
| Refund / dispute / chargeback | ❌ | None | Billing dispute flow |
| Payout statements / GST invoices / export | ◐ ledger | No statements | Monthly statements + CSV + GST invoice |
| Developer profile page | ◐ link only | `/developers/:slug` referenced, page depth unclear | Build profile + dev's other apps |
| Private/internal app distribution | ◐ `type` in schema | No UI | Private install links |
| Pagination on directory | ❌ | limit 24, no pager | Pagination/infinite scroll |
| Localization / multi-currency | ❌ | en + INR | i18n + currency per geo |
| Mobile navigation | ❌ | Nav hidden <768/<640px | Mobile menu |

## NICE TO HAVE

- Screenshot lightbox, video/demo support, app activity log for merchants, uninstall-reason capture, partner directory, listing preview before submit, draft autosave, SEO structured data (JSON-LD/sitemaps), A/B experimentation, status page, synonyms in search, multi-tag categories, "works with" compatibility.

## Backend-ahead-of-product summary

The unusual shape here: **most "missing" features are missing only in the UI.** OAuth, billing, extensions, manifest validation, API keys, embed/App Bridge, compliance, and payouts already exist server-side. The highest-leverage work is **wiring the existing API into the product**, not building new platform capability. The genuine *platform* gaps are narrower: **app update/versioning**, **real review gating/scanning**, **per-app analytics**, and **app health monitoring**.
