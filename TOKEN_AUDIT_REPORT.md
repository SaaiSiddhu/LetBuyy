# LetBuyy Purple V1 Token Audit Report

Generated: 2026-06-03
Scope: `packages/typescript/ui` tokens, theme root, and Storybook token references only.

## Files Reviewed

- `packages/typescript/ui/src/tokens.ts`
- `packages/typescript/ui/src/design-system-root.tsx`
- `packages/typescript/ui/.storybook/main.ts`
- `packages/typescript/ui/.storybook/preview.tsx`
- `packages/typescript/ui/src/storybook.css`
- `packages/typescript/ui/src/merchant-experience.stories.tsx`

## Current Token Source

`packages/typescript/ui/src/tokens.ts` is the active shared web token source. `DesignSystemRoot` injects `letbuyyTokenCss`, and Storybook wraps stories with `DesignSystemRoot`, so Storybook can render directly from shared token variables.

## Blue Brand Tokens

No active shared UI brand token currently resolves to the old blue primary values `#2563EB` or `#60A5FA`.

Blue remains only as the semantic info token:

- `letbuyyTokens.color.light.info = #3B82F6`
- `letbuyyTokens.color.dark.info = #3B82F6`

This is allowed by Purple V1 because info blue is semantic, not brand.

## Purple Tokens

The existing shared token file already contains:

- `brandPurple = #8B5CF6`
- `primary = #8B5CF6`
- `primaryHover = #7C3AED`
- `primaryActive = #6D28D9`
- `primarySubtle = rgba(139, 92, 246, 0.12)`
- `primarySoft = rgba(139, 92, 246, 0.12)`

However, Purple V1 does not yet expose a flat canonical color object with the requested token names such as `backgroundLight`, `backgroundDark`, `surfaceLight`, `surfaceDark`, `textPrimaryLight`, and `textPrimaryDark`.

## Duplicate Tokens

Duplicates are intentional but should be normalized as aliases:

- `brandPurple`, `primary`, and dark `primary` all resolve to `#8B5CF6`.
- `primarySubtle` and `primarySoft` both resolve to `rgba(139, 92, 246, 0.12)`.
- Light `bg` and `surfaceSubdued` both resolve to `#F8FAFC`.
- Light `surface` and `surfaceRaised` both resolve to `#ffffff`.
- Dark `bg` and `surfaceSubdued` both resolve to `#0A0F1A`.
- Dark `surface` and `surfaceRaised` both resolve to `#0F172A`.

Normalization target: derive theme aliases from one canonical Purple V1 token object instead of restating values independently.

## Dead Or Weakly Documented Tokens

- `primarySubtle` is exported as a CSS variable but shared UI components mostly consume `primarySoft`.
- `primarySoft` is useful as a compatibility alias for existing components.
- `textInverse` is used by buttons, tooltips, destructive buttons, and preview controls.
- No Storybook page currently documents all color tokens directly.

## Token Aliases

The current CSS variable bridge maps old and new naming patterns:

- `--lb-color-bg` aliases `--lb-color-background`.
- `--lb-color-text` aliases `--lb-color-text-primary`.
- `--lb-color-text-subdued` aliases `--lb-color-text-secondary`.
- `--lb-color-border` aliases `--lb-color-border-default`.
- `--lb-color-critical` aliases `--lb-color-danger`.
- `--lb-color-primary-soft` aliases `--lb-color-primary-subtle`.

These aliases should remain for compatibility, but their values should come from centralized Purple V1 tokens.

## Button Strategy Gap

Current primary buttons consume `--lb-color-primary`, which resolves to Brand Purple in both themes.

Purple V1 mission requires:

- Light mode primary CTA background: `#0F172A`
- Light mode primary CTA text: `#FFFFFF`
- Dark mode primary CTA background: `#8B5CF6`
- Dark mode primary CTA text: `#FFFFFF`

This requires CTA-specific token variables so `--lb-color-primary` can remain the brand Purple token.

## Storybook Findings

Storybook config is present and uses the shared token root:

- `packages/typescript/ui/.storybook/main.ts`
- `packages/typescript/ui/.storybook/preview.tsx`

Current Storybook gaps:

- No dedicated `Design Tokens` story group exists.
- Existing stories include hardcoded swatch demo values in `merchant-experience.stories.tsx`.
- Storybook does not yet render separate Colors, Light Theme, Dark Theme, Brand Colors, and Semantic Colors token documentation pages.

## Required Changes

1. Add a canonical Purple V1 color object in `tokens.ts`.
2. Derive light and dark theme aliases from that object.
3. Add CTA-specific tokens for light/dark button strategy.
4. Update primary CTA component references to use CTA tokens.
5. Add Storybook token stories that render from token exports and CSS variables, not hardcoded color values.
6. Replace hardcoded Storybook swatch examples with token-derived values.
