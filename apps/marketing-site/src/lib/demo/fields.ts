/**
 * Demo-form option taxonomy.
 *
 * Single source for the choices the form offers. The gateway stores whatever
 * string arrives (length-capped), so these values ARE the analytics dimension —
 * changing a label later without a data migration silently splits a segment in
 * two. Values are therefore stable slugs and labels are free to change.
 *
 * The bands are chosen to be answerable without looking anything up. A seller
 * knows roughly how many orders a month they do; asking for an exact figure
 * gets a blank field or a made-up number.
 */

export interface Choice {
    value: string
    label: string
    hint?: string
}

export const BUSINESS_TYPES: Choice[] = [
    { value: 'brand', label: 'Own brand / D2C' },
    { value: 'reseller', label: 'Reseller or distributor' },
    { value: 'manufacturer', label: 'Manufacturer' },
    { value: 'retail_store', label: 'Physical shop going online' },
    { value: 'creator', label: 'Creator or influencer' },
    { value: 'services', label: 'Services business' },
    { value: 'agency', label: 'Agency building for clients' },
    { value: 'other', label: 'Something else' },
]

export const CURRENT_CHANNELS: Choice[] = [
    { value: 'not_selling', label: 'Not selling online yet' },
    { value: 'whatsapp_instagram', label: 'WhatsApp / Instagram DMs' },
    { value: 'marketplace', label: 'Amazon, Flipkart or Meesho' },
    { value: 'shopify', label: 'Shopify' },
    { value: 'woocommerce', label: 'WooCommerce or WordPress' },
    { value: 'wix_squarespace', label: 'Wix or Squarespace' },
    { value: 'dukaan_instamojo', label: 'Dukaan, Instamojo or similar' },
    { value: 'custom_build', label: 'A custom-built site' },
    { value: 'offline_only', label: 'Offline only' },
]

export const MONTHLY_ORDERS: Choice[] = [
    { value: 'pre_launch', label: 'Not launched yet' },
    { value: 'under_50', label: 'Under 50' },
    { value: '50_250', label: '50 – 250' },
    { value: '250_1000', label: '250 – 1,000' },
    { value: '1000_5000', label: '1,000 – 5,000' },
    { value: 'over_5000', label: 'Over 5,000' },
]

export const GMV_BANDS: Choice[] = [
    { value: 'pre_revenue', label: 'Pre-revenue' },
    { value: 'under_1l', label: 'Under ₹1 lakh' },
    { value: '1l_5l', label: '₹1 – 5 lakh' },
    { value: '5l_25l', label: '₹5 – 25 lakh' },
    { value: '25l_1cr', label: '₹25 lakh – 1 crore' },
    { value: 'over_1cr', label: 'Over ₹1 crore' },
    { value: 'prefer_not', label: 'Prefer not to say' },
]

export const PRODUCT_CATEGORIES: Choice[] = [
    { value: 'fashion', label: 'Fashion & apparel' },
    { value: 'beauty', label: 'Beauty & personal care' },
    { value: 'jewellery', label: 'Jewellery & accessories' },
    { value: 'home', label: 'Home & living' },
    { value: 'electronics', label: 'Electronics' },
    { value: 'grocery', label: 'Grocery & food' },
    { value: 'health', label: 'Health & wellness' },
    { value: 'handmade', label: 'Handmade & craft' },
    { value: 'digital', label: 'Digital products' },
    { value: 'services', label: 'Services' },
    { value: 'other', label: 'Other' },
]

export const PLANS: Choice[] = [
    { value: 'not_sure', label: 'Not sure yet', hint: 'We will recommend one on the call' },
    { value: 'starter', label: 'Starter', hint: 'Getting the first orders in' },
    { value: 'growth', label: 'Growth', hint: 'Scaling a working store' },
    { value: 'business', label: 'Business', hint: 'Higher volume and team access' },
    { value: 'enterprise', label: 'Enterprise', hint: 'Custom terms and support' },
]

export const GOALS: Choice[] = [
    { value: 'launch_fast', label: 'Launch quickly' },
    { value: 'cut_fees', label: 'Stop paying commission' },
    { value: 'own_brand', label: 'Own my storefront and customers' },
    { value: 'cod_upi', label: 'Take COD and UPI properly' },
    { value: 'gst_compliance', label: 'Get GST invoicing right' },
    { value: 'migrate', label: 'Migrate off my current platform' },
    { value: 'scale_ops', label: 'Handle more orders without more staff' },
    { value: 'whatsapp_selling', label: 'Sell on WhatsApp' },
    { value: 'b2b', label: 'Sell wholesale / B2B' },
    { value: 'international', label: 'Sell outside India' },
]

export const HEARD_ABOUT: Choice[] = [
    { value: 'google', label: 'Google search' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'youtube', label: 'YouTube' },
    { value: 'x', label: 'X' },
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'whatsapp', label: 'WhatsApp group' },
    { value: 'friend', label: 'A friend or colleague' },
    { value: 'existing_merchant', label: 'An existing LetBuyy merchant' },
    { value: 'event', label: 'An event or meetup' },
    { value: 'news', label: 'News or a blog' },
    { value: 'other', label: 'Somewhere else' },
]

/** Heard-about values that warrant a follow-up "where exactly?" field. */
export const HEARD_ABOUT_NEEDS_DETAIL = new Set(['friend', 'existing_merchant', 'event', 'news', 'other'])

export const CONTACT_LANGUAGES: Choice[] = [
    { value: 'en', label: 'English' },
    { value: 'hi', label: 'हिन्दी' },
    { value: 'ta', label: 'தமிழ்' },
]

/**
 * Bookable slots.
 *
 * Working hours in IST, on the half hour, weekdays only, starting tomorrow.
 * Generated rather than listed so the form never offers a slot in the past —
 * a hardcoded list goes stale the day after it is written.
 */
export interface SlotDay {
    /** yyyy-mm-dd in IST. */
    date: string
    label: string
    weekday: string
}

const IST_OFFSET_MINUTES = 5 * 60 + 30

function istParts(date: Date) {
    const shifted = new Date(date.getTime() + IST_OFFSET_MINUTES * 60_000)
    return {
        y: shifted.getUTCFullYear(),
        m: shifted.getUTCMonth(),
        d: shifted.getUTCDate(),
        weekday: shifted.getUTCDay(),
    }
}

export function nextBookableDays(count = 10, from: Date = new Date()): SlotDay[] {
    const days: SlotDay[] = []
    const cursor = new Date(from.getTime())
    // Start tomorrow: same-day demos cannot realistically be staffed.
    cursor.setUTCDate(cursor.getUTCDate() + 1)

    while (days.length < count) {
        const { y, m, d, weekday } = istParts(cursor)
        if (weekday !== 0 && weekday !== 6) {
            const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            const display = new Date(Date.UTC(y, m, d))
            days.push({
                date: iso,
                label: new Intl.DateTimeFormat('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    timeZone: 'UTC',
                }).format(display),
                weekday: new Intl.DateTimeFormat('en-IN', {
                    weekday: 'short',
                    timeZone: 'UTC',
                }).format(display),
            })
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    return days
}

/** 10:00 → 18:00 IST on the half hour. */
export const SLOT_TIMES: string[] = Array.from({ length: 17 }, (_, i) => {
    const minutes = 10 * 60 + i * 30
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
})

/**
 * Combine an IST date and time into a real instant.
 *
 * Built by subtracting the IST offset from a UTC-constructed date rather than
 * by string parsing: `new Date('2026-08-05T10:00')` is interpreted in the
 * BROWSER's zone, so a submitter in Dubai would book a different moment than
 * the one they clicked.
 */
export function istSlotToIso(date: string, time: string): string | null {
    const [y, m, d] = date.split('-').map(Number)
    const [hh, mm] = time.split(':').map(Number)
    if ([y, m, d, hh, mm].some(n => !Number.isFinite(n))) return null
    const utcMs = Date.UTC(y, m - 1, d, hh, mm) - IST_OFFSET_MINUTES * 60_000
    return new Date(utcMs).toISOString()
}
