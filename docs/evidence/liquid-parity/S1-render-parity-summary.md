# S1/W4 — Render-parity harness results

5/20 sections PASS semantic parity; 15 FAIL.

| React file | Liquid section | Verdict | Reason (first) |
|---|---|---|---|
| about-section.tsx | about-section | FAIL | setting "layout" absent from BOTH outputs — neither side renders it (value: left) |
| app-block-slot.tsx | app-block-slot | FAIL | setting "slot" absent from BOTH outputs — neither side renders it (value: storefront.home.after-hero) |
| banner-carousel.tsx | banner-carousel | FAIL | React: React render threw: TypeError: Cannot read properties of undefined (reading 'length') \|     at BannerCarousel (apps/storefront-runtime/src/__liquid_parity_harness__/banner-carousel.harness.tsx:76:36) \|     at Object.react_stack_bottom_frame (node_modules/.pnpm/react-dom@19.2.3_react@19.2.3/node_modules/react-dom/cjs/react-dom-server-legacy.node.development.js:9808:18) \|     at renderWithHooks (node_modules/.pnpm/react-dom@19.2.3_react@19.2.3/node_modules/react-dom/cjs/react-dom-server-legacy.node.development.js:5062:19) |
| brand-marquee.tsx | brand-marquee | FAIL | heading text only in Liquid: ["Featured brands"] |
| category-grid.tsx | category-grid | FAIL | setting "title" present in Liquid output only (value: Shop by style) |
| contact-form.tsx | contact-form | PASS |  |
| cta-section.tsx | cta-section | PASS |  |
| experience-timeline.tsx | experience-timeline | FAIL | setting "block.experience.period" present in Liquid output only (value: Parity value for period) |
| featured-products.tsx | featured-products | FAIL | setting "title" present in Liquid output only (value: Drop-ready collection) |
| hero.tsx | hero-banner | FAIL | setting "eyebrow" present in Liquid output only (value: New season essentials) |
| marquee.tsx | marquee | FAIL | setting "text" present in Liquid output only (value: Featured announcement) |
| newsletter.tsx | newsletter-signup | FAIL | setting "buttonLabel" present in Liquid output only (value: Sign up) |
| portfolio-grid.tsx | portfolio-grid | FAIL | setting "block.project.summary" present in Liquid output only (value: Parity value for summary) |
| product-detail-section.tsx | product-detail | PASS |  |
| product-grid.tsx | product-grid | FAIL | setting "subtitle" present in Liquid output only (value: Parity value for subtitle) |
| rich-content-section.tsx | rich-content | PASS |  |
| services-grid.tsx | services-grid | PASS |  |
| skills-section.tsx | skills-section | FAIL | heading text only in React: ["General"] |
| testimonials.tsx | testimonials | FAIL | setting "title" present in Liquid output only (value: What customers say) |
| trust-badges.tsx | trust-badges | FAIL | heading text only in React: ["Parity value for label"] |
