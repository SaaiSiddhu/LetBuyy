import {
  assertNoOffenders,
  phaseBEntries,
} from "./phase-b-common.mjs";
import { createReporter } from "./governance-common.mjs";

const reporter = createReporter("No new React sections validator");

const frozenReactSections = new Set([
  "apps/customer_web/src/components/sections/about-section.tsx",
  "apps/customer_web/src/components/sections/app-block-slot.tsx",
  "apps/customer_web/src/components/sections/banner-carousel.tsx",
  "apps/customer_web/src/components/sections/brand-marquee.tsx",
  "apps/customer_web/src/components/sections/category-grid.tsx",
  "apps/customer_web/src/components/sections/contact-form.tsx",
  "apps/customer_web/src/components/sections/cta-section.tsx",
  "apps/customer_web/src/components/sections/experience-timeline.tsx",
  "apps/customer_web/src/components/sections/featured-products.tsx",
  "apps/customer_web/src/components/sections/hero.tsx",
  "apps/customer_web/src/components/sections/marquee.tsx",
  "apps/customer_web/src/components/sections/newsletter.tsx",
  "apps/customer_web/src/components/sections/portfolio-grid.tsx",
  "apps/customer_web/src/components/sections/product-detail-section.tsx",
  "apps/customer_web/src/components/sections/product-grid.tsx",
  "apps/customer_web/src/components/sections/rich-content-section.tsx",
  "apps/customer_web/src/components/sections/services-grid.tsx",
  "apps/customer_web/src/components/sections/skills-section.tsx",
  "apps/customer_web/src/components/sections/testimonials.tsx",
  "apps/customer_web/src/components/sections/trust-badges.tsx",
]);

const offenders = [];
for (const entry of phaseBEntries(["apps/customer_web/src/components/sections"])) {
  if (!entry.path.endsWith(".tsx")) continue;
  if (!frozenReactSections.has(entry.path)) {
    offenders.push(`${entry.path}: React section registry is frozen; add Liquid sections instead`);
  }
}

assertNoOffenders(reporter, offenders, "New storefront React sections are forbidden after Liquid freeze");
reporter.finish(`${frozenReactSections.size} frozen React sections checked`);
