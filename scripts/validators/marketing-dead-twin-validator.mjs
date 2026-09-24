import {
  createReporter,
  exists,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Marketing dead twin validator");

const twins = [
  "Navbar.tsx",
  "HeroSection.tsx",
  "FeaturesSection.tsx",
  "PricingSection.tsx",
  "TestimonialsSection.tsx",
  "Testimonials.tsx",
  "CTASection.tsx",
  "SocialProof.tsx",
  "Capabilities.tsx",
];

for (const file of twins) {
  reporter.assert(
    !exists(`apps/marketing/web/src/components/${file}`),
    `marketing dead twin ${file} must stay out of active source`,
  );
  reporter.assert(
    exists(`docs/archive/dead-code/marketing-site/components/${file}`),
    `marketing dead twin ${file} must be preserved in the archive`,
  );
}

const pageSource = readFile("apps/marketing/web/src/app/[locale]/page.tsx");
for (const liveComponent of [
  "Header",
  "Hero",
  "CapabilityMap",
  "Features",
  "MerchantJourney",
  "Pricing",
  "FAQ",
  "EcosystemMap",
  "FinalCTA",
  "Footer",
]) {
  reporter.assert(
    pageSource.includes(`@/components/${liveComponent}`),
    `marketing homepage must keep using live ${liveComponent} component`,
  );
}

for (const deadComponent of [
  "Navbar",
  "HeroSection",
  "FeaturesSection",
  "PricingSection",
  "TestimonialsSection",
  "Testimonials",
  "CTASection",
  "SocialProof",
  "Capabilities",
]) {
  reporter.assert(
    !pageSource.includes(`@/components/${deadComponent}`),
    `marketing homepage must not import archived ${deadComponent} twin`,
  );
}

reporter.finish("marketing-site dead twin components are archived outside active source");
