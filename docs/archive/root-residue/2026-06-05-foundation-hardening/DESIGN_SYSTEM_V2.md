# LetBuyy Design System V2

Generated: 2026-06-03

Purpose: central visual architecture for a premium commerce-admin experience. This is a token and presentation layer update, not a redesign.

## Color Hierarchy

### Light Mode

| Token | Value | Role |
|---|---|---|
| Sidebar surface | `#EFEFF1` | Persistent navigation layer |
| Page surface | `#F5F5F7` | Main admin canvas |
| Card surface | `#FFFFFF` | Primary content panels |
| Border | `#E5E7EB` | Subtle structural borders |
| Primary CTA | `#0F172A` | Main light-mode actions |
| Primary CTA hover | `#1E293B` | Light-mode hover |
| Primary CTA active | `#000000` | Light-mode active |
| Brand accent | `#8B5CF6` | Links, focus, selected states, indicators |

### Dark Mode

| Token | Value | Role |
|---|---|---|
| Sidebar surface | `#111827` | Persistent navigation layer |
| Page surface | `#0A0F1A` | Main admin canvas |
| Card surface | `#1F2937` | Primary content panels |
| Border | `#334155` | Default dark border |
| Primary CTA | `#8B5CF6` | Main dark-mode actions |
| Primary CTA hover | `#7C3AED` | Dark-mode hover |
| Primary CTA active | `#6D28D9` | Dark-mode active |

## Spacing Scale

Official spacing values:

- `--lb-space-1`: 4px
- `--lb-space-2`: 8px
- `--lb-space-3`: 12px
- `--lb-space-4`: 16px
- `--lb-space-5`: 24px
- `--lb-space-6`: 32px
- `--lb-space-7`: 48px
- `--lb-space-8`: 64px

## Typography Scale

| Role | Size | Line Height |
|---|---:|---:|
| Display | 48px | 56px |
| H1 | 40px | 48px |
| H2 | 32px | 40px |
| H3 | 24px | 32px |
| H4 | 20px | 28px |
| Body Large | 18px | 28px |
| Body | 16px | 24px |
| Small | 14px | 20px |
| Caption | 12px | 16px |

Allowed weights: 400, 500, 600, 700.

## Component Tokens

| Component | Key V2 Rules |
|---|---|
| Button | Light primary is navy with white text. Dark primary is purple with white text. Secondary is transparent with subtle border. |
| Card | 16px radius, 1px subtle border, soft shadow only. |
| Sidebar | Separate background layer, subtle hover, subtle selected background, no glow. |
| Input | Uses shared surface, border, focus-ring, and text tokens. |
| Table | Uses shared table background, header, row hover, border, and text tokens. |
| Empty State | Illustration, title, description, primary CTA, secondary CTA. |

## Motion

- Duration: 150-200ms
- Easing: ease-out
- Hover lift: 2px maximum
- Hover scale token: 1.01 maximum
- No bounce, glow, or flashy motion

## Source of Truth

Primary source: `packages/typescript/ui/src/tokens.ts`

Documentation source: `packages/typescript/ui/src/design-tokens.stories.tsx`
