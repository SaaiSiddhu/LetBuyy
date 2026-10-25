# Canonical marketing UI — 23 October 2026

Owner clarified “canonical” means consistent UI and design system. Existing content, features, layouts and section order remain the acceptance constraint. Scope is the marketing runtime on `develop` at `118209b4`; no commit, push or deployment.

## Implementation

- Follow UI-R1/UI-R5/UI-R7 and DOC 03 §35: consume the existing `@letbuyy/ui` token engine, theme controller, form controls and shared dialogs. No second palette, token engine, shell or theme controller was introduced.
- Converted 1,001 raw RGB/RGBA occurrences across the stylesheet and illustration/resource data to existing canonical variables. Public chrome uses semantic roles; artwork/module colors use existing primitive variables. Transparency uses `color-mix()` with those variables.
- Converted stylesheet font sizes, weights, spacing and radii to the shared scale. Existing off-scale illustration/layout dimensions are expressed relative to the shared scale so their geometry is retained. Inter remains locally hosted and is reached through the canonical font stack.
- Replaced retired/missing border, danger and hovered-surface references. App-owned header/section measurements now use the `--marketing-*` namespace rather than reauthoring `--lb-*` tokens.
- Resolve marketing color adapters on the theme-provider root. This fixes manual light-mode switching under a dark OS preference, which previously inherited document-root values already resolved against the other mode. Light header backgrounds also use the surface role. Supporting text uses the canonical subdued role in both modes.
- Standardized AI/action Material indicators to the existing Lucide exports. The create flow uses the same semantic colors instead of its separate zinc/blue palette. Existing choices, fields and interactions remain.
- The existing shared theme toggle is now reachable in the mobile drawer header. Existing links and actions retain their order.
- Marketing source lint now fails on raw color functions, raw form controls and Tailwind palette colors. Its stylesheet lint fails on raw color functions, named colors, app-local `--lb-*` definitions, numeric weights and raw-pixel type/spacing declarations. `pnpm --filter @letbuyy/marketing-site lint` runs both checks. No global baseline was raised or updated.
- Browser checks exposed a pre-existing unsupported `size: 'invisible'` option in both marketing Turnstile wrappers. Removed that option; widget mode remains controlled by its configured site key and the existing server verification stays in place. Cloudflare documents that sizes are normal/flexible/compact and invisible widgets have no footprint regardless of size: https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/#widget-sizes .

## Evidence

- Final marketing production build, TypeScript and package lint: exit 0. ESLint retains 19 unrelated warnings; strict stylesheet lint has no errors/warnings.
- Marketing package tests: 10/10 passed. Global design-system validator passed without any baseline edit.
- Positive/negative stylesheet probes: canonical styles exit 0; deliberate raw RGB, raw type/spacing/weight and a local `--lb-*` declaration exit 2, with each enforcing rule identified. The probe used stdin and did not modify application source.
- Final source scan: zero raw RGB/HSL functions, zero app-local `--lb-*` declarations, zero unresolved canonical variable references, zero direct raw-pixel `font-size` declarations.
- TypeScript AST comparison against the pre-pass snapshot: visible JSX copy and literal href/alt/aria-label values unchanged across all 70 JSX files.
- Browser: dark desktop homepage at 1440px preserves all eight sections in order, five trust pills and four visible commerce metrics; no horizontal overflow. Light homepage at 490px renders dark headings, readable supporting copy and white-on-purple primary actions. Mobile drawer at 320px has no horizontal overflow and retains its links, login/signup and theme control. Escape dismisses it.
- Contact at 1440px: Continue with blank fields shows three existing validation errors and focuses the name field. Resources, pricing, demo and Privacy render without horizontal overflow or broken images in the observed desktop checks. Create flow retains both site-type choices; keyboard activation reaches Site Details with the existing two fields and disabled Create action.
- Sample opaque color-pair calculations: light primary/page 16.549:1, light supporting/page 4.510:1, dark primary/page 19.798:1, dark supporting/page 13.335:1, primary button 7.105:1. These sample pairs do not certify every composited/gradient state.
- Browser left on `http://localhost:9006/in`, dark preview, original 490×1034 viewport restored.

## Limits

The existing global marketing exemption in the repository-wide drift ratchet remains; this pass adds strict package-level enforcement instead of expanding that global baseline. Existing literal responsive breakpoints, drawing dimensions and dynamic positioning styles remain, preserving the owner’s layout constraint. This is a marketing UI consolidation, not closure of the platform-wide design governance programme. Full assistive-technology, performance and production acceptance remain unverified. No contact/demo request, account, payment or provider delivery was submitted; Turnstile provider success is not certified by the option correction or the absence of a console error in the observed demo visit.

Screenshots: `canonical-home-dark-desktop.png`, `canonical-home-light-mobile.png`, `canonical-menu-320.png`.
