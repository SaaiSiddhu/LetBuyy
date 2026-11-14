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
const compositionSource = readFile("apps/marketing/web/src/components/MarketingHome.tsx");
const liveSource = pageSource + "\n" + compositionSource;
reporter.assert(
  pageSource.includes("@/components/MarketingHome") && /await loadPublicPricing\(\)/.test(pageSource)
    && /<MarketingHome pricing=\{<Pricing initialData=\{initialData\}/.test(pageSource)
    && compositionSource.includes("{pricing}"),
  "marketing homepage must pass server-loaded Pricing into the live client composition",
);
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
    liveSource.includes(`@/components/${liveComponent}`),
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
    !liveSource.includes(`@/components/${deadComponent}`),
    `marketing homepage must not import archived ${deadComponent} twin`,
  );
}

reporter.finish("marketing-site dead twin components are archived outside active source");
