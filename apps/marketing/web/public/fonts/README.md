# Inter

Locally hosted variable Inter, used by the marketing site's sans-serif and display typography. The retained source spans weights 100–900; the current delivery face covers the used 400–900 range. Served through `next/font/local` with `font-display: swap`.

Webfont source: [Inter official repository](https://github.com/rsms/inter/blob/master/docs/font-files/InterVariable.woff2). License: [Google Fonts / Inter](https://github.com/google/fonts/tree/main/ofl/inter), preserved in `Inter-OFL.txt`. Downloaded 23 October 2026.

Inter replaces the earlier Manrope visual trial at the owner's request.

`Inter-Variable-Marketing.woff2` is the retained full-weight input: a lossless-outline subset of the original variable font. It preserves the original font's Latin-1 coverage and every source character supported by the original font at the time of subsetting, including the current punctuation and currency symbols. Hindi/Tamil continue to use the existing language fallbacks; subsetting does not claim new script coverage. Variable axes, advance metrics and sampled outlines at weights 100/400/900 were verified unchanged. The local-font `unicode-range` declaration matches its cmap so the browser can select Indic fallbacks before the Latin file loads. Review character coverage and update that declaration when introducing new copy.

The original `Inter-Variable.woff2` and `Inter-OFL.txt` remain here. The subset keeps the font's copyright and licence metadata. Its current Unicode recipe, tool versions and verification are recorded in `reports/letbuyy-mobile-performance-2026-10-30/evidence/font-proof.json`; regenerate with fontTools/woff2 in an isolated tool environment rather than installing dependencies into the application. The earlier broader subset is documented in the preceding SEO closeout report as dated history.

The app now loads `Inter-Marketing-400-900.woff2`. This removes only glyph-variation tuples whose contribution is zero throughout weights 400–900. It retains all 210 Unicode mappings, the optical-size range, active variation data, shaping features, and name/licence metadata. The generator checks exact outlines and advance widths in 11,550 glyph/axis samples. It avoids variable-font instancing because that introduced small outline-rounding changes in the rejected trial.

Within an isolated Python environment containing `fonttools==4.60.1` and `brotli==1.1.0`, regenerate with `python scripts/marketing/prepare-inter-weight-subset.py --output apps/marketing/web/public/fonts/Inter-Marketing-400-900.woff2 --proof /tmp/marketing-font-proof.json`. The source fingerprint is pinned and timestamps are retained for deterministic output. Before adding typography below weight 400, restore the retained full-weight input and rerun the visual and performance checks.

The subset retains default shaping, kerning, and the configured tabular-numeral feature, with slashed-zero support. Unused optional stylistic alternates are omitted. New OpenType feature requests require checking the recipe as well as character coverage. Every retained glyph's advance and outline was compared at six weights and three optical sizes; current page geometry and representative raster output were also checked.
