---
"@letbuyy/ui": major
---

Promote `@letbuyy/ui` to its first stable release (**1.0.0**) and harden the foundation:

- **Tokens:** completed the primitive colour ramps (purple/gray/slate/red/blue) and removed all raw hex from the semantic token layer — the design system now obeys its own `no-hardcoded-hex` rule. Token snapshots regenerated; no rendered colour changes.
- **Enforcement:** expanded the ESLint plugin with `no-raw-form-controls` (select/textarea/dialog), `no-raw-color-functions` (rgb()/hsl()), and `no-tailwind-default-color` (Tailwind default-palette utilities), shipped at `warn` in the recommended config and wired into all apps. Added a Stylelint config to fence the `.css` layer.
- **Cross-platform:** added a Dart token generator so the mobile app's tokens are derived from the canonical TypeScript source (no more hand-maintained drift).
- **Theming:** added a shared token-backed Tailwind preset (`config/tailwind`) mapping the default palette to `--lb-*` tokens and wiring the design-system breakpoints.
- **Overlays:** Modal/Drawer/Dropdown/Popover now render through a portal with body scroll-lock and focus restoration.
- **Operations:** added changesets, a `dist` publish config, and a migrator CLI (`codemods/cli.mjs`).
