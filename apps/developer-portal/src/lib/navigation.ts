/**
 * Developer portal information architecture.
 *
 * Every href here resolves to a route that exists in `src/app`. Nothing in this
 * file is aspirational: sections are derived from the contract data in
 * `./reference.ts`, which is itself tracked to gateway, webhook-service,
 * auth-core, shared-types, and theme-engine source.
 *
 * Deliberately absent: a Changelog section. No changelog source of truth exists
 * in the workspace, and inventing one would put fabricated release notes in
 * front of partners.
 */

export type NavLink = {
  label: string;
  href: string;
  /** Shown in the sidebar filter results and on section landing cards. */
  description?: string;
};

export type NavGroup = {
  title: string;
  items: NavLink[];
};

export type PortalSection = {
  key: string;
  /** Tier-1 primary nav label. */
  label: string;
  /** Section landing route. */
  href: string;
  /** Tier-2 tabs shown under the masthead while inside this section. */
  tabs: NavLink[];
  /** Left rail for every route inside this section. */
  sidebar: NavGroup[];
};

export const portalSections: PortalSection[] = [
  {
    key: "apps",
    label: "Apps",
    href: "/docs",
    tabs: [
      { label: "Build", href: "/docs" },
      { label: "Authorize", href: "/oauth" },
      { label: "Events", href: "/webhooks" },
      { label: "Distribute", href: "/dashboard" },
    ],
    sidebar: [
      {
        title: "Getting started",
        items: [
          { label: "Install and lifecycle", href: "/docs", description: "How an app is authorized and how it hears about change." },
          { label: "Authorization code + PKCE", href: "/oauth", description: "S256 challenge, 15-minute codes, scoped token exchange." },
          { label: "Lifecycle webhooks", href: "/webhooks", description: "HMAC-SHA256 signing, delivery headers, compliance topics." },
        ],
      },
      {
        title: "Building blocks",
        items: [
          { label: "App manifest and extensions", href: "/sdk", description: "Manifest schema 2026-06-05.ws13 and the extension registry." },
          { label: "Minimal App SDK", href: "/sdk", description: "createLetbuyyAppSdk over the versioned scoped-app API." },
          { label: "Partner credentials", href: "/dashboard", description: "Show-once client secret and API key issuance." },
        ],
      },
      {
        title: "Reference",
        items: [
          { label: "App Platform API", href: "/api-reference", description: "Every /v1/app-store route the gateway mounts." },
          { label: "Rate limits", href: "/api", description: "Query-cost buckets and the X-RateLimit-* headers." },
        ],
      },
    ],
  },
  {
    key: "themes",
    label: "Themes",
    href: "/sdk",
    tabs: [
      { label: "Overview", href: "/sdk" },
      { label: "Quick-starts", href: "/sdks" },
    ],
    sidebar: [
      {
        title: "Getting started",
        items: [
          { label: "Theme and App SDK", href: "/sdk", description: "The contracts that exist today, and the gaps that do not." },
          { label: "Quick-starts", href: "/sdks", description: "JSON-contract theme bundle and app bridge walkthroughs." },
        ],
      },
      {
        title: "Building blocks",
        items: [
          { label: "Theme bundle contract", href: "/sdks", description: "settings_schema, settings_data, templates, sections, blocks." },
          { label: "Theme Platform API", href: "/api-reference", description: "Upload, install, editor drafts, preview tokens, rollback." },
        ],
      },
    ],
  },
  {
    key: "apis",
    label: "APIs",
    href: "/api",
    tabs: [
      { label: "Overview", href: "/api" },
      { label: "Full reference", href: "/api-reference" },
    ],
    sidebar: [
      {
        title: "Getting started",
        items: [
          { label: "Gateway surface", href: "/api", description: "The curated /v1 surface and how it is versioned." },
          { label: "Full API reference", href: "/api-reference", description: "Route groups, rules, and response contracts." },
        ],
      },
      {
        title: "Reference",
        items: [
          { label: "Rate limits", href: "/api", description: "Cost per verb, per-parameter surcharges, response headers." },
          { label: "OAuth and scopes", href: "/oauth", description: "Known scopes and the app bridge contract." },
          { label: "Webhook topics", href: "/webhooks", description: "Signed delivery contract and verification sketch." },
        ],
      },
    ],
  },
];

/** Tier-1 links rendered to the right of the primary nav. */
export const utilityLinks: NavLink[] = [
  { label: "Dashboard", href: "/dashboard" },
];

/**
 * Footer columns. Only routes that exist, plus the sibling LetBuyy surfaces the
 * platform actually deploys. No social or marketing links are invented here.
 */
export const footerGroups: NavGroup[] = [
  {
    title: "Build",
    items: [
      { label: "Apps", href: "/docs" },
      { label: "Themes", href: "/sdk" },
      { label: "APIs", href: "/api" },
      { label: "Quick-starts", href: "/sdks" },
    ],
  },
  {
    title: "Reference",
    items: [
      { label: "API reference", href: "/api-reference" },
      { label: "OAuth and app bridge", href: "/oauth" },
      { label: "Webhook contract", href: "/webhooks" },
      { label: "Rate limits", href: "/api" },
    ],
  },
  {
    title: "Partner",
    items: [
      { label: "Developer dashboard", href: "/dashboard" },
      { label: "App submissions", href: "/dashboard" },
      { label: "Partner credentials", href: "/dashboard" },
    ],
  },
];

/** Resolve the active section for a pathname, falling back to Apps. */
export function resolveSection(pathname: string): PortalSection {
  const match = portalSections.find(
    (section) =>
      section.href === pathname ||
      section.tabs.some((tab) => tab.href === pathname) ||
      section.sidebar.some((group) => group.items.some((item) => item.href === pathname)),
  );
  return match ?? portalSections[0];
}
