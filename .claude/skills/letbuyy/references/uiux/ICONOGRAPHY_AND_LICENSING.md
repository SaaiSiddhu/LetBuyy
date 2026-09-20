# LetBuyy Iconography and Licensing

Measured 2026-09-04 at `a751a2ff`. Licences must be **re-read from the official source** before any
new asset is added; nothing below was re-verified online this session.

---

## 1. Icons — one system

**Web: Lucide**, re-exported through `packages/typescript/ui/src/icons.tsx` (`lucide-react`). Product
code imports icons from `@letbuyy/ui`, never from `lucide-react` directly and never from a second set.
Reasons: already installed, ISC/MIT, 24 px grid with a uniform stroke, tree-shakes per icon, and the
wrapper carries the accessibility contract.

**Flutter: Material Icons** via the Flutter SDK (Apache 2.0) for `merchant_app`. `font_awesome_flutter`
(pinned `^11.0.0` after the `IconData` compile blocker) is a **donor-app** dependency of
`customer_app`/`admin_app` only — HOLD scope; do not introduce it into `merchant_app` or `ui_kit`.

Rules:
- Sizes from the token scale (16 / 20 / 24; density tokens size icons and illustrations); uniform
  stroke; never scale an icon beyond ~1.5× — that is an illustration (`EmptyStateIllustration`).
- Decorative icon next to a label → `aria-hidden="true"`; icon-only control → accessible name on the
  control; meaningful standalone icon → `role="img"` + `aria-label`. Flutter: `Semantics` labels.
- Icons support meaning, never replace it (the icon-card test in `ANTI_AI_TEMPLATE_CHECKLIST.md`).
- Custom icons only when Lucide lacks the concept; match the grid and stroke; document why.
- No icon fonts on the web; SVG only.
- Status and provider mode always carry text (`StatusPresentationBadge`, `ProviderModeBadge`).

---

## 2. Fonts

`packages/typescript/ui/src/fonts.ts` defines three stacks behind CSS variables —
`--font-letbuyy-sans`, `--font-letbuyy-display`, `--font-letbuyy-mono` — each falling back to
`ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` (mono to the
system monospace). **Which font files each app binds to those variables was not measured this
session** (`UNKNOWN`); a UX phase records it in `EVIDENCE_LEDGER.md` before changing anything.

Rules:
- Self-host via `next/font/local`; Latin subset unless another script is required; WOFF2; variable
  fonts where available; `display: swap` with metric overrides; preload only the LCP font.
- **No inline `GoogleFonts.inter()` in Flutter** (UX-R7; DOC 06 measured 44 sites in the merchant
  app) — type comes from `LetbuyyTypographyTokens` through the theme.
- Tabular numerals on every money and quantity column (`font-variant-numeric: tabular-nums`).
- **Indic scripts (Devanagari, Tamil, …) are OPEN_OWNER_DECISION.** V1 copy is English; if Hindi or
  a regional language is approved, add a script-scoped OFL face (e.g. Noto Sans Devanagari) as a
  separate subset — never swap the Latin face — and treat it as a phase of its own.
- Any paid or unverified-licence face is prohibited without written owner approval.

---

## 3. Illustrations, photography and product imagery

- `EmptyStateIllustration` ships 36 token-driven SVG motifs with a manifest and gallery — use them;
  do not add stock illustration.
- Product screenshots are real product UI; never a fabricated dashboard or invented merchant data.
- Merchant/product photos come from merchants (storefront) — never a stock photo implied to be a
  customer; never AI-generated imagery presented as a photo.
- No photograph of an identifiable person without documented consent; KYC documents never appear in
  any UI preview or screenshot.

---

## 4. Adding any dependency (web or Flutter)

```
[ ] Genuinely required, not a preference; no existing primitive covers it
[ ] Licence read from the official source, today, and recorded (name, version, licence, URL)
[ ] Commercial use permitted for a SaaS product; attribution satisfiable
[ ] Compressed size measured against PERFORMANCE_AND_MOTION_BUDGETS.md
[ ] Tree-shakeable (web) / no transitive platform channel surprises (Flutter)
[ ] Maintained; compatible with the pinned Flutter SDK (final-class rules bit font_awesome once)
[ ] Not duplicating something in the workspace (two empty-state widgets already exist in ui_kit)
[ ] OSV / dependency-audit clean; lockfile diff reviewed
```

Fail any line → do not add it. Report licence and size in the completion report. Never commit
proprietary icon, font, illustration or photo assets; never an asset whose provenance is undocumented.
