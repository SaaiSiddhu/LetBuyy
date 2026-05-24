# 08 - Enterprise Design System Architecture

Generated: 2026-05-22

## Objective

LetBuyy needs one token and component architecture spanning admin, storefront, theme editor, marketplace, and future Flutter surfaces. Themes can change storefront style, but platform UI must remain consistent.

## Design Token Architecture

Token layers:

```text
Primitive tokens
  color scales
  spacing scale
  typography scale
  radius scale
  shadow scale
  motion scale

Semantic tokens
  background
  surface
  text
  muted
  border
  primary
  danger
  warning
  success
  info

Component tokens
  button
  input
  table
  card
  modal
  drawer
  sidebar
  toolbar
  product_card
  section_wrapper

Theme tokens
  merchant storefront brand values
  package preset values
  responsive overrides
```

## Shared UI Architecture

Use `packages/typescript/ui` for components reused by two or more apps.

Required component families:

- Button.
- Icon button.
- Input.
- Textarea.
- Select.
- Combobox.
- Checkbox.
- Toggle.
- Slider.
- Color picker.
- File/media picker.
- Tabs.
- Segmented control.
- Menu.
- Popover.
- Modal.
- Drawer.
- Sidebar.
- Data table.
- Empty state.
- Skeleton.
- Toast.
- Tooltip.
- Badge.
- Card for repeated items only.
- Form field wrapper.

Admin UI should prioritize dense operational workflows over marketing layout.

## Theme Token System

Theme tokens are store-facing and package-specific.

Example token categories:

- `color.brand.primary`
- `color.brand.secondary`
- `color.surface.page`
- `color.surface.card`
- `color.text.primary`
- `font.body`
- `font.heading`
- `space.section.x`
- `space.section.y`
- `radius.card`
- `radius.button`
- `shadow.card`
- `motion.duration.fast`

Theme package exposes:

- Token schema.
- Preset token values.
- Allowed token ranges.
- Color contrast constraints.
- CSS variable mapping.

## CSS Variable Strategy

Admin:

- Stable platform CSS variables.
- Light/dark mode supported.
- No merchant theme variables should leak into admin chrome.

Storefront:

- Release snapshot generates CSS variables.
- Theme CSS variables are scoped to storefront root:

```css
[data-letbuyy-storefront] {
  --lb-color-brand-primary: ...;
  --lb-font-body: ...;
}
```

Preview:

- iframe receives draft variables.
- Editor parent uses admin variables only.

## Dynamic Theming Architecture

Theme settings update:

1. Merchant changes token in editor.
2. Schema validates value and contrast.
3. Draft token patch is sent to iframe.
4. iframe updates CSS variables without full reload when possible.
5. Autosave stores draft token.
6. Publish snapshots token map in release.

## Accessibility Architecture

Required checks:

- Color contrast.
- Keyboard focus states.
- Visible focus ring.
- Label associations.
- Landmark regions.
- Heading order.
- Alt text for images.
- Reduced motion support.
- Touch target size.
- Form error announcements.
- Modal/drawer focus traps.
- Iframe editor accessibility boundaries.

Publish warnings:

- Missing alt text.
- Insufficient contrast.
- Missing heading in hero/content sections.
- Empty button/link labels.
- Icon-only buttons without accessible name.

## Responsive Strategy

Breakpoints:

- Mobile.
- Tablet.
- Desktop.
- Wide.

Rules:

- No viewport-width font scaling.
- Stable dimensions for preview frames, toolbar controls, cards, grids, and product cards.
- Responsive settings stored as overrides.
- Storefront section wrappers use CSS container queries where possible.
- Editor previews every section at each breakpoint before publish warnings are cleared.

## UI Consistency Audit

Current issues from source and screenshots:

- Admin theme page uses hardcoded preview mockups and inline styles.
- Theme editor preview uses placeholder sections, not shared storefront components.
- Storefront uses theme-specific shell for Urban Kicks and generic shell for others.
- Multiple color systems exist: hardcoded colors, theme presets, theme settings, Tailwind classes, inline CSS variables.
- Material Symbols are used in some places; governance says web icons should use Lucide React.
- Preferences page is visually present but not integrated as a theme config layer.
- Pages screen is visually empty and not a CMS system.

## Standardization Plan

1. Define platform tokens in `packages/typescript/ui`.
2. Define storefront theme token schema in theme package registry.
3. Replace inline preview styling with shared components and CSS variables.
4. Make admin theme cards use generated screenshots from real preview renderer.
5. Replace static icon font usage with Lucide React where applicable.
6. Create shared form field renderer for schema-driven controls.
7. Move reusable editor primitives into UI package after two-app reuse.
8. Generate Dart token exports for Flutter builder surfaces.

## Storefront Component Consistency

Storefront components must accept:

- `settings`
- `tokens`
- `data`
- `responsive`
- `editorContext`

They must not:

- Read static mock data.
- Hardcode product collections.
- Hardcode navigation links.
- Hardcode brand copy.
- Hardcode theme colors except fallback tokens.
- Import editor-only code.

## Admin Component Consistency

Admin components must:

- Use platform tokens.
- Support light/dark mode.
- Support loading, empty, error, focus, hover, active, and disabled states.
- Avoid inline styles in new work.
- Use dense, scan-friendly layouts for operations.
- Use Lucide React icons.
