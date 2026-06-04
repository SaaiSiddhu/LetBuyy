# LetBuyy Brand System V1

Generated: 2026-06-03
Source of truth decision: **LetBuyy Brand Purple `#8B5CF6`**.

This document defines the canonical color tokens for LetBuyy products. It uses the selected existing brand direction and the existing repo color set. It does not introduce a redesign.

## Canonical Tokens

| Token | Light value | Dark value | Role |
|---|---:|---:|---|
| Brand Purple | `#8B5CF6` | `#8B5CF6` | Official LetBuyy brand anchor |
| Primary | `#8B5CF6` | `#8B5CF6` | Default brand action and accent |
| Primary Hover | `#7C3AED` | `#7C3AED` | Hover and stronger CTA state |
| Primary Active | `#6D28D9` | `#6D28D9` | Pressed state and high-contrast small CTA |
| Primary Subtle | `rgba(139, 92, 246, 0.12)` | `rgba(139, 92, 246, 0.12)` | Subtle selected, focus, and tint surfaces |
| Background | `#F8FAFC` | `#0A0F1A` | Page background |
| Surface | `#FFFFFF` | `#0F172A` | Panels, forms, app shells |
| Card | `#FFFFFF` | `#0F172A` | Cards and grouped content |
| Sidebar | `#FFFFFF` | `#0F172A` | Navigation shell |
| Header | `#FFFFFF` | `#0F172A` | Top-level app header |
| Text Primary | `#0F172A` | `#FFFFFF` | Main readable text |
| Text Secondary | `#475569` | `#94A3B8` | Supporting readable text |
| Text Muted | `#64748B` | `#94A3B8` | Metadata, placeholders, low-emphasis labels |
| Border Subtle | `#E2E8F0` | `#334155` | Light separators |
| Border Default | `#E2E8F0` | `#334155` | Standard control and panel borders |
| Border Strong | `#334155` | `#E2E8F0` | High-emphasis outlines when required |
| Success | `#22C55E` | `#22C55E` | Positive and completed states |
| Warning | `#F59E0B` | `#F59E0B` | Caution and pending states |
| Danger | `#EF4444` | `#EF4444` | Error, destructive, critical, failed states |
| Info | `#3B82F6` | `#3B82F6` | Informational state only |

## Official Token Names

Use these names across web, Flutter, docs, and future product surfaces:

| Canonical name | CSS variable | TypeScript key | Flutter key |
|---|---|---|---|
| Brand Purple | `--lb-color-brand-purple` | `brandPurple` | `brandPurple` |
| Primary | `--lb-color-primary` | `primary` | `primary` |
| Primary Hover | `--lb-color-primary-hover` | `primaryHover` | `primaryHover` |
| Primary Active | `--lb-color-primary-active` | `primaryActive` | `primaryActive` |
| Primary Subtle | `--lb-color-primary-subtle` | `primarySubtle` | `primarySubtle` |
| Background Light | `--lb-color-background-light` | `backgroundLight` | `backgroundLight` |
| Background Dark | `--lb-color-background-dark` | `backgroundDark` | `backgroundDark` |
| Surface Light | `--lb-color-surface-light` | `surfaceLight` | `surfaceLight` |
| Surface Dark | `--lb-color-surface-dark` | `surfaceDark` | `surfaceDark` |
| Text Primary Light | `--lb-color-text-primary-light` | `textPrimaryLight` | `textPrimaryLight` |
| Text Primary Dark | `--lb-color-text-primary-dark` | `textPrimaryDark` | `textPrimaryDark` |
| Text Secondary Light | `--lb-color-text-secondary-light` | `textSecondaryLight` | `textSecondaryLight` |
| Text Secondary Dark | `--lb-color-text-secondary-dark` | `textSecondaryDark` | `textSecondaryDark` |
| Text Muted | `--lb-color-text-muted` | `textMuted` | `textMuted` |
| Border Light | `--lb-color-border-light` | `borderLight` | `borderLight` |
| Border Dark | `--lb-color-border-dark` | `borderDark` | `borderDark` |
| Success | `--lb-color-success` | `success` | `success` |
| Warning | `--lb-color-warning` | `warning` | `warning` |
| Danger | `--lb-color-danger` | `danger` | `danger` |
| Info | `--lb-color-info` | `info` | `info` |

## Web Mapping

```ts
export const colors = {
  brandPurple: '#8B5CF6',
  primary: '#8B5CF6',
  primaryHover: '#7C3AED',
  primaryActive: '#6D28D9',
  primarySubtle: 'rgba(139, 92, 246, 0.12)',
  backgroundLight: '#F8FAFC',
  backgroundDark: '#0A0F1A',
  surfaceLight: '#FFFFFF',
  surfaceDark: '#0F172A',
  textPrimaryLight: '#0F172A',
  textPrimaryDark: '#FFFFFF',
  textSecondaryLight: '#475569',
  textSecondaryDark: '#94A3B8',
  textMuted: '#64748B',
  borderLight: '#E2E8F0',
  borderDark: '#334155',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
} as const;
```

```css
:root {
  --lb-color-brand-purple: #8B5CF6;
  --lb-color-primary: #8B5CF6;
  --lb-color-primary-hover: #7C3AED;
  --lb-color-primary-active: #6D28D9;
  --lb-color-primary-subtle: rgba(139, 92, 246, 0.12);
  --lb-color-background: #F8FAFC;
  --lb-color-surface: #FFFFFF;
  --lb-color-card: #FFFFFF;
  --lb-color-sidebar: #FFFFFF;
  --lb-color-header: #FFFFFF;
  --lb-color-text-primary: #0F172A;
  --lb-color-text-secondary: #475569;
  --lb-color-text-muted: #64748B;
  --lb-color-border-subtle: #E2E8F0;
  --lb-color-border-default: #E2E8F0;
  --lb-color-border-strong: #334155;
  --lb-color-success: #22C55E;
  --lb-color-warning: #F59E0B;
  --lb-color-danger: #EF4444;
  --lb-color-info: #3B82F6;
}

[data-theme="dark"] {
  --lb-color-brand-purple: #8B5CF6;
  --lb-color-primary: #8B5CF6;
  --lb-color-primary-hover: #7C3AED;
  --lb-color-primary-active: #6D28D9;
  --lb-color-primary-subtle: rgba(139, 92, 246, 0.12);
  --lb-color-background: #0A0F1A;
  --lb-color-surface: #0F172A;
  --lb-color-card: #0F172A;
  --lb-color-sidebar: #0F172A;
  --lb-color-header: #0F172A;
  --lb-color-text-primary: #FFFFFF;
  --lb-color-text-secondary: #94A3B8;
  --lb-color-text-muted: #94A3B8;
  --lb-color-border-subtle: #334155;
  --lb-color-border-default: #334155;
  --lb-color-border-strong: #E2E8F0;
  --lb-color-success: #22C55E;
  --lb-color-warning: #F59E0B;
  --lb-color-danger: #EF4444;
  --lb-color-info: #3B82F6;
}
```

## Flutter Mapping

```dart
class LetBuyyColors {
  static const brandPurple = Color(0xFF8B5CF6);
  static const primary = Color(0xFF8B5CF6);
  static const primaryHover = Color(0xFF7C3AED);
  static const primaryActive = Color(0xFF6D28D9);
  static const backgroundLight = Color(0xFFF8FAFC);
  static const backgroundDark = Color(0xFF0A0F1A);
  static const surfaceLight = Color(0xFFFFFFFF);
  static const surfaceDark = Color(0xFF0F172A);
  static const textPrimaryLight = Color(0xFF0F172A);
  static const textPrimaryDark = Color(0xFFFFFFFF);
  static const textSecondaryLight = Color(0xFF475569);
  static const textSecondaryDark = Color(0xFF94A3B8);
  static const textMuted = Color(0xFF64748B);
  static const borderLight = Color(0xFFE2E8F0);
  static const borderDark = Color(0xFF334155);
  static const success = Color(0xFF22C55E);
  static const warning = Color(0xFFF59E0B);
  static const danger = Color(0xFFEF4444);
  static const info = Color(0xFF3B82F6);

  static const primarySubtle = Color(0x1F8B5CF6);
}
```

## Accessibility Rules

1. `#8B5CF6` is the brand anchor.
2. For small white-text primary buttons, use `#7C3AED` or `#6D28D9` when contrast requires a darker background.
3. Red is not a brand color. Red is only danger, destructive action, critical alert, failed state, or security risk.
4. Blue is not a brand color. Blue is only info, link support where already required, provider color, or chart/category color.
5. Cyan is not a brand color. Cyan may remain only as a merchant theme preset, storefront palette, chart color, or legacy documented value until migration.
6. Indigo is not the primary brand. It may remain only as a nearby support shade where a product-specific palette explicitly requires it.

## Source Authority

After Wave 1 of migration, `packages/typescript/ui/src/tokens.ts` should become the web token source, and `packages/dart/ui_kit/lib/src/themes/app_colors.dart` should become the Flutter token source. Both must map to this document and to the same canonical values.
