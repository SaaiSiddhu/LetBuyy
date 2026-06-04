# Shopify Theme System Blueprint

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Online Store Themes

- Route: `/themes`
- Purpose: Manage current theme, theme library, previews, password protection, and theme discovery.
- Primary CTA: Edit theme
- Secondary actions: Preview, duplicate, rename, edit code/content, download, visit theme store, import theme, add theme
- Component/workflow: embedded channel frame
- Component/workflow: current theme card
- Component/workflow: theme preview images
- Component/workflow: theme action menu
- Component/workflow: discovery carousel
- Component/workflow: plan/password banner
- LetBuyy equivalent: Theme management needs library, current/live state, safe duplicate, and edit entry.

## Theme Editor

- Route: `/themes/[theme_id]/editor`
- Purpose: Customize storefront sections, blocks, settings, app embeds, responsive preview, and publishing state.
- Primary CTA: Save when changes exist, not executed
- Secondary actions: Undo/redo, template selector, preview mode, app embeds, section actions
- Component/workflow: section tree
- Component/workflow: live preview
- Component/workflow: template selector
- Component/workflow: left mode rail
- Component/workflow: drag handles
- Component/workflow: visibility toggles
- Component/workflow: inspector
- Component/workflow: responsive preview
- Component/workflow: save buttons
- LetBuyy equivalent: Builder must support section tree plus live preview, not a form-only settings page.

## Theme System Rules For LetBuyy

- Separate theme marketplace, acquired theme library, current live theme, draft theme, and editor state.
- Never make edit/publish the same action; merchants need duplicate, preview, publish, rollback, and download/export affordances.
- Use a section tree with groups, drag handles, visibility toggles, and add-section affordances.
- Live preview must reflect template selection, responsive viewport selection, and app block presence.
- Theme actions should live behind contextual menus to keep the current theme card calm.
- Password protection and plan gating belong in banners, not hidden in settings only.
