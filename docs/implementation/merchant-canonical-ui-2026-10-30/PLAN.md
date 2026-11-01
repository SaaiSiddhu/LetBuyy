# Merchant web canonical UI and workflow convergence

**Status:** IN PROGRESS — 30 October 2026. This is the target plan; current implementation and acceptance evidence are recorded in `IMPLEMENTATION_LEDGER.md` and `ROUTE_LEDGER.csv`.

## Objective and boundary

Make `apps/merchant/web` one coherent merchant operating workspace: a single canonical `@letbuyy/ui`/`AppNavigation` shell, one token source, consistent navigation and feedback, truthful data and actions, and verified light/dark and responsive states. Complete the existing merchant routes through the canonical API and identity boundaries. Remove proven-unused presentation code and assets after their replacements pass deletion validation.

“No hardcoded UI” means no fabricated merchant facts, provider outcomes, capabilities, permissions, counts, prices, or persisted action results. Route names, accessible labels, design tokens, enum mappings, and genuinely static explanatory copy remain source-controlled by design. The UI cannot grant authority: the server owns session, site, role, operation, and provider truth.

Scope is Merchant web, the generic shared UI pieces it consumes, and the necessary contracts in existing canonical services. This is not authorization to add a runtime, a second shell/token source, new money authority, or a Shopify-scale capability. Native Merchant parity is a follow-on consumer of generated tokens and navigation concepts, not a parallel web redesign.

## Governing decisions

- Constitution ART-20 and root `AGENTS.md` UI-R1/R2: `packages/typescript/ui/src/tokens.ts` is the web token authoring source and `AppNavigation` is the shell. Extend shared primitives where a reusable behavior is missing; keep store-specific composition in Merchant web.
- Root CODE-R7/UI-R5: functional web icons use Lucide React. The recent Merchant navigation SVG mask assets need a governed replacement or a human-ratified exception; the brand logo and decorative illustrations are distinct assets.
- Root UI-R3/R4/R6/R7: light and dark, interaction states, accessibility, provider-mode honesty, and drift blocking are acceptance requirements.
- Root ARCH-R17: Merchant owns presentation and transport composition; `api-gateway` owns authorization, commerce commands, and tenant enforcement. `identity-platform` remains the sole issuer.
- Root DEL-R1–R6 and Constitution ART-24: no bulk deletion. Classify every candidate, prove zero importers or live winner plus parity, retarget asserting validators, run build/test/governance, and keep rollback possible.
- DOC 03 registry rows 27 and 35: Merchant OS and design-system winners are already named. Do not create a replacement Merchant framework or a new design-system package.

## Current source observations that shape the work

1. Current `develop` has extensive uncommitted UI work and was one commit behind `origin/develop` at this planning snapshot. Preserve these changes and inspect the remote delta before integration; no reset, blind pull, or duplicate worktree migration.
2. `apps/merchant/web/src/components/AdminShell.tsx` composes `AppNavigation`, but still owns Merchant rail, drawer, popover, breakpoint and scroll behavior. `SettingsShell.tsx` renders a separate settings navigation tree beside it. Unify the contract without losing the two-column Settings layout.
3. `apps/merchant/web/src/app/globals.css` is 10,592 lines. A bounded search found 1,246 lines matching raw pixel declarations and 208 lines matching literal color functions/hex, plus local `--lb-*` overrides. These are investigation counts, not a deletion list.
4. `MerchantSidebarIcon.tsx` maps navigation names to 11 SVG masks and falls back to `MaterialIcon`. That conflicts with the current Lucide rule for functional web icons. Avoid deleting the assets until visual, navigation, and dependency proof passes.
5. The route inventory records 80 `page.tsx` routes, 57 explicit no-data routes, and 59 generated transparent PNG scenes. `MerchantEmptyArtwork` currently uses `unoptimized` and `loading="eager"`; the generated asset directory is about 48 MB. Existing `Emptystate Illustration` is about 18 MB and appears to have no source reference in a bounded Merchant search. Both need whole-repo and runtime-reference proof before cleanup.
6. `settings/page.tsx` calls every item without `status: 'backend-needed'` “available now.” That is navigation metadata, not evidence the entire workflow works. Replace with a truthful capability/readiness contract or honest route-level status.
7. `NotificationsPanel.tsx` fetches notifications, but “Mark all read” only changes local state and “View all notifications” has no action. `AdminShell.tsx` supplies an empty AI toggle callback on Settings. These are first-priority action audits, not proof that all other controls are unwired.
8. The store layout already fetches authorized session and current-store data, with the optional store-switcher list loaded separately. Preserve this security and latency pattern; map every subsequent read to actor/site scope.
9. The shared UI package already contains tokens, AppNavigation, feedback, a theme provider, component tests, Storybook and validators. Canonicalization should finish and adopt these boundaries, not replace them.

## Deliverable 0 — baseline and coverage ledger

Before product edits, capture the exact Git tree, current untracked assets, recent remote delta, active runtime identity, and existing test results. Keep the owner's work intact. Establish one route ledger for all 80 current routes and every directly rendered child workspace. Each row records:

`route · site type · actor/grant · primary task · shell mode · navigation entry · current data owner · API endpoint/schema · read states · write intents · persistence/readback · downstream consumer · provider mode · light/dark · mobile/tablet/desktop · accessibility · asset · status · evidence`.

Classify every route as **complete and verified**, **source-wired but unverified**, **partial**, **truthfully unavailable**, **redirect/flow**, or **candidate for gated removal**. Do not infer completeness from the 57 illustration links or a page rendering. Record a concise screenshot and request trace for representative Home, Orders, Products, Customers, Money, Online Store, Settings, and a non-store site type.

**Exit:** every route and shared shell action has a named owner and disposition; high-risk false-ready or dead controls are listed first. No code or asset is deleted in this step.

## Deliverable 1 — canonical shell contract

Define a small, typed Merchant shell model using authenticated current-store and user projections: site type, permitted navigation, store display information, active route, plan/trial state, and provider-mode facts. The server remains authoritative; the model is presentation data, not a permissions engine. Use one `AppNavigation` instance for the primary rail and main page plane. Extend its generic API only for reusable slots/behaviors; Merchant owns its brand, header, store switcher, Settings secondary panel, AI panel, and routes.

The responsive contract is explicit:

- Desktop: expanded or collapsed rail; content uses the agreed tiny right/bottom inset and small corners.
- Tablet: docked icon rail plus Settings secondary sidebar, both in flow; content remains visible and independently scrollable.
- Phone: one modal navigation drawer with correct focus entry/trap/return, Escape/outside dismissal and scroll lock; content is edge-aligned and never horizontally clipped.
- Fullscreen checkout and theme editor flows: intentional shell bypass, with a direct return path.

Remove duplicated shell state and scroll rules only after browser equivalence. Retain the existing collapsed preference as a non-secret UI preference; handle storage errors and cross-route/store changes safely. Keep keyboard and pointer paths equivalent for rail popovers.

**Exit:** a single shell/scroll/overlay state machine, route-computed active state, working focus and responsive behavior; Settings is a secondary navigation region within that shell, not another app shell.

## Deliverable 2 — navigation and capability truth

Make one typed navigation registry drive primary nav, Settings nav, rail popovers, command palette, shortcuts, breadcrumbs and mobile drawer. Preserve site-type distinctions and direct links. Route metadata can be static; visibility/actionability must come from the authenticated capability/grant projection and current backend readiness, with server enforcement on every destination and command. Distinguish **hidden by role**, **unavailable backend**, **not configured**, and **temporarily failed**.

Audit every destination for a valid route and useful result. Keep Add product inside Products. Replace static “available now” counts derived from nav metadata with actual supported capability/readiness data, or remove the count until such data exists. Make search results and keyboard shortcuts respect the same route and authorization model. Preserve an active ancestor for subroutes and unique active leaf semantics.

**Exit:** no dead navigation links; no UI-only privilege grants; one registry gives consistent labels, paths, groups, active state and hints across all nav entry points.

## Deliverable 3 — tokens, typography and components

Map every Merchant visual role to `tokens.ts`: page/surface/sidebar, foreground hierarchy, focus, borders, elevation, spacing, density, radii, motion, status, and font roles. Keep the accepted dark brand shell and light content identity; make a usable, reachable dark content mode. Preserve the approved logo. Move generic token changes into `@letbuyy/ui`; keep only Merchant layout selectors in app CSS. Remove app-local `--lb-*` redefinitions after comparing computed output in both themes and other shared-UI consumers.

Refactor the 10.5k-line CSS by ownership, not by a mass rewrite: record selector usage, duplicate precedence and computed wins; migrate one surface family at a time; move generic styles into shared components; reduce raw values where a token exists; verify visual output before deleting an old rule. Canonicalize page headers, cards, buttons, inputs, tables, tabs, pills, alerts, empty states and status/`ProviderModeBadge` semantics. Keep money and quantity values tabular and maintain readable compact density.

Migrate functional Merchant icons to the canonical Lucide family while preserving the intended grey hierarchy and selected contrast. Treat SVG masks as transitional until visual parity and accessibility checks pass. Keep logo and illustrations as brand/decorative assets.

**Exit:** one token authoring source; no new naked visual literals or duplicate component skins; both themes and all interaction states work; shared consumers have no regressions.

## Deliverable 4 — truthful states and assets

Give each async data surface distinct **loading, empty, no-match, error-with-retry, unavailable, denied, stale, conflict, processing, unknown-commit and success** states as applicable. Never turn a failed request into an empty list or display a mock/sandbox outcome as live success. Reuse shared feedback and provider-mode components with domain-specific status mappings.

Retain the 59 scene registry only where an illustration helps the task. Ensure every scene key resolves to a real asset; provide an appropriate dark-mode treatment and localized text stays outside artwork. Optimize PNG dimensions/format and delivery, load scenes only when visible, and measure bundle/network cost. Decorative art remains `alt=""`/hidden from assistive technology; title, explanation and next action stay semantic text. Compare the old and new artwork visually before deleting either.

**Exit:** all 57 recorded no-data routes and any newly found states use the canonical primitive; artwork loads only when needed within a measured asset budget; no legacy illustration reference remains after a proven replacement.

## Deliverable 5 — real data and action wiring, by domain slice

For every route, trace **screen → typed Merchant client/Next boundary → mounted `/v1` API → authorized transaction/outbox/provider/job → durable readback → every affected consumer**. Use shared domain types/Zod and existing endpoints. When a contract is missing, complete it in the canonical `api-gateway`/worker boundary with pagination, idempotency, tenant scope, audit and truthful provider status as needed; never invent a parallel Merchant-only authority. Disable or remove an unsupported control until its operation can be completed honestly.

Implement and verify in slices:

1. **Shell actions:** store switch, search, notifications read state/list route, AI panel presence, trial/plan links, sign-out, error recovery and settings readiness. Fix the local-only/inert controls named in the observations.
2. **Catalog:** Products list/detail/create, collections, categories, variants/media, import/export, stock, reservations, locations, vendors, purchase orders, transfers and receipts. Preserve server-side matching, counts, permissions and stock transitions.
3. **Orders and Customers:** list/detail/direct links, bounded filters, permitted actions, durable status/receipt, customer associations and segments. Distinguish application delivery from provider/carrier evidence.
4. **Money and Settings:** payment connection, test/live readiness, COD, billing/plan, payouts, shipping, taxes, checkout, domains, notifications, access and security. Show provider mode; verify setting save, persisted readback and downstream buyer/order effect where applicable.
5. **Online Store and growth:** themes/editor/publish/preview, pages/preferences, content, campaigns, reviews, analytics and other supported site types. Keep drafts distinct from published output. Include public SEO/metadata checks for settings that control discoverable pages.

For each slice, test own-store success beside forbidden cross-store access, stale membership, permission withdrawal, late responses, direct detail entry, lost mutation response, retry with the original intent, and unaffected primary content when an optional section fails. Do not broaden a surface into a new product capability merely because a control exists.

**Exit:** every reachable action either produces an authorized durable result and readback or is explicitly unavailable with an honest explanation; route ledger rows close on evidence, not visual polish.

## Deliverable 6 — deletion and repository cleanup

Create a candidate manifest for duplicate CSS, old component forks, Material/icon-mask usage, previous logos, `Emptystate Illustration`, starter Next assets, duplicate illustrations, unused routes, dead tests and abandoned helper code. Each candidate needs **owner, reference graph, runtime/static URL use, classification, replacement, validator, proof, rollback**. Search the entire repo and built asset references, not only TS imports. Retain licensed font notices and any asset used by another runtime.

Delete small zero-importer presentation assets first. For a load-bearing component/route, prove the canonical replacement is serving and behavior/visual parity passes before removing the old one. Retarget any validator that asserts an old path in the same change. Run import, build, behavioral, governance and deletion checks on a branch; use an isolated checkout for governance cleanup that can remove `node_modules`. Keep each deletion reviewable and revertible. Do not apply this UI cleanup plan to database tables, money, identity, theme renderers, or reserved roots.

**Exit:** every removed file has a recorded gate and no missing route/asset; remaining transitional code has an explicit owner and removal trigger.

## Deliverable 7 — acceptance, CI and release candidate

Run affected Merchant and `@letbuyy/ui` typecheck, lint, component/contract tests, token/API snapshot validators, stylelint and design-system drift gate. Use Storybook plus browser visual comparisons of representative pages at narrow phone, tablet, desktop, 200% zoom, long text, light/dark and reduced motion. Exercise keyboard, focus, screen-reader names, touch targets, contrast, modal/popover closure and browser back/forward. Measure useful content, request count, asset transfer and scroll behavior on a production build, not only dev mode.

For backend-connected slices, run owned DB/integration and security tests appropriate to the touched authority; preserve provider-mode distinctions. Recheck route ledger from direct entry and with separate role/store identities. Capture exact build/source/config identity and remaining unverified states. No hosted promotion follows automatically from local green checks.

**Exit:** zero unresolved dead controls or false-success states, all 80 current routes dispositioned, no regression in other `@letbuyy/ui` consumers, deletion gates green, and a reviewable release candidate with rollback notes.

## Execution order and checkpoints

`0 baseline/ledger → 1 shell → 2 navigation/capabilities → 3 tokens/components → 4 states/assets → 5 domain wiring in slices → 6 gated deletions → 7 full acceptance`.

The first implementation slice should be **shell + Settings + notifications/readiness**, because it tests the canonical composition and exposes the clearest current false-action/false-availability cases. After that, finish one end-to-end domain journey before sweeping all pages. Keep the route ledger current after every slice; a visually complete page with missing API or readback stays open.

## Planning limits

This plan is grounded in a bounded source review of the current checkout, the earlier 80-route empty-state inventory, and project authority. It is not an exhaustive current API/dead-code audit. No product source edit, test run, deletion, provider operation or deployment was performed for this planning turn. The route ledger and deletion candidate manifest are the first implementation artifacts needed before claiming complete coverage or removing files.
