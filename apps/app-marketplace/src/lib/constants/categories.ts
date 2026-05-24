// App categories from Doc 15 §4

import { AppCategory } from '@/lib/types/apps';

export const APP_CATEGORIES: AppCategory[] = [
    // ── Finding Products ──
    { slug: 'sourcing', name: 'Product Sourcing', icon: '📦', group: 'Products' },
    { slug: 'dropshipping', name: 'Dropshipping', icon: '🚛', group: 'Products' },
    { slug: 'print-on-demand', name: 'Print on Demand', icon: '🎨', group: 'Products' },

    // ── Selling Products ──
    { slug: 'checkout', name: 'Checkout', icon: '💳', group: 'Selling' },
    { slug: 'upsell-cross-sell', name: 'Upsell & Cross-sell', icon: '📈', group: 'Selling' },
    { slug: 'subscriptions', name: 'Subscriptions', icon: '🔄', group: 'Selling' },
    { slug: 'pricing', name: 'Pricing & Discounts', icon: '🏷️', group: 'Selling' },

    // ── Orders & Shipping ──
    { slug: 'shipping', name: 'Shipping & Delivery', icon: '🚚', group: 'Orders' },
    { slug: 'inventory', name: 'Inventory Management', icon: '📋', group: 'Orders' },
    { slug: 'order-management', name: 'Order Management', icon: '📑', group: 'Orders' },
    { slug: 'returns', name: 'Returns & Exchanges', icon: '↩️', group: 'Orders' },

    // ── Marketing ──
    { slug: 'email-marketing', name: 'Email Marketing', icon: '📧', group: 'Marketing' },
    { slug: 'sms-marketing', name: 'SMS Marketing', icon: '📱', group: 'Marketing' },
    { slug: 'seo', name: 'SEO', icon: '🔍', group: 'Marketing' },
    { slug: 'social-media', name: 'Social Media', icon: '📣', group: 'Marketing' },
    { slug: 'ads', name: 'Advertising', icon: '📺', group: 'Marketing' },

    // ── Conversion ──
    { slug: 'reviews', name: 'Reviews & Ratings', icon: '⭐', group: 'Conversion' },
    { slug: 'loyalty', name: 'Loyalty & Rewards', icon: '🎁', group: 'Conversion' },
    { slug: 'popups', name: 'Pop-ups & Banners', icon: '💬', group: 'Conversion' },
    { slug: 'trust-badges', name: 'Trust & Security', icon: '🛡️', group: 'Conversion' },

    // ── Store Design ──
    { slug: 'page-builders', name: 'Page Builders', icon: '🏗️', group: 'Design' },
    { slug: 'image-editing', name: 'Image & Media', icon: '🖼️', group: 'Design' },

    // ── Customer Support ──
    { slug: 'live-chat', name: 'Live Chat', icon: '💬', group: 'Support' },
    { slug: 'helpdesk', name: 'Help Desk & FAQ', icon: '🎧', group: 'Support' },
    { slug: 'crm', name: 'CRM', icon: '👥', group: 'Support' },

    // ── Analytics ──
    { slug: 'analytics', name: 'Analytics & Reports', icon: '📊', group: 'Analytics' },
    { slug: 'ab-testing', name: 'A/B Testing', icon: '🧪', group: 'Analytics' },

    // ── Finance ──
    { slug: 'accounting', name: 'Accounting & Tax', icon: '🧾', group: 'Finance' },
    { slug: 'invoicing', name: 'Invoicing', icon: '📄', group: 'Finance' },
];

export type AppCategorySlug = typeof APP_CATEGORIES[number]['slug'];
