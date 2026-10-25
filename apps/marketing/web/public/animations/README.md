# LetBuyy globe ending

`letbuyy-finale-v1.json` is a custom, local Lottie animation, rendered with the SVG-only `lottie-web` light player (5.13.0). It is 32,115 bytes, 1200 × 480, 60 fps, with eight vector shape layers: seven brand letters and the subtitle. It contains no external assets, embedded raster images, font downloads or expressions.

- Brand: LetBuyy, Inter 800 outlines, left-to-right stagger.
- Subtitle: Sell worldwide, Inter 700 outlines, begins after all brand letters finish.
- Intro: frames 0–156, synchronized to the existing globe finale clock.
- Ambient gradient segment: frames 156–636, loops without replaying the brand intro.
- Theme: SVG gradient stops consume the existing closing-title theme variables.
- Fallback: existing HTML text when loading fails, reduced motion or forced colors.

Authoring source: `../../scripts/generate-globe-finale-lottie.py`. Run with Python 3, `fonttools` and `brotli` installed. Source font is the existing `../fonts/Inter-Variable.woff2`; its license is retained at `../fonts/Inter-OFL.txt`. This generated JSON is a source animation asset, not a build artifact.

Player lifecycle/segment API reference: https://github.com/airbnb/lottie-web/wiki/Usage
