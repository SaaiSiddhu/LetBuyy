from pathlib import Path
import json,hashlib,zipfile,subprocess,xml.etree.ElementTree as ET
from html.parser import HTMLParser
R=Path(__file__).resolve().parent.parent;S=json.loads((R/'scenes.json').read_text());A=json.loads((R/'responsive-audit.json').read_text());X=json.loads((R/'exports.json').read_text())
read='''# Threadline — 45-image responsive UI/UX storybook

**15 page states × desktop, tablet and mobile = 45 separate PNGs.** Fifteen additional comparison boards place each scene's three device views together.

These are detailed visual implementation targets for the `sense` / Threadline fashion preset, version 1. They replace the earlier schematic wireframes as the detailed visual reference for these covered states. They are not yet installed, integrated, published or deployed themes. This turn fulfills the owner's mockups-first sequence; the broader ten-preset implementation request remains pending after the design work.

## Open and download

- [Interactive visual storybook](index.html) — choose any of the 15 scenes; compare all three devices or inspect one at full size.
- [Download all 45 PNGs](Threadline-45-mockups.zip).
- [Responsive source index](prototype-index.html) — local visual-only HTML, no live login, API, cart, order or payment calls.
- [Generation prompts and provenance](generation-prompts.json).
- [Viewport and export evidence](responsive-audit.json), [export manifest](exports.json), [validation](validation.json).

## Fifteen-scene sequence

| # | Scene | Desktop | Tablet | Mobile | Three-device board |
|---|---|---|---|---|---|
'''
for i,s in enumerate(S,1):read+=f'| {i:02d} | {s["title"]} | [PNG](images/{s["id"]}-desktop.png) | [PNG](images/{s["id"]}-tablet.png) | [PNG](images/{s["id"]}-mobile.png) | [PNG](boards/{s["id"]}.png) |\n'
read+='''
## Responsive reference

- Desktop: **1440 × 1000 CSS px** viewport.
- Tablet: **834 × 1112 CSS px** viewport.
- Mobile: **390 × 844 CSS px** viewport.
- Each exported PNG is full-page, so its height can exceed the viewport. DPR is 1; text is native browser rasterization, not AI-rendered copy.
- The browser capture transport returned JPEG bytes; final exports were encoded to genuine PNG using Sharp with decoded-pixel equality checks. No resizing, cropping or retouching was applied.
- Tablet is an independently reflowed layout: the collection uses two columns, supporting regions adjust and checkout stacks its summary.
- Mobile uses a compact menu header, stacked hero/PDP, two-column merchandise, a reflowed fit table, horizontal account navigation and single-column forms/cards.
- Scenes 01+02 compose one homepage. Scenes 04+05+06 compose one PDP. Repeated headers and product-context strips make each standalone story image understandable; they do not prescribe multiple production home/PDP routes or repeated headers within a page.

## Visual system locked for this version

Canvas `#FAF7F2`; white surface `#FFFFFF`; stone `#EFE7DC`; main text `#241E1A`; supporting text `#65574C`; terracotta action `#713F35`; essential boundary `#766657`; focus `#005FCC`. Heading family Playfair Display and body Inter, with serif/system fallbacks. The source CSS defines explicit tablet/mobile breakpoints at 900px/640px, with intermediate adjustments at 1100px. Structural/page values are encoded in [styles.css](source/styles.css), not left to interpretation of a generated screenshot.

Original generated fashion photography follows the same adult model, oat linen shirt, ink trouser, rust dress and sunlit stone environment. No existing merchant or Shopify photography was copied. Lucide icons were rendered from the installed Lucide React package; the LetBuyy logo was reused from the current identity app. The initial generated UI anchor is retained in `references/`; it is a style-development artifact and is not counted among the 45 final screens.

Optimization: one responsive presentation system + five original generated photographic assets, reused across the 45 browser-rendered screen exports. This avoids 45 independently generated layouts and preserves consistent text, prices, spacing, assets and breakpoints. Built-in `image_gen` was used, not CLI/API fallback. Photography prompts and source output paths are preserved in the provenance file.

## Shared checkout and identity boundaries

Checkout carries Threadline's wordmark, palette and heading/body treatment through the existing data-only branding contract (`apps/commerce/web/src/app/checkout-origin/branding.ts` and the shared checkout-core schema). Its two-step Address → Review & pay structure remains canonical. No merchant CSS injection, separate checkout runtime or theme-specific payment logic is proposed.

Sign-in and registration depict the canonical LetBuyy buyer credential page with an explicit Threadline destination. They keep LetBuyy's identity/logo and readable purple action treatment. Store account overview, orders and addresses return to the merchant's visual identity. The reference does not create a second authentication system or permit a storefront theme to inject a credential form into the shared identity origin.

Razorpay and COD appear as a fixture where both are available. The implemented UI must use actual server eligibility/configuration, not always display them. Shipping charge, tax treatment, stock and all other values must come from the real server quote/catalog. No payment, signup, order creation or account change was performed to create these mockups.

## Fixture data and content rules

All product prices, sizes, measurements, garment composition/care copy, customer name/email/address, dates, order IDs, paid/status state and shipping amount are **fictional visual fixtures**. `asha@example.test` is reserved example data. The mock model is generated. This does not establish certification, material truth, real stock, shipping readiness, tax policy or an actual person's body measurements.

The three sample products are the oat linen shirt (₹2,490), ink straight trouser (₹3,290) and rust cotton dress (₹3,990). Cart line quantities are one shirt and one trouser; subtotal ₹5,780; the checkout sample shipping charge is ₹100 and total ₹5,880. Account views use the same fictional order. Do not hardcode any of these into production templates.

Only one PDP is fully illustrated in this pack. Product-card links in the visual-only source lead to that reference PDP; production must bind each card to its actual product identity. The gallery is navigable, while presentation-only controls are not commerce integration. Search/filter, quantity, save, form, address and payment controls still require canonical wiring and their error/recovery states during implementation.

## Implementation mapping

- Homepage: existing hero/category/product-grid/rich-text/media primitives with Threadline composition and responsive settings.
- Collection: apparel card anatomy, real query-backed size/color/price filters and current pagination/search owner. Hide unsupported controls until their contract works.
- PDP: canonical productDetail with fit layout, validated garment facts and typed option/cart islands; merchant measurements and fabric/care content. The selected size persists while inspecting fit and returning to selection.
- Outfit module: independently priced linked products; no automatic bundle or shared inventory assumption.
- Cart/checkout: current checkout-core, gateway cart and hosted checkout flow; retain server pricing, stock, eligibility, idempotency and tenant scope.
- Account: existing buyer/store-customer realm/linking model, verified-order access and canonical address/settings owners. If only a buyer email is available, use the established email fallback rather than inventing a customer name or exposing another principal.
- All templates remain in one canonical Liquid engine, one merchant editor and shared storefront token mechanism. These research HTML files are a review tool, not a new application architecture or a production renderer fork.

## Review and acceptance

All 45 exports were measured against the requested viewport before capture. There are no broken image loads or page-level horizontal overflow in those captured states. Native fonts loaded; the six shared identity views intentionally use sans headings and do not require a loaded Playfair face. These checks validate the visual artifacts, not a complete accessibility or transaction workflow.

Before implementation acceptance, verify the actual canonical install → editor save/readback → preview → publish → release readback → storefront chain, plus functional filters/options/cart, keyboard/focus, 320px reflow, text zoom, error/retry, stock/price races, actual translated content and shared checkout/identity security. Preserve the broader research plan's proof gates. Do not label these mockups “published themes.”

The current requested batch is Threadline only. Remaining niche mockups and the authorized Threadline/Pantry implementation slice remain follow-on work; no production code was changed in this batch.
'''
(R/'README.md').write_text(read)
# ZIP contains exactly 45 requested screen images, plus minimal explanation/manifest.
zipread='Threadline responsive mockups — 15 scenes x 3 devices = 45 PNGs.\n\nDesktop 1440x1000, tablet 834x1112, mobile 390x844 CSS viewport; exports are full-page.\nVisual-only implementation references. All customer/product/order values are fictional. No live payment/auth/order behavior is implemented.\nImages use one coherent responsive system and original generated fashion photography.\n\nSee the full saved project storybook for comparison boards, design notes, source and provenance.\n'
with zipfile.ZipFile(R/'Threadline-45-mockups.zip','w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 z.writestr('README.txt',zipread)
 for p in sorted((R/'images').glob('*.png')):z.write(p,'images/'+p.name)
 z.writestr('exports.json',json.dumps(X,indent=2))
