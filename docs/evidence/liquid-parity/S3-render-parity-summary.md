# S3 — Render-parity harness results (closes S1-render-parity.json's 11 real defects)

8/20 sections PASS semantic parity (text/link/image scraping); 12 FAIL.
10/10 behavioral setting-change checks PASS (B1/B2/B3 — these are CSS-class-driven and are NOT detectable by the text-scraping matrix above; see behavioralSettingChangeChecks in the JSON).

| React file | Liquid section | Verdict | Reason (first) |
|---|---|---|---|
| about-section.tsx | about-section | FAIL | setting "layout" absent from BOTH outputs — neither side renders it (value: left) |
| app-block-slot.tsx | app-block-slot | PASS |  |
| banner-carousel.tsx | banner-carousel | FAIL | setting "title" present in Liquid output only (value: Parity value for title) |
| brand-marquee.tsx | brand-marquee | FAIL | heading text only in Liquid: ["Featured brands"] |
| category-grid.tsx | category-grid | FAIL | setting "title" present in Liquid output only (value: Shop by style) |
| contact-form.tsx | contact-form | PASS |  |
| cta-section.tsx | cta-section | PASS |  |
| experience-timeline.tsx | experience-timeline | FAIL | setting "block.experience.period" present in Liquid output only (value: Parity value for period) |
| featured-products.tsx | featured-products | FAIL | setting "subtitle" present in Liquid output only (value: Parity value for subtitle) |
| hero.tsx | hero-banner | FAIL | setting "eyebrow" present in Liquid output only (value: New season essentials) |
| marquee.tsx | marquee | FAIL | setting "text" present in Liquid output only (value: Featured announcement) |
| newsletter.tsx | newsletter-signup | FAIL | setting "buttonLabel" present in Liquid output only (value: Sign up) |
| portfolio-grid.tsx | portfolio-grid | FAIL | setting "block.project.summary" present in Liquid output only (value: Parity value for summary) |
| product-detail-section.tsx | product-detail | PASS |  |
| product-grid.tsx | product-grid | FAIL | setting "subtitle" present in Liquid output only (value: Parity value for subtitle) |
| rich-content-section.tsx | rich-content | PASS |  |
| services-grid.tsx | services-grid | PASS |  |
| skills-section.tsx | skills-section | PASS |  |
| testimonials.tsx | testimonials | FAIL | setting "title" present in Liquid output only (value: What customers say) |
| trust-badges.tsx | trust-badges | PASS |  |

## Behavioral setting-change checks (B1/B2/B3)

| Check | Verdict |
|---|---|
| B1: hero-banner height (full -> small) changes rendered output in both engines | PASS |
| B2: hero-banner textAlign (center -> right) changes rendered output in both engines | PASS |
| B3: about-section layout (left -> center) changes rendered output in both engines | PASS |
| C1: banner-carousel renders with zero banners (no throw) | PASS |
| C1: banner-carousel renders with one banner (no throw) | PASS |
| C1: banner-carousel renders with many banners (no throw) | PASS |
| Liquid: featured-products with zero real blocks still shows the title/subtitle AND the empty state | PASS |
| Liquid: featured-products with a real block shows title/subtitle and the item, no empty state | PASS |
| React: featured-products with zero real products still shows the title/subtitle AND the empty state | PASS |
| React: featured-products with a real product shows the title and the item, no empty state | PASS |
