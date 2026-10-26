# Footer spacing — 24 October 2026

Reduced large footer padding, column gaps and link-list gaps. Headings now use the existing 16px body-large token, links use 14px body text with regular weight, and legal controls use compact type. The footer retains the same four navigation groups in DOM order, all 17 group links, five legal links, privacy choices, language picker, app availability badges and social destinations. On phones the four groups form two columns with subtle separators between rows. Links retain 44px height at <=560px. Social buttons now use semantic surfaces, borders and foreground colors in both themes.

Native browser checks at 320×780, 390×844, 768×1024 and 1280×720: no horizontal overflow and 17 group links at every size. Phone links measure 44px high, with 16px headings and 14px links; desktop links measure 36px high. Inspected the light phone footer and light/dark desktop footer. Privacy choices opens and closes without saving preferences. Light theme and default viewport restored. Screenshots: `footer-compact-phone.png`, `footer-compact-light.png`, `footer-compact-dark.png`.

Strict CSS lint and diff whitespace checks passed. Production build passed with all 494 pages generated. Marketing dev preview restarted on 0.0.0.0:9006 after the build. No React component or business interaction handlers changed.
