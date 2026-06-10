#!/usr/bin/env node
/**
 * LetBuyy Empty State Illustration System — asset + gallery generator.
 *
 * Single source of truth for the 18 curated empty-state motifs. Emits:
 *   assets/<motif>.light.svg   concrete-hex, self-contained (design library / Canva)
 *   assets/<motif>.dark.svg
 *   gallery.html               faithful, token-themed, animated preview (style board + review surface)
 *   motifs.manifest.json       machine-readable index (surface → motif map)
 *
 * Design language is lifted verbatim from packages/typescript/ui/src/feedback.tsx
 * (EmptyStateIllustration) and tokens.ts. Ink is a single brand-purple drawn at
 * graded opacity (currentColor), on a purple-subtle tinted panel, with one floating
 * secondary element and a central elevated icon chip. No 3D, no characters, no gradients.
 *
 * Run:  node generate-empty-states.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, 'assets');
mkdirSync(ASSETS, { recursive: true });

/* ----------------------------------------------------------------------------
 * Token values — copied verbatim from packages/typescript/ui/src/tokens.ts.
 * Ink + tinted panel are theme-invariant (brand purple @ 12% alpha); only the
 * card surface, hairline border and elevation flip between light and dark.
 * ------------------------------------------------------------------------- */
const INK = '#8B5CF6';                 // accent.brand / --lb-component-empty-state-illustration-ink (both themes)
const PANEL_ALPHA = 0.12;              // primitive.opacity.purpleSubtle
const CTA = '#6D28D9';                 // component.button.primary.bg (purple-700)
const CTA_TEXT = '#FFFFFF';

const THEME = {
    light: {
        page: '#F6F7F9',     // color.light.bg (gray-125)
        card: '#FFFFFF',     // empty-state-bg (card light)
        border: '#E5E7EB',   // empty-state-border (gray-200)
        title: '#111827',    // empty-state-title (gray-900)
        body: '#6B7280',     // empty-state-body (gray-500)
        shadow: { dy: 6, blur: 12, color: '#0F172A', op: 0.08 }, // ~cardLight
    },
    dark: {
        page: '#111827',     // color.dark.bg (gray-900)
        card: '#1F2937',     // empty-state-bg (card dark / slate-850)
        border: '#334155',   // empty-state-border (slate-700)
        title: '#FFFFFF',
        body: '#CBD5E1',     // text.secondary dark (slate-300)
        shadow: { dy: 8, blur: 16, color: '#000000', op: 0.30 },  // ~cardDark
    },
};

// Alpha-composite the purple-subtle panel over the card surface so a standalone
// (transparent) asset reads identically to the live component.
function blend(hex, base, a) {
    const h = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
    const [r1, g1, b1] = h(hex);
    const [r2, g2, b2] = h(base);
    const mix = (x, y) => Math.round(x * a + y * (1 - a));
    return '#' + [mix(r1, r2), mix(g1, g2), mix(b1, b2)]
        .map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/* ----------------------------------------------------------------------------
 * Motif registry. `scene` = line-art behind/around the chip (viewBox 0 0 192 128,
 * ink via currentColor at graded opacity, exactly one data-lb-empty-float="secondary").
 * `glyph` = the chip icon (a 24x24 line glyph, translated to the chip centre).
 * ------------------------------------------------------------------------- */
const motifs = {
    generic: {
        title: 'Nothing here yet',
        body: 'When there is something to show, it will appear in this space.',
        primary: 'Get started', secondary: 'Learn more',
        surfaces: ['Generic / fallback', 'Search — no results'],
        scene: `
      <path d="M48 78H92" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.45"/>
      <path d="M48 88H118" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.28"/>
      <circle cx="136" cy="52" r="10" fill="currentColor" opacity="0.12" data-lb-empty-float="secondary"/>`,
        glyph: `<path d="M12 2.5l2.1 6.4 6.4 2.1-6.4 2.1L12 19.5l-2.1-6.4L3.5 11l6.4-2.1L12 2.5Z"/>`,
    },
    orders: {
        title: 'No orders yet',
        body: 'Orders placed in your store will show up here, ready to fulfil.',
        primary: 'Create order', secondary: 'View checkout settings',
        surfaces: ['Orders'],
        scene: `
      <rect x="50" y="40" width="78" height="54" rx="10" stroke="currentColor" stroke-width="2" opacity="0.65"/>
      <path d="M64 56H112M64 70H100M64 84H92" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.45"/>
      <circle cx="130" cy="46" r="12" fill="currentColor" opacity="0.1" data-lb-empty-float="secondary"/>`,
        glyph: `<path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/>`,
    },
    products: {
        title: 'Add your first product',
        body: 'Products you add appear here. Add details, media and pricing to start selling.',
        primary: 'Add product', secondary: 'Import products',
        surfaces: ['Products'],
        scene: `
      <rect x="48" y="46" width="34" height="28" rx="8" stroke="currentColor" stroke-width="2" opacity="0.7"/>
      <path d="M48 57H82" stroke="currentColor" stroke-width="2" opacity="0.28"/>
      <rect x="92" y="40" width="36" height="40" rx="9" fill="currentColor" opacity="0.1" data-lb-empty-float="secondary"/>`,
        glyph: `<path d="M12 3l8 4v10l-8 4-8-4V7l8-4Z"/><path d="M4 7l8 4 8-4M12 11v10"/>`,
    },
    inventory: {
        title: 'No inventory tracked',
        body: 'Track stock to see quantities on hand, committed and available to sell.',
        primary: 'Enable tracking', secondary: 'Import stock',
        surfaces: ['Inventory'],
        scene: `
      <path d="M50 72H132" stroke="currentColor" stroke-width="2" opacity="0.45"/>
      <path d="M58 48H126L118 72H66L58 48Z" stroke="currentColor" stroke-width="2" opacity="0.7"/>
      <circle cx="74" cy="82" r="4" fill="currentColor" opacity="0.28"/>
      <circle cx="110" cy="82" r="4" fill="currentColor" opacity="0.28"/>
      <circle cx="136" cy="44" r="7" fill="currentColor" opacity="0.12" data-lb-empty-float="secondary"/>`,
        glyph: `<rect x="6" y="5" width="12" height="16" rx="2"/><path d="M9 5a3 3 0 0 1 6 0"/><path d="M9 11h6M9 15h6"/>`,
    },
    shipping: {
        title: 'No shipments yet',
        body: 'Once you fulfil an order, shipments and tracking will appear here.',
        primary: 'Set up shipping', secondary: 'Add carrier',
        surfaces: ['Shipping', 'Fulfillment', 'Returns'],
        scene: `
      <path d="M46 88H146" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.36"/>
      <rect x="58" y="56" width="40" height="30" rx="4" stroke="currentColor" stroke-width="2" opacity="0.64"/>
      <path d="M58 66H98" stroke="currentColor" stroke-width="2" opacity="0.3"/>
      <path d="M104 64H126L136 74V86H104Z" stroke="currentColor" stroke-width="2" opacity="0.5" data-lb-empty-float="secondary"/>`,
        glyph: `<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.7"/><circle cx="17.5" cy="18" r="1.7"/>`,
    },
    customers: {
        title: 'No customers yet',
        body: 'People who buy from you or sign up will appear here with their history.',
        primary: 'Add customer', secondary: 'Import customers',
        surfaces: ['Customers', 'Reseller'],
        scene: `
      <circle cx="72" cy="54" r="12" stroke="currentColor" stroke-width="2" opacity="0.7"/>
      <path d="M52 88C56 74 64 68 72 68C80 68 88 74 92 88" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.55"/>
      <circle cx="112" cy="58" r="10" fill="currentColor" opacity="0.14" data-lb-empty-float="secondary"/>
      <path d="M98 88C102 76 108 72 114 72C120 72 126 76 130 88" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.28"/>`,
        glyph: `<circle cx="12" cy="8" r="4"/><path d="M5 20c1-5 4-7 7-7s6 2 7 7"/>`,
    },
    payments: {
        title: 'No payments yet',
        body: 'Captured and pending payments across your checkout will appear here.',
        primary: 'Configure payments', secondary: 'View checkout',
        surfaces: ['Payments', 'Checkout'],
        scene: `
      <rect x="48" y="48" width="84" height="52" rx="10" stroke="currentColor" stroke-width="2" opacity="0.62"/>
      <path d="M48 62H132" stroke="currentColor" stroke-width="3" opacity="0.22"/>
      <rect x="62" y="78" width="34" height="8" rx="4" fill="currentColor" opacity="0.18"/>
      <circle cx="138" cy="44" r="7" fill="currentColor" opacity="0.12" data-lb-empty-float="secondary"/>`,
        glyph: `<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>`,
    },
    payouts: {
        title: 'No payouts yet',
        body: 'Settlements to your bank account will appear here once sales are processed.',
        primary: 'Add bank account', secondary: 'View schedule',
        surfaces: ['Payouts', 'Settlements', 'Billing'],
        scene: `
      <ellipse cx="74" cy="56" rx="18" ry="7" stroke="currentColor" stroke-width="2" opacity="0.6"/>
      <path d="M56 56V72C56 76 64 79 74 79C84 79 92 76 92 72V56" stroke="currentColor" stroke-width="2" opacity="0.6"/>
      <path d="M102 70H134M124 60L138 70L124 80" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.45"/>
      <circle cx="134" cy="46" r="6" fill="currentColor" opacity="0.16" data-lb-empty-float="secondary"/>`,
        glyph: `<rect x="3" y="7" width="18" height="10" rx="2"/><circle cx="12" cy="12" r="2.4"/><path d="M6 9.5v5M18 9.5v5"/>`,
    },
    discounts: {
        title: 'No discounts yet',
        body: 'Create automatic or code-based discounts and campaigns to drive sales.',
        primary: 'Create discount', secondary: 'Browse campaigns',
        surfaces: ['Discounts', 'Marketing'],
        scene: `
      <path d="M52 70L118 42L126 84L52 70Z" stroke="currentColor" stroke-width="2" opacity="0.68"/>
      <path d="M61 72L66 92" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
      <circle cx="136" cy="38" r="5" fill="currentColor" opacity="0.22" data-lb-empty-float="secondary"/>
      <path d="M134 58H150M138 72H152" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.32"/>`,
        glyph: `<path d="M4 12l8-8h7v7l-8 8z"/><circle cx="15.5" cy="8.5" r="1.5"/>`,
    },
    analytics: {
        title: 'No data to show yet',
        body: 'As traffic and sales come in, your trends and reports will appear here.',
        primary: 'Choose metrics', secondary: 'View reports',
        surfaces: ['Analytics'],
        scene: `
      <path d="M48 84H132" stroke="currentColor" stroke-width="2" opacity="0.36"/>
      <rect x="58" y="60" width="12" height="24" rx="4" fill="currentColor" opacity="0.16"/>
      <rect x="82" y="48" width="12" height="36" rx="4" fill="currentColor" opacity="0.28" data-lb-empty-float="secondary"/>
      <rect x="106" y="36" width="12" height="48" rx="4" fill="currentColor" opacity="0.16"/>`,
        glyph: `<path d="M4 20h16"/><path d="M6 20V12M12 20V5M18 20V9"/>`,
    },
    domains: {
        title: 'No domains connected',
        body: 'Connect a custom domain so customers reach your store at your own URL.',
        primary: 'Connect domain', secondary: 'Buy a domain',
        surfaces: ['Domains'],
        scene: `
      <circle cx="92" cy="64" r="30" stroke="currentColor" stroke-width="2" opacity="0.58"/>
      <path d="M62 64H122M92 34C102 48 102 80 92 94M92 34C82 48 82 80 92 94" stroke="currentColor" stroke-width="2" opacity="0.32"/>
      <circle cx="132" cy="44" r="8" fill="currentColor" opacity="0.12" data-lb-empty-float="secondary"/>`,
        glyph: `<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c3 4 3 13 0 17M12 3.5c-3 4-3 13 0 17"/>`,
    },
    themes: {
        title: 'No theme published',
        body: 'Pick a theme and customise your storefront. Your published theme shows here.',
        primary: 'Browse themes', secondary: 'Customise',
        surfaces: ['Themes', 'Storefront'],
        scene: `
      <rect x="48" y="42" width="80" height="54" rx="10" stroke="currentColor" stroke-width="2" opacity="0.62"/>
      <path d="M48 56H128" stroke="currentColor" stroke-width="2" opacity="0.24"/>
      <circle cx="62" cy="49" r="3" fill="currentColor" opacity="0.35"/>
      <rect x="62" y="68" width="42" height="12" rx="4" fill="currentColor" opacity="0.13" data-lb-empty-float="secondary"/>`,
        glyph: `<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.6 0 2.2-1.1 2.2-2.1 0-2 2-2.1 3.1-2.1A3.2 3.2 0 0 0 20.5 13c0-5.2-3.8-9.5-8.5-9.5Z"/><circle cx="8.5" cy="10" r="1"/><circle cx="12" cy="8" r="1"/><circle cx="15.5" cy="10" r="1"/>`,
    },
    apps: {
        title: 'No apps installed',
        body: 'Extend your store with apps and integrations from the LetBuyy marketplace.',
        primary: 'Browse marketplace', secondary: 'Manage apps',
        surfaces: ['Apps', 'Marketplace', 'Integrations'],
        scene: `
      <path d="M74 42H96V60H118V82H96V100H74V82H52V60H74V42Z" stroke="currentColor" stroke-width="2" opacity="0.64"/>
      <circle cx="132" cy="44" r="7" fill="currentColor" opacity="0.16" data-lb-empty-float="secondary"/>`,
        glyph: `<rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="7" rx="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6"/><rect x="13" y="13" width="7" height="7" rx="1.6"/>`,
    },
    messaging: {
        title: 'No conversations yet',
        body: 'WhatsApp chats with your customers will appear here once they reach out.',
        primary: 'Connect WhatsApp', secondary: 'Message templates',
        surfaces: ['WhatsApp'],
        scene: `
      <path d="M56 50H126C130 50 134 54 134 58V80C134 84 130 88 126 88H88L72 100V88H56C52 88 48 84 48 80V58C48 54 52 50 56 50Z" stroke="currentColor" stroke-width="2" opacity="0.62"/>
      <path d="M66 64H116M66 75H98" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.34"/>
      <circle cx="138" cy="44" r="7" fill="currentColor" opacity="0.14" data-lb-empty-float="secondary"/>`,
        glyph: `<path d="M4 6h16v11H9l-5 4V6Z"/><path d="M8 10.5h8M8 13.5h5"/>`,
    },
    notifications: {
        title: "You're all caught up",
        body: 'New alerts, emails and notifications will appear here as they arrive.',
        primary: 'Notification settings', secondary: 'View archive',
        surfaces: ['Notifications', 'Email'],
        scene: `
      <path d="M96 44C86 44 80 51 80 61V72L74 80H118L112 72V61C112 51 106 44 96 44Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" opacity="0.62"/>
      <path d="M90 88a6 6 0 0 0 12 0" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
      <circle cx="114" cy="50" r="6" fill="currentColor" opacity="0.9"/>
      <rect x="124" y="70" width="22" height="15" rx="3" fill="currentColor" opacity="0.12" data-lb-empty-float="secondary"/>`,
        glyph: `<path d="M12 3.5c-4 0-6 3-6 7v4l-2 2h16l-2-2v-4c0-4-2-7-6-7Z"/><path d="M10 19a2 2 0 0 0 4 0"/>`,
    },
    identity: {
        title: 'No identities yet',
        body: 'Verified people and KYC submissions will appear here for review.',
        primary: 'Start verification', secondary: 'KYC settings',
        surfaces: ['Identity', 'KYC'],
        scene: `
      <rect x="54" y="48" width="84" height="42" rx="9" stroke="currentColor" stroke-width="2" opacity="0.62"/>
      <circle cx="74" cy="64" r="9" stroke="currentColor" stroke-width="2" opacity="0.5"/>
      <path d="M62 82C64 74 68 71 74 71C80 71 84 74 86 82" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
      <path d="M100 60H126M100 70H120M100 80H114" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.36"/>
      <circle cx="136" cy="42" r="6" fill="currentColor" opacity="0.14" data-lb-empty-float="secondary"/>`,
        glyph: `<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="8" cy="11" r="2.2"/><path d="M4.8 16c0-2 1.6-3 3.2-3s3.2 1 3.2 3"/><path d="M14 10h4M14 13.5h4"/>`,
    },
    security: {
        title: 'Nothing flagged',
        body: 'Security events, sign-in methods and audit entries will appear here.',
        primary: 'Review security', secondary: 'View audit log',
        surfaces: ['Security', 'SSO', 'Passkeys', 'Audit Logs'],
        scene: `
      <path d="M96 42L122 50V70C122 86 110 96 96 102C82 96 70 86 70 70V50L96 42Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" opacity="0.62"/>
      <path d="M86 70L93 78L108 60" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>
      <circle cx="134" cy="46" r="7" fill="currentColor" opacity="0.14" data-lb-empty-float="secondary"/>`,
        glyph: `<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6l8-3Z"/><path d="M8.5 12l2.4 2.4L15.5 10"/>`,
    },
    permissions: {
        title: 'No staff added',
        body: 'Invite teammates and assign roles to control who can access what.',
        primary: 'Invite staff', secondary: 'Manage roles',
        surfaces: ['Staff', 'Roles', 'Permissions'],
        scene: `
      <circle cx="72" cy="56" r="11" stroke="currentColor" stroke-width="2" opacity="0.6"/>
      <path d="M54 90C57 78 63 72 72 72C81 72 87 78 90 90" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.48"/>
      <circle cx="116" cy="62" r="9" stroke="currentColor" stroke-width="2" opacity="0.55"/>
      <path d="M122 68L140 86M133 79L139 73M139 85L144 80" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.45"/>
      <circle cx="134" cy="42" r="6" fill="currentColor" opacity="0.14" data-lb-empty-float="secondary"/>`,
        glyph: `<circle cx="8.5" cy="10" r="4"/><path d="M11.5 13l8.5 8.5M16.5 18l3-3"/>`,
    },
};

const ORDER = [
    'generic', 'orders', 'products', 'inventory', 'shipping', 'customers',
    'payments', 'payouts', 'discounts', 'analytics', 'domains', 'themes',
    'apps', 'messaging', 'notifications', 'identity', 'security', 'permissions',
];

/* ----------------------------------------------------------------------------
 * Standalone asset renderer (concrete hex, self-contained, 192x128).
 * ------------------------------------------------------------------------- */
function renderAsset(key, theme) {
    const m = motifs[key];
    const t = THEME[theme];
    const panel = blend(INK, t.card, PANEL_ALPHA);
    const scene = m.scene.replaceAll('currentColor', INK);
    const fid = `lbShadow-${key}-${theme}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="128" viewBox="0 0 192 128" fill="none" role="img" aria-label="LetBuyy ${key} empty-state illustration">
  <defs>
    <filter id="${fid}" x="-20%" y="-20%" width="140%" height="160%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="${t.shadow.dy}" stdDeviation="${t.shadow.blur / 2}" flood-color="${t.shadow.color}" flood-opacity="${t.shadow.op}"/>
    </filter>
  </defs>
  <rect x="18" y="18" width="156" height="92" rx="16" fill="${panel}"/>
  <rect x="34" y="32" width="124" height="64" rx="12" stroke="${INK}" stroke-width="2" opacity="0.2"/>
  <path d="M40 102C56 90 74 90 96 102C118 114 142 114 162 96" stroke="${INK}" stroke-width="2" stroke-linecap="round" opacity="0.22"/>
  <g>${scene}
  </g>
  <g filter="url(#${fid})">
    <rect x="73" y="41" width="46" height="46" rx="14" fill="${t.card}" stroke="${t.border}" stroke-width="1.5"/>
  </g>
  <g transform="translate(84,52)" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    ${m.glyph}
  </g>
</svg>
`;
}

/* ----------------------------------------------------------------------------
 * Gallery — faithful to the live component: ink/panel/surfaces are driven by the
 * real --lb-* variables (values copied from tokens.ts), themed via [data-theme],
 * and animated by the actual lb-empty-state-float / drift keyframes.
 * ------------------------------------------------------------------------- */
function illustrationSvg(key) {
    const m = motifs[key];
    return `<svg class="lb-illus" viewBox="0 0 192 128" fill="none" aria-hidden="true">
      <rect x="18" y="18" width="156" height="92" rx="16" fill="var(--lb-component-empty-state-illustration-bg)"/>
      <rect x="34" y="32" width="124" height="64" rx="12" stroke="currentColor" stroke-width="2" opacity="0.2"/>
      <path d="M40 102C56 90 74 90 96 102C118 114 142 114 162 96" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.22"/>
      <g data-lb-empty-float="primary">${m.scene}</g>
    </svg>
    <span class="lb-chip" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${m.glyph}</svg>
    </span>`;
}

function card(key) {
    const m = motifs[key];
    return `<figure class="lb-empty" data-kind="${key}">
    <div class="lb-illus-wrap">${illustrationSvg(key)}</div>
    <div class="lb-copy">
      <h3>${m.title}</h3>
      <p>${m.body}</p>
    </div>
    <div class="lb-actions">
      <button class="lb-btn lb-btn-secondary">${m.secondary}</button>
      <button class="lb-btn lb-btn-primary">${m.primary}</button>
    </div>
    <figcaption class="lb-kindtag">${key} &middot; ${m.surfaces.join(', ')}</figcaption>
  </figure>`;
}

function gallery() {
    const cards = ORDER.map(card).join('\n');
    const count = ORDER.length;
    const surfaceCount = ORDER.reduce((n, k) => n + motifs[k].surfaces.length, 0);
    return `<!doctype html>
<html lang="en" data-theme="light" data-density="comfortable">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>LetBuyy Empty State System — preview gallery</title>
<style>
  /* --- token layer (values copied verbatim from packages/typescript/ui/src/tokens.ts) --- */
  :root, [data-theme="light"]{
    --lb-color-bg:#F6F7F9; --lb-color-card:#FFFFFF; --lb-color-text:#111827; --lb-color-text-subdued:#6B7280; --lb-color-border:#E5E7EB;
    --lb-component-empty-state-bg:#FFFFFF; --lb-component-empty-state-border:#E5E7EB;
    --lb-component-empty-state-title:#111827; --lb-component-empty-state-body:#6B7280;
    --lb-component-empty-state-illustration-ink:#8B5CF6; --lb-component-empty-state-illustration-bg:rgba(139,92,246,0.12);
    --lb-component-card-shadow:0 1px 2px rgb(15 23 42 / 5%), 0 8px 24px rgb(15 23 42 / 4%);
    --lb-component-button-primary-bg:#6D28D9; --lb-component-button-primary-text:#FFFFFF;
  }
  [data-theme="dark"]{
    --lb-color-bg:#111827; --lb-color-card:#1F2937; --lb-color-text:#FFFFFF; --lb-color-text-subdued:#CBD5E1; --lb-color-border:#334155;
    --lb-component-empty-state-bg:#1F2937; --lb-component-empty-state-border:#334155;
    --lb-component-empty-state-title:#FFFFFF; --lb-component-empty-state-body:#CBD5E1;
    --lb-component-empty-state-illustration-ink:#8B5CF6; --lb-component-empty-state-illustration-bg:rgba(139,92,246,0.12);
    --lb-component-card-shadow:0 1px 2px rgb(0 0 0 / 18%), 0 10px 26px rgb(0 0 0 / 16%);
    --lb-component-button-primary-bg:#6D28D9; --lb-component-button-primary-text:#FFFFFF;
  }
  /* density only changes the illustration footprint, mirroring --lb-density-empty-state-* */
  [data-density="compact"]{ --es-illus-w:160px; --es-illus-h:108px; --es-min-h:180px; }
  [data-density="comfortable"]{ --es-illus-w:184px; --es-illus-h:122px; --es-min-h:220px; }
  [data-density="spacious"]{ --es-illus-w:208px; --es-illus-h:138px; --es-min-h:260px; }

  *{box-sizing:border-box}
  body{margin:0;background:var(--lb-color-bg);color:var(--lb-color-text);
    font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
    transition:background .2s ease,color .2s ease}
  header.bar{position:sticky;top:0;z-index:40;display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between;
    padding:16px 24px;background:color-mix(in srgb,var(--lb-color-bg) 86%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--lb-color-border)}
  .brand{display:flex;align-items:center;gap:10px;font-weight:700;letter-spacing:-.2px}
  .brand .dot{width:22px;height:22px;border-radius:7px;background:linear-gradient(135deg,#8B5CF6,#6D28D9);box-shadow:0 2px 8px rgba(124,58,237,.45)}
  .brand small{display:block;font-weight:500;color:var(--lb-color-text-subdued);font-size:12px}
  .controls{display:flex;gap:8px;flex-wrap:wrap}
  .controls button{height:36px;padding:0 14px;border-radius:8px;border:1px solid var(--lb-color-border);
    background:var(--lb-color-card);color:var(--lb-color-text);font:inherit;font-size:13px;font-weight:500;cursor:pointer}
  .controls button[aria-pressed="true"]{border-color:#8B5CF6;color:#8B5CF6;box-shadow:0 0 0 1px #8B5CF6 inset}
  .meta{max-width:1240px;margin:24px auto 0;padding:0 24px;color:var(--lb-color-text-subdued);font-size:13px}
  .grid{max-width:1240px;margin:0 auto;padding:24px;display:grid;gap:20px;grid-template-columns:repeat(auto-fill,minmax(360px,1fr))}
  /* --- the EmptyState component, faithfully reproduced --- */
  .lb-empty{margin:0;min-height:var(--es-min-h);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center;
    border:1px dashed var(--lb-component-empty-state-border);border-radius:16px;background:var(--lb-component-empty-state-bg);padding:24px}
  .lb-illus-wrap{position:relative;width:var(--es-illus-w);height:var(--es-illus-h);color:var(--lb-component-empty-state-illustration-ink)}
  .lb-illus{position:absolute;inset:0;width:100%;height:100%}
  .lb-chip{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;
    border-radius:16px;border:1px solid var(--lb-component-empty-state-border);background:var(--lb-component-empty-state-bg);box-shadow:var(--lb-component-card-shadow);color:var(--lb-component-empty-state-illustration-ink)}
  .lb-chip svg{width:20px;height:20px}
  .lb-copy{max-width:440px;display:flex;flex-direction:column;gap:6px}
  .lb-copy h3{margin:0;font-size:16px;line-height:20px;font-weight:600;color:var(--lb-component-empty-state-title)}
  .lb-copy p{margin:0;font-size:14px;line-height:20px;color:var(--lb-component-empty-state-body)}
  .lb-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
  .lb-btn{height:40px;padding:0 16px;border-radius:8px;font:inherit;font-size:14px;font-weight:500;cursor:pointer;border:1px solid transparent}
  .lb-btn-primary{background:var(--lb-component-button-primary-bg);color:var(--lb-component-button-primary-text)}
  .lb-btn-secondary{background:transparent;border-color:var(--lb-color-border);color:var(--lb-color-text)}
  .lb-kindtag{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--lb-color-text-subdued);opacity:.8}
  /* --- motion: the real keyframes from tokens.ts (letbuyyTokenCss) --- */
  @keyframes lb-empty-state-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
  @keyframes lb-empty-state-drift{0%,100%{transform:translate3d(0,0,0);opacity:.72}50%{transform:translate3d(4px,-5px,0);opacity:1}}
  @media (prefers-reduced-motion: no-preference){
    html:not([data-motion="off"]) [data-lb-empty-float="primary"]{animation:lb-empty-state-float 4.8s ease-in-out infinite}
    html:not([data-motion="off"]) [data-lb-empty-float="secondary"]{animation:lb-empty-state-drift 5.6s ease-in-out infinite}
  }
  .lb-illus-wrap{transition:transform .2s ease}
  html:not([data-motion="off"]) .lb-empty:hover .lb-illus-wrap{transform:translateY(-4px)}
  footer{max-width:1240px;margin:0 auto;padding:8px 24px 48px;color:var(--lb-color-text-subdued);font-size:12px}
</style>
</head>
<body>
  <header class="bar">
    <div class="brand"><span class="dot"></span><div>LetBuyy Empty State System<small>${count} motifs &middot; ${surfaceCount} surfaces &middot; token-driven</small></div></div>
    <div class="controls">
      <button id="t-light" aria-pressed="true">Light</button>
      <button id="t-dark" aria-pressed="false">Dark</button>
      <span style="width:1px;background:var(--lb-color-border);margin:0 4px"></span>
      <button id="d-compact" aria-pressed="false">Compact</button>
      <button id="d-comfortable" aria-pressed="true">Comfortable</button>
      <button id="d-spacious" aria-pressed="false">Spacious</button>
      <span style="width:1px;background:var(--lb-color-border);margin:0 4px"></span>
      <button id="m-toggle" aria-pressed="true">Motion: on</button>
    </div>
  </header>
  <p class="meta">Live preview. Ink and tinted panel are theme-invariant brand purple (#8B5CF6 @ 12%); only the card surface, hairline and elevation flip between modes — exactly as the production <code>EmptyStateIllustration</code> resolves the <code>--lb-component-empty-state-*</code> tokens. Hover a card to see the float; toggle motion to verify the reduced-motion path.</p>
  <main class="grid">
${cards}
  </main>
  <footer>Generated by docs/design-system/empty-states/generate-empty-states.mjs — do not hand-edit the assets; edit the generator.</footer>
<script>
  const root=document.documentElement;
  const setTheme=(v)=>{root.dataset.theme=v;t_light.ariaPressed=String(v==='light');t_dark.ariaPressed=String(v==='dark');};
  const setDensity=(v)=>{root.dataset.density=v;d_compact.ariaPressed=String(v==='compact');d_comfortable.ariaPressed=String(v==='comfortable');d_spacious.ariaPressed=String(v==='spacious');};
  t_light.onclick=()=>setTheme('light');t_dark.onclick=()=>setTheme('dark');
  d_compact.onclick=()=>setDensity('compact');d_comfortable.onclick=()=>setDensity('comfortable');d_spacious.onclick=()=>setDensity('spacious');
  m_toggle.onclick=()=>{const off=root.dataset.motion==='off';root.dataset.motion=off?'':'off';m_toggle.textContent='Motion: '+(off?'on':'off');m_toggle.ariaPressed=String(off);};
</script>
</body>
</html>
`;
}

/* ------------------------------- emit -------------------------------------- */
let n = 0;
for (const key of ORDER) {
    for (const theme of ['light', 'dark']) {
        writeFileSync(join(ASSETS, `${key}.${theme}.svg`), renderAsset(key, theme));
        n++;
    }
}
writeFileSync(join(HERE, 'gallery.html'), gallery());
writeFileSync(join(HERE, 'motifs.manifest.json'), JSON.stringify({
    generatedAt: new Date().toISOString().slice(0, 10),
    motifCount: ORDER.length,
    motifs: ORDER.map((k) => ({ key: k, title: motifs[k].title, surfaces: motifs[k].surfaces })),
}, null, 2));

const surfaces = ORDER.reduce((a, k) => a + motifs[k].surfaces.length, 0);
console.log(`✓ ${n} SVG assets (${ORDER.length} motifs × 2 themes)`);
console.log(`✓ gallery.html  (${surfaces} surfaces mapped)`);
console.log(`✓ motifs.manifest.json`);
