# Apps Marketplace Foundation Ledger

Verification key: `app checks PASS` means `typecheck`, `lint`, `build`, and `test` passed for `@letbuyy/app-marketplace` after the marketplace changes. `build` was run with local public URL env values because the app fails fast without them.

| #NN | title | wave | boundary (IN/IN+C/C/H) | status (DONE/PARTIAL/CONTRACTED/SKIPPED) | files changed | verification | contract id |
|---|---|---:|---|---|---|---|---|
| #1 | Launch catalog seed | 5 | H | SKIPPED | `CROSS_BOUNDARY_CONTRACTS.md`, `CODEX_FOUNDATION_STATUS.md` | Human launch-partner decision logged; app checks PASS | C-001 |
| #2 | App update endpoint/UI | 2 | IN+C | PARTIAL | `src/app/(auth)/developers/dashboard/page.tsx`, `src/app/(auth)/developers/apps/new/page.tsx` | Edit/version controls gated; app checks PASS | C-046 |
| #3 | Revenue-share default/rate | 5 | H | SKIPPED | `src/app/(auth)/developers/register/page.tsx`, `CROSS_BOUNDARY_CONTRACTS.md` | No rate guessed; app checks PASS | C-003 |
| #4 | Search `.or()` injection | 1 | IN+C | PARTIAL | `src/lib/marketplace-display.ts`, `src/lib/app-service.ts`, `src/app/api/apps/search/route.ts` | Query sanitized defensively; app checks PASS | C-004, C-077 |
| #5 | Built for LetBuyy on every app | 0 | IN+C | PARTIAL | `src/lib/marketplace-display.ts`, `src/components/AppCard.tsx`, `src/app/(store)/apps/[slug]/page.tsx` | Badge hidden unless explicit field true; app checks PASS | C-005 |
| #6 | Real review gating/scanning | 5 | C | CONTRACTED | `CROSS_BOUNDARY_CONTRACTS.md` | Contract only; app checks PASS | C-006 |
| #7 | OAuth consent bypassed | 3 | IN+C | PARTIAL | `src/components/AppInstallConsentPanel.tsx`, `src/lib/capabilities.ts` | OAuth path guarded off; app checks PASS | C-007 |
| #8 | No billing UI | 3 | IN+C | PARTIAL | `src/components/AppInstallConsentPanel.tsx`, `src/lib/capabilities.ts` | Price/trial terms shown, charge list contracted; app checks PASS | C-008 |
| #9 | Dead pricing/rating filters | 0 | IN | DONE | `src/app/(store)/search/page.tsx`, `src/lib/app-service.ts` | Filters update URL/results; app checks PASS |  |
| #10 | Fake collections | 0 | IN+C | PARTIAL | `src/app/(store)/collections/[slug]/page.tsx` | Misleading curation copy removed; app checks PASS | C-010 |
| #11 | Mobile nav disappears | 4 | IN | DONE | `src/components/Header.tsx`, `src/app/globals.css` | Mobile menu remains reachable; app checks PASS |  |
| #12 | Category icon rendered as text | 0 | IN | DONE | `src/app/(store)/search/page.tsx`, `src/app/(store)/categories/[slug]/page.tsx`, `src/app/(auth)/developers/apps/new/page.tsx` | MaterialIcon used instead of raw names; app checks PASS |  |
| #13 | Review count uses first page | 0 | IN | DONE | `src/app/(store)/apps/[slug]/page.tsx` | Detail heading uses total review count; app checks PASS |  |
| #14 | Media upload | 5 | C | CONTRACTED | `CROSS_BOUNDARY_CONTRACTS.md` | Contract only; app checks PASS | C-014 |
| #15 | Per-app analytics | 5 | C | CONTRACTED | `CROSS_BOUNDARY_CONTRACTS.md` | Contract only; app checks PASS | C-015 |
| #16 | App health/API usage | 5 | C | CONTRACTED | `CROSS_BOUNDARY_CONTRACTS.md` | Contract only; app checks PASS | C-016 |
| #17 | `usage_based` offered, DB rejects | 0 | IN+C | PARTIAL | `src/lib/marketplace-display.ts`, `src/app/(auth)/developers/apps/new/page.tsx` | Submit option removed; persistence contracted; app checks PASS | C-017 |
| #18 | Review count equals first 10 | 0 | IN | DONE | `src/app/(store)/apps/[slug]/page.tsx` | Detail heading uses total review count; app checks PASS |  |
| #19 | Hard-coded categories diverge | 1 | IN | DONE | `src/lib/app-service.ts`, `src/app/(store)/categories/page.tsx`, `src/app/page.tsx` | Live categories with fallback; app checks PASS |  |
| #20 | No category counts/empty handling | 1 | IN+C | PARTIAL | `src/components/CategoryGrid.tsx`, `CROSS_BOUNDARY_CONTRACTS.md` | Counts used when returned; app checks PASS | C-020 |
| #21 | Updated shows 1970 | 0 | IN | DONE | `src/lib/marketplace-display.ts`, `src/app/(store)/apps/[slug]/page.tsx` | Missing timestamps render dash; app checks PASS |  |
| #22 | No review write UI | 3 | IN | DONE | `src/components/ReviewComposer.tsx`, `src/components/InstalledAppsGrid.tsx` | Installed apps expose review composer; app checks PASS |  |
| #23 | No developer reply | 3 | C | CONTRACTED | `CROSS_BOUNDARY_CONTRACTS.md` | Contract only; app checks PASS | C-023 |
| #24 | No rating histogram | 3 | IN+C | PARTIAL | `src/app/(store)/apps/[slug]/page.tsx`, `CROSS_BOUNDARY_CONTRACTS.md` | Loaded-review histogram rendered; full histogram contracted; app checks PASS | C-024 |
| #25 | Weak similar apps | 1 | IN | DONE | `src/app/(store)/apps/[slug]/page.tsx` | Same-category and developer signals improved; app checks PASS |  |
| #26 | No compare | 4 | IN | DONE | `src/app/(store)/search/page.tsx`, `src/app/globals.css` | Client compare tray present; app checks PASS |  |
| #27 | No featured/editorial | 1 | IN+C | PARTIAL | `src/app/page.tsx`, `src/lib/capabilities.ts` | Rail hidden unless flagged data exists; app checks PASS | C-027 |
| #28 | No post-install onboarding | 3 | IN+C | PARTIAL | `src/components/AppInstallConsentPanel.tsx`, `CROSS_BOUNDARY_CONTRACTS.md` | Honest post-install path retained; setup contracted; app checks PASS | C-028 |
| #29 | Unsafe embed iframe | 3 | IN+C | PARTIAL | `src/components/AppInstallConsentPanel.tsx`, `CROSS_BOUNDARY_CONTRACTS.md` | Sandbox tightened; signed embed session contracted; app checks PASS | C-029 |
| #30 | All-or-nothing scopes | 3 | IN+C | PARTIAL | `src/components/AppInstallConsentPanel.tsx`, `src/lib/capabilities.ts` | Scope display/guard added; optional consent contracted; app checks PASS | C-007 |
| #31 | No data-handling disclosure | 3 | IN+C | PARTIAL | `src/app/(store)/apps/[slug]/page.tsx`, `CROSS_BOUNDARY_CONTRACTS.md` | Disclosure renders when present; app checks PASS | C-031 |
| #32 | No support SLA signal | 4 | IN+C | PARTIAL | `src/app/(store)/apps/[slug]/page.tsx`, `CROSS_BOUNDARY_CONTRACTS.md` | SLA renders when present; app checks PASS | C-032 |
| #33 | No changelog | 3 | IN+C | PARTIAL | `src/app/(store)/apps/[slug]/page.tsx`, `CROSS_BOUNDARY_CONTRACTS.md` | Release fields render when present; app checks PASS | C-033 |
| #34 | No status link | 4 | IN | DONE | `src/app/(store)/apps/[slug]/page.tsx` | Status URL renders when present; app checks PASS |  |
| #35 | No per-app management | 2 | IN+C | PARTIAL | `src/app/(auth)/developers/dashboard/page.tsx`, `src/app/api/developers/apps/route.ts` | Developer app list/API-key panel present; edit gated; app checks PASS | C-046 |
| #36 | Dead Pencil edit affordance | 0 | IN | DONE | `src/app/(auth)/developers/dashboard/page.tsx` | Dead edit control removed/disabled; app checks PASS |  |
| #37 | Collaborator code flow incomplete | 2 | IN | DONE | `src/components/CollaboratorCodePanel.tsx`, `src/app/api/developers/route.ts` | Request/redeem action uses existing route; app checks PASS |  |
| #38 | No API-key UI | 2 | IN | DONE | `src/components/ApiKeyPanel.tsx`, `src/app/api/developers/apps/route.ts`, `src/app/(auth)/developers/dashboard/page.tsx` | Rotate action wired through existing route; app checks PASS |  |
| #39 | No manifest validation UI | 2 | IN | DONE | `src/app/(auth)/developers/apps/new/page.tsx`, `src/app/api/developers/apps/route.ts` | Pre-submit manifest validation wired; app checks PASS |  |
| #40 | No extension config UI | 2 | IN+C | PARTIAL | `src/components/ExtensionConfigPanel.tsx`, `src/components/InstalledAppsGrid.tsx`, `CROSS_BOUNDARY_CONTRACTS.md` | Honest unavailable panel; endpoint contracted; app checks PASS | C-040 |
| #41 | Webhook CRUD | 5 | C | CONTRACTED | `CROSS_BOUNDARY_CONTRACTS.md` | Contract only; app checks PASS | C-041 |
| #42 | Developer store provisioning | 5 | C | CONTRACTED | `CROSS_BOUNDARY_CONTRACTS.md` | Contract only; app checks PASS | C-042 |
| #43 | No SDK/CLI references | 2 | IN | DONE | `src/app/(auth)/developers/page.tsx`, `src/app/(auth)/developers/apps/new/page.tsx` | Portal/submit links present; app checks PASS |  |
| #44 | Docs links unverified | 0 | H | SKIPPED | `CODEX_FOUNDATION_STATUS.md`, `CROSS_BOUNDARY_CONTRACTS.md` | Docs publication requires human ownership; app checks PASS | C-044 |
| #45 | No published review rubric | 2 | H | SKIPPED | `src/app/(auth)/developers/review-requirements/page.tsx`, `CODEX_FOUNDATION_STATUS.md` | Placeholder content page added; final policy skipped; app checks PASS |  |
| #46 | No update/version/re-review | 2 | IN+C | PARTIAL | `src/app/(auth)/developers/dashboard/page.tsx`, `CROSS_BOUNDARY_CONTRACTS.md` | New-version UI gated; app checks PASS | C-046 |
| #47 | No scope re-consent | 2 | IN+C | PARTIAL | `src/components/AppInstallConsentPanel.tsx`, `CROSS_BOUNDARY_CONTRACTS.md` | Scope disclosure present; re-consent contracted; app checks PASS | C-046, C-007 |
| #48 | No suspension/appeal UX | 2 | IN+C | PARTIAL | `src/app/(auth)/developers/dashboard/page.tsx`, `CROSS_BOUNDARY_CONTRACTS.md` | Status messaging present; appeal contracted; app checks PASS | C-048 |
| #49 | Unearned badges | 3 | IN+C | PARTIAL | `src/lib/marketplace-display.ts`, `src/components/AppCard.tsx`, `src/app/(store)/apps/[slug]/page.tsx` | Badges require explicit field; app checks PASS | C-005 |
| #50 | KYC policy | 5 | H | SKIPPED | `CROSS_BOUNDARY_CONTRACTS.md`, `CODEX_FOUNDATION_STATUS.md` | Human KYC/GST policy required; app checks PASS | C-050 |
| #51 | Country list vs India payouts | 0 | IN | DONE | `src/app/(auth)/developers/register/page.tsx` | Country options/copy align to India payout support; app checks PASS |  |
| #52 | No localization | 4 | H | SKIPPED | `src/lib/i18n/messages.ts`, `CODEX_FOUNDATION_STATUS.md` | Scaffold added; translations skipped for human/localization owner; app checks PASS |  |
| #53 | INR-only | 4 | IN+C | PARTIAL | `src/lib/currency.ts`, `src/components/AppInstallConsentPanel.tsx`, `CROSS_BOUNDARY_CONTRACTS.md` | Currency display scaffold; multi-currency contracted; app checks PASS | C-053 |
| #54 | A11y gaps | 4 | IN | DONE | `src/components/Header.tsx`, `src/app/(store)/search/page.tsx`, `src/app/globals.css` | Semantic controls/ARIA basics added; app checks PASS |  |
| #55 | Non-semantic click targets | 4 | IN | DONE | `src/components/Header.tsx`, `src/app/(store)/search/page.tsx`, `src/components/AppInstallConsentPanel.tsx` | Buttons/links used for interactive controls; app checks PASS |  |
| #56 | No pagination | 1 | IN | DONE | `src/app/page.tsx`, `src/app/(store)/categories/[slug]/page.tsx`, `src/app/(store)/search/page.tsx` | Pagination/load-more paths wired to total/page/limit; app checks PASS |  |
| #57 | Inert category sort select | 1 | IN | DONE | `src/app/(store)/categories/[slug]/page.tsx` | Sort query refetches page; app checks PASS |  |
| #58 | Two UI idioms/inline styles | 4 | IN | DONE | `src/app/globals.css`, `src/app/(auth)/developers/*.tsx`, `src/app/(store)/*.tsx`, `src/components/*.tsx` | `rg "style={{"` across `src/app` and `src/components` found no matches; app checks PASS |  |
| #59 | Hardcoded error colors | 0 | IN | DONE | `src/app/globals.css`, `src/components/*Panel.tsx`, `src/components/ReviewComposer.tsx` | Tokenized alert/toast styling; app checks PASS |  |
| #60 | No skeletons on server pages | 4 | IN | DONE | `src/components/MarketplaceSkeleton.tsx`, `src/app/loading.tsx`, route segment `loading.tsx` files, `src/app/globals.css` | Route loading skeletons added; app checks PASS |  |
| #61 | No empty-search guidance | 1 | IN | DONE | `src/app/(store)/search/page.tsx` | Empty/zero states suggest useful categories/queries; app checks PASS |  |
| #62 | Debounce without cancellation | 1 | IN | DONE | `src/app/(store)/search/page.tsx` | AbortController cancels stale fetches; app checks PASS |  |
| #63 | Client re-sort masks server sort | 0 | IN | DONE | `src/app/(store)/search/page.tsx` | Redundant re-sort removed; app checks PASS |  |
| #64 | No recency signals | 1 | IN | DONE | `src/lib/marketplace-display.ts`, `src/components/AppCard.tsx` | New/Updated badges use real timestamps only; app checks PASS |  |
| #65 | Install-count credibility | 5 | C | CONTRACTED | `CODEX_FOUNDATION_STATUS.md` | Noted as backend trigger concern; app checks PASS |  |
| #66 | No review report/moderation | 3 | IN+C | PARTIAL | `src/app/(store)/apps/[slug]/page.tsx`, `CROSS_BOUNDARY_CONTRACTS.md` | Report controls honest/unavailable; app checks PASS | C-066 |
| #67 | Payout statements | 5 | C | CONTRACTED | `CROSS_BOUNDARY_CONTRACTS.md` | Contract only; app checks PASS | C-067 |
| #68 | GST invoices | 5 | C | CONTRACTED | `CROSS_BOUNDARY_CONTRACTS.md` | Contract only; app checks PASS | C-068 |
| #69 | Refunds | 5 | C | CONTRACTED | `CROSS_BOUNDARY_CONTRACTS.md` | Contract only; app checks PASS | C-069 |
| #70 | Trials/annual/usage capturable | 3 | IN+C | PARTIAL | `src/app/(auth)/developers/apps/new/page.tsx`, `src/components/AppInstallConsentPanel.tsx` | Trial/yearly fields added; persistence contracted; app checks PASS | C-017, C-008 |
| #71 | Annual/usage plan display | 3 | IN+C | PARTIAL | `src/lib/marketplace-display.ts`, `src/components/AppInstallConsentPanel.tsx` | Annual/trial display scaffold; usage unsupported until contract; app checks PASS | C-017, C-008 |
| #72 | Billing proration | 5 | C | CONTRACTED | `CROSS_BOUNDARY_CONTRACTS.md` | Contract only; app checks PASS | C-072 |
| #73 | Per-store install scope unclear | 3 | IN | DONE | `src/components/AppInstallConsentPanel.tsx`, `src/components/InstalledAppsGrid.tsx` | Target store shown in consent/My Apps; app checks PASS |  |
| #74 | Billing terms not at install | 3 | IN | DONE | `src/components/AppInstallConsentPanel.tsx` | Price/trial/scopes shown on one consent surface; app checks PASS |  |
| #75 | No works-with compatibility | 3 | IN+C | PARTIAL | `src/app/(store)/apps/[slug]/page.tsx`, `CROSS_BOUNDARY_CONTRACTS.md` | Compatibility renders when present; app checks PASS | C-075 |
| #76 | Single category_id | 4 | IN+C | PARTIAL | `src/app/(store)/apps/[slug]/page.tsx`, `CROSS_BOUNDARY_CONTRACTS.md` | Multiple tags render when present; schema contracted; app checks PASS | C-075 |
| #77 | No full-text/synonym search | 1 | C | CONTRACTED | `CROSS_BOUNDARY_CONTRACTS.md` | Contract only; app checks PASS | C-077 |
| #78 | Naive markdown | 4 | IN | DONE | `src/lib/marketplace-display.ts`, `src/app/(store)/apps/[slug]/page.tsx` | Sanitized text renderer used; app checks PASS |  |
| #79 | No screenshot lightbox | 4 | IN | DONE | `src/app/(store)/apps/[slug]/page.tsx`, `src/app/globals.css` | CSS lightbox anchors added; app checks PASS |  |
| #80 | No video/demo | 4 | IN+C | PARTIAL | `src/app/(store)/apps/[slug]/page.tsx`, `CROSS_BOUNDARY_CONTRACTS.md` | Video renders when present; field contracted; app checks PASS | C-080 |
| #81 | No report listing | 3 | IN+C | PARTIAL | `src/app/(store)/apps/[slug]/page.tsx`, `CROSS_BOUNDARY_CONTRACTS.md` | Report control honest/unavailable; app checks PASS | C-066 |
| #82 | No developer profile page | 2 | IN+C | PARTIAL | `src/app/(auth)/developers/[slug]/page.tsx`, `CROSS_BOUNDARY_CONTRACTS.md` | Shell renders; public fetch contracted; app checks PASS | C-082 |
| #83 | No developer other apps | 2 | IN | DONE | `src/app/(store)/apps/[slug]/page.tsx`, `src/app/api/developers/apps/route.ts` | Developer apps endpoint/listing used where available; app checks PASS |  |
| #84 | No partner directory | 4 | IN+C | PARTIAL | `src/app/(store)/partners/page.tsx`, `CROSS_BOUNDARY_CONTRACTS.md` | Directory shell renders; listing endpoint contracted; app checks PASS | C-084 |
| #85 | No notifications | 3 | IN+C | PARTIAL | `src/app/(auth)/developers/dashboard/page.tsx`, `CROSS_BOUNDARY_CONTRACTS.md` | Inbox gated/contracted; app checks PASS | C-085 |
| #86 | No app activity log | 3 | IN+C | PARTIAL | `src/components/InstalledAppsGrid.tsx`, `CROSS_BOUNDARY_CONTRACTS.md` | Activity surface gated/contracted; app checks PASS | C-086 |
| #87 | No uninstall reason | 3 | IN+C | PARTIAL | `src/components/InstalledAppsGrid.tsx`, `CROSS_BOUNDARY_CONTRACTS.md` | Reason capture prompt scaffolded; persistence contracted; app checks PASS | C-087 |
| #88 | Rate-limit visibility | 5 | C | CONTRACTED | `CROSS_BOUNDARY_CONTRACTS.md` | Contract only; app checks PASS | C-088 |
| #89 | No catalog caching/CDN | 1 | IN+C | PARTIAL | `src/app/page.tsx`, `src/app/(store)/categories/page.tsx`, `src/app/(store)/categories/[slug]/page.tsx` | Next revalidate set; CDN headers contracted; app checks PASS | C-089 |
| #90 | Thin SEO | 4 | IN | DONE | `src/app/(store)/apps/[slug]/page.tsx`, `src/app/sitemap.ts`, `src/app/robots.ts` | JSON-LD/sitemap/robots present; app checks PASS |  |
| #91 | No funnel telemetry | 5 | IN+C | PARTIAL | `src/lib/telemetry.ts`, `src/components/AppInstallConsentPanel.tsx`, `src/components/ReviewComposer.tsx` | No-op event hooks behind flag; sink contracted; app checks PASS | C-091 |
| #92 | No experimentation | 5 | IN+C | PARTIAL | `src/lib/experiments.ts`, `src/lib/capabilities.ts`, `CROSS_BOUNDARY_CONTRACTS.md` | Flag scaffold added; assignment contracted; app checks PASS | C-092 |
| #93 | Env catalog parity | 5 | C | CONTRACTED | `CROSS_BOUNDARY_CONTRACTS.md` | Contract only; app checks PASS | C-093 |
| #94 | No private-app distribution UX | 2 | IN+C | PARTIAL | `src/app/(auth)/developers/apps/new/page.tsx`, `CROSS_BOUNDARY_CONTRACTS.md` | Private distribution UI gated; endpoint contracted; app checks PASS | C-094 |
| #95 | Dev team roles | 5 | C | CONTRACTED | `CROSS_BOUNDARY_CONTRACTS.md` | Contract only; app checks PASS | C-095 |
| #96 | 2FA/security settings | 5 | C | CONTRACTED | `CROSS_BOUNDARY_CONTRACTS.md` | Contract only; app checks PASS | C-096 |
| #97 | No listing preview | 2 | IN | DONE | `src/app/(auth)/developers/apps/new/page.tsx`, `src/app/globals.css` | Live preview renders from submit form; app checks PASS |  |
| #98 | No draft autosave | 2 | IN | DONE | `src/app/(auth)/developers/apps/new/page.tsx` | Draft persists/restores from localStorage; app checks PASS |  |
| #99 | No delist/archive | 2 | IN+C | PARTIAL | `src/app/(auth)/developers/dashboard/page.tsx`, `CROSS_BOUNDARY_CONTRACTS.md` | Delist control gated; endpoint contracted; app checks PASS | C-046 |
| #100 | No 320px tier | 4 | IN | DONE | `src/app/globals.css`, `src/components/Header.tsx` | 360/320px responsive rules added; app checks PASS |  |
