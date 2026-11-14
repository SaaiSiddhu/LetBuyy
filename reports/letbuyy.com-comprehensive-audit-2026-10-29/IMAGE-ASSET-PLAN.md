# Image and media asset plan

Audit-only plan. No images were generated, files optimized or live assets changed. Existing verified art and genuine product captures should be reused before new illustrations. `evidence/image-inventory.json` inventories 4,413 occurrences from 489 pages, with 95 distinct raw source URLs; `evidence/resource-probes.json` measures 16 sampled image resources. This is not an exhaustive byte/visual audit of every image.

## Existing evidence and immediate work

- All captured image elements have an alt attribute and width/height pair; 4,107 empty alts are mostly decorative/redundant UI art. No blanket missing-alt defect is supported. Manually assess informative screenshots against their surrounding explanation.
- Homepage source contains 16 image preloads and 22 eager images. Inspect actual critical request waterfalls before changing loading priority; diagnostic browser measurements do not establish a slow LCP.
- The live social PNG returns 200 at 1,200×630, 52,770 bytes. The main live homepage still does not advertise it through `og:image`; fix metadata before replacing a working asset. Local source has additional social-image work that is not deployed.
- The organization logo PNG returns 200 at 512×512, 225,263 bytes. Optimize a copy and verify transparency/edges if worthwhile; this does not establish a large LCP element. Header SVG assets are different and much smaller.
- Sample storefront WebPs are 1,000×667 at 107,040 bytes and 1,000×1,000 at 142,960 bytes. Eight 256px capability icons range about 12–16KB each. Their file sizes alone are not a demonstrated problem.
- Only 18 image occurrences have `srcset` in the captured locale dataset. Match responsive sizing to actual display size and DPR before recommending variants. Keep intentional SVG/logo treatment and accurate image dimensions.
- No substantive VideoObject/video publishing surface was established in the inspected marketing templates. Animated illustrations are not automatically video content requiring video schema.

## Asset opportunities and briefs

| Priority / use | Intended output | Suggested filename | Text/alt policy | Placement / acceptance |
|---|---|---|---|---|
| First: existing social preview wiring | Reuse verified 1,200×630 PNG, or export revised brand-approved equivalent | letbuyy-commerce-os-1200x630.png | Social alt: “LetBuyy commerce platform for Indian online stores”, only if image actually expresses that | Complete OG URL/type/image metadata; check crop and consumer preview |
| High value: genuine merchant setup evidence | Product-owned screenshots at natural 1,600px source width; responsive 480/960/1,440px exports if measured useful | letbuyy-store-setup-step-01-1600.webp | Describe the visible real setup step and controls; avoid keyword stuffing | Existing launch/setup guide; capture current real state with synthetic data and no private identifiers |
| High value: actual pricing explanation | Semantic HTML table first; optional 1,200×800 visual for sharing | letbuyy-plan-cost-components-1200x800.webp | Explain subscription, commission and third-party charges only after approval; image cannot be sole text source | Pricing/brief; all amounts/statuses sourced and synchronized |
| Conditional: tax decision diagram | 1,200×1,600 readable diagram plus equivalent HTML, after qualified review | ecommerce-gst-registration-decision-guide-1200x1600.webp | Alt summarizes the decision; full conditions remain in accessible text | Existing GST guide; effective dates and primary sources visible; never depict unreviewed law |
| Later: generic editorial comparison illustration | 1,200×800 WebP, target below 200KB as a heuristic | indian-store-builder-evaluation-1200x800.webp | Decorative `alt=""` if redundant; otherwise describe the actual subject | Existing sourced comparison section; no fake customer logos, awards or results |

## Prompt plans where generation is appropriate

Actual UI screenshots, prices, tax diagrams and customer results should come from verified product/editorial data, not generative invention. For decorative art only, an optional prompt brief is:

> Create a clean editorial illustration of a small Indian merchant arranging a branded online storefront and order parcels, using the existing LetBuyy purple/neutral visual language. Leave a quiet text-safe region. Include no invented numerical results, certification badges, third-party logos, fake customers or legible UI labels. Compose for a 1,200×800 crop, with distinct foreground shapes and good small-size legibility.

For a generic social background, use the same brief at 1,200×630 with generous safe margins and add exact verified brand text in a deterministic design tool. Treat captions and alt as editorial review tasks after inspecting the final pixels. Do not auto-generate merely because the image-gen route exists.

## Validation and ownership

Designer plus frontend owner: compare intended visual meaning, mobile crop, natural/display dimensions, compression and transparency, informative alt and surrounding text, accessible text alternatives, OG consumer behavior and actual LCP request priority. No promised image-search ranking gain or speculative byte savings. Preserve real product evidence and explicit illustrative labels. Merchant Center AI-image/feed rules are outside this marketing-site scope unless a real merchant product catalog is separately authorized.
