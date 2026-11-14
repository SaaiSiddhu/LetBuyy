# Architecture section → customer explanation — 24 October 2026

## Product review and scope

The owner requested a replacement for the Architecture section's orbit diagram, written for prospective customers rather than engineers. The maintained entry point remains `src/components/Features.tsx`, at homepage position after MerchantJourney and before Pricing, with the existing `#features` anchor. The separate Capability Map, hero/globe and other homepage sections are not redesigned by this change.

Source review covered:

| Customer job | Reviewed source | Explanation used |
| --- | --- | --- |
| Brand and publish a shop | merchant web `online-store/themes/page.tsx`, `settings/domains/page.tsx`, commerce web `store/[subdomain]` routes | Theme, branding, domain, preview and publish |
| Put products on sale | merchant web `products/new/page.tsx`, inventory routes | Photos, prices, variants and stock |
| Receive/manage purchases | merchant web `orders/page.tsx`, `orders/[orderId]/page.tsx`, buyer order routes | Order records, separate payment/fulfilment status, shipments and returns |
| Reach existing customers | merchant web `marketing/page.tsx`, customers/segments routes, gateway `routes/marketing.ts` | Campaign drafts, subscribed audiences/segments, review before sending |
| Understand the business | merchant web `analytics/page.tsx`, product inventory pages | Orders, revenue and stock; no fabricated growth guarantees |
| Assist with work | gateway `routes/ai.ts` | Source supports bounded drafts and metrics; avoided unsupported autonomous fraud/price-optimization claims |

Email source explicitly distinguishes sandbox/live delivery and provider configuration. The public copy therefore explains email setup and other plan/provider requirements. This was a source-backed product review, not a certification of live integrations, payments or end-to-end production readiness. Curated LetBuyy product references supplied context; repository source supplied the concrete UI examples.

## Design and implementation

Three numbered editorial stories cover building the shop, managing a sale and bringing customers back. Each combines an original transparent pen-and-ink/gouache illustration with a short explanation, three practical steps and a locale-preserving guide link. All three guide paths were checked against the existing resource article registry. Native `details` elements explain six everyday jobs (orders, payments, refunds, low stock, campaigns and earnings), preserving multiple-open behavior without custom accordion state. A labelled T-shirt-order example connects order details, payment status, stock and fulfilment in a readable linear sequence.

Removed the obsolete orbit widget, sample counter strip, moving sample activity feed and technical outbox/backend copy from this section. Their intended customer capabilities are explained in the story and everyday tasks. No functional commerce API, shared contract or other runtime was changed. No new visual style was applied to other sections. Styles are colocated in `src/app/how-it-works.css`, imported by the existing global stylesheet; tokens and Lucide icons come from the existing system. Three-column desktop stories become a single-column sequence below 768px, while the practical example becomes a two-column list. Layout is content-sized, with no forced viewport cards or empty fixed-height tails.

## Artwork

Built-in `image_gen` generated three independent transparent illustrations. Original generated files are retained in the generation directory; project-ready WebPs are saved under `public/illustrations/how-it-works/`:

- `build-store-v1.webp`: 800×600, 114,584 bytes.
- `fulfill-order-v1.webp`: 800×600, 115,576 bytes.
- `grow-customers-v1.webp`: 800×600, 126,656 bytes.

All three encoded assets have alpha spanning 0–255. Installed Sharp was used only to resize/encode, preserving alpha and composition; no raster content edits. Total shipped artwork: 356,816 bytes. The complete final prompt set, intended display roles and semantics are in `public/illustrations/how-it-works/artwork-manifest.json`. Artwork is decorative because the adjacent visible text carries its meaning; it is not represented as an actual app screenshot or testimonial. Native dimensions reserve image space and noncritical images load lazily.

## Verification

TypeScript, focused Features ESLint, strict CSS lint (both global and new stylesheet), whitespace checks and all 23 existing marketing/federation tests pass. The three generated source images were visually inspected, and encoded asset dimensions, file sizes and alpha ranges were checked. Production build passed with all 494 pages generated. The standard `lint:css` script now includes the new stylesheet so subsequent CI checks cover it.

The local browser tool returns “Local browser use is disabled in Work settings” even after the owner's earlier enablement report. Consequently the new composed section, desktop/tablet/phone layouts, actual keyboard/native-details behavior, image-loading failure appearance, light/dark appearance and text zoom have NOT been inspected in a browser. No current website screenshot is claimed; earlier section screenshots predate this redesign. The unchanged preview server remains in place. Installed Next effective configuration isolates `.next/dev` from production `.next`, so the build does not require stopping the preview.

## Everyday tasks illustration

At the owner's request, added a fourth original illustration below the left-side “What does that mean for your day?” heading: an Indian shop owner reviewing orders on a laptop beside a packed T-shirt, stock cartons and a notebook. Built-in `image_gen` follows the same editorial pen/gouache family. Saved as `public/illustrations/how-it-works/everyday-merchant-v1.webp`, 800×600, 95,970 bytes, alpha range 0–255. The final prompt and intended role are appended to the existing artwork manifest. Display is contained, unboxed and at most 340px wide on desktop or 240px on phones. Existing task disclosures and wording are unchanged. The generated source was visually inspected; TypeScript, focused ESLint, CSS lint and whitespace checks pass. Production build passed with all 494 pages generated. Browser composition remains unverified due to the recorded access limitation.

## Order-example card refinement

The owner requested a more polished card with a regenerated background and improved spacing/reflow. Replaced the text-only split card with a photographic introduction above a distinct four-step workflow. All four original jobs remain in order. Icon tiles, two-digit step numbers, readable type and a single rounded clipping owner create a quieter hierarchy. Fluid inset spacing ranges from the existing space-5 to space-9 tokens. A named container query changes four steps to two at 880px card width, then to a vertical single-column flow at 560px. At the narrow breakpoint, background photography becomes a separate 180px band below the introduction; text stays on a solid semantic surface. Wider sizes use a theme-aware gradient over the photograph to protect the entire text column. The new named section has a direct `#order-example` anchor.

Built-in `image_gen` generated opaque product photography of a navy T-shirt packed in a kraft parcel, with quiet ivory space on the left. Source was visually inspected. Saved `public/illustrations/how-it-works/order-story-background-v1.webp`, 1440×576, 52,860 bytes, no alpha. Prompt and role are in the existing artwork manifest. The asset is a decorative illustrative order background, not a real merchant/customer claim. TypeScript, focused ESLint, CSS lint, all 23 marketing/federation tests and whitespace checks pass. Production build passed with all 494 pages generated. Built HTML contains the named card, new background and all four workflow labels. The preview was left running.

The browser tool was retried for this refinement and still returns “Local browser use is disabled in Work settings.” The composed card, actual responsive crops, native container-query behavior, text zoom and theme contrast have not been visually checked on devices. No replacement screenshot is claimed.

## Order card: background removed, four workflow illustrations

The owner's latest direction supersedes the photographic header treatment above: no background image anywhere on this card. Removed the image, gradient overlay, reserved image band and all related backdrop rules. The old source asset is retained only as historical artwork and marked retired in the manifest; it has no runtime reference. The card now uses a solid semantic theme surface, a compact two-column introduction, and four content-sized workflow columns. At 880px container width the introduction stacks and steps become two columns; at 560px steps become single rows with 72px artwork beside copy. No fixed content height, no empty image area, and no changes to the four jobs or their order. Spacing, type and borders reuse existing LetBuyy tokens.

Built-in image_gen produced four separate decorative illustrations: cobalt order bag/slip, emerald payment card, amber inventory carton and violet delivery van. These are illustrations beside visible text, not functional icon replacements or claims of a completed payment/order. Each has genuine alpha range 0–255 and is encoded to 256×256 WebP: order 13,488 bytes; payment 11,084 bytes; stock 15,626 bytes; delivery 15,918 bytes (56,116 bytes total). Source images and representative encoded outputs were inspected. Sharp was used only for resizing and encoding. Full prompts, source paths, colors and roles are registered in the artwork manifest.

TypeScript, focused Features ESLint, CSS lint, whitespace checks and all 23 existing marketing/federation tests pass. Production build passed with all 494 pages generated. Built HTML confirms the named card, all four illustrations and no retired background reference. The browser tool was retried and still reports local access disabled in Work settings, so composed light/dark, responsive rendering and text zoom remain visually unverified. No browser screenshot is claimed.


## Compact mobile order example — 26 October 2026, 09:08 feedback

Reduced the four-step card's mobile inset, row spacing and illustrations to 44px; each illustration retains its distinct color and visible two-digit step number. The mobile introduction uses a 20px heading, steps use 14px headings and 13px descriptions, with content-sized layout and full text. The desktop treatment and all four jobs are unchanged; no background image was restored. At 429px width the card decreases from 762.87px to 475.49px (38%). At 390px and 320px it is 497.13px high, with four equal 70.40px step rows and no overflowing step copy.

Local browser access now works, superseding the older unavailable-browser notes for these checks. Verified fixed CSS viewports from 320px to 640px and a 1280px desktop check, with zero horizontal document overflow. Screenshot: order-mobile-compact-2026-10-26.jpg. Raw readings: mobile-card-compaction-checks-2026-10-26.json. Existing artwork, color distinctions and text remain. Production build/TypeScript (497 pages), strict CSS lint, all 184 current tests and whitespace validation pass. The temporary QA fixture and tab were removed; existing dirty repository work was preserved.
