import {
  assertNoOffenders,
  phaseBEntries,
} from "./phase-b-common.mjs";
import { createReporter } from "./governance-common.mjs";

const reporter = createReporter("No new React sections validator");

const frozenReactSections = new Set([
  "apps/storefront-runtime/src/components/sections/about-section.tsx",
  "apps/storefront-runtime/src/components/sections/app-block-slot.tsx",
  "apps/storefront-runtime/src/components/sections/banner-carousel.tsx",
  "apps/storefront-runtime/src/components/sections/brand-marquee.tsx",
  "apps/storefront-runtime/src/components/sections/category-grid.tsx",
  "apps/storefront-runtime/src/components/sections/contact-form.tsx",
  "apps/storefront-runtime/src/components/sections/cta-section.tsx",
  "apps/storefront-runtime/src/components/sections/experience-timeline.tsx",
  "apps/storefront-runtime/src/components/sections/featured-products.tsx",
  "apps/storefront-runtime/src/components/sections/hero.tsx",
  "apps/storefront-runtime/src/components/sections/marquee.tsx",
  "apps/storefront-runtime/src/components/sections/newsletter.tsx",
  "apps/storefront-runtime/src/components/sections/portfolio-grid.tsx",
  "apps/storefront-runtime/src/components/sections/product-detail-section.tsx",
  "apps/storefront-runtime/src/components/sections/product-grid.tsx",
  "apps/storefront-runtime/src/components/sections/rich-content-section.tsx",
  "apps/storefront-runtime/src/components/sections/services-grid.tsx",
  "apps/storefront-runtime/src/components/sections/skills-section.tsx",
  "apps/storefront-runtime/src/components/sections/testimonials.tsx",
  "apps/storefront-runtime/src/components/sections/trust-badges.tsx",
]);

const offenders = [];
for (const entry of phaseBEntries(["apps/storefront-runtime/src/components/sections"])) {
  if (!entry.path.endsWith(".tsx")) continue;
  if (!frozenReactSections.has(entry.path)) {
    offenders.push(`${entry.path}: React section registry is frozen; add Liquid sections instead`);
  }
}

assertNoOffenders(reporter, offenders, "New storefront React sections are forbidden after Liquid freeze");
reporter.finish(`${frozenReactSections.size} frozen React sections checked`);
