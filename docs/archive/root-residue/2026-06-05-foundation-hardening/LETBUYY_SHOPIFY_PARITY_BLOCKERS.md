# LetBuyy — What's Still Blocking *Exact* Shopify Parity (focused deep audit)

**Scope:** the three things you flagged — (1) cross‑platform (Flutter) not wired, (2) web apps not talking "exactly like Shopify," (3) **the theme engine is a whole Next app, not Shopify‑style blocks.** Verified against the live code, not assumed.

---

## PART 0 — Env cleanup: ✅ Codex did it well

Verified: **0** `.env.local`/`.dev.vars`/`.dart-defines.local`; `scripts/dev/` **gone**; `scripts/staging/seed.mjs` **present**; **no** `[env.dev]` in any wrangler; **no** `local:*` scripts; final report claims typecheck 58/58, build 58/58, governance 128/128. The staging+production‑only migration landed cleanly. ✔️

---

## PART 1 — The verdict: 3 real blockers, ranked

| # | Blocker | Status | Severity to "exact Shopify" |
|---|---|---|---|
| **1** | **Theme engine = monolithic React app, not portable blocks** | 32 React sections compiled into `storefront-runtime`; `0` `.liquid`/bundle files; `LiquidRenderer` still a stub | 🔴 **Existential** — caps the entire theme ecosystem |
| **2** | **Web apps share one API but lack the *extension* layer** | All 7 apps are thin clients of `/v1` (0 direct Supabase ✓) — but it's **REST not GraphQL**, and there's **no real extension/app‑block/Functions surface** | 🔴 High — this *is* "talking like Shopify" |
| **3** | **Flutter cross‑platform still on Firebase, not the gateway** | Firebase/Firestore primary; `lb_session`/`api-client` not adopted (WS8 mission written, not yet run) | 🟠 High — phone ≠ same platform |

**The headline:** your federation work genuinely fixed "the apps don't share a backend" — all 7 web apps now call **one** gateway with **zero** direct Supabase. What's left for *exact* Shopify is the **extensibility layer**: portable themes/blocks (#1), an extension/Functions/GraphQL surface (#2), and the phone on the same rails (#3). #1 is the one you feel most, and it's the biggest business unlock.

---

## PART 2 — THE THEME ENGINE (the one you're asking about)

### 2.1 What you actually have today (verified)
- `apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx` — **393 lines, ~32 hardcoded React section components** (`hero`, `product-grid`, `footer`, …). A "theme" is a **JSON arrangement of these fixed React sections** stored in the DB.
- `packages/theme-engine/src/theme-renderer.ts` — has a `ThemeRenderer` interface with `JsonContractThemeRenderer` (active) and **`LiquidRenderer` (still a stub: "not implemented in the JSON‑contract phase")**.
- **`0` `.liquid` files, `0` on‑disk `settings_schema.json` theme bundles.** Themes are DB rows, not portable artifacts.
- There's an `app-block-slot.tsx` (a slot exists) but the sections themselves are React.

**In one sentence:** the storefront is **one monolithic Next app with every section baked in as React code**, and a theme just picks/arranges those sections. That is exactly your "theme engine has the whole Next app, not Shopify blocks."

### 2.2 Why this is NOT Shopify (and caps the business)
Shopify's theme is a **portable bundle of data + template files** that the renderer *interprets*:
```
theme/
  layout/theme.liquid
  templates/{index,product,collection}.json     ← which sections appear + their settings
  sections/<name>.liquid   + {% schema %}        ← AUTHORABLE section types
  blocks/<name>.liquid                            ← AUTHORABLE reusable blocks (incl. app blocks)
  config/settings_schema.json                     ← generates the editor
  locales/*.json
```
The decisive property: **a third‑party designer can ship a brand‑new section or block type without touching Shopify's code or redeploying anything.** Shopify's renderer reads the files; it does not compile a React component per section.

In LetBuyy today, a "new section" = **a code change in `renderer-registry.tsx` + a storefront redeploy.** So your theme marketplace can only ever sell themes built from the **32 sections your own engineers compiled in.** That's the ceiling — it's why a real theme ecosystem (thousands of independent themes with novel sections) is impossible on the current engine. This is the same Issue‑3 from the very first audit; every mission **stubbed the Liquid seam and moved on.** It's now the #1 thing between you and "exact Shopify."

### 2.3 The Shopify‑level target — a portable Block/Section runtime

A theme must become a **versioned, portable artifact** (stored in the existing `theme_packages`/`theme_releases` tables, downloadable/uploadable as a bundle), and the storefront must **interpret** it. Two viable engines — pick by how literally you want "exact Shopify":

**Option A — Liquid (true Shopify parity, importable Shopify themes).**
- Render sections/blocks server‑side with **LiquidJS** inside `storefront-runtime`. A theme is `sections/*.liquid` + `blocks/*.liquid` + `templates/*.json` + `settings_schema.json` + `locales`.
- Pro: **literally Shopify's model** — designers author in Liquid, you could even import Shopify themes; unlimited third‑party sections; the marketplace becomes real.
- Con: sections lose React interactivity → use **hydration islands** for interactive bits (cart, search) via small web components; biggest engineering shift for the storefront.

**Option B — JSON‑component Block DSL (React‑native, faster, less "literal").**
- Sections/blocks are **data‑described** (a JSON schema: type, settings, accepted block types, a safe template AST), rendered by a **generic block renderer** that maps primitives (text/image/button/product‑card/grid) — not a fixed list of 32. New section/block types are **uploaded as data**, not coded.
- Pro: keeps React/RSC + your token system; faster to ship; reuses much of the current renderer.
- Con: not Liquid (can't import Shopify themes); portability is "as flexible as your primitive set."

> **Recommendation for "exact Shopify level":** **Option A (Liquid)** — it's the only one that is *literally* Shopify. Keep the current JSON‑contract engine as the fast path for first‑party themes during the transition (the `ThemeRenderer` seam already exists for exactly this), and implement `LiquidRenderer` for real.

### 2.4 The Block model specifically (what "Shopify blocks" means)
This is the part you keep pointing at. In the target engine:
- **Section** = a region of a page (hero, product‑grid). Has its own `{% schema %}` (settings + which **block types** it accepts).
- **Blocks** = the composable units *inside* a section, three kinds:
  - **Theme blocks** — authorable, reusable across sections (`blocks/*.liquid`).
  - **Section blocks** — defined inline in a section.
  - **App blocks** — injected by an **installed app** (your `app-block-slot.tsx` is the seed of this — make it real).
- Merchants **add / remove / reorder / configure blocks** in the theme editor (the live‑canvas editor WS2 builds), and each block's settings come from its schema.
- The storefront **renders the section + its ordered blocks from data** — no per‑block React code.

That tree — *page → sections → blocks (incl. app blocks), all authorable as data/templates* — **is** "Shopify blocks." It's what turns the storefront from "a Next app with 32 sections" into "an engine that renders any theme anyone builds."

### 2.5 What changes across the stack (one engine, four surfaces)
- **storefront-runtime:** swap the fixed React registry for the block/section **interpreter** (Option A or B); keep app‑block slots as first‑class.
- **theme editor (WS2):** the live canvas edits **sections + blocks** of the real bundle and previews via the storefront — not a mock.
- **theme-marketplace (WS3):** "install" = drop in a **portable bundle**; versioning/updates per `theme_releases`.
- **theme SDK/CLI (WS10):** designers author/validate/upload themes locally — the developer side of the ecosystem.

---

## PART 3 — "Web apps talking exactly like Shopify" — what's still missing

Your apps **do** share one backend now (federation landed: all 7 on `api-client`, 0 direct Supabase). So "they don't talk" is fixed. What's *not* Shopify is the **extensibility + API shape**:

1. **REST, not GraphQL.** Shopify exposes **one typed GraphQL Admin API + a Storefront API** (field‑level selection, calculated query cost, bulk operations) and a generated SDK. LetBuyy is REST `/v1`. → Add a GraphQL gateway over the same domain + a separate Storefront API; keep REST as a shim.
2. **No real extension framework.** Shopify's "apps talking to everything" = **App Bridge** (apps embedded in admin) + **extensions**: app blocks (into themes — see Part 2.4), **Checkout UI extensions**, **Admin UI extensions**, and **Functions (Wasm)** for discount/shipping/payment logic. LetBuyy has an app‑block *slot* and an embed bridge seed, but **no checkout/admin extensions and no Functions.** → This is the "Shopify magic" — apps extend *other apps' surfaces*, not just call the API.
3. **No bulk operations API** (async JSONL export/import) — needed for catalogs at scale.

So: the **sync plumbing is Shopify‑shaped** (one gateway, thin clients); the **extension/Function/GraphQL layer** — the thing that makes the ecosystem feel alive — is the gap.

---

## PART 4 — Cross‑platform (Flutter) — still pending

Unchanged from `LETBUYY_FLUTTER_WEB_PARITY_AUDIT.md`: the Flutter merchant app is still **Firebase/Firestore‑primary**, authenticates on **Firebase Auth** (not `lb_session`), barely calls the gateway, defines its own 58 Dart models, and its theme editor is a **local mock** (not the real engine). The fix is the **`CODEX_MOBILE_PARITY_MISSION.md` (WS8)** — re‑wire to `lb_session` + a `dart api_client` over `/v1` + shared contracts + the **same** block/section theme engine (so the phone edits real themes too) + delete legacy + Android/iOS. **Written, not yet run** — it's a Wave‑5 job (needs WS7 staging + WS1 tokens first), and now also needs the Part 2 theme engine so "even the theme editor on mobile" matches.

---

## PART 5 — The execution (where the theme engine slots in)

The portable theme‑block engine is a **new, dedicated workstream** — call it **WS11 — Theme Block Engine** — because it's bigger than "UX" and it unblocks the marketplace, the editor, and mobile theme parity at once. It is **backend + storefront**, so it pairs with WS7, not the pure‑UI streams.

**Sequence:** WS7 (staging) → WS1 (design system) → **WS11 (theme block engine: implement `LiquidRenderer` / block DSL + portable bundle + app blocks)** → WS2 (theme editor now edits real sections/blocks) → WS3 (marketplace installs real bundles) → WS8 (mobile renders the same engine) → the GraphQL + extension/Functions layer (Part 3) as the developer‑ecosystem deepening.

**Bottom line, bro:** the apps already share one backend (that part's done). The three things stopping *exact* Shopify are: **portable theme blocks (the big one — implement the real engine, kill the "32‑React‑sections‑in‑one‑Next‑app" model), an extension/Functions/GraphQL layer, and the phone on the same rails.** Fix the theme engine first — it's the one you keep feeling, and it's the ceiling on your whole theme business.

*Want the full **`CODEX_THEME_BLOCK_ENGINE_MISSION.md` (WS11)** — Liquid renderer + portable bundle + section/block schema + app blocks + the editor/marketplace/mobile handoffs, in the same keep‑green / SKIP‑and‑continue format? Say the word and I'll write it.*
