# Shopify Evidence and Coverage Register

Research date: **22 October 2026, Asia/Kolkata**. Environment: public Shopify account pages followed by the user's authenticated India trial store. The signed-in account was used for inspection and reversible, unsaved research interactions.

The user's request covers the entire product. Shopify varies by plan, role, region, device, account history and rollout; this study records the visible surface and retains unexecuted branches explicitly. A feature named in a menu or help article is not a completed workflow test.

## Evidence hierarchy

| Label | Use |
| --- | --- |
| LIVE | Rendered UI or interaction observed in this session |
| MEASURED | Read from rendered DOM, geometry or computed CSS at the recorded state |
| USER | One of the eight screenshots supplied by the user; historical moment within their session |
| DOC | Current first-party source, reviewed for relevant sections |
| ARCHIVE | Public source pinned to an archival commit |
| PRIOR | Existing June 2026 research, retained with its original date |
| ANALYSIS | Original interpretation, evaluation criterion or research plan |
| OPEN | Not exercised or not established by the available evidence |

The sources below were consulted for relevant sections, not uniformly reviewed line by line. Long help pages and API pages can change. The dated LIVE evidence is stronger for this account's appearance; documentation is stronger for supported branches outside this account.

## Public identity captures

| Evidence group | Recorded state | Limit |
| --- | --- | --- |
| `login-711.*` | Initial public email lookup, 711 × 1034 | No credentials submitted |
| `login-1440.jpg` | Wide public lookup | CSS values supported by companion measurements |
| `login-empty-error.*` | Empty email submission and invalid state | No negative test against a real account |
| `login-error-390.jpg` | Narrow error composition | Error changes card height |
| `login-returning-390.*` | Later public lookup composition | Not a completed returning-account login |
| `signup-1440.*`, `signup-390.*` | Regional signup and custom input components | No account created |
| `whatsapp-login-1440.*`, `whatsapp-login-390.*` | Country/phone entry | No number submitted or code requested |
| `whatsapp-signup-1440.*`, `whatsapp-signup-390.*` | Account-creation variant and disclosure | No terms accepted or account created |

The public measurements include dimensions, typography, colors and spacing. Screenshots are raster exhibits; reported exact dimensions use **CSS pixels**, not the screenshot's pixel dimensions. Explicit public viewport overrides and the later native admin viewport have different DPR conditions.

## Supplied screenshot observations

| User image | Observed content | Treatment |
| --- | --- | --- |
| 1, 7:10:51 | Password step at displayed 390 × 844 | Identifier summary, change email, eye control, recovery and alternate method |
| 2, 7:11:07 | Password step at displayed 671 × 787 | Identifier/change action arranged inline |
| 3, 7:11:29 | Additional email verification | Six cells, resend and verify; not proof of every MFA method |
| 4, 7:12:51 | Post-login passkey promotion | Purple security illustration, Add passkey / Not now |
| 5, 7:13:10 | Setup Home in responsive admin | Trial popover and floating navigation/Sidekick |
| 6, phone photo | Verification email | Delivery artifact and expiry/security copy; secret code excluded |
| 7, 7:15:56 | Compact rail and Products flyout | Appearance observed; hover/keyboard behavior untested |
| 8, 7:16:05 | Expanded Products navigation and trial footer | Labels, children, selection and promotion hierarchy |

Original screenshots containing account identifiers or verification secrets were not copied into the repository. Their observations are summarized without the personal email, code or session-bearing URL. A screenshot does not prove OTP paste/autofill, delivery latency, code expiry enforcement or passkey enrollment success.

## Authenticated coverage

| Area | Evidence and interaction | Remaining coverage |
| --- | --- | --- |
| Home | Current task feed, prompt, illustration crop and motion styles | Task completion persistence and mature-store activity globe |
| Global navigation | Expanded/collapsed shell, route transitions, current child labels | Keyboard/touch flyout, every responsive breakpoint |
| Global search | Product query, pending state, grouped results and shortcuts | Object detail selection, stale results and permission filtering |
| Store menu / alerts | Menu entries and empty alerts | Multiple-store selection, profile/security pages, session revocation |
| Products | Empty index; full editor fields; HTML/rich round trip; AI preview; discard | Saved product, variant combinations, media upload, publish/failure |
| Collections | One default collection and explicit page-selection scope | Bulk cross-page actions and populated conditions |
| Inventory | Empty index, columns and recovery affordance | Stock adjustment, concurrency and history |
| Purchase orders | Index and blank creation form | Supplier/product selection and receiving |
| Transfers | Index and blank creation form | Transfer creation, shipping, receipt and reconciliation |
| Gift cards | Index and unsaved creation form | Issuance, redemption, expiry and audit |
| Orders | Plan-gated empty state | Populated order, fulfillment, refund, dispute and failure flows |
| Customers | Segment/query workspace and blank customer/address forms; Segments/Companies links | Companies, saved customer, segment execution and populated history |
| Discounts | Empty index and four-type chooser | Rule editing, eligibility, application and conflict outcomes |
| Growth | Early-access promotion, performance and campaign entry | Attribution detail, Autopilot/campaign setup and execution |
| Content | Metaobjects, Files, Menus and Blog posts | Definition creation, upload, content editor and publication |
| Markets | Hierarchy and regional index | Catalogs, Rollouts and market creation |
| Analytics | Skeleton and stable zero/dash/no-data states | Populated chart interaction, Live View and custom metrics |
| Reports | Populated system catalog, row geometry, no-result query and clear recovery | Saved custom reports, pinning, export and large results |
| Online Store | Theme/channel overview, private/launch state; deeper Themes menus/import/Rename/discovery/wording; editor and code-workbench inspection below | Pages/Preferences editors, saved theme changes, preview parity and publishing |
| Agentic | Setup tasks, channel/source status and ineligible state | Eligibility, installed Knowledge Base and channel activation |
| Sidekick | Drawer, context menu, memory entry and assistant controls | Conversation, voice, files, app generation and action execution |
| Settings | All 20 visible destinations; Domains dialog validation | Each nested editor, save/failure and permission variant |

Files named `admin-*`, `core-*`, `content-*`, `channel-*`, `create-*` and `settings-*-roles.txt` support these observations. Captures are not uniformly full-page: safe crops omit business/account details, and positive-geometry style samples can include content below the fold.

The [evidence manifest](evidence/evidence-manifest.json) records exhibit paths, byte sizes and SHA-256 hashes for this delivery.

Settings inventories cover General, Plan, Billing, Users, Payments, Checkout, Customer accounts, Shipping and delivery, Taxes and duties, Locations, Markets, Apps, Sales channels, Domains, Customer events, Notifications, Metafields and metaobjects, Languages, Customer privacy and Policies. The Markets Settings entry opens the global Markets workspace.

That list is the first-pass inventory. A later follow-up contained **19 destinations without Markets**. Both observed states are retained; no cause, permission rule or permanent rollout was inferred.

## Deeper Themes editor Apps and navigation pass

Chapters [09](09_SURFACE_CONTAINERS_AND_NAVIGATION_LOADING.md), [10](10_THEMES_PAGE_DETAILED_REFERENCE.md), [11](11_THEME_EDITOR_DETAILED_REFERENCE.md) and [12](12_APPS_AND_EXTENSION_SURFACES.md) use the additional `evidence/deep-dive-02/` exhibits.

| Branch | New direct evidence | Still unexecuted / limited |
| --- | --- | --- |
| Container choices | Focused theme dialogs, large discovery modal, anchored pickers, full settings details, dedicated visual editor and new-tab code workbench | Focus trapping/return, every keyboard/touch path |
| Route loading | Semantic Page loading bar; 2 px related element; sparse Themes main; old-content probes on Customers/Analytics | Exact paint timing, fill/easing/duration, cold/warm distribution, timeout/retry |
| Theme overview | Current preview ancestors/clipping; three/two/one-column discovery; two scoped menus; private/active/plan states | Multi-theme draft library, purchase/add/duplicate/download/publish |
| Theme import | ZIP/GitHub choices; ZIP format/50 MB/unpublished explanation and pre-file disabled Upload | File selection, processing, invalid file, repository authorization |
| Visual editor | 1440 stacked / 1920 dual-sidebars / 390 bottom sheet; 375 px desktop phone preview | Exact breakpoint sweep, divider dragging, assistive technology |
| Section/block properties | Hero and Heading forms, selection outlines/context, local CSS/dynamic-source/color pickers | Applied edit, media upload, data binding, persisted CSS |
| Global theme settings | All 19 visible Horizon groups opened, including secondary Theme style panel | Changed setting, preview effect, Save/failure/rollback |
| Template/catalog | Template tree, empty product assignment, section presets, expanded block catalog, Generate/Apps branches | New template, insertion, drag/hide/remove, generated theme code |
| App extensions | Stable empty app-block and app-embed states | Installation, compatibility, activation, persistence |
| Theme code | Separate workbench, file tree, activity/status areas and geometry | No source file opened/exported/edited or source validation |
| Wording editor | Categories, string labels/placeholders and search/filter entry | String edits, translations, Save and storefront result |
| Apps | Launcher, resolved recommendation modal, public listing, empty settings index, development landing | App authorization, charges, third-party populated index and uninstall |
| Installed channel details | Existing Online Store management: connection, billing, activity/permission table, privacy and history | Third-party API activity/logs/charges and restricted-role behavior |

The bodyless Settings-exit state and initial editor 10% indicator were observed in tool output without saving the original raw snapshots. They are observer notes, with lower reproducibility than saved probes. The later Settings-exit JSON already contains destination content. [Follow-up observation notes](evidence/deep-dive-02/observation-notes.json).

The no-change check recorded Save disabled before exiting the editor. The final user tab was verified on the Themes route with resolved Online Store/Discover themes content and no dialog; its browser title still named Analytics. This is another reason to use the actual destination content, not URL or title alone, when evaluating readiness. Temporary app-listing/code tabs were closed.

## Measurement and interpretation cautions

- The native admin viewport measured **1144 × 778, DPR 1**. Public identity captures include 1440 × 1000, 711 × 1034 and 390 × 844.
- An immediate SPA snapshot sometimes retained the old page while the URL or shell had changed. Final observations used the destination heading or resolved result state. Initial Analytics skeleton is intentionally retained as a distinct state.
- Light-DOM selectors omit internal shadow components. Some early `settings-*-controls.json` files are partial inventories. Role-based `*-roles.txt` files are the coverage reference.
- Computed inner controls do not necessarily include wrapper/pseudo borders, backgrounds or shadows. The Domains action-role measurements and screenshots clarify this distinction.
- Home headline spans override their H1 wrapper's inherited font. The file includes several headings; use the first entry's visible 28 px spans for the Home title.
- The root-variable sample is a subset, not every stylesheet rule. Targeted role reads provide important values that were missing from enumeration.
- Contrast files cover explicitly listed opaque pairs. OKLCH and translucent states were not silently converted into approximate universal ratios.
- Four click-to-heading samples include automation overhead. Neither those values nor the AI probe establish Web Vitals or full task latency.
- The follow-up native route probe measured the same 1144 × 778 viewport at DPR 2; explicit theme/editor overrides measured DPR 1. Do not silently equate their raster sizes.
- Theme page metrics are frame-local. The 966 × 749.48 image is clipped by a 966 × 550 ancestor; image size is not visible-card height.
- Some theme-editor geometry was sampled during a panel slide. Negative/transient x coordinates were excluded from settled layout claims.
- App-discovery geometry includes skeleton slots; the resolved screenshot supplies final displayed content. The transparent full-width ARIA wrapper differs from its 980 px white card.
- Early app-embed snapshots were still loading; the stable empty-state inventory is the coverage reference.
- The current-theme preview probes show a spinner; saved mobile-preview-area crops are blank. Neither is presented as completed storefront rendering. The desktop selected-Hero capture and catalog preview do show their artwork.

## First party identity and onboarding sources

| Source | Sections used for this research |
| --- | --- |
| [Login overview](https://help.shopify.com/en/manual/your-account/logging-in) | Account entry and available methods |
| [Login and logout](https://help.shopify.com/en/manual/your-account/logging-in/log-in) | Standard login, remembered store, device/session management |
| [Passkeys](https://help.shopify.com/en/manual/your-account/logging-in/passkeys) | Setup prerequisites, device types, alternatives and recovery |
| [Secure sign-in methods](https://help.shopify.com/en/manual/your-account/logging-in/secure-sign-in-methods) | Method distinctions |
| [Two-step security](https://help.shopify.com/en/manual/your-account/logging-in/secure-sign-in) | Requirements and limits on new legacy-method enrollment |
| [Two-step login](https://help.shopify.com/en/manual/your-account/logging-in/secure-sign-in/two-step-login) | Challenge methods and backup access |
| [Password reset](https://help.shopify.com/en/manual/your-account/logging-in/reset-password) | Recovery branches and effects on connected methods |
| [Login troubleshooting](https://help.shopify.com/en/manual/your-account/logging-in/troubleshooting-login) | Account access and recovery context |
| [Login services](https://help.shopify.com/en/manual/your-account/logging-in/login-services) | Provider eligibility, Facebook compatibility, WhatsApp |
| [Store switcher](https://help.shopify.com/en/manual/your-account/logging-in/store-switcher) | Recent/full list, rollout placement, unavailable stores |
| [Shopify ID](https://help.shopify.com/en/manual/your-account/logging-in/sso-migration-guide) | Individual identity versus store resources |
| [Identity verification](https://help.shopify.com/en/manual/your-account/logging-in/identity-verification) | ID/liveness and review-dependent branches |
| [Manage account](https://help.shopify.com/en/manual/your-account/manage-account/) | Account/security context |
| [Invite users](https://help.shopify.com/en/manual/your-account/users/invite-users) | Individual account, invitation expiry and roles |
| [SAML](https://help.shopify.com/en/manual/your-account/users/security/advanced-security-features/saml) | Enterprise enforcement and identity-provider boundary |
| [Advanced security](https://help.shopify.com/en/manual/your-account/users/security/advanced-security-features) | Organization security context |
| [User search/filtering](https://help.shopify.com/en/manual/your-account/users/searching-and-filtering-users) | User-management retrieval |
| [User activity log](https://help.shopify.com/en/manual/your-account/users/security/user-management-activity-log) | Administrative activity context |
| [Customer accounts](https://help.shopify.com/en/manual/customers/customer-accounts) | Buyer identity and account journeys |
| [Initial setup](https://help.shopify.com/en/manual/intro-to-shopify/initial-setup) | Creation stages and optional setup/billing |
| [General setup checklist](https://help.shopify.com/en/manual/intro-to-shopify/initial-setup/new-to-shopify-checklists/general-checklist) | Configuration, testing and launch |
| [Setup guide](https://help.shopify.com/en/manual/intro-to-shopify/initial-setup/setup-getting-started) | Setup task context |

## First party admin and design sources

| Source | Sections used for this research |
| --- | --- |
| [Shopify Home](https://help.shopify.com/en/manual/shopify-admin/shopify-home) | Setup versus activity Home, guides, metrics, reduced motion |
| [Admin overview](https://help.shopify.com/en/manual/shopify-admin/shopify-admin-overview) | Both navigation designs, search, alerts and account placement |
| [Admin search](https://help.shopify.com/en/manual/shopify-admin/admin-search) | Cross-admin search context |
| [Rich text editor](https://help.shopify.com/en/manual/shopify-admin/productivity-tools/rich-text-editor) | Formatting, media, HTML and filtering |
| [Product details](https://help.shopify.com/en/manual/products/details/product-details-page) | Editor groups and product information |
| [Product descriptions](https://help.shopify.com/en/manual/products/details/product-descriptions) | Authoring context |
| [AI tools](https://help.shopify.com/en/manual/ai-powered-tools) | Capability catalog |
| [Sidekick](https://help.shopify.com/en/manual/ai-powered-tools/sidekick) | Assistant context and task support |
| [Generated content](https://help.shopify.com/en/manual/ai-powered-tools/sidekick/generate-content) | Content previews and capability limits |
| [Sidekick setup](https://help.shopify.com/en/manual/ai-powered-tools/sidekick/set-up) | Context, permissions and review |
| [Sidekick guidance](https://help.shopify.com/en/manual/ai-powered-tools/sidekick/help-and-guidance) | Assistance entry context |
| [Polaris](https://shopify.dev/docs/api/polaris) | Current developer design-system entry |
| [Using web components](https://shopify.dev/docs/api/polaris/using-polaris-web-components) | Semantic props, forms, responsive and accessible components |
| [Web-component catalog](https://shopify.dev/docs/api/app-home/latest/web-components) | App-facing component taxonomy |
| [Button](https://shopify.dev/docs/api/app-home/latest/web-components/actions/button) | Action component context |
| [Box](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/box) | Layout component context |
| [Page](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/page) | Page composition context |
| [Table](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/table) | Responsive rows/list, pagination and loading |
| [Modal](https://shopify.dev/docs/api/app-home/latest/web-components/overlays/modal) | Overlay component context |
| [Empty state](https://shopify.dev/docs/api/app-home/latest/web-components/feedback-and-status-indicators/empty-state) | First-use component context |

App-facing developer contracts are not a claim that every internal native-admin page uses the same component implementation or API version.

## Follow-up first-party theme app and loading sources

These sources were consulted for relevant sections, not necessarily read in full. Live Horizon controls remain the primary evidence for this account's exact appearance.

| Source | Scope used / review limit |
| --- | --- |
| [Theme editor overview](https://help.shopify.com/en/manual/online-store/themes/customizing-themes/theme-editor) | Task and theme-specific editor context |
| [Editor features](https://help.shopify.com/en/manual/online-store/themes/customizing-themes/theme-editor/features-overview) | Dual/stacked sidebar modes, divider, toolbar and Canvas distinction |
| [Preview inspector](https://help.shopify.com/en/manual/online-store/themes/customizing-themes/theme-editor/preview-inspector) | Selection and documented mobile behavior; no mobile two-tap test claimed |
| [Theme structure](https://help.shopify.com/en/manual/online-store/themes/theme-structure) | Template/section/block terminology |
| [Sections and blocks](https://help.shopify.com/en/manual/online-store/themes/theme-structure/sections-and-blocks) | Structural compatibility context, not a completed drag/drop test |
| [Theme documentation](https://help.shopify.com/en/manual/online-store/themes/theme-support/documentation) | Theme-specific support context |
| [Keyboard shortcuts](https://help.shopify.com/en/manual/shopify-admin/productivity-tools/keyboard-shortcuts) | General reference; live editor hints retained where combinations differ |
| [Online code editor](https://shopify.dev/docs/storefronts/themes/tools/online-editor) | Search-result excerpt only; subsequent full open failed; no broad source review claimed |
| [App management](https://help.shopify.com/en/manual/apps/managing-apps) | Installed-app details, access/privacy/activity, billing, extensions and development entry |
| [Activity/permission release](https://changelog.shopify.com/posts/track-app-activity-and-permissions-from-settings) | March 2026 release context |
| [Extension/function visibility release](https://changelog.shopify.com/posts/see-which-apps-use-extensions-and-functions-to-power-your-checkout-online-store-and-more) | April 2026 release context |
| [Store permissions](https://help.shopify.com/en/manual/your-account/users/roles/permissions/store-permissions) | App installation versus charge authority; no restricted-role test |
| [Extension configuration](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration) | App block versus app embed targets/activation |
| [Loading API](https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/loading-api) | App-facing show/hide lifecycle; not native-router implementation evidence |
| [Public Judge.me listing](https://apps.shopify.com/judgeme) | Direct browser inspection of listing composition; vendor claims not independently validated |

Third-party forum/video results encountered during searching were not used as technical authority.

## Archive and standards

The public [Polaris React archive](https://github.com/Shopify/polaris-react-archive) was archived on **11 September 2026**. The source reference is pinned to commit [3f7954ae42fabf26d63cee68c23ceebfd7ef0972](https://github.com/Shopify/polaris-react-archive/tree/3f7954ae42fabf26d63cee68c23ceebfd7ef0972), dated 9 September 2026. Current developer guidance points to web components.

The source manifest records 25 downloaded TypeScript files and their SHA-256 hashes. Selected token/source excerpts were inspected. The derived JSON resolves 430 base entries across color, space, font, text, border, breakpoints, height, width, z-index and motion. Its color count includes a color-scheme entry; it is not 226 opaque colors. The resolver does not materialize every expression, shadow or theme override.

- [Source manifest](evidence/archived-source-manifest.json)
- [Derived historical reference](evidence/archived-polaris-token-reference.json)
- [Historical color CSV](evidence/archived-color-reference.csv)
- [WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [WCAG non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- [WCAG target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [WCAG reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)

A standards link supplies evaluation criteria, not a Shopify conformance claim.

## Failed or superseded source routes

The old `app-home/using-polaris-components` route did not resolve. Guessed older login-services, switching-stores and productivity-search paths were replaced by the verified current login-services, store-switcher and admin-search pages. Older staff-account guidance was not used as the current invitation authority. A legacy standalone Polaris-tokens repository was not treated as the latest token source.

## Privacy and preservation

Saved textual captures replace the test store, account name, email and query parameters. Private General/Billing/Users values are omitted from role inventories. Safe image crops exclude the account/store footer and domain address rows where necessary. The verification code from the supplied email is not included.

Research interactions did not send invitations, messages or webhooks; upload media; connect a domain; change credentials/security; buy a plan/domain; install an app; activate an AI channel; publish content; or issue a gift card. The single AI prompt used fictional, non-sensitive product facts.

The June 2026 documents in the parent directory remain historical. This dated snapshot supplies newer evidence and explicitly supersedes old visual assumptions only for the observed refreshed account. Neither study changes LetBuyy's governance or canonical implementation.

## Delivery validation

All **12 research chapters and the index** passed local link checks. Evidence JSON parsed successfully and the color atlas SVG passed XML parsing. Selected first-pass screenshots and all 26 follow-up image exhibits were reviewed for content, cropping and privacy. The follow-up review corrected the loading-preview caption and separated blank mobile-preview crops from resolved artwork. Text captures were scanned for personal identifiers, email addresses, JWTs, session-bearing account URLs, credential values and record identifiers; remaining numeric theme/dashboard IDs were redacted.

`git diff --check` passed. The repository's required `node scripts/validate-governance.mjs` gate was rerun for the follow-up and passed **114 validators**, with zero failures or blocked validators. Its five declared branch/ref advisories remain repository context. This documentation-only task did not change application source and did not run a full application build or certify Shopify's behavior through those governance checks. The evidence manifest covers nested follow-up files with byte sizes and SHA-256 hashes; its own file is excluded from self-hashing.
