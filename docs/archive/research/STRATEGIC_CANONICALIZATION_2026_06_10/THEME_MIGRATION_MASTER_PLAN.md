# LETBUYY — THEME MIGRATION MASTER PLAN (React → Liquid)

> **Document type:** Canonical theme-system roadmap (Architecture Review Board, Part 4 of the Strategic Canonicalization directive).
> **Date:** 2026-06-10
> **Author role:** Shopify Theme Platform Architect (Online Store 2.0 theme-team grade), LetBuyy ABR.
> **Repo:** `/Users/saai_sidd/Git/Letbuyy_Store`
> **Status:** EXECUTABLE PLAN. Subordinate to `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` + `LETBUYY_FINAL_ARCHITECTURE_FREEZE.md` (the constitution) and to `STRATEGIC_CANONICALIZATION_2026_06_10/_ANCHOR_DECISIONS_SPINE.md` (the coherence backbone). On any conflict, V1/Freeze win, then the Anchor Spine, then this document.

---

## 0. Methodology

This plan is built **bottom-up from the code**, not from aspiration. Every claim of "current state" is anchored to `path:line` evidence; every "strategic state" is anchored to a named constitutional decision (V1 §/principle, R-rule, or Anchor A5/A6). The source set, in authority order:

1. `_ANCHOR_DECISIONS_SPINE.md` — **A5 (Theme System)** and **A6 (Storefront Runtime)** are the load-bearing calls this document must stay consistent with. A5 is quoted verbatim where it governs.
2. `FORENSIC_MASTER_2026_06_10/THEME_FORENSIC_AUDIT.md` — the current-state evidence base (THEME-001…022, each with `path:line`). Re-verified the four highest-leverage facts directly against source on 2026-06-10 (see §1).
3. `STRATEGIC_CANONICALIZATION_2026_06_10/SHOPIFY_ALIGNMENT_REPORT.md` §2 (theme platform), §3 (storefront runtime) — the Shopify-benchmark verdict (**ALIGN + leapfrog**; flip Liquid on behind a per-theme `renderer.engine` switch + canary; one runtime = Liquid SSR).
4. `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` — §3/§10 ("**Themes — the differentiator — protect it**"), §6 deletion ledger (theme-engine kept "only as far as the existing theme editor needs"), R-6/R-11/R-15, and the P0→P3 roadmap that the Waves map onto.

**Decision rule (from the Anchor Spine, applied literally):** the Strategic Winner is the implementation that should **still exist at 10,000 India merchants with a theme marketplace and third-party theme authors** — not the oldest, the most complete, or the easiest. LetBuyy has **~0 production merchants and one seeded theme**, so there is **no legacy theme corpus to migrate** and preservation-for-its-own-sake is forbidden. This is the single fact that makes the React-vs-Liquid call clean.

**Classification legend (verbatim from the Anchor Spine):** **CANONICAL** (the winner — build/finish it) · **TRANSITIONAL** (real today, kept only until the winner lands) · **LEGACY** (superseded; freeze, then delete after migration) · **DEAD** (no value; SAFE_DELETE) · **FROZEN** (rejected-for-envelope but keep an empty seam; reconsider at a named trigger).

**Wave map (from the Anchor Spine's "cross-cutting sequencing law", mapped onto V1's P0→P3):**

| Wave | Theme | V1 phase | Theme-system posture |
|---|---|---|---|
| **0** | Deploy meta-blocker + S0 data-leak fixes | pre-P0 | Theme work **does not start**. Ship the pipeline; nothing theme-related is touched. |
| **1** | Money-correctness for live keys | P0 | **FREEZE the duplication** (the only theme action in P0). No new sections, no renderer work — just stop the bleed. |
| **2** | Tenancy + architecture true-up | P0→P1 | Make theme persistence/tenant-safe; **collapse the 3 schema sources → 1** and the **2 draft systems → 1**; designate the single render seam. Entry-gate for Liquid prep. |
| **3** | Product-completeness for beta | P1 | **Liquid becomes DEFAULT** behind a per-theme `renderer.engine` switch + canary; React renderer demoted to compatibility fast-path. Editor parity hardening (drag-reorder, lint panel). |
| **4** | Perf + design-debt hardening | P1→P2 | Render-latency parity proof; theme-blocks (nestable) leapfrog; dynamic sources/metafields; theme-check product. |
| **5** | Differentiate | P2 | **Author 5–10 first-party themes**; seed the marketplace catalog; first-party app-blocks via the FROZEN extension seam (no 3rd-party authors yet). |
| **6** | Ecosystem readiness (gated) | P2→P3 | **Trigger-gated** (≈5k merchants + theme-author demand): open the portable-bundle author path; **delete or fast-path-freeze the React renderer** per the exit criterion in §6. |
| **7–8** | Scale (gated) | P3 | Only if metrics demand. Theme system is feature-complete; this is hardening, not migration. |

---

## 1. Executive Verdict — the React-vs-Liquid call (5 sentences) + interim freeze

**The Strategic Winner is the Liquid / portable-theme engine (Online-Store-2.0-shaped: JSON templates → sandboxed Liquid sections → blocks → section-groups → settings schema), because it is the ONLY architecture that survives the decision rule — a theme MARKETPLACE, third-party theme authors, portable themes, and theme app-extensions are all structurally impossible on a React-component-per-section model, which is a first-party-only dead-end no matter how complete it looks today.** The React section-registry in `storefront-runtime` is **more complete and is the live read path** (~24 sections, real web + Flutter editors, ~62% Shopify parity), but completeness is explicitly **not** the tiebreaker, and React's "moat" — a thick first-party section library — is exactly the part that does not need to survive when the ecosystem is the goal. **The migration is DEFERRED and GATED, not "rewrite to Liquid now":** with ~0 merchants and 9 open S0s, theme work is correctly sequenced *behind* the deploy meta-blocker (Wave 0), money-correctness (Wave 1), and tenancy/architecture true-up (Wave 2) — pulling the Liquid migration forward would be the same class of premature-build error V1 spent a whole document rejecting. **The interim rule is FREEZE THE DUPLICATION immediately (Wave 1): designate exactly ONE render seam, stop maintaining two renderers, freeze the React path to NEW sections, and stop adding capability to the dead Liquid engine until its entry gate opens** — the current state where both a live React renderer and a dead-but-shipped Liquid renderer are carried, with three schema sources and two draft systems written in the same call, is the precise "two parallel systems" tax this program exists to kill. **Liquid becomes the DEFAULT renderer in Wave 3** (behind a per-theme `renderer.engine` switch with a canary and a screenshot/DOM-diff parity gate), the React renderer is retained as a **TRANSITIONAL first-party compatibility fast-path** through Waves 3–5, and at the Wave-6 ecosystem trigger (~5k merchants + real theme-author demand) it is either **deleted** (if Liquid parity + perf are green and no first-party section depends on it) or **frozen as a named legacy fast-path** (if a measured render-latency win for first-party sections justifies the maintenance) — that final fork is decided by data at the gate, not pre-committed here.

---

## 2. Strategic-Winner Decision Table (component | classification | winner | one-line why)

| # | Component | Classification | Strategic Winner | One-line why |
|---|---|---|---|---|
| 1 | **Theme architecture model** (sections/blocks/JSON-templates/section-groups/schema) | **CANONICAL** | The existing OS-2.0-shaped model in `packages/theme-engine` | Already Shopify-grade and ecosystem-shaped; it is *the* "copy the load-bearing pattern" success — keep it, build on it. |
| 2 | **Live renderer** (React section-registry) | **TRANSITIONAL** | Liquid renderer (winner); React kept as first-party fast-path until Wave 6 | React is live + complete but first-party-only; it is the bridge, not the destination. |
| 3 | **Portable/Liquid renderer** (`LiquidRenderer`/`JsonContractThemeRenderer`) | **CANONICAL** | The Liquid/portable-theme engine | Only renderer that supports a marketplace, 3rd-party authors, portable bundles, app-blocks. |
| 4 | **Renderer + data-context security model** (data-only sandbox, drop scrub, auto-escape) | **CANONICAL** | The data-only sandbox contract (Liquid `ownPropertyOnly`/`jsTruthy:false` + drop scrub) layered with React JSX auto-escape during interim | The actual security-load-bearing part of Shopify's design, already cloned correctly; the regex output-sanitizer is the one weak link to replace at flip-on. |
| 5 | **Theme editor** (web `editor/page.tsx`) | **CANONICAL** | The web editor (renderer-agnostic) | The differentiator V1 says "protect"; it already speaks the canonical contracts — it survives the renderer swap untouched. |
| 6 | **Theme editor** (Flutter `section_editor_screen.dart`) | **CANONICAL** | The Flutter editor (renderer-agnostic) | At-or-above web on reorder/device-frames; same backend contracts; the strongest part of the mobile app. |
| 7 | **Schema / settings system** (3 sources) | **CANONICAL (1) + LEGACY (2)** | theme-engine `BUILT_IN_SECTION_SCHEMAS` as the single generated source | One typed schema source must feed storefront + DB; the storefront re-declaration and DB manifests become generated/derived. |
| 8 | **Persistence / draft system** (dual: legacy + instance/patch) | **CANONICAL (1) + LEGACY (1)** | `theme_instance_drafts` + `theme_draft_patches` spine | The patch-log spine is the auditable, versioned winner; `theme_editor_drafts` becomes a read-shim then dies. |
| 9 | **Versioning / release / rollback** (`theme_releases`, `rollbackRelease`) | **CANONICAL** | The release/rollback spine | Already real, monotonic, auditable; only de-duplicate the snapshot vs config column. |
| 10 | **Section library** (24 declared; ~20 with renderers) | **CANONICAL (renderable) + LEGACY (4 placeholders + announcementBar mismatch)** | The commerce-complete renderable set, ported to Liquid sections | Thick first-party set is real value; the 4 placeholders + the `announcementBar` gap must be fixed or removed, not shipped as fallback boxes. |
| 11 | **theme-engine package** (contracts/schema/validation/bundle vs orphaned renderer classes) | **CANONICAL (contracts) + resolves under #2/#3** | theme-engine as the contract/schema/validator/bundle source of truth; its renderer becomes the live one in Wave 3 | It is load-bearing (60+ importers), not scaffolding; only its renderer classes were orphaned — Wave 3 un-orphans them. |
| 12 | **theme-marketplace app** (machinery real, catalog empty) | **CANONICAL (machinery) + DORMANT (catalog)** | The marketplace machinery; catalog seeded at the Wave-5 demand trigger | Real, release-creating install flow over a one-theme shelf; reframe as "starter + editor" until Wave 5. |
| 13 | **Theme extensions / app-blocks** (`appBlockSlot` + `@app`) | **FROZEN** (seam kept, 1st-party only at Wave 5; 3rd-party gated to Wave 6) | The app-block seam (kept empty of 3rd-party authors per R-11) | R-11 rejects the 3rd-party app platform in this envelope; keep the good seam, no sandbox/review burden now. |
| 14 | **Metafields / dynamic sources** | **CANONICAL (DEFERRED to Wave 4)** | A `dataBinding` resolver registry (collections/pages/blogs/metafields/metaobjects) | The single biggest *capability* gap vs OS 2.0; merchants hit it first — but it follows the renderer flip, not precedes it. |
| 15 | **Theme blocks** (reusable, nestable) | **CANONICAL (DEFERRED to Wave 4)** | Nestable reusable theme blocks (Shopify's 2024–25 evolution) | Adopt now while there is no legacy theme corpus — a leapfrog past Shopify's own painful sections-v1→theme-blocks transition. |
| 16 | **Theme-check / lint** (validator exists, no UI) | **CANONICAL (DEFERRED to Wave 3/4)** | An editor "Issues" panel + CLI surfacing `collectThemeTemplateValidationIssues` + renderer audit | The validator already exists; only the surface is missing. |
| 17 | **`runtime-composition` package wired into storefront** | **DEAD** (DELETE_AFTER_MIGRATION) | Delete (unwire first) — per A6 | Rejected/dormant artifact wired into the storefront page; unwire then SAFE_DELETE. |
| 18 | **"AI hooks" in editor** (deterministic stubs labeled AI) | **TRANSITIONAL (rename) / FROZEN (real model)** | Honest "Smart defaults / Quick fill"; real model is a P2/Wave-5 seam | R-15: no merchant-facing AI in P0/P1; stop mislabeling deterministic transforms as AI. |
| 19 | **Headless Hydrogen/Oxygen storefront tier** | **FROZEN** (not built; deferred seam) | One runtime = Liquid SSR (A6) | No headless-developer population in the 100→10k envelope; dual runtimes = the 22-services error. |

---

## 3. Current → Target → Gap, per subsystem

### 3.1 Architecture model (sections/blocks/templates/section-groups/schema)

- **Current:** Faithful OS-2.0 quad — `SectionModel`/`BlockModel` (`packages/theme-engine/src/index.ts:79/92`), JSON `templates: Record<string,...>` keyed `index/product/collection/page/cart/blog` (`theme-execution.adapter.ts:184`), `sectionGroups` with `role:'header'|'footer'` (`index.ts:109`), typed `SectionSchema`/`SchemaField` (`theme-registry.ts:12/31`), `THEME_SETTINGS_SCHEMA` settings_schema-equivalent (`theme-registry.ts:436`), presets, defaults. **Sections+blocks-v1 only** — no reusable/nestable theme-blocks.
- **Target:** Same model retained verbatim (it is the winner), **plus** nestable reusable **theme blocks** (`@theme`/`@app`, private `_`-prefixed, ≤8 deep) adopted in Wave 4 as a leapfrog. Limits aligned to Shopify (≤25 sections/template, ≤50 blocks/section) — LetBuyy's validator already caps blocks ≤50 (`index.ts:706`).
- **Gap:** Theme-blocks layer (SHOP-015); the model is otherwise complete. **No migration of the model itself is required — only its renderer changes.** This is the key de-risker.

### 3.2 Renderer + data-context security

- **Current:** TWO renderer families. **Live = React-component-per-section** (`renderer-registry.tsx:198`, server-rendered RSC via `StorefrontCompositionEngine`); merchant content flows as props → **JSX auto-escapes** → structurally low XSS, **zero merchant-content `dangerouslySetInnerHTML` in the section layer** (verified). **Dormant = sandboxed Liquid** (`theme-renderer.ts:121`) gated OFF by `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false` (verified at `theme-governance.ts:14`); resolver short-circuits before loading any bundle (`template-resolver.ts:197`). The Liquid path is a genuine data-only sandbox: `ownPropertyOnly`, `jsTruthy:false`, `parseLimit/renderLimit/memoryLimit` (`theme-renderer.ts:255`), drop scrub of `__proto__`/secrets/non-identifier keys with depth/key/array caps (`theme-renderer.ts:407/441`), upload forbids `{% render %}`/`{% include %}`/`<script>`/`javascript:` (`theme-bundle.ts:101`), and output is regex-sanitized (`theme-renderer.ts:606`). The **only** `dangerouslySetInnerHTML` sink is the Liquid output at `composition-engine.tsx:84` (verified) — behind the dead flag, after the regex sanitizer.
- **Target:** **ONE renderer = sandboxed Liquid (default Wave 3)**. The data-only sandbox is the canonical security contract. At flip-on, the **regex output-sanitizer is replaced with a real allowlist sanitizer (DOMPurify / sanitize-html)** — brittle regex HTML sanitization is the one residual weakness (THEME-012). React's auto-escape remains the safety property of the interim fast-path.
- **Gap (cross-link → SECURITY canonicalization):** (a) THEME-012 — regex sanitizer must become a real sanitizer **before** Liquid is the default render path that reaches the DOM; this is a Wave-3 entry gate. (b) THEME-013 — every `richtext` consumer audited for any future `dangerouslySetInnerHTML`; add a lint rule banning dSIH in section components. (c) Liquid sandbox-escape / SSTI / XSS-via-merchant-content must pass the Security test taxonomy (§5) before the canary widens. **No Liquid render reaches a real merchant's buyers until the Security suite is green** (Deletion-validation discipline applied to enablement).

### 3.3 Editor (web + Flutter parity)

- **Current:** Web editor (`editor/page.tsx`, ~1,892 lines) is dense and real: add/remove/reorder(±1 buttons, **no drag**)/visibility/typed-settings-form(11 field types)/undo-redo(Ctrl+Z)/draft-autosave(900ms)/preview-token/publish(blocks-if-dirty)/discard/multi-template/image-upload. Flutter editor (`section_editor_screen.dart`) at-or-above web: 50-state undo, device frames + zoom, tap-to-edit live preview, layers drawer with reorder, optimistic-lock draft/publish — **same backend contracts**. "AI hooks" are deterministic stubs labeled AI (THEME-011). Mobile defaults to slug `minimal_modern` while web/seed use `urban-kicks` (THEME-021).
- **Target:** Both editors are **renderer-agnostic and survive the React→Liquid swap untouched** (they edit `SectionModel`/settings via the gateway, not the renderer). Add web **drag-and-drop reorder** (mirror the Flutter layers drawer) and a **Theme-Check "Issues" panel** (Wave 3/4). Rename "AI hooks" to honest "Smart defaults" (Wave 1, trivial). Align mobile fallback slug to the seeded canonical (Wave 2).
- **Gap:** Drag-reorder on web (THEME-006); lint panel (THEME-016); honest AI labeling (THEME-011); slug divergence (THEME-021). **The editor is NOT a migration risk** — it is the protected asset; the whole renderer migration is designed so the editor never breaks.

### 3.4 Schema / settings system unification (3 sources → 1)

- **Current:** Three declaration sites — theme-engine `BUILT_IN_SECTION_SCHEMAS` (24, `built-in-section-schemas.ts:308`), storefront `RUNTIME_SECTION_SCHEMAS` (11) + local re-declarations (`renderer-registry.tsx:66`), and DB `theme_schema_manifests`. A field added in one is not validated/edited consistently in the others (THEME-005). Validation itself is single and strong: `collectThemeTemplateValidationIssues` (`index.ts:698`) type-checks, blocks unsafe keys (`__proto__`/`dangerouslySetInnerHTML`/`on*`, `index.ts:251`), caps payload 256 KB.
- **Target:** **ONE source = the theme-engine registry.** Storefront schema and DB manifests are **generated/derived** from it; a CI parity check fails the build on drift. This is a Wave-2 prerequisite to the renderer flip (you cannot trust a Liquid renderer reading a schema the editor doesn't share).
- **Gap:** Generator + CI parity gate (THEME-005). Low complexity, high leverage.

### 3.5 Persistence / versioning (dual draft systems → 1)

- **Current:** TWO draft systems written **in the same call** — legacy `theme_editor_drafts` (`theme-execution.adapter.ts:928`) **and** the new `theme_instance_drafts` + `theme_draft_patches` spine (`:427`/`:476`, with the patch literally tagged `source:'theme_editor_drafts.compat'` at `:482`). Preview reads legacy-or-instance. Release/rollback is real (`theme_releases`, `rollbackRelease:1413`, publish-via-RPC `publish_theme_release` with a full JS fallback `:695`). `template_snapshot` duplicates `release_config` (THEME-019). Adapter pervasively swallows "schema-unavailable" by silently degrading (THEME-015).
- **Target:** **ONE draft spine = `theme_instance_drafts` + `theme_draft_patches`** (auditable patch-log). `theme_editor_drafts` becomes a **compatibility read-shim**, then is dropped after migration. RPC `publish_theme_release` becomes a hard dependency; remove the JS fallback once guaranteed deployed (THEME-014). Standardize on one snapshot column (THEME-019). Convert silent `return null` degradations to logged/metered warnings; fail loudly in non-prod (THEME-015).
- **Gap:** Collapse dual drafts (THEME-004); drop publish JS fallback (THEME-014); de-dup snapshot (THEME-019); de-silence schema-degradation (THEME-015). All Wave 2.

### 3.6 Section library

- **Current:** 24 declared section types; ~20 with real React renderers (commerce-complete: hero, product grid, product detail, header, footer, category grid, featured, testimonials, newsletter, trust, app-block-slot, + a portfolio/resume/landing set). **4 placeholders** with schema but no renderer (`collectionFilter`, `instagramFeed`, `faqAccordion`, `videoHero` — THEME-010) and **1 mismatch** (`announcementBar` has schema + default-template usage but no renderer → `UnknownSectionFallback`, THEME-009).
- **Target:** The renderable set is **ported to Liquid sections** (each gets a `sections/<type>.liquid` with `{% schema %}` mirroring the registry schema) as the Wave-3 deliverable. Placeholders are **implemented or removed from `BUILT_IN_SECTION_TYPES`** so the editor cannot offer un-renderable sections. `announcementBar` gets a renderer or is folded into the header explicitly.
- **Gap:** ~20 Liquid section ports (Wave 3); 4 placeholder resolutions + announcementBar fix (Wave 2, before the flip so the editor can't offer fallback boxes — THEME-009/010).

### 3.7 theme-engine package role (contracts vs orphaned renderer)

- **Current:** `@letbuyy/theme-engine` is **load-bearing** (60+ importers across storefront, control-plane, marketplace, api-gateway) for **types/schemas/validators/bundle/governance** — NOT dormant scaffolding. But its **renderer classes are near-orphaned**: `LiquidRenderer`/`JsonContractThemeRenderer`/`composeStorefrontTheme` are imported only by the storefront's `composition-engine.tsx`, and only for the dead Liquid branch. The storefront **forked** the render + compose path in React (`renderer-registry.tsx` + `template-resolver.ts` re-implements `composeStorefrontTheme`'s sort/visibility/group logic). V1 §6 lists `theme-engine` among packages that "stay only as far as the existing theme editor needs."
- **Target:** theme-engine is **CANONICAL for contracts/schema/validation/bundle** (the V1 §6 caveat is satisfied because the editor *does* need it). Wave 3 **un-orphans its renderer**: the React path calls `composeStorefrontTheme`/`hydrateAndComposeStorefrontTheme` instead of re-deriving (THEME-003), and the engine's renderer becomes the live Liquid renderer. There is exactly **one `ThemeRenderer` interface** (THEME-002).
- **Gap:** Route both compose + render through the engine (THEME-002/003). Wave 2 (compose unification) → Wave 3 (renderer unification).

### 3.8 theme-marketplace (machinery real, catalog empty)

- **Current:** Real, release-creating machinery (`apps/theme-marketplace`, ~50 files): DB-backed listing/search, session-gated rate-limited bundle upload, detail/compare/category pages, developer-listing builder, purchases/installs/favorites/downloads (multi-platform), reviews/reports/refunds, GST receipts, Razorpay purchase-verify, and a working `installThemeAction` → `installTheme` that purchase-gates premium themes and **publishes a release**. **Catalog = only `urban-kicks` seeded** in production (`seeds/urban-kicks-theme.sql:21`; deliberately, to keep marketplace metrics honest at zero). A 26-row sample catalog exists but is not production-loaded (THEME-008).
- **Target:** Machinery stays **CANONICAL**; catalog stays **DORMANT** until the Wave-5 demand trigger, when **5–10 first-party themes** are authored (as Liquid bundles, the now-default engine) and seeded. Until then the surface is honestly reframed as **"theme starter + editor,"** not "a store." 3rd-party theme authors are gated to Wave 6 (the ecosystem trigger).
- **Gap:** Author 5–10 first-party themes (Wave 5, SHOP-017); the machinery needs nothing.

### 3.9 Theme extensions / app-blocks (FROZEN seam per R-11)

- **Current:** `appBlockSlot` section + `@app` block type exist (`theme-bundle.ts:132`; `app-block-slot.tsx`); the app-block iframe is sandboxed (`composition-engine.tsx:109`). No 3rd-party app authors; no app marketplace supply.
- **Target:** **FROZEN per V1 R-11** — keep the seam, add **no** sandbox/review/versioning burden. First-party app-blocks may be authored at Wave 5; **3rd-party app-block authoring is gated to Wave 6** (≈5k merchants + developer demand, the same trigger as `app-marketplace`/`developer-portal` in Anchor A9). The seam is genuinely good (the data-only sandbox + iframe model is correct) — it just stays empty of external supply.
- **Gap:** None now (by design). The discipline is to **resist building it** until the trigger.

### 3.10 Metafields / dynamic sources (the capability gap)

- **Current:** No dynamic sources / metafield binding. Data binding only fetches products for product sections (`data-binding-engine.ts:46`; `sectionRequestsProductData:32`). Sections cannot bind to arbitrary resources/metafields like OS 2.0 dynamic sources (THEME-007).
- **Target:** A `dataBinding` resolver **registry** (collections, pages, blogs, metafields, metaobjects) feeding `SectionRenderData`, built in **Wave 4** (after the renderer is Liquid, because dynamic-source binding is most natural in the Liquid drop layer). This is SHOP-014, the single biggest *capability* gap vs OS 2.0.
- **Gap:** Whole subsystem (Wave 4). It is **DEFERRED, not absent-by-design** — it is on the critical path to a credible theme platform, just after the renderer foundation.

### 3.11 Storefront runtime (A6 cross-link)

- **Current:** Live storefront is server-rendered RSC reading themes via the React registry; Liquid SSR engine built-but-off; **no headless tier** (correct); Hyperdrive-pooled, cache-heavy read path (the audited strong point). `runtime-composition` is wired into the storefront page but is a rejected/dormant artifact (A6, THEME-adjacent).
- **Target (A6):** **ONE runtime = `storefront-runtime` (Next.js/Vercel) SSR/ISR + Worker Cache**, hosting the **Liquid renderer** at target state. **No Hydrogen/Oxygen split** (FROZEN). Keep the 3-tier KV-versioned cache (CANONICAL). **Unwire then DELETE `runtime-composition`** (DEAD).
- **Gap:** Unwire+delete `runtime-composition` (Wave 2); host Liquid in the one runtime (Wave 3). Do **not** build headless (SHOP-021/ID-6).

---

## 4. The phased React → Liquid roadmap (gated waves with entry/exit)

> **Governing principle:** no theme work competes with S0/security/money/tenancy. The renderer migration is a **Wave-3 event**, fully de-risked by Wave-2 unification and explicitly gated. **Nothing is deleted until its validation is green** (Deletion-validation law).

### Wave 0 — Deploy & S0 (theme posture: HANDS OFF)

- **Entry:** program start.
- **Theme actions:** **none.** Do not touch theme code. (The deploy meta-blocker — `main` ~30 commits behind the fix branch — and the data-leak S0s are the only thing that matters; a theme change now ships nothing and risks the leak fixes.)
- **Exit:** pipeline ships; S0 data-leak fixes deployed live.

### Wave 1 — FREEZE THE DUPLICATION (the only P0 theme action)

- **Entry:** Wave 0 exit.
- **Theme actions (cheap, reversible, leverage-maximizing):**
  1. **Designate ONE render seam** on paper and in a `THEME_RENDERER_AUTHORITY` constant: the React registry is the *interim single authority*; the Liquid engine is *frozen-pending-flip*. No code both-renders.
  2. **Freeze the React renderer to NEW sections** — a CI rule: no new entries in `SECTION_RENDERER_DEFINITIONS` without ABR sign-off (you will port to Liquid, not extend React).
  3. **Freeze the Liquid engine to NEW capability** — no new filters/tags/features until its Wave-3 entry gate; it is maintained for security parity only.
  4. **Rename "AI hooks" → "Smart defaults"** (THEME-011) — honesty, trivial, R-15.
- **Exit:** exactly one live renderer; both renderers frozen to new scope; the "two parallel systems" tax stops growing.
- **Rollback:** revert the constants/CI rules (no data touched).

### Wave 2 — Unify the foundations (Liquid prep; no flip yet)

- **Entry:** Wave 1 exit **and** tenancy/RLS kernel landing (theme persistence must be tenant-safe under the new connection model before it is restructured).
- **Theme actions:**
  1. **Schema: 3 → 1** — generate storefront + DB schema from the engine registry; CI parity gate (THEME-005).
  2. **Drafts: 2 → 1** — make `theme_editor_drafts` a read-shim; canonical = `theme_instance_drafts`+`theme_draft_patches`; migrate; plan its drop (THEME-004).
  3. **Compose: 2 → 1** — React path calls `composeStorefrontTheme` instead of re-deriving (THEME-003).
  4. **Section library hygiene** — implement or remove the 4 placeholders (THEME-010); fix `announcementBar` (THEME-009); these MUST be clean before any renderer flip.
  5. **Persistence hardening** — drop publish JS fallback once RPC guaranteed (THEME-014); de-dup snapshot (THEME-019); de-silence schema-degradation (THEME-015).
  6. **A6 hygiene** — unwire + delete `runtime-composition`; align mobile slug fallback (THEME-021).
- **Exit:** one schema source, one draft spine, one compose path, a clean section library, hardened persistence. **This is the entry gate for the renderer flip.**
- **Rollback:** schema generator and draft shim are additive/reversible; compose unification reverts to the forked path; placeholder removals restore from the registry.

### Wave 3 — LIQUID BECOMES DEFAULT (the flip)

- **Entry gate (ALL must be green):** Wave 2 exit · **regex sanitizer replaced with DOMPurify/allowlist** (THEME-012) · ~20 first-party Liquid section ports authored with `{% schema %}` parity to the registry · the Security suite (§5) passing on the Liquid sandbox · a screenshot/DOM-diff parity harness wired (§5 E2E).
- **Theme actions:**
  1. **Per-theme `renderer.engine` switch** (`liquid` | `react`) added to `theme_instances`/release config; default flips to `liquid` **per-theme, canaried** — start with `urban-kicks` on an internal canary store, then widen.
  2. **React renderer demoted to TRANSITIONAL compatibility fast-path** — still callable via `renderer.engine='react'` for any first-party section not yet at Liquid parity; **frozen to new sections** (Wave-1 rule persists).
  3. **theme-engine renderer un-orphaned** — it is now the live Liquid renderer; one `ThemeRenderer` interface (THEME-002).
  4. **Editor parity** — add web **drag-and-drop reorder** (THEME-006); ship the **Theme-Check "Issues" panel** surfacing the existing validator + renderer audit (THEME-016).
  5. **Governance flip** — `THEME_RENDERER_GOVERNANCE_DEFAULT_MODE` `warn` → `enforce` in the publish flow once placeholders are resolved (THEME-022).
- **Exit:** Liquid is the default renderer for new themes; render/security/perf parity proven on the canary; React is a named fast-path, not a shadow.
- **Rollback (designed-in):** the per-theme `renderer.engine` switch **is** the rollback — flip any theme back to `react` instantly; the canary contains blast radius to one internal store first. **This is why the flip is per-theme and canaried rather than a global flag flip.**

### Wave 4 — Capability leapfrog (perf + OS-2.0 completeness)

- **Entry:** Wave 3 exit; Liquid stable on the canary + early stores.
- **Theme actions:**
  1. **Render-latency parity proof** — Performance suite (§5): Liquid render p50/p95 within budget vs the React baseline; if not, optimize before widening (this is the data that informs the Wave-6 React-delete-vs-freeze fork).
  2. **Dynamic sources / metafield binding** — the `dataBinding` resolver registry (THEME-007, SHOP-014).
  3. **Theme blocks** — nestable reusable blocks (≤8 deep), the 2024–25 leapfrog while no legacy corpus exists (SHOP-015).
  4. **Image focal point / responsive transforms** in the editor (THEME-017; the Liquid `image_url` filter stub already exists at `theme-renderer.ts:481`).
- **Exit:** ~85% OS-2.0 parity live (the alignment-report target); dynamic sources + theme-blocks shipped; render-latency parity proven.

### Wave 5 — Differentiate (seed the catalog, first-party app-blocks)

- **Entry:** Wave 4 exit; theme-author UX credible.
- **Theme actions:**
  1. **Author 5–10 first-party themes** as Liquid bundles; seed the marketplace catalog (THEME-008, SHOP-017). The marketplace machinery is finally over a real shelf.
  2. **First-party app-blocks** via the FROZEN seam (no 3rd-party authors).
  3. **AI theme copilot** as a real-model seam (P2; honest, behind a flag) — only now, per R-15.
- **Exit:** a real (if first-party) theme catalog; the differentiator is live and stocked.

### Wave 6 — Ecosystem readiness (TRIGGER-GATED) + the React-renderer end-state

- **Entry trigger (named, from Anchor A5/A9):** ≈**5,000 merchants** **AND** real **third-party theme-author demand**. Until both are true, this wave does not start.
- **Theme actions:**
  1. **Open the portable-bundle author path** to third parties (the Liquid engine + bundle validator + marketplace upload are already built for this).
  2. **3rd-party app-blocks** un-frozen (R-11 trigger met).
  3. **The React renderer end-state decision** — decided by Wave-4 perf data, not pre-committed:
     - **DELETE** (SAFE_DELETE the React `renderer-registry` + the storefront render fork) **if** every first-party section is at Liquid parity **and** Liquid render-latency is within budget. This is the default expectation.
     - **FREEZE as a named legacy fast-path** **only if** a *measured* render-latency win for high-traffic first-party sections justifies the maintenance cost — in which case it is explicitly documented as a frozen first-party-only optimization, never an author-facing renderer.
- **Exit:** either one renderer (Liquid) or Liquid-plus-a-frozen-first-party-fast-path, decided by data. **Deletion-validation law:** the React renderer is not deleted until the full E2E + Security + Performance + Regression suites are green on Liquid for every section it served.

### Waves 7–8 — Scale (gated, no migration)

- Theme system is feature-complete; only hardening if metrics demand (read-replica reads for theme catalog, etc.). No renderer migration remains.

---

## 5. Test & validation plan (the React → Liquid migration taxonomy)

> **Law:** **no system is deleted until its validation is green.** Enablement (flipping Liquid on) is treated with the same rigor as deletion — the Liquid path does not reach a real merchant's buyers until Security + parity are green.

| Layer | What it proves | Concrete tests | Gate it blocks |
|---|---|---|---|
| **Unit** | Each Liquid section/filter/drop behaves like its schema | Per-section render given fixed settings → expected HTML fragment; drop-scrub unit tests (`__proto__`/secret keys stripped); `image_url` filter; each of 11 field-type coercions | Wave 3 entry (per-section) |
| **Integration** | Compose + persistence + publish work end-to-end through the engine | `composeStorefrontTheme` ordering/visibility/section-groups; draft→patch→publish→release→rollback round-trip on the unified spine; schema-generator parity (engine→storefront→DB) | Wave 2 exit; Wave 3 entry |
| **Contract (schema)** | The one schema source is honored everywhere | Golden-schema snapshot of `BUILT_IN_SECTION_SCHEMAS`; CI parity check storefront/DB ≡ engine; bundle zod-validation (`ThemeBundleSettingsSchema`) accepts valid / rejects malformed/oversized; `{% schema %}` in each Liquid section ≡ registry schema | Wave 2 exit (parity gate) |
| **E2E — editor** | The protected editor survives the renderer swap | Web + Flutter: add/remove/reorder(incl. new drag)/visibility/undo-redo/draft/preview-token/publish/discard/multi-template — **run identically on `renderer.engine=react` and `=liquid`** | Wave 3 (editor unchanged across flip) |
| **E2E — render parity (screenshot/DOM diff)** | Liquid output ≡ React output for first-party sections | For all ~20 sections + the urban-kicks home/product/collection templates: render via React baseline and via Liquid, **pixel/DOM diff within tolerance**; responsive (desktop/tablet/mobile) | Wave 3 entry (parity harness) + Wave 6 (per-section before React delete) |
| **Security** | Merchant content cannot escape the sandbox | **SSTI:** `{{ }}`/`{% %}` injection via every settings/richtext field is inert; **XSS:** `<script>`/`on*=`/`javascript:`/`data:text/html` in richtext/url fields neutralized by the **new allowlist sanitizer** (not the old regex); **sandbox escape:** prototype traversal blocked (`ownPropertyOnly`), `{% render/include/layout %}` rejected at upload (`theme-bundle.ts:101`), secret keys absent from drops; iframe sandbox attributes present on app-blocks; **the single `dangerouslySetInnerHTML` sink only ever receives sanitizer output** | Wave 3 entry (HARD GATE — Liquid does not go live to buyers until green) |
| **Performance** | Liquid is not a latency regression | Liquid render p50/p95 vs React baseline per template, cold + warm cache; parse/render/memory limits never tripped on real themes; this data **decides the Wave-6 React delete-vs-freeze fork** | Wave 3 (no regression) + Wave 4 (parity proof) |
| **Regression** | Nothing previously working broke | Full store-route smoke (`/`, `/shop`, `/product/[id]`, `/store/[subdomain]`) on Liquid; unknown-section fallback still graceful; cache-key versioning honored after renderer swap | Every wave exit |
| **Rollback validation** | The per-theme switch actually reverts cleanly | Flip a canary theme `liquid→react` mid-traffic → buyers see the React render with no error/cache-poisoning; release rollback restores prior `template_snapshot`; draft-shim read still works during the dual-write window | Wave 3 entry (rollback is the safety net) |
| **Deletion validation** | A system is provably unused before deletion | Before deleting `runtime-composition` (Wave 2): zero importers after unwire. Before deleting `theme_editor_drafts` (post-Wave-2): zero reads for N days. Before deleting the React renderer (Wave 6): all E2E/Security/Perf/Regression green on Liquid for every section it served | The gate on every deletion |

---

## 6. Risk register

| ID | Risk | Likelihood | Impact | Mitigation | Residual |
|---|---|---|---|---|---|
| TR-1 | **Premature Liquid migration** steals effort from S0/money/tenancy | Med | Critical | Hard sequencing: theme work is Wave-1+ ; the flip is Wave-3, gated on tenancy landing. This document's whole structure is the mitigation. | Low |
| TR-2 | **Render parity drift** — Liquid output ≠ React, breaking live stores at flip | Med | High | Screenshot/DOM-diff parity harness as a Wave-3 entry gate; per-theme canary; per-theme rollback switch | Low |
| TR-3 | **Sandbox escape / SSTI / XSS** once Liquid renders untrusted merchant content | Low (sandbox strong) | Critical | Replace regex sanitizer with DOMPurify (THEME-012); Security suite as HARD gate; data-only drop scrub already in place | Low–Med (regex is the current weak link until replaced) |
| TR-4 | **Schema/draft unification regressions** corrupt drafts or lose merchant edits | Med | High | Read-shim + dual-write window with rollback validation; CI parity gate; migrate-then-drop, never drop-then-pray | Low |
| TR-5 | **Editor breaks** during renderer swap (the differentiator V1 says protect) | Low | Critical | Editors are renderer-agnostic by contract; E2E runs identically on both engines; the flip is per-theme | Very Low |
| TR-6 | **Liquid latency regression** vs React makes the flip a downgrade | Med | Med | Performance suite gates Wave 3; if Liquid is slower, optimize before widening; the data decides the Wave-6 fork | Low |
| TR-7 | **Catalog stays empty** → marketplace remains "machinery over an empty shelf" | High (if not sequenced) | Med | Wave-5 first-party authoring is an explicit deliverable; honestly reframe as "starter + editor" until then | Low |
| TR-8 | **Scope creep into 3rd-party app/theme ecosystem** before demand (R-11) | Med | Med | App-blocks FROZEN; 3rd-party authoring trigger-gated to Wave 6 (5k merchants + demand) | Low |
| TR-9 | **Silent schema-degradation** masks real prod misconfig (THEME-015) | Med | Med | Convert silent `return null` to logged/metered; fail loudly in non-prod (Wave 2) | Low |
| TR-10 | **Deleting the React renderer too early** strands a first-party section | Low | High | Deletion-validation law: full suite green per-section before delete; default to delete, allow data-justified freeze | Very Low |

---

## 7. Per-decision detail blocks (all 13 fields)

> Fields, every block: **Current State · Strategic State · Reasoning · Migration Plan · Validation Plan · Deletion Plan · Rollback Plan · Risk Level · Complexity · Timeline · Owner · Dependencies · Success Criteria.** Owner squads: **Storefront** (storefront-runtime), **Theme-Platform** (theme-engine + marketplace), **Merchant-OS** (control-plane + Flutter editor), **Platform** (gateway/persistence/CI), **Security**.

### DEC-1 — Strategic renderer: Liquid wins; React is the interim fast-path

- **Current State:** Two renderers; **React live** (`renderer-registry.tsx:198`), **Liquid dead** (`theme-governance.ts:14`). React is more complete; Liquid is the ecosystem architecture.
- **Strategic State:** **CANONICAL = Liquid**; **TRANSITIONAL = React** (first-party fast-path through Wave 5; deleted-or-frozen at Wave 6).
- **Reasoning:** The decision rule asks what survives at 10k merchants + marketplace + 3rd-party authors. Only Liquid supports portable themes, external authors, app-blocks. React-per-section is first-party-only by construction. Completeness is explicitly not the tiebreaker; the absence of a legacy theme corpus makes the migration cheap.
- **Migration Plan:** Wave 1 freeze duplication → Wave 2 unify foundations → Wave 3 flip Liquid default per-theme + canary → Waves 4–5 capability + catalog → Wave 6 React end-state.
- **Validation Plan:** Render-parity (screenshot/DOM-diff), Security, Performance, E2E-editor, Regression, Rollback (§5).
- **Deletion Plan:** React renderer deleted at Wave 6 **only** with the full suite green per-section; else frozen as a documented first-party fast-path.
- **Rollback Plan:** Per-theme `renderer.engine` switch + per-theme canary = instant revert; blast radius one internal store first.
- **Risk Level:** High (managed to Low by gating).
- **Complexity:** L.
- **Timeline:** Waves 1–6.
- **Owner:** Theme-Platform (lead) + Storefront + Security.
- **Dependencies:** Tenancy/RLS kernel (Wave 2); schema/draft/compose unification (Wave 2); DOMPurify (Wave 3).
- **Success Criteria:** Liquid is the default renderer; parity + security + perf green; React is a named fast-path or deleted; exactly one author-facing renderer.

### DEC-2 — FREEZE the duplication now (interim posture)

- **Current State:** Both renderers carried; 3 schema sources; 2 draft systems written in one call — the live "two parallel systems" tax.
- **Strategic State:** **TRANSITIONAL freeze** — one live renderer, both frozen to new scope.
- **Reasoning:** With ~0 merchants you must stop *growing* the duplication immediately even though you can't *resolve* it until Wave 2/3. Freezing is cheap and reversible; maintaining two divergent renderers is the expensive mistake.
- **Migration Plan:** Wave 1 — `THEME_RENDERER_AUTHORITY` constant; CI rule banning new `SECTION_RENDERER_DEFINITIONS` entries and new Liquid capability; rename "AI hooks."
- **Validation Plan:** CI rule fires on a test PR adding a section to either renderer; no behavior change in render smoke.
- **Deletion Plan:** N/A (freeze, not delete).
- **Rollback Plan:** Revert constants/CI rules; no data touched.
- **Risk Level:** Low.
- **Complexity:** XS.
- **Timeline:** Wave 1.
- **Owner:** Platform + Theme-Platform.
- **Dependencies:** None.
- **Success Criteria:** No new code path both-renders; duplication stops growing; honesty fix shipped.

### DEC-3 — Schema sources 3 → 1 (generated)

- **Current State:** engine `BUILT_IN_SECTION_SCHEMAS` (`built-in-section-schemas.ts:308`) + storefront `RUNTIME_SECTION_SCHEMAS` (`renderer-registry.tsx:66`) + DB `theme_schema_manifests` (THEME-005).
- **Strategic State:** **CANONICAL = engine registry**; storefront + DB **generated/derived**; **LEGACY = the other two declaration sites**.
- **Reasoning:** A Liquid renderer cannot be trusted reading a schema the editor doesn't share; one source is a Wave-3 prerequisite.
- **Migration Plan:** Wave 2 — generator from engine → storefront + DB; CI parity gate.
- **Validation Plan:** Contract tests (golden-schema snapshot + parity check); a drift PR fails CI.
- **Deletion Plan:** Remove the hand-maintained storefront/DB schema declarations once the generator is authoritative.
- **Rollback Plan:** Generator is additive; revert to hand-maintained on failure.
- **Risk Level:** Low.
- **Complexity:** S.
- **Timeline:** Wave 2.
- **Owner:** Theme-Platform + Platform.
- **Dependencies:** None (precedes the flip).
- **Success Criteria:** One schema source; CI blocks drift; editor/renderer/DB agree field-for-field.

### DEC-4 — Draft systems 2 → 1 (instance/patch spine)

- **Current State:** legacy `theme_editor_drafts` (`adapter:928`) + `theme_instance_drafts`+`theme_draft_patches` (`:427/:476`) written together; preview reads either (THEME-004).
- **Strategic State:** **CANONICAL = instance/patch spine**; **LEGACY = `theme_editor_drafts`** (read-shim → drop).
- **Reasoning:** The patch-log is the auditable, versioned winner; two draft truths are a reconciliation hazard.
- **Migration Plan:** Wave 2 — stop writing legacy; make it a read-shim; migrate existing; schedule drop after the dual-read window.
- **Validation Plan:** Integration (draft→patch→publish→rollback round-trip); Rollback-validation (shim reads during window).
- **Deletion Plan:** Drop `theme_editor_drafts` after N days of zero reads (Deletion-validation).
- **Rollback Plan:** Re-enable legacy write (shim is reversible) during the window.
- **Risk Level:** Med (merchant edits).
- **Complexity:** M.
- **Timeline:** Wave 2 (drop early Wave 3).
- **Owner:** Platform.
- **Dependencies:** None (precedes the flip).
- **Success Criteria:** One draft spine; zero legacy reads before drop; no lost edits.

### DEC-5 — Compose path 2 → 1

- **Current State:** `template-resolver.ts` re-implements `composeStorefrontTheme`'s sort/visibility/section-group logic (`execution-runtime.ts:288` vs `template-resolver.ts`) (THEME-003).
- **Strategic State:** **CANONICAL = engine `composeStorefrontTheme`**; storefront calls it (the React fork's compose dies).
- **Reasoning:** Order/visibility bugs must not be fixable in two places; one compose authority is the foundation under both renderers.
- **Migration Plan:** Wave 2 — storefront calls `composeStorefrontTheme`/`hydrateAndComposeStorefrontTheme`.
- **Validation Plan:** Integration (ordering/visibility/section-groups parity vs the old fork).
- **Deletion Plan:** Remove the duplicated compose logic from `template-resolver.ts`.
- **Rollback Plan:** Revert to the forked compose.
- **Risk Level:** Low–Med.
- **Complexity:** S.
- **Timeline:** Wave 2.
- **Owner:** Storefront + Theme-Platform.
- **Dependencies:** None.
- **Success Criteria:** One compose function; identical ordering/visibility output.

### DEC-6 — Liquid render security (sandbox + sanitizer)

- **Current State:** Liquid sandbox strong (`ownPropertyOnly`, drop scrub `theme-renderer.ts:407/441`, upload forbids dangerous tags `theme-bundle.ts:101`), but output is **regex-sanitized** (`:606`) and the single DOM sink is `composition-engine.tsx:84` (verified) behind the dead flag (THEME-012/013).
- **Strategic State:** **CANONICAL = data-only sandbox + allowlist sanitizer**; React JSX auto-escape is the interim safety property.
- **Reasoning:** Regex HTML sanitization is brittle; it is acceptable while the flag is off but **must** be a real sanitizer before Liquid renders untrusted content to buyers.
- **Migration Plan:** Wave 3 entry — replace regex with DOMPurify/sanitize-html allowlist; add a lint rule banning `dangerouslySetInnerHTML` in section components; audit every `richtext` consumer.
- **Validation Plan:** Security suite (SSTI/XSS/sandbox-escape) as a HARD Wave-3 gate.
- **Deletion Plan:** Delete the regex sanitizer once the allowlist sanitizer is live.
- **Rollback Plan:** The per-theme `renderer.engine` switch reverts to React (auto-escaped) instantly.
- **Risk Level:** Critical (managed to Low–Med).
- **Complexity:** M.
- **Timeline:** Wave 3 entry.
- **Owner:** Security + Theme-Platform.
- **Dependencies:** DEC-1 (flip); cross-links the SECURITY canonicalization deliverable.
- **Success Criteria:** Security suite green; no merchant content reaches the DOM unsanitized; no `dangerouslySetInnerHTML` in sections.

### DEC-7 — Editor (web + Flutter) is protected and renderer-agnostic

- **Current State:** Dense web editor (no drag-reorder; THEME-006) + at-or-above Flutter editor; both on shared contracts; "AI hooks" mislabeled (THEME-011); mobile slug divergence (THEME-021).
- **Strategic State:** **CANONICAL (both)** — survive the renderer swap untouched; gain drag-reorder + lint panel.
- **Reasoning:** Themes are V1's named differentiator; the migration is explicitly designed so the editor never breaks (it edits `SectionModel`, not the renderer).
- **Migration Plan:** Wave 1 rename AI hooks; Wave 2 align mobile slug; Wave 3 add web drag-and-drop reorder + Theme-Check "Issues" panel.
- **Validation Plan:** E2E-editor runs identically on `renderer.engine=react|liquid`.
- **Deletion Plan:** N/A (protected asset).
- **Rollback Plan:** Editor features are independent of the renderer; revert per feature.
- **Risk Level:** Low (Very Low to the migration).
- **Complexity:** M (drag-reorder + lint panel).
- **Timeline:** Waves 1–3.
- **Owner:** Merchant-OS.
- **Dependencies:** Schema unification (DEC-3) for the lint panel.
- **Success Criteria:** Editor E2E identical across engines; drag-reorder + lint shipped; honest labeling.

### DEC-8 — Section library: port renderable, fix/remove placeholders

- **Current State:** ~20 renderable + 4 placeholders (THEME-010) + `announcementBar` mismatch (THEME-009).
- **Strategic State:** **CANONICAL (renderable, ported to Liquid)** + **LEGACY (placeholders removed/implemented; announcementBar fixed)**.
- **Reasoning:** The editor must not offer un-renderable sections; the commerce-complete set is real value to carry into Liquid.
- **Migration Plan:** Wave 2 fix/remove placeholders + announcementBar (before flip); Wave 3 author ~20 `sections/*.liquid` with `{% schema %}` parity.
- **Validation Plan:** Unit (per-section render); Contract (`{% schema %}` ≡ registry); Render-parity (screenshot/DOM-diff per section).
- **Deletion Plan:** Remove placeholder types from `BUILT_IN_SECTION_TYPES` if not implemented.
- **Rollback Plan:** Per-section `renderer.engine='react'` until its Liquid port passes parity.
- **Risk Level:** Med.
- **Complexity:** L (≈20 ports).
- **Timeline:** Waves 2–3.
- **Owner:** Theme-Platform + Storefront.
- **Dependencies:** DEC-3 (schema), DEC-6 (sanitizer).
- **Success Criteria:** Every offered section renders on Liquid at parity; no fallback boxes on live stores.

### DEC-9 — theme-engine: contracts canonical, renderer un-orphaned

- **Current State:** Load-bearing contracts/schema/validator/bundle (60+ importers); renderer classes orphaned (only `composition-engine.tsx`) (THEME-002).
- **Strategic State:** **CANONICAL (contracts)**; renderer becomes the live one at Wave 3 (one `ThemeRenderer` interface). Satisfies V1 §6 ("only as far as the editor needs" — the editor needs it).
- **Reasoning:** The package is the contract source of truth; only its renderer was dead — Wave 3 makes it live, removing the fork.
- **Migration Plan:** Wave 3 — route render through the engine; collapse to one interface.
- **Validation Plan:** Integration (engine renders the live path); Render-parity.
- **Deletion Plan:** Remove the storefront React render fork at Wave 6 (with the React renderer).
- **Rollback Plan:** `renderer.engine='react'` keeps the fork alive during transition.
- **Risk Level:** Med.
- **Complexity:** M.
- **Timeline:** Wave 3.
- **Owner:** Theme-Platform + Storefront.
- **Dependencies:** DEC-1, DEC-5.
- **Success Criteria:** One renderer interface; engine renderer is live; no orphaned classes.

### DEC-10 — theme-marketplace: machinery canonical, catalog seeded at demand

- **Current State:** Real install/release-creating machinery; only `urban-kicks` seeded (THEME-008).
- **Strategic State:** **CANONICAL (machinery)** + **DORMANT (catalog)**; seed 5–10 first-party themes at Wave 5; reframe as "starter + editor" until then.
- **Reasoning:** The machinery is genuinely built; an empty shelf is a content problem, not an architecture problem, and content-before-demand burns effort.
- **Migration Plan:** Wave 5 — author + seed first-party Liquid-bundle themes.
- **Validation Plan:** Integration (install → release for each new theme); Render-parity per theme.
- **Deletion Plan:** N/A (machinery kept).
- **Rollback Plan:** Themes are additive seeds; un-seed on issue.
- **Risk Level:** Low.
- **Complexity:** L (authoring 5–10 themes).
- **Timeline:** Wave 5.
- **Owner:** Theme-Platform.
- **Dependencies:** DEC-1 (Liquid default), DEC-8 (sections).
- **Success Criteria:** A real first-party catalog over working machinery; honest framing until then.

### DEC-11 — Theme extensions / app-blocks: FROZEN seam (R-11)

- **Current State:** `appBlockSlot` + `@app` + sandboxed iframe exist; no external supply.
- **Strategic State:** **FROZEN** — keep the seam; first-party app-blocks at Wave 5; 3rd-party authoring gated to Wave 6.
- **Reasoning:** R-11 rejects the 3rd-party app platform in this envelope; the seam is good, the supply/review burden is premature.
- **Migration Plan:** No build now; first-party use Wave 5; un-freeze 3rd-party at the Wave-6 trigger (5k merchants + demand).
- **Validation Plan:** Security (iframe sandbox attributes present); when un-frozen, app-block review pipeline tests.
- **Deletion Plan:** N/A (seam preserved empty).
- **Rollback Plan:** N/A.
- **Risk Level:** Low.
- **Complexity:** XS (now); L (Wave 6, if triggered).
- **Timeline:** Wave 5 (first-party) / Wave 6 (3rd-party, gated).
- **Owner:** Theme-Platform + Security.
- **Dependencies:** Anchor A9 app-marketplace trigger.
- **Success Criteria:** Seam intact, empty of 3rd-party supply until the trigger; no premature review burden.

### DEC-12 — Metafields / dynamic sources: CANONICAL, deferred to Wave 4

- **Current State:** Only product fetch (`data-binding-engine.ts:46`); no dynamic sources (THEME-007).
- **Strategic State:** **CANONICAL (DEFERRED Wave 4)** — a `dataBinding` resolver registry.
- **Reasoning:** The biggest capability gap vs OS 2.0 and the thing merchants hit first — but it belongs *after* the renderer foundation (dynamic binding is most natural in the Liquid drop layer).
- **Migration Plan:** Wave 4 — resolver registry (collections/pages/blogs/metafields/metaobjects) feeding `SectionRenderData`.
- **Validation Plan:** Unit (per-resolver); Integration (section binds to a metafield end-to-end); Security (resolved data passes the drop scrub).
- **Deletion Plan:** N/A (new capability).
- **Rollback Plan:** Feature-flag the resolver registry; sections fall back to static settings.
- **Risk Level:** Med.
- **Complexity:** L.
- **Timeline:** Wave 4.
- **Owner:** Theme-Platform + Storefront.
- **Dependencies:** DEC-1 (Liquid live).
- **Success Criteria:** Sections bind to arbitrary resources/metafields; data passes the sandbox.

### DEC-13 — Theme blocks (nestable) + Theme-Check + storefront single-runtime

- **Current State:** sections+blocks-v1 only (no nestable theme-blocks, SHOP-015); validator exists, no lint UI (THEME-016); `runtime-composition` wired into the storefront (A6, DEAD); no headless tier (correct).
- **Strategic State:** **CANONICAL** — nestable theme-blocks (Wave 4 leapfrog); Theme-Check "Issues" panel + CLI (Wave 3/4); **ONE runtime = Liquid SSR** (A6); `runtime-composition` **DELETE_AFTER_MIGRATION**; Hydrogen/Oxygen **FROZEN**.
- **Reasoning:** No legacy theme corpus ⇒ adopt theme-blocks now, leapfrogging Shopify's painful sections-v1→blocks transition; the lint surface is just exposing an existing validator; a second (headless) runtime is the 22-services error.
- **Migration Plan:** Wave 2 unwire+delete `runtime-composition`; Wave 3/4 ship lint panel + theme-blocks.
- **Validation Plan:** Contract (block schema, nesting ≤8); E2E (editor adds/nests blocks); Deletion-validation (`runtime-composition` zero importers).
- **Deletion Plan:** SAFE_DELETE `runtime-composition` after unwire; never build headless.
- **Rollback Plan:** Theme-blocks behind a flag; lint panel is read-only/non-blocking first.
- **Risk Level:** Low–Med.
- **Complexity:** M (blocks), S (lint), XS (unwire).
- **Timeline:** Waves 2–4.
- **Owner:** Theme-Platform + Storefront + Platform.
- **Dependencies:** DEC-1, DEC-3.
- **Success Criteria:** Nestable theme-blocks live; lint panel surfaced; one runtime; `runtime-composition` deleted; no headless tier built.

---

## 8. Theme Canonicalization Findings / Actions

> ID | Component | Decision | Classification | Wave | Risk | Evidence (path:line). Forensic source IDs (THEME-00x / SHOP-0xx) referenced for traceability.

| ID | Component | Decision | Classification | Wave | Risk | Evidence (path:line) |
|---|---|---|---|---|---|---|
| **THEME-C-001** | Live renderer | Liquid is the Strategic Winner; React is the interim first-party fast-path | TRANSITIONAL (React) / CANONICAL (Liquid) | 1→6 | High | `renderer-registry.tsx:198`; `theme-governance.ts:14` (THEME-001/002) |
| **THEME-C-002** | Renderer duplication | FREEZE both renderers to new scope now; one live authority | TRANSITIONAL (freeze) | 1 | Low | `renderer-registry.tsx:198`; only-importer `composition-engine.tsx` (THEME-002) |
| **THEME-C-003** | Liquid engine | Flip Liquid ON behind per-theme `renderer.engine` switch + canary; becomes DEFAULT | CANONICAL | 3 | High | `theme-governance.ts:14`; `template-resolver.ts:197` (THEME-001, SHOP-007) |
| **THEME-C-004** | Render security | Replace regex sanitizer with allowlist (DOMPurify); ban dSIH in sections | CANONICAL | 3 | Critical | `theme-renderer.ts:606`; sink `composition-engine.tsx:84` (THEME-012/013) |
| **THEME-C-005** | Schema sources | Collapse 3 → 1 generated from engine registry; CI parity gate | CANONICAL (1) / LEGACY (2) | 2 | Low | `built-in-section-schemas.ts:308`; `renderer-registry.tsx:66`; `theme_schema_manifests` (THEME-005) |
| **THEME-C-006** | Draft systems | Collapse 2 → 1 (instance/patch spine); legacy → read-shim → drop | CANONICAL (1) / LEGACY (1) | 2 | Med | `adapter:928` (legacy) + `:427/:476` (spine), compat tag `:482` (THEME-004) |
| **THEME-C-007** | Compose path | One compose authority (`composeStorefrontTheme`); storefront calls it | CANONICAL | 2 | Low–Med | `execution-runtime.ts:288` vs `template-resolver.ts` (THEME-003) |
| **THEME-C-008** | Section library | Port ~20 renderable to Liquid sections; fix/remove placeholders + announcementBar | CANONICAL / LEGACY (placeholders) | 2→3 | Med | `built-in-section-schemas.ts:3`; `renderer-registry.tsx` (THEME-009/010) |
| **THEME-C-009** | theme-engine package | Contracts CANONICAL; renderer un-orphaned to one interface at flip | CANONICAL | 3 | Med | 60+ importers; renderer only-importer `composition-engine.tsx`; V1 §6 (THEME-002) |
| **THEME-C-010** | Web editor | Renderer-agnostic; add drag-reorder + Theme-Check panel; protect it | CANONICAL | 3 | Low | `page.tsx:1164` (no drag); validator `index.ts:698` no UI (THEME-006/016) |
| **THEME-C-011** | Flutter editor | Renderer-agnostic; align fallback slug; the protected differentiator | CANONICAL | 2 | Low | `section_editor_screen.dart:40/270` (slug); 50-state undo `:93/126` (THEME-021) |
| **THEME-C-012** | Versioning / persistence | Drop publish JS fallback; de-dup snapshot; de-silence schema-degradation | CANONICAL (spine) | 2 | Low–Med | RPC+fallback `adapter:669/695`; snapshot `:634/1446`; silence `:121/937` (THEME-014/015/019) |
| **THEME-C-013** | theme-marketplace | Machinery CANONICAL; seed 5–10 first-party themes at demand | CANONICAL (machinery) / DORMANT (catalog) | 5 | Low | `seeds/urban-kicks-theme.sql:21`; install `install/page.tsx` (THEME-008, SHOP-017) |
| **THEME-C-014** | App-blocks / extensions | FROZEN seam (R-11); first-party Wave 5; 3rd-party gated Wave 6 | FROZEN | 5/6 | Low | `theme-bundle.ts:132`; iframe sandbox `composition-engine.tsx:109`; V1 R-11 |
| **THEME-C-015** | Dynamic sources / metafields | Build `dataBinding` resolver registry (DEFERRED) | CANONICAL (deferred) | 4 | Med | `data-binding-engine.ts:46` (THEME-007, SHOP-014) |
| **THEME-C-016** | Theme blocks | Adopt nestable reusable blocks now (leapfrog, no legacy corpus) | CANONICAL (deferred) | 4 | Low–Med | sections+blocks-v1 only (SHOP-015, L-3) |
| **THEME-C-017** | Theme-Check / lint | Surface existing validator + renderer audit as editor "Issues" panel + CLI | CANONICAL (deferred) | 3/4 | Low | `collectThemeTemplateValidationIssues` `index.ts:698` (THEME-016, SHOP-016) |
| **THEME-C-018** | `runtime-composition` | Unwire from storefront, then SAFE_DELETE | DEAD | 2 | Low | A6; rejected/dormant artifact wired into storefront page |
| **THEME-C-019** | "AI hooks" | Rename to honest "Smart defaults"; real model is a P2 seam | TRANSITIONAL (rename) / FROZEN (model) | 1/5 | Low | `page.tsx:1224` (deterministic stubs) (THEME-011, R-15) |
| **THEME-C-020** | Headless storefront tier | Do NOT build Hydrogen/Oxygen; one runtime = Liquid SSR | FROZEN | n/a | Low | A6; SHOP-021/ID-6 |
| **THEME-C-021** | Renderer governance mode | Flip `warn` → `enforce` in publish once placeholders resolved | CANONICAL | 3 | Low | `theme-governance.ts:13` (THEME-022) |
| **THEME-C-022** | React renderer end-state | Delete at Wave 6 (default) OR freeze as data-justified first-party fast-path | LEGACY → DEAD (or FROZEN) | 6 | High | decided by Wave-4 Performance suite; Deletion-validation law (THEME-001/002) |

**Findings: 22 (CANONICAL ×13 incl. deferred · TRANSITIONAL ×3 · LEGACY/DEAD ×3 incl. the React end-state fork · FROZEN ×3).** Note: several rows carry split classifications (e.g. CANONICAL-one + LEGACY-two for schema/drafts); the headline counts below resolve each component to its *primary* disposition.

---

## 9. Component classification summary (primary disposition)

- **CANONICAL (13):** architecture model · Liquid renderer/engine · render-security sandbox · web editor · Flutter editor · schema system (the 1 source) · persistence/versioning spine · theme-engine contracts · marketplace machinery · dynamic sources (deferred) · theme blocks (deferred) · theme-check (deferred) · governance-enforce.
- **TRANSITIONAL (3):** React renderer (interim fast-path) · the renderer-duplication freeze · "AI hooks" rename.
- **LEGACY (3):** the 2 superseded schema-declaration sites · `theme_editor_drafts` · the 4 placeholder sections + `announcementBar` mismatch. (These resolve to delete-after-migration.)
- **DEAD (2):** `runtime-composition` (SAFE_DELETE after unwire) · the React renderer **end-state** at Wave 6 (deletes by default unless data justifies the FROZEN fast-path fork).
- **FROZEN (3):** theme app-blocks / 3rd-party extensions (R-11) · headless Hydrogen/Oxygen tier (A6) · the real-model AI theme copilot (R-15, until P2).

*(Counts use primary disposition; the Findings table §8 records the full split classifications. "Deferred CANONICAL" items are counted as CANONICAL because they are on the build path, not rejected.)*

---

## 10. Cross-links & consistency check

- **Anchor A5 (Theme System):** This plan is consistent verbatim — Liquid-first canonical, migration DEFERRED (Wave 2–3) and gated on marketplace/3rd-party demand, duplication FROZEN now, React as TRANSITIONAL first-party fast-path frozen to new sections, theme-engine CANONICAL for contracts with its orphaned renderer resolved under the single-renderer decision, marketplace machinery CANONICAL with dormant catalog, editor (web+Flutter) CANONICAL and protected.
- **Anchor A6 (Storefront Runtime):** One runtime = Liquid SSR; no Hydrogen/Oxygen split; 3-tier cache kept; `runtime-composition` unwire-then-delete.
- **V1 §3/§10:** "Themes — the differentiator — protect it" is honored by making the editor renderer-agnostic and the flip per-theme/canaried/rollback-safe, so the differentiator never breaks.
- **V1 §6:** `theme-engine` is kept "only as far as the existing theme editor needs" — satisfied (the editor needs its contracts/schema/validator); the *renderer* part stops being dead at Wave 3.
- **V1 R-6/R-11/R-15:** No self-custody (n/a to themes); app-blocks/3rd-party extensions FROZEN; AI theme copilot deferred to P2 and stubs renamed.
- **SHOPIFY_ALIGNMENT_REPORT §2/§3:** ALIGN + leapfrog; flip Liquid behind per-theme engine switch + canary; theme-blocks + dynamic sources + lint + 5–10 first-party themes; one Liquid-SSR runtime, no headless.
- **Sequencing law:** S0/deploy (Wave 0) → money (Wave 1, theme = freeze only) → tenancy/architecture (Wave 2, theme unification) → product-completeness (Wave 3, Liquid default) → perf/design-debt (Wave 4, capability) — exactly the Anchor's cross-cutting order.

---

## 11. UNVERIFIED / open items (carried honestly)

- **Runtime render/XSS behavior** of `richtext` fields and the single `dangerouslySetInnerHTML` sink — code-low-surface, but **runtime-UNVERIFIED**; the Security suite (§5) exists to verify before the flip. (Forensic audit §2b, §11.)
- **Whether any schema migrations are registered** in production (`migrateThemeTemplateSchemas` exists; usage UNVERIFIED).
- **Whether `announcementBar` reaches a renderer at runtime** or is absorbed by the header — must be resolved in Wave 2 regardless (THEME-009).
- **Preview-token round-trip latency** and **mobile reorder persistence to `order`** — UNVERIFIED; covered by Wave-3 E2E + Performance.
- **Liquid render-latency vs React** at real-theme scale — **not yet measured**; the Wave-4 Performance suite produces this number, and it **decides the Wave-6 React delete-vs-freeze fork** (THEME-C-022). This is the single most consequential unverified quantity in the plan.
- **Theme-block GA breadth in Shopify mid-2026** — does not affect the leapfrog recommendation (alignment report §"UNVERIFIED").

---

*End of THEME MIGRATION MASTER PLAN.*
