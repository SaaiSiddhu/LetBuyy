# LetBuyy — Top 200 Issues Blocking Shopify-Level Platform Consistency (Phase 13)

**Date:** 2026-06-08. Every item is grounded in a source read or `grep` (see Discovery / Token Audit) or a named reference-system best practice. This is a working backlog, not prose.

**Legend**
**Sev** S1 critical (breaks UX/a11y or guarantees drift) · S2 high · S3 medium · S4 minor.
**Pri** P0 (now / foundation) · P1 (this quarter) · P2 (next) · P3 (later) · P4 (opportunistic).
**Impact** B = business/brand, D = developer velocity, A = accessibility, X = cross-platform.
**Apps** ALL = 9 web apps; MCP = merchant-control-plane; SF = storefront-runtime; AM = app-marketplace; TM = theme-marketplace; ID = identity; DP = developer-portal; PC = platform-console; OPS = operations-portal; MKT = marketing-site; MOB = mobile.

---

## The 25 that matter most (expanded)

| # | Issue | Sev | Impact | Apps | Fix | Pri |
|--:|---|:--:|:--:|---|---|:--:|
| 1 | **No `dist` build — package ships raw `src` (`main: ./src/index.ts`).** Blocks independent versioning/publishing and external (plugin/theme dev) consumption; couples every app's build to DS internals. | S2 | D | ALL | Add `tsc -b` dist + `exports` map to built artifacts; keep src for types. | P0 |
| 2 | **No semver / `changesets`; pinned at `0.0.2` under 9 apps + mobile.** No contract for breaking changes; consumers can't reason about upgrades. | S1 | D,B | ALL | Adopt `changesets`, move to `1.0.0`, enforce changeset-on-PR in CI. | P0 |
| 3 | **~613 raw Tailwind default color utilities** (`bg-white`×251, `text-gray-500`-style ×362) bypass tokens and **do not switch in dark mode**. | S1 | B,A | ALL | Restrict Tailwind palette in shared preset to `--lb-*`; codemod offenders; lint. | P0 |
| 4 | **Parallel `rgb()` token systems in every `globals.css`** ("synced by hand"): 382 raw colors MCP, 304 MKT, 235 AM. Drift by construction; unlinted. | S1 | B,D | ALL | Replace per-app color blocks with generated token CSS; Stylelint-ban raw color in `.css`. | P0 |
| 5 | **Mobile Dart tokens are a separate, already-drifted source** (extra pink/cyan/teal, full slate ramp, different spacing, no dark/semantic layers). | S1 | X,B | MOB | Generate Dart from one DTCG source; delete hand-maintained copy. | P0 |
| 6 | **No W3C DTCG / Style Dictionary pipeline.** Bespoke TS→CSS generator can't emit Figma/Dart/iOS; root cause of #4/#5 and of no design↔code parity. | S1 | D,X,B | ALL+MOB | Move token source to DTCG; Style Dictionary emits CSS/Tailwind/Dart/Figma. | P0 |
| 7 | **No design documentation site & no Figma kit.** 10 teams build against tribal knowledge; no usage/do-don't/a11y/content guidance. | S1 | D,B | ALL+MOB | Stand up docs site (Storybook Docs/zeroheight) + Figma library in DTCG parity. | P0 |
| 8 | **Overlays don't portal** (`createPortal` in 0 files); `Dropdown`/`Popover` render in-flow `absolute` → clipped by `overflow:hidden`/transformed ancestors; z-index tokens defeatable. | S1 | A,B | ALL | Portal overlays to body (or adopt Floating UI/Base UI); keep z-index tokens. | P0 |
| 9 | **Incomplete primitive color ramps** (`gray` skips 300/600/700/800; `purple` 300/500/600/700 only) force **raw hex into the semantic layer** (`#5B21B6`, `#4C1D95`, `#CBD5E1`, `#FCA5A5`, `#7DD3FC`). DS exempts itself from `no-hardcoded-hex`. | S2 | B,D | ALL | Generate full OKLCH ramps; remove raw hex from semantic tokens. | P0 |
| 10 | **Automated a11y testing is ~nonexistent** (2 jest-axe files, 1 component test for ~60 components); no axe-in-CI gate; no WCAG target declared. | S1 | A,B | ALL | Set WCAG 2.2 AA target; axe per story in CI; manual SR pass on overlays/forms. | P0 |
| 11 | **ESLint fence is narrow:** only `<button>/<input>/<table>` + hex. `<select>/<textarea>/<a>/<dialog>` and `rgb()/hsl()` pass. ~12 raw elements remain. | S2 | A,B | AM,TM,MCP | Extend `no-raw-elements` to all interactive/semantic elements; ban raw color funcs. | P0 |
| 12 | **No component "definition of done."** Quality is inconsistent because there's no gate (Carbon-style: spec+code+test+a11y+docs+Figma). | S2 | D,B | ALL | Adopt a DoD checklist; block "stable" status without it. | P1 |
| 13 | **No written ownership / contribution / RFC model.** Enforcement exists; *decision rights* don't. Drift starts when contribution scales past the core team. | S2 | D | ALL | Define hybrid model: core owns tokens/primitives/process; RFC for new components. | P1 |
| 14 | **No component lifecycle/status** (EA/Beta/GA/Deprecated). Consumers can't tell stable from experimental. | S3 | D | ALL | Add status labels (à la ADS release phases) in docs + types. | P1 |
| 15 | **Alias sprawl already in production**, only *frozen* by `no-new-alias` (space numeric+named; type `h1–h4`+roles; color `bg`+`background`, `border`+`borderDefault`). | S3 | D | ALL | Pick canonical names; codemod; **remove** aliases at next major. | P1 |
| 16 | **Breakpoint tokens not wired into apps.** `letbuyyTailwindPreset` used by 0 apps; apps use Tailwind defaults; `2xl:` hits an undefined breakpoint. | S2 | B,D | ALL | Ship shared Tailwind preset to all apps; define/forbid `2xl`. | P1 |
| 17 | **storefront-runtime: 691 `rgb()` + 42 inline-`style` files.** Partly legitimate (per-merchant theming) but a large ungoverned color surface. | S2 | B,A | SF | Channel merchant theme through a typed `brand`/theme token API; lint the rest. | P1 |
| 18 | **Hand-rolled focus/dismiss/inert** in `overlay-hooks.ts` instead of a headless primitive lib; large a11y surface to maintain forever. | S2 | A,D | ALL | Adopt Base UI/Radix/Floating UI for overlay mechanics; keep LB styling. | P1 |
| 19 | **No adoption telemetry.** High de-facto adoption isn't *measured* (no coverage %, no DX survey); can't prove progress or find bypass hotspots. | S3 | B,D | ALL | Add coverage metric (import/visual/render) à la stylelint-polaris; quarterly DX survey. | P1 |
| 20 | **`validateLetbuyyBrandContrast` is a callable, not a CI gate**, and checks only 3 tokens. Brand/white-label can ship failing contrast. | S2 | A,B | ALL | Gate all text/status-on-surface pairs in CI; fail build on AA miss. | P1 |
| 21 | **No `prefers-color-scheme` ↔ stored-theme reconciliation** beyond a per-app inline `localStorage` script "synced with accounts by hand." Flash/mismatch risk across surfaces. | S3 | B | ALL | Centralize theme bootstrap in DS (one script/util); SSR-safe. | P1 |
| 22 | **Thin Storybook coverage** (7 catalog stories) — most of ~60 components have no per-component story/controls/docs page; weakens VRT + docs. | S3 | D | ALL | One story per component w/ args + a11y + docs; expand VRT matrix. | P1 |
| 23 | **No content/UX-writing guidelines** (voice, casing, error messages, empty-state copy). Polaris/ADS treat this as core. | S3 | B | ALL | Author content guidelines + lint terminology (e.g. "delete" vs "remove"). | P2 |
| 24 | **No VPAT / accessibility conformance statement.** Blocks enterprise/B2B sales requiring a11y attestation (cf. Stripe's "$10M unlocked", Cloudflare VPAT). | S3 | B | ALL | After axe-in-CI + audit, publish a VPAT. | P2 |
| 25 | **Mobile app consumes 0% of the design system** and has 136 screens; web↔mobile parity is undefined. | S1 | X,B | MOB | DTCG → Dart tokens + a Flutter component parity spec mapped to `@letbuyy/ui`. | P1 |

---

## A. Color & token integrity (26–43)

| # | Issue | Sev | Apps | Fix | Pri |
|--:|---|:--:|---|---|:--:|
| 26 | `gray` ramp non-monotonic spacing (50,100,125,150,175,200,400,500,900) | S3 | DS | Regenerate even ramp | P1 |
| 27 | `purple` ramp missing 100/200/400/800/900 | S3 | DS | Full ramp | P1 |
| 28 | Status hues only have 100/500/700/950 → limited tints for charts/badges | S3 | MCP,AM | Extend to 10 steps | P2 |
| 29 | Raw hex `#5B21B6`/`#4C1D95` in `button.primary.hover/active` | S2 | DS | Reference `purple.800/900` | P0 |
| 30 | Raw hex `#CBD5E1` (`textSecondaryDark`) | S3 | DS | `slate.300` | P1 |
| 31 | Raw hex `#FCA5A5`/`#7DD3FC` in dark statusText | S3 | DS | `red.300`/`blue.300` | P1 |
| 32 | `opacity` tokens mix `rgba()` and `rgb / %` syntaxes | S4 | DS | Normalize to `color-mix`/one syntax | P3 |
| 33 | Semantic `border.subtle === border.default` (both gray200) — no real subtle tier | S4 | DS | Distinct subtle value | P3 |
| 34 | `textMuted === textSecondaryLight` (gray500) collapses two roles | S4 | DS | Distinct muted value | P3 |
| 35 | No semantic tokens for data-viz categorical series (charts ad hoc) | S3 | MCP,PC,OPS | Add chart palette tokens | P2 |
| 36 | No `color-bg-success/warning/critical-strong` for solid status fills beyond soft | S4 | DS | Add strong-fill tokens | P3 |
| 37 | Brand contrast check covers 3 tokens; secondary/critical/links unchecked | S2 | ALL | Expand matrix | P1 |
| 38 | `criticalHover` uses primitive `red.600` directly in color map (layer skip) | S4 | DS | Route via semantic | P3 |
| 39 | No high-contrast theme (only light/dark); WCAG/forced-colors users unserved | S3 | ALL | Add `contrast` theme (cf. ADS/Linear) | P2 |
| 40 | No `forced-colors` / Windows High Contrast handling | S3 | ALL | Add `@media (forced-colors)` | P2 |
| 41 | Token CSS injected via `dangerouslySetInnerHTML` per root; no nonce/CSP hook | S3 | ALL | Support CSP nonce; or build-time CSS | P2 |
| 42 | `--lb-*` token count is large & undocumented; no token reference page | S3 | ALL | Generate token docs from source | P1 |
| 43 | No deprecation metadata on tokens (only `deprecatedTokenAliasVariables` set) | S4 | DS | Add `$deprecated` in DTCG | P3 |

## B. Theming & dark-mode correctness (44–57)

| # | Issue | Sev | Apps | Fix | Pri |
|--:|---|:--:|---|---|:--:|
| 44 | ~613 Tailwind palette utils don't react to dark mode | S1 | ALL | Codemod→tokens | P0 |
| 45 | `globals.css` raw `rgb()` values not theme-aware | S1 | ALL | Token CSS | P0 |
| 46 | Per-app theme bootstrap scripts duplicated, "synced by hand" | S3 | ALL | DS-provided bootstrap | P1 |
| 47 | `.dark` class + `[data-theme]` + `[data-letbuyy-theme]` three toggle conventions coexist | S3 | ALL | One convention | P1 |
| 48 | Surface theming (`data-letbuyy-surface`) defined but app usage unverified/partial | S3 | ALL | Audit + enforce surface per app | P2 |
| 49 | No per-merchant brand theming wired in storefront (uses inline rgb instead of `brand` API) | S2 | SF | Route via `createLetbuyyBrandVariables` | P1 |
| 50 | Dark-mode card/border contrast not audited against WCAG | S3 | ALL | Contrast audit dark pairs | P2 |
| 51 | No theme transition handling (instant flip; potential flash) | S4 | ALL | `color-scheme` + transition policy | P3 |
| 52 | `theme="auto"` + manual `.dark` can conflict (two mechanisms) | S3 | ALL | Single source of theme state | P1 |
| 53 | No SSR theme resolution (client script sets class post-hydration) | S3 | ALL | Cookie-based SSR theme | P2 |
| 54 | Marketing site theming differs in scale (304 raw colors) — likely off-system | S2 | MKT | Re-base on tokens | P1 |
| 55 | No documented theming contract for plugin/app-marketplace embeds | S3 | AM,DP | Theming API for 3rd-party UIs | P2 |
| 56 | No dark-mode visual-regression matrix (baselines mostly light) | S3 | DS | Add dark VRT variants | P1 |
| 57 | Density × theme × surface combinatorial states untested | S3 | DS | Matrix VRT/stories | P2 |

## C. Tailwind / CSS divergence channels (58–69)

| # | Issue | Sev | Apps | Fix | Pri |
|--:|---|:--:|---|---|:--:|
| 58 | Tailwind default palette available everywhere (not restricted) | S1 | ALL | Restrict palette in preset | P0 |
| 59 | No Stylelint for `.css` (raw color/units ungoverned) | S1 | ALL | Add Stylelint + token rules | P0 |
| 60 | Arbitrary-value ergonomics (`bg-[var(--lb-...)]`) verbose & bypassable | S3 | ALL | Tailwind theme maps tokens→named utils | P1 |
| 61 | Each app re-implements font CSS vars in `globals.css` | S4 | ALL | DS exports font CSS | P2 |
| 62 | `@theme inline` blocks differ per app | S3 | ALL | Shared `@theme` from preset | P1 |
| 63 | No shared `tailwind` preset package consumed by apps | S2 | ALL | Publish `@letbuyy/tailwind-preset` | P1 |
| 64 | `@source` globs hand-listed per app (drift/omission risk) | S4 | ALL | Standardize via preset | P3 |
| 65 | Inline `style={{}}` in 42 SF + 5 ID + 4 MCP files | S3 | SF,ID,MCP | Token props / lint | P2 |
| 66 | No lint against arbitrary px in className (`p-[13px]`) | S3 | ALL | Lint arbitrary spacing | P2 |
| 67 | No lint against raw `rgb()/hsl()` in TSX (21 MCP, 691 SF) | S2 | SF,MCP | Extend hex rule to color funcs | P0 |
| 68 | Mixed class-ordering / no `tailwind-merge` discipline in apps | S4 | ALL | Prettier-tailwind + `cx` everywhere | P3 |
| 69 | Duplicate utility patterns re-declared instead of DS components | S3 | ALL | Promote repeated patterns to DS | P2 |

## D. Components — API & quality (70–88)

| # | Issue | Sev | Apps | Fix | Pri |
|--:|---|:--:|---|---|:--:|
| 70 | `unstyled` escape hatch on Button/Input invites silent divergence | S3 | ALL | Track usage; deprecate where possible | P2 |
| 71 | Modal backdrop is `aria-hidden` div w/ onClick; Drawer backdrop is `<button>` — inconsistent pattern | S4 | DS | Unify overlay backdrop | P3 |
| 72 | Two table codemods (`data-table-to-table`,`index-table-to-table`) imply 3 historical tables | S3 | MCP | Confirm one Table; remove legacy | P1 |
| 73 | No `Form`/`FormField`/`Fieldset` composition component (forms hand-assembled) | S2 | MCP,ID,AM | Add Form primitives | P1 |
| 74 | No `Banner`/`Toast` action-button contract documented | S3 | ALL | Document/standardize | P2 |
| 75 | `ConfirmDialog` ships opinionated default copy ("affect merchant data") | S4 | ALL | Neutral default / required prop | P3 |
| 76 | No `Pagination` + `Table` integrated pattern (assembled per app) | S3 | MCP,AM,TM | Provide combined recipe | P2 |
| 77 | No `DataGrid`/virtualized table for large lists (perf at scale) | S2 | MCP | Add virtualization | P2 |
| 78 | `Chart` is a single primitive; no typed chart variants/tokens | S3 | MCP,PC,OPS | Expand chart system | P2 |
| 79 | No `Tabs` deep-link/route binding pattern | S4 | MCP | Document pattern | P3 |
| 80 | `Select` is custom — verify native-vs-custom a11y + mobile behavior | S2 | ALL | a11y audit/Base UI | P1 |
| 81 | No `FileUpload`/`Dropzone` component (likely hand-rolled) | S3 | MCP,TM,AM | Add component | P2 |
| 82 | No `Stepper`/wizard for onboarding flows | S3 | ID,MCP | Add component | P2 |
| 83 | No `Tag`/removable-chip distinct from `Badge` | S4 | AM,TM | Add Tag | P3 |
| 84 | No `Card` interactive/link variant contract | S4 | AM,TM,DP | Define variants | P3 |
| 85 | Icon-only buttons rely on `aria-label` discipline (not enforced) | S3 | ALL | Lint icon-button labels | P2 |
| 86 | No `Tooltip` delay/positioning collision handling (no Floating UI) | S3 | ALL | Floating UI | P2 |
| 87 | `CommandPalette` focus/scroll behavior unverified at scale | S3 | MCP | a11y + perf test | P2 |
| 88 | No skeleton/loholder parity for every async surface | S3 | ALL | Skeleton recipes | P3 |

## E. Overlays, focus & portals (89–100)

| # | Issue | Sev | Apps | Fix | Pri |
|--:|---|:--:|---|---|:--:|
| 89 | No portals → clipping/stacking bugs (see #8) | S1 | ALL | Portal layer | P0 |
| 90 | No scroll-lock on Modal/Drawer open (background scrolls) | S2 | ALL | Add scroll lock | P1 |
| 91 | Focus restoration to trigger on close unverified | S2 | ALL | Test/guarantee return focus | P1 |
| 92 | `inert` used without polyfill guard for old browsers (comment notes risk) | S3 | ALL | Bundle/guard polyfill | P2 |
| 93 | Multiple stacked overlays (modal→dropdown) focus-trap interaction untested | S3 | MCP | Test nested overlays | P2 |
| 94 | No `Popover`/`Dropdown` viewport-collision flipping | S3 | ALL | Floating UI middleware | P2 |
| 95 | Tooltip on touch toggles on tap — may conflict with click targets | S4 | ALL | UX review | P3 |
| 96 | Esc handling duplicated across components (trigger + dismiss hook) | S4 | DS | Centralize | P3 |
| 97 | No `aria-modal` scrim click-label consistency (Drawer has label, Modal hidden) | S4 | DS | Unify | P3 |
| 98 | CommandPalette/Modal share no focus-manager abstraction | S3 | DS | Shared overlay manager | P2 |
| 99 | No max-height/scroll within long Dropdown menus | S4 | MCP | Add menu scroll | P3 |
| 100 | Z-index tokens can be defeated by app stacking contexts (no portal) | S2 | ALL | Portals + audit | P1 |

## F. Accessibility program (101–116)

| # | Issue | Sev | Apps | Fix | Pri |
|--:|---|:--:|---|---|:--:|
| 101 | No declared WCAG target | S2 | ALL | Adopt WCAG 2.2 AA | P0 |
| 102 | No axe-in-CI per component/story | S1 | ALL | Add jest-axe/Playwright-axe gate | P0 |
| 103 | No manual screen-reader test protocol (NVDA/VoiceOver/JAWS) | S2 | ALL | Add SR pass to DoD | P1 |
| 104 | WCAG 2.2 target-size (24×24) not verified for icon buttons/density compact | S2 | ALL | Audit hit areas | P1 |
| 105 | No skip-to-content link in AppFrame | S3 | ALL | Add skip link | P1 |
| 106 | Landmark structure (`main/nav/aside`) present in shell but not guaranteed per page | S3 | ALL | Page landmark lint | P2 |
| 107 | Color-only status signaling in Badge/Banner (icon redundancy?) | S3 | ALL | Ensure icon+text | P2 |
| 108 | Focus-visible ring contrast vs all surfaces not audited | S3 | ALL | Contrast audit | P2 |
| 109 | `select`/`textarea` can be raw (no a11y guarantees) | S2 | AM,TM | Extend lint | P0 |
| 110 | No reduced-data/`prefers-reduced-transparency` handling | S4 | ALL | Add media query | P3 |
| 111 | Charts lack keyboard/data-table fallback (cf. Cloudflare a11y charts) | S2 | MCP,PC,OPS | Accessible chart pattern | P2 |
| 112 | Form error summary / focus-on-error not standardized | S2 | MCP,ID | Form a11y pattern | P1 |
| 113 | No live-region strategy beyond Toast (`aria-live`) | S3 | ALL | Document live regions | P2 |
| 114 | Tables lack caption/scope/row-header conventions documented | S3 | MCP | Table a11y spec | P2 |
| 115 | No VPAT/conformance statement | S3 | ALL | Publish after audit | P2 |
| 116 | Apps render 0 `aria-*`? No — 1000 present, but unaudited for correctness | S3 | ALL | Audit aria misuse | P2 |

## G. Layout & responsiveness (117–130)

| # | Issue | Sev | Apps | Fix | Pri |
|--:|---|:--:|---|---|:--:|
| 117 | Breakpoint tokens unused by apps (#16) | S2 | ALL | Wire preset | P1 |
| 118 | `2xl:` used (3×) with no DS token | S3 | MCP | Define/forbid | P2 |
| 119 | Grid responsive classes hard-coded (sm/md/lg/xl maps), not token-derived | S3 | DS | Derive from breakpoint tokens | P2 |
| 120 | No documented responsive page templates (list/detail/settings) | S2 | ALL | Page templates | P1 |
| 121 | Sidebar widths fixed px (220/260/320), no responsive collapse contract | S3 | ALL | Responsive nav pattern | P2 |
| 122 | No mobile-nav (drawer) pattern for admin on small screens | S2 | MCP | Responsive AppFrame | P1 |
| 123 | `pageMax 1440` / `marketplaceContainer 1200` — no ultra-wide (>1440) strategy | S3 | ALL | Define wide behavior | P3 |
| 124 | Tables not responsive (horizontal scroll vs stack) policy undefined | S2 | MCP,AM | Responsive table pattern | P1 |
| 125 | No container-query usage (modern responsive primitive) | S3 | DS | Adopt container queries | P3 |
| 126 | Inconsistent page padding (Page hard-codes space-3 + sm:card-padding) | S4 | DS | Tokenize page padding | P3 |
| 127 | No print stylesheet for invoices/reports | S4 | MCP | Print styles | P3 |
| 128 | RTL support (`dir`) plumbed in root but untested | S3 | ALL | RTL audit | P2 |
| 129 | No `min`/`max` fluid spacing tokens beyond type | S4 | DS | Fluid space scale | P3 |
| 130 | Storefront responsive behavior diverges (custom CSS) | S3 | SF | Re-base on primitives | P2 |

## H. Governance & contribution (131–144)

| # | Issue | Sev | Apps | Fix | Pri |
|--:|---|:--:|---|---|:--:|
| 131 | No ownership model / CODEOWNERS for DS | S2 | DS | Assign core team + CODEOWNERS | P1 |
| 132 | No RFC process for new components/tokens | S2 | DS | RFC template + queue | P1 |
| 133 | No component status lifecycle | S3 | DS | EA/Beta/GA/Deprecated | P1 |
| 134 | No deprecation policy (warn→wait→remove) documented | S3 | DS | Policy + timeline | P1 |
| 135 | No breaking-change review board | S3 | DS | Change council | P2 |
| 136 | No design review / critique cadence | S3 | DS | Fortnightly critique (ADS-style) | P2 |
| 137 | `no-new-alias` validator freezes but doesn't reduce alias debt | S3 | DS | Reduction plan | P2 |
| 138 | No "definition of done" gate (#12) | S2 | DS | DoD checklist | P1 |
| 139 | No contribution docs for app teams | S3 | ALL | Contributor guide | P2 |
| 140 | No design-token request/intake flow | S4 | DS | Intake form | P3 |
| 141 | No ADR record of DS decisions | S4 | DS | ADR log | P3 |
| 142 | Governance scripts (200+ runtime validators) dwarf DS validators (3) — imbalance | S3 | repo | Invest validator effort in UI | P2 |
| 143 | No release notes/changelog discipline surfaced to consumers | S3 | ALL | Changesets → changelog | P1 |
| 144 | No cross-functional DS roadmap published | S4 | DS | Publish roadmap | P3 |

## I. Versioning, build & distribution (145–156)

| # | Issue | Sev | Apps | Fix | Pri |
|--:|---|:--:|---|---|:--:|
| 145 | No `dist` (#1) | S2 | ALL | Build artifacts | P0 |
| 146 | No semver/changesets (#2) | S1 | ALL | Adopt | P0 |
| 147 | Pinned `0.0.2` signals "anything breaks" | S2 | ALL | → 1.0.0 | P0 |
| 148 | No CHANGELOG automation (file exists, manual) | S3 | DS | Changesets-generated | P1 |
| 149 | No canary/preview releases for risky changes | S3 | DS | Snapshot releases | P2 |
| 150 | No bundle/treeshake verification (barrel `export *`) | S3 | ALL | Verify treeshaking | P2 |
| 151 | No published types separate from impl | S4 | ALL | `.d.ts` in dist | P2 |
| 152 | No subpath stability guarantees documented | S4 | ALL | Document exports | P3 |
| 153 | No upgrade guide per major | S3 | ALL | Version guides (Polaris-style) | P1 |
| 154 | Codemods exist but no `migrator` CLI wrapper | S3 | ALL | `@letbuyy/ui-migrator` CLI | P1 |
| 155 | No automated codemod CI dry-run on consumers | S3 | ALL | CI codemod check | P2 |
| 156 | No external (theme/app dev) distribution channel | S3 | DP,AM,TM | Publish for 3rd parties | P2 |

## J. Testing & QA (157–168)

| # | Issue | Sev | Apps | Fix | Pri |
|--:|---|:--:|---|---|:--:|
| 157 | 1 component unit test for ~60 components | S1 | DS | RTL tests per component | P0 |
| 158 | 2 jest-axe files only | S1 | DS | axe per story | P0 |
| 159 | VRT baselines skew light/desktop | S3 | DS | Add dark/density/mobile | P1 |
| 160 | No interaction tests (keyboard flows) | S2 | DS | Storybook play/Playwright | P1 |
| 161 | No contract tests for token CSS output | S3 | DS | Snapshot already partial—expand | P2 |
| 162 | No cross-browser VRT (Safari/Firefox) | S3 | DS | Add browsers | P2 |
| 163 | No perf budget/regression test | S3 | ALL | Lighthouse CI | P2 |
| 164 | No visual diff review workflow (Chromatic-style) | S3 | DS | Chromatic or equivalent | P2 |
| 165 | No e2e smoke per app using DS | S3 | ALL | Playwright smoke | P2 |
| 166 | No mutation/coverage threshold for DS | S4 | DS | Coverage gate ≥80% | P3 |
| 167 | No SSR/RSC render tests (`'use client'` boundaries) | S3 | ALL | RSC tests | P2 |
| 168 | No theming snapshot across surfaces | S3 | DS | Surface snapshot | P2 |

## K. Documentation & Figma/DTCG (169–182)

| # | Issue | Sev | Apps | Fix | Pri |
|--:|---|:--:|---|---|:--:|
| 169 | No docs site (#7) | S1 | ALL | Build it | P0 |
| 170 | No Figma kit / library | S1 | ALL+MOB | Figma in DTCG parity | P0 |
| 171 | No per-component usage/do-don't docs | S2 | ALL | Author docs | P1 |
| 172 | No token reference page | S2 | ALL | Generate from source | P1 |
| 173 | No content/UX-writing guidelines (#23) | S3 | ALL | Author | P2 |
| 174 | No accessibility docs per component | S2 | ALL | Add a11y notes | P1 |
| 175 | No migration/upgrade docs | S3 | ALL | Version guides | P1 |
| 176 | No "getting started" for new app/team | S3 | ALL | Onboarding doc | P1 |
| 177 | No AGENTS.md/AI-readable component registry (cf. Kumo) | S3 | DS | Add for AI tooling | P2 |
| 178 | Prior audit docs (`ui-system-audit/`) now stale vs v0.0.2 | S3 | repo | Supersede/date-stamp | P1 |
| 179 | No design principles statement | S3 | DS | Author principles | P2 |
| 180 | No icon catalog/search | S4 | ALL | Icon docs page | P3 |
| 181 | No do/don't for density/surface usage | S3 | ALL | Guidance | P2 |
| 182 | No examples gallery / recipes | S3 | ALL | Recipes section | P2 |

## L. Cross-platform / mobile (183–192)

| # | Issue | Sev | Apps | Fix | Pri |
|--:|---|:--:|---|---|:--:|
| 183 | Dart tokens drifted (#5) | S1 | MOB | DTCG→Dart | P0 |
| 184 | No web↔mobile component parity spec | S2 | MOB | Parity matrix | P1 |
| 185 | Mobile spacing grid differs (adds 2/6, drops 96) | S3 | MOB | Regenerate | P1 |
| 186 | Mobile has no dark/semantic/component token layers | S2 | MOB | Port layers | P1 |
| 187 | Mobile-only colors (pink/cyan/teal) not in canonical source | S2 | MOB | Reconcile palette | P1 |
| 188 | No shared design language doc spanning web+native | S3 | ALL+MOB | Cross-platform guidelines | P2 |
| 189 | Reserved `shopper-app`/`operator-app` will repeat the drift | S2 | MOB | Token codegen first | P1 |
| 190 | No motion/elevation parity web↔mobile | S3 | MOB | Define mappings | P2 |
| 191 | No typography parity (Geist web vs mobile fonts?) | S3 | MOB | Align type | P2 |
| 192 | No CI check comparing web vs Dart token values | S2 | MOB | Drift test | P1 |

## M. Per-app consistency (193–204)

| # | Issue | Sev | Apps | Fix | Pri |
|--:|---|:--:|---|---|:--:|
| 193 | marketing-site has 304 raw colors / lowest DS density (13 instances) — most off-system | S2 | MKT | Re-base | P1 |
| 194 | app-marketplace has 5 raw elements + lower DS instance ratio | S3 | AM | Convert | P2 |
| 195 | theme-marketplace 6 raw elements | S3 | TM | Convert | P2 |
| 196 | storefront-runtime large inline/rgb surface (#17) | S2 | SF | Theme API | P1 |
| 197 | Identity has 5 inline-style files | S3 | ID | Tokenize | P2 |
| 198 | Inconsistent nav/sidebar usage (AppFrame imported by 0 app files) | S2 | ALL | Adopt AppFrame or document alt | P1 |
| 199 | Page header identity system adoption uneven across apps | S3 | ALL | Enforce PageHeader | P2 |
| 200 | Empty/loading/error states not standardized across apps | S2 | ALL | Standard states | P1 |
| 201 | Toized terminology differs across apps (labels/casing) | S3 | ALL | Content lint | P2 |
| 202 | Per-app font wiring duplicated (geist localFont) | S4 | ALL | DS font module | P3 |
| 203 | Per-app theme bootstrap differs | S3 | ALL | Centralize | P1 |
| 204 | No cross-app navigation/IA consistency review | S3 | ALL | IA audit | P2 |

## N. Performance, content & future-readiness (205–216)

| # | Issue | Sev | Apps | Fix | Pri |
|--:|---|:--:|---|---|:--:|
| 205 | Barrel `export *` (icons) may bloat bundles without treeshaking | S3 | ALL | Verify/per-icon import | P2 |
| 206 | Token CSS injected at runtime per root (repeat cost) | S3 | ALL | Build-time CSS option | P2 |
| 207 | No image/asset guidelines (illustrations, OG) | S4 | MKT,AM | Asset system | P3 |
| 208 | No i18n/locale formatting policy beyond INR/India helpers | S3 | ALL | i18n strategy | P2 |
| 209 | Hardcoded India/INR helpers may not generalize for global merchants | S3 | ALL | Locale-driven formatting | P2 |
| 210 | No motion guidelines (when to animate) | S4 | ALL | Motion docs | P3 |
| 211 | No empty-state illustration system beyond one component | S4 | ALL | Illustration tokens | P3 |
| 212 | Reserved services (search/media/notification/analytics) will need UI patterns | S3 | future | Pre-define patterns | P2 |
| 213 | No telemetry on component usage/errors in prod | S3 | ALL | Usage analytics | P2 |
| 214 | No design-lint in Figma (pre-handoff) | S3 | design | FigmaLint/Design Lint | P2 |
| 215 | No theming sandbox/playground for brand testing | S4 | DS | Brand playground | P3 |
| 216 | No governance for AI-generated UI to stay on-system | S3 | ALL | AGENTS.md + lint in CI | P2 |

---

## Rollup

| Severity | Count | Priority | Count |
|---|--:|---|--:|
| S1 critical | ~22 | P0 | ~26 |
| S2 high | ~70 | P1 | ~70 |
| S3 medium | ~105 | P2 | ~95 |
| S4 minor | ~19 | P3/P4 | ~25 |

**The P0 cluster collapses to five moves:** (1) DTCG token pipeline → kills the mobile + CSS + Tailwind divergence channels at the root; (2) fence the remaining channels (Stylelint + restricted Tailwind palette + extend ESLint); (3) operational base (dist + changesets + 1.0.0); (4) a11y program (WCAG 2.2 AA + axe-in-CI + portals + scroll-lock/focus-return); (5) docs site + Figma kit. Everything else sequences behind those. See `LETBUYY_UI_FOUNDATION_IMPLEMENTATION_PLAN.md`.
