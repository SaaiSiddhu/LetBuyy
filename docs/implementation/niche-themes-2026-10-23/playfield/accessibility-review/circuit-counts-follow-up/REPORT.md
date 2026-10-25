# Circuit count-name follow-up: FILTER-A11Y-001 closed in scoped evidence

**FILTER-A11Y-001 is closed for the released HTML/computed-name scope.** All 32 originally affected primary controls and 64 count 0/1 variants pass: 96 exact name checks across six actual HTML artifacts, both collection/search routes and desktop/mobile forms. No source, browser, build, database or owner artifact was changed.

## Independent method and exact inputs

The review reads the released HTML directly. It uses the original immutable before390 facet labels and the original finding's exact selectors, then computes names independently. It does not rerun Circuit's harness, render another bundle, copy a filter parser or infer browser/AT behavior.

The Circuit source-release receipt is pinned at SHA256 `52be736c64ae1cbd9a4dff8e0c74cc7c5b932abd1ab355752f7f35b8ca40ad41`; its report is `e3e1f9829b85f94d18ca6de6d44cee0291fd808023d55769ba5a228610d19579`. Declared source hashes were checked before and after the review. The bundle hash `cadab65d5351e1d5f8506d3620df481700ff38ae7e23c19f7282d1f31be79b46` is the owner's declared release fingerprint; no new bundle was built here. Exact inputs and post390 functional-receipt context are in [inputs.json](/Volumes/Projects/LetBuyy/docs/implementation/niche-themes-2026-10-23/playfield/accessibility-review/circuit-counts-follow-up/inputs.json).

| Route | Count fixture | Names checked | Actual HTML | SHA256 |
|---|---:|---:|---|---|
| collection | 0 | 16 | `collection-count-0.html` | `12088f9b44c6fbfdc280a0ed975551916b34a4bd0c33d9d2ca03cc17631a7086` |
| collection | 1 | 16 | `collection-count-1.html` | `7bfa31e923a5b2fa7471e065974a63abb7c16001d35c3da28c58ade1cc7afe28` |
| collection | 4 | 16 | `collection-count-4.html` | `697335102aac9d228f1b666dbabd7b16333d54e232c1dd5c557e070bcaf15d44` |
| search | 0 | 16 | `search-count-0.html` | `253dff10ea86dd620984597d5beab462210a102c329a42937438840c04fff0e6` |
| search | 1 | 16 | `search-count-1.html` | `596ece61d9c1ebf4ddb444441a2d6245f2b68f742c475af1b3572a4da610990c` |
| search | 4 | 16 | `search-count-4.html` | `387de5015853392c2529e72c52425c433f713deaf7c449afa2c9625d70f47fe5` |

Count 4 covers the same 32 primary controls as the original finding. Counts 0 and 1 are additional finite rendered fixture cases, not claims about real merchant counts or SQL execution.

## Closure evidence

For the 100 W choice, the old artifact name was `1004`. The new actual markup is:

```html
<label><input type="radio" name="power_input_w" value="100" checked="">100 <span aria-hidden="true">4</span><span class="lb-sr-only"> (4 matching products)</span></label>
```

The independent computed names are:

- `100 (0 matching products)`
- `100 (1 matching product)`
- `100 (4 matching products)`

Other count-4 examples now read `85 (4 matching products)`, `5000 (4 matching products)` and `usb-c (4 matching products)`. The bare numerical count is excluded from the name using `aria-hidden`; meaningful singular/plural count text remains exposed. A real text node ending in a space separates the option value, and the meaningful count span also starts with a space.

Every targeted input retains its original type, name, value, ID, checked and disabled state. Native roles and wrapping labels remain intact. Each named fieldset still has its original legend. All 96 independently computed names also agree with the owner's recorded witnesses. [observations.json](/Volumes/Projects/LetBuyy/docs/implementation/niche-themes-2026-10-23/playfield/accessibility-review/circuit-counts-follow-up/observations.json) contains every exact selector, name, label excerpt, group and hash.

## Preserved evidence and remaining limits

The original 24 HTML hashes and every output pinned by the original review integrity receipt were checked unchanged before and after. The old finding/report remain historical records; this closure is a separate follow-up. No full nine-theme accessibility review was repeated.

This uses JSDOM 29.1.1 and dom-accessibility-api 0.5.16, with zero network calls. The released CSS contains the clipped `.lb-sr-only` helper inside `@layer`; JSDOM does not apply that layer in its computed style here. Its `position: static` diagnostic must therefore not be presented as verified visual clipping or a browser defect. Closure concerns unambiguous markup and computed names. Actual speech, visual hiding, responsive panel exposure, focus behavior and assistive technology remain unmeasured.

Original R01 visible-purpose candidates and R02 responsive-focus review remain open and were not reclassified. Screen-reader-only labels are not labelled failures. The new full functional 55/55 archive receipt is recorded as owner context, not rerun by this review. No SQL or installed lifecycle qualification is asserted.

Reproduce the bounded read-only assertions:

```sh
node docs/implementation/niche-themes-2026-10-23/playfield/accessibility-review/circuit-counts-follow-up/review-counts.mjs
```
