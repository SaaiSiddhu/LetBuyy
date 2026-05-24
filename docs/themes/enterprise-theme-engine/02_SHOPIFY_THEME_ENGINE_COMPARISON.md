# 02 - Shopify Theme Engine Comparison

Generated: 2026-05-22

## Research Sources

Primary and official sources reviewed:

- Shopify theme architecture: https://shopify.dev/docs/storefronts/themes/architecture
- Shopify sections: https://shopify.dev/docs/storefronts/themes/architecture/sections
- Shopify blocks: https://shopify.dev/docs/storefronts/themes/architecture/blocks
- Shopify JSON templates: https://shopify.dev/docs/storefronts/themes/architecture/templates/json-templates
- Shopify section groups: https://shopify.dev/docs/storefronts/themes/architecture/section-groups
- Shopify theme settings schema: https://shopify.dev/docs/storefronts/themes/architecture/config/settings-schema-json
- Shopify settings data: https://shopify.dev/docs/storefronts/themes/architecture/config/settings-data-json
- Shopify theme app extensions: https://shopify.dev/docs/apps/build/online-store/theme-app-extensions
- Shopify theme performance best practices: https://shopify.dev/docs/storefronts/themes/best-practices/performance
- Builder.io docs: https://www.builder.io/c/docs/intro
- Webflow collection fields: https://help.webflow.com/hc/en-us/articles/33961390084499-Collection-fields
- Framer CMS help: https://www.framer.com/help/cms/
- Medusa storefront development: https://docs.medusajs.com/learn/storefront-development
- Shogun custom elements: https://getshogun.com/help/advanced/custom-elements-documentation/
- Shogun Shopify sections: https://getshogun.com/help/en/articles/5915013-create-shopify-theme-sections-using-shogun

## Shopify Architecture Patterns

Shopify separates theme structure into:

- Layouts: base wrappers for repeated page structure.
- Templates: page-type render definitions.
- JSON templates: data files listing sections and settings.
- Section groups: dynamic header/footer-style areas controlled by layouts.
- Sections: merchant-customizable modules.
- Blocks: merchant-customizable child modules inside sections, including theme blocks, section blocks, and app blocks.
- Snippets: reusable code invisible to merchants.
- Assets: CSS, JS, images, and other static resources.
- Config: `settings_schema.json` defines settings; `settings_data.json` stores selected values and presets.
- Locales: translatable content.

Key implications for LetBuyy:

- A page is not a hardcoded React route. It is a layout plus template plus ordered sections plus blocks plus settings.
- Header and footer should be section groups, not component imports.
- Settings schema and settings values must be separate artifacts.
- Presets must be installable starting states, not static runtime arrays.
- App extension capability requires app-owned blocks that can be placed by merchants without editing theme code.

## Shopify JSON Template Pattern

Shopify JSON templates use a schema with:

- `layout`: optional layout name.
- `sections`: object keyed by stable section IDs.
- `order`: ordered list of section IDs.

The pattern matters because the current LetBuyy editor uses:

```text
sections: {
  header: SectionEntry,
  footer: SectionEntry,
  template: SectionEntry[]
}
```

That shape is easy for one homepage editor, but it is not enough for:

- Multiple template types.
- Alternate product templates.
- Collection templates.
- Page templates.
- Blog templates.
- Customer templates.
- Password/coming soon pages.
- Section groups beyond header/footer.
- Reusing the same schema across pages while storing instance values separately.

Target LetBuyy shape should be closer to:

```text
layout_ref + template_ref + section_groups + sections_by_id + order + resource_binding
```

## Shopify Section and Block Patterns

Shopify sections:

- Are reusable modules.
- Are configurable by merchants.
- Can be dynamically added to JSON templates and section groups.
- Can contain blocks.
- Have schemas that control settings and availability.

Shopify blocks:

- Have their own settings.
- Can be added, removed, and reordered within a section.
- Can be section-local, theme-level reusable, or app-provided.
- Newer theme block patterns support nested blocks.

LetBuyy gap:

- Blocks exist as arrays in config and schema definitions, but the editor does not implement complete block selection, edit, reorder, duplicate, delete, nesting, or static/locked block concepts.
- Storefront rendering currently passes block arrays into individual React components without an engine-level block renderer.
- No app-block extension point exists for reviews, subscriptions, badges, personalization, analytics embeds, loyalty widgets, or marketplace apps.

## Shopify Theme Settings Pattern

Shopify separates:

- `settings_schema.json`: the organization and field definitions in the theme editor.
- `settings_data.json`: saved values, current state, and presets.

LetBuyy gap:

- `THEME_SETTINGS_SCHEMA` and `SECTION_SCHEMAS` are source-code constants.
- Theme settings and template sections are mixed into one `template_config`.
- Store preferences screen is disconnected from the theme engine.
- There is no DB-backed settings data model with current, draft, preset, platform-controlled, and release values.

Target model:

- `theme_setting_definitions`: versioned field schema.
- `theme_instance_settings`: store-specific current values.
- `theme_draft_settings`: draft values.
- `theme_release_settings`: immutable published snapshot.
- `platform_storefront_settings`: SEO, analytics, password, policy, app embeds.

## Shopify Theme App Extension Pattern

Shopify theme app extensions let app developers expose blocks and assets in the theme editor without merchants editing theme code. The pattern is important for LetBuyy because the platform already has an app marketplace direction.

LetBuyy needs:

- App block registry.
- App embed registry.
- Extension asset hosting.
- Block placement permissions by template/section.
- App uninstall cleanup and disabled-state rendering.
- App block data isolation by `site_id`.
- Versioned extension contracts.

Without this, the future app marketplace will require custom code changes per app.

## Shopify Performance Pattern

Shopify emphasizes:

- Minimal JavaScript for basic commerce.
- Progressive enhancement.
- Lazy loading below-the-fold images.
- Avoiding parser-blocking scripts.
- Resource hints for critical assets.
- Strong performance thresholds for marketplace acceptance.

LetBuyy implications:

- The renderer must be server-first.
- Section interactivity should be island-based.
- Editor-only code must never ship to published storefronts.
- App blocks must have strict script budgets and sandboxing.
- Render manifests should declare critical CSS, critical images, and deferred assets per section.

## Webflow Patterns

Webflow CMS emphasizes structured collections:

- Fields are data storage, not visual elements.
- Designers bind visual elements to fields.
- Field types include text, rich text, image, multi-image, video, link, email, phone, number, date, boolean, color, option, file, references, and multi-references.
- Field deletion requires knowing where fields are connected.

LetBuyy implications:

- CMS pages and product/collection sections need explicit data bindings.
- The builder should track field usage and prevent deleting content fields that live templates consume.
- Storefront pages should separate content schema from visual layout.

## Framer Patterns

Framer CMS patterns relevant to LetBuyy:

- Collections define structured content.
- Dynamic pages use one layout to render many items.
- Collection lists repeat a component for multiple CMS entries.
- On-page editing and flexible detail pages are part of editor expectations.

LetBuyy implications:

- CMS detail templates should support resource binding, not one page per entity.
- Product detail, collection detail, blog article, portfolio project, and policy pages should be template-driven.
- Section repeaters must bind to queries, not hardcoded arrays.

## Builder.io Patterns

Builder.io patterns:

- Visual editor with layers, style/options/data tabs, custom components, data binding, targeting, scheduling, variants, symbols, and reusable blocks.
- Components can be registered and then visually composed by editors.
- Content can be connected to API data and state.

LetBuyy implications:

- Component/section registry must expose editor metadata separately from runtime render code.
- Data binding is first-class: product query, collection query, customer state, cart state, CMS model, external app block.
- Reusable symbols/sections are needed for shared content.
- Scheduling and targeting are future requirements, especially for campaign sections.

## Shogun Patterns

Shogun patterns:

- Custom elements have editable variables and reusable versions.
- Snippets enable reuse of elements/sections/pages.
- Shopify sections can be created in Shogun and then made available to Shopify Theme Editor.
- Publishing a section can affect every place where it is used.

LetBuyy implications:

- LetBuyy needs shared section definitions and per-instance section configs.
- Updating a reusable section definition must have explicit propagation policy: immediate, staged, forked, or per-store opt-in.
- Custom code/extensions need strong safety and versioning.
- Reuse should distinguish between copied section instances and linked global symbols.

## Medusa Patterns

Medusa storefront architecture separates commerce backend from storefront app:

- Storefronts are independent apps.
- Commerce data is fetched through Store API routes.
- Publishable API keys scope storefront requests to channels.

LetBuyy implications:

- The theme engine should not couple rendering to admin internals.
- Storefront runtime must use public scoped APIs and tenant-safe context.
- Product, inventory, pricing, customer, cart, and order APIs should be data providers to the renderer.
- Multi-region/multi-market expansion requires channel/market-aware data context.

## Missing Enterprise Systems in LetBuyy

Compared with Shopify/Webflow/Framer/Builder/Shogun/Medusa, LetBuyy lacks:

- Theme package manifest.
- Theme instance abstraction.
- Template resolver.
- Section group engine.
- Block engine.
- Schema compiler.
- Dynamic data-binding engine.
- CMS model registry.
- Route/template assignment.
- Navigation builder.
- Live iframe preview runtime.
- Real app block extension system.
- Theme upgrade and migration system.
- Renderer manifest and lazy-loading registry.
- Edge/cache dependency graph.
- Shared editor/live renderer.
- Field usage graph and safe deletion workflow.
- Section-level versioning and global reusable symbols.

## Missing Rendering Layers

Required rendering layers:

1. Request context loader.
2. Store/site resolver.
3. Theme instance resolver.
4. Draft or published release resolver.
5. Route resolver.
6. Template resolver.
7. Data dependency planner.
8. Section group renderer.
9. Template section renderer.
10. Block renderer.
11. Asset and script manifest collector.
12. Cache tag collector.
13. HTML/React streaming renderer.
14. Client island hydrator.

## Missing Schema Systems

Required schema systems:

- Theme schema definitions stored by package version.
- Section schemas stored by theme version.
- Block schemas stored by theme version.
- Settings schema stored by theme version.
- Data source schema for products, collections, CMS, menus, media, reviews, customers, and app extensions.
- Editor UI schema with field widgets, validations, visibility conditions, permissions, and responsive overrides.
- Runtime JSON schema validation before save, publish, import, upgrade, rollback, and render.

## Missing Dynamic Composition Systems

LetBuyy needs dynamic composition for:

- Homepages.
- Product pages.
- Collection pages.
- CMS pages.
- Blog pages.
- Cart page.
- Search page.
- Customer account pages.
- Policy pages.
- Password/coming soon page.
- Theme preview pages.

Each page must be resolved by route and resource, not by a hardcoded route component.

## Missing Preview Architecture

Current preview token creation exists in the worker, but final preview needs:

- Draft preview URL.
- Signed token resolver.
- Iframe-safe preview shell.
- Live `postMessage` patches from editor to iframe.
- Server-rendered draft HTML on first load.
- Client patch rendering for low-latency edits.
- Device viewport modes.
- Route/resource switching.
- Error overlay from the iframe back to editor.
- Screenshot capture for theme cards.

## Missing Realtime Architecture

Required realtime systems:

- Autosave queue.
- Patch stream.
- Editor-to-preview message bus.
- Optimistic state patches.
- Conflict detection by draft version and section revision.
- Multi-tab locking.
- Collaboration-ready presence and cursor model.
- Publish transaction status stream.

## Missing Extensibility Systems

Required extensibility systems:

- App block registry.
- App embed registry.
- Section marketplace registry.
- Theme extension assets.
- Extension permission model.
- Extension uninstall cleanup.
- Extension rate and script budget.
- Webhook/event integrations for theme publish, section update, product update, collection update, and app install.

## LetBuyy Target Pattern

LetBuyy should implement a hybrid pattern:

- Shopify-inspired theme package, templates, sections, blocks, app blocks, presets, settings, and releases.
- Webflow-inspired CMS field binding and field usage graph.
- Framer-inspired dynamic CMS pages and reusable layouts.
- Builder.io-inspired visual editor, data tab, reusable symbols, targeting-ready model.
- Shogun-inspired reusable custom sections with explicit publish propagation.
- Medusa-inspired headless commerce data providers and tenant-scoped public APIs.
