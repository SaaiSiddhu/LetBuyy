# Heading hierarchy and header refinement — 2026-10-23

The owner requested more prominent section names (especially Automation and Pricing) and a better site header. Changes are limited to the marketing stylesheet.

- Section names now use 18px on mobile and up to 20px on desktop, with the canonical theme-aware primary text accent. Other public section eyebrows use 14–16px instead of 11px.
- Home section headlines and Automation share a balanced 32–48px scale. Architecture and Automation header blocks have side gutters; supporting text wraps within a bounded measure.
- Stable 72px mobile / 80px desktop header, enlarged brand area, consistent navigation baseline, 44px controls, primary signup action and a clearly bounded mobile menu control.
- Dropdown offsets follow the actual header height. Corrected the menu-open signup contrast and removed the forced dark-logo override so light mode uses its proper logo.
- Replaced an unsupported spacing-token reference with an arithmetic expression using an existing token for the logo and illustrated shortcut dimensions.

Validation: lint/stylelint pass (19 existing ESLint warnings, no errors), production build passes (494 pages), typecheck passes, existing marketing suites pass 10/10. Typecheck was repeated after the build finished because the initial concurrent run raced generated `.next/types` files.

Browser: inspected 320px, 505px, 1024px, and 1440px widths with no page overflow. Confirmed 320px header controls fit and section names/headlines wrap; desktop Products and Why LetBuyy menus fit under the 80px header; signup remains readable while a menu is open. Mobile and desktop Escape dismiss menus. Inspected light/dark logo selection and button contrast. These checks do not constitute a full assistive-technology audit.

SHA-256 comparison confirms Header, Hero, CommerceNetwork, CapabilityMap, Features, MerchantJourney, EcosystemMap, Pricing, FAQ, and FinalCTA component files are unchanged from the start of this task. Content, feature order, handlers, illustrations, and Commerce OS visual code are preserved.

Screenshots: [Automation mobile](headings-automation-mobile.png), [Pricing desktop](headings-pricing-desktop.png), [desktop menu](header-desktop-menu.png), [light menu](header-light-menu.png).
