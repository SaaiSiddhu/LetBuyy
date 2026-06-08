// Fallback-only category list. Runtime category names/counts come from the app-store API.

import type { MarketplaceAppCategory } from '@letbuyy/shared-types';

export const APP_CATEGORIES: MarketplaceAppCategory[] = [
    // ── Finding Products ──
    { slug: 'sourcing', name: 'Product Sourcing', icon: 'inventory_2', group: 'Products' },
    { slug: 'dropshipping', name: 'Dropshipping', icon: 'local_shipping', group: 'Products' },
    { slug: 'print-on-demand', name: 'Print on Demand', icon: 'palette', group: 'Products' },

    // ── Selling Products ──
    { slug: 'checkout', name: 'Checkout', icon: 'shopping_cart_checkout', group: 'Selling' },
    { slug: 'upsell-cross-sell', name: 'Upsell & Cross-sell', icon: 'trending_up', group: 'Selling' },
    { slug: 'subscriptions', name: 'Subscriptions', icon: 'autorenew', group: 'Selling' },
    { slug: 'pricing', name: 'Pricing & Discounts', icon: 'local_offer', group: 'Selling' },

    // ── Orders & Shipping ──
    { slug: 'shipping', name: 'Shipping & Delivery', icon: 'local_shipping', group: 'Orders' },
    { slug: 'inventory', name: 'Inventory Management', icon: 'inventory', group: 'Orders' },
    { slug: 'order-management', name: 'Order Management', icon: 'orders', group: 'Orders' },
    { slug: 'returns', name: 'Returns & Exchanges', icon: 'refund_policy', group: 'Orders' },

    // ── Marketing ──
    { slug: 'email-marketing', name: 'Email Marketing', icon: 'mail', group: 'Marketing' },
    { slug: 'sms-marketing', name: 'SMS Marketing', icon: 'phone_iphone', group: 'Marketing' },
    { slug: 'seo', name: 'SEO', icon: 'search', group: 'Marketing' },
    { slug: 'social-media', name: 'Social Media', icon: 'share', group: 'Marketing' },
    { slug: 'ads', name: 'Advertising', icon: 'monitoring', group: 'Marketing' },

    // ── Conversion ──
    { slug: 'reviews', name: 'Reviews & Ratings', icon: 'star', group: 'Conversion' },
    { slug: 'loyalty', name: 'Loyalty & Rewards', icon: 'card_giftcard', group: 'Conversion' },
    { slug: 'popups', name: 'Pop-ups & Banners', icon: 'chat', group: 'Conversion' },
    { slug: 'trust-badges', name: 'Trust & Security', icon: 'shield_lock', group: 'Conversion' },

    // ── Store Design ──
    { slug: 'page-builders', name: 'Page Builders', icon: 'web_asset', group: 'Design' },
    { slug: 'image-editing', name: 'Image & Media', icon: 'image', group: 'Design' },

    // ── Customer Support ──
    { slug: 'live-chat', name: 'Live Chat', icon: 'chat', group: 'Support' },
    { slug: 'helpdesk', name: 'Help Desk & FAQ', icon: 'support', group: 'Support' },
    { slug: 'crm', name: 'CRM', icon: 'group', group: 'Support' },

    // ── Analytics ──
    { slug: 'analytics', name: 'Analytics & Reports', icon: 'analytics', group: 'Analytics' },
    { slug: 'ab-testing', name: 'A/B Testing', icon: 'experiment', group: 'Analytics' },

    // ── Finance ──
    { slug: 'accounting', name: 'Accounting & Tax', icon: 'receipt_long', group: 'Finance' },
    { slug: 'invoicing', name: 'Invoicing', icon: 'request_quote', group: 'Finance' },
];

export type AppCategorySlug = typeof APP_CATEGORIES[number]['slug'];
