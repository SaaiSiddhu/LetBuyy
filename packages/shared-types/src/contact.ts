import { z } from 'zod';

/**
 * Contact-request catalog — the single source of truth for the public contact
 * form.
 *
 * Three consumers read this file and they MUST agree:
 *   • apps/marketing/web  renders the dropdowns from it
 *   • services/api-gateway validates the submission against it and routes the
 *     lead to a team using it
 *   • the transactional emails print the human labels from it
 *
 * If the catalog lived in the form, the gateway would have to re-declare it and
 * the two would drift the first time somebody added a topic — the submitter
 * would pick "GST & compliance", the gateway would reject an unknown id, and
 * the lead would be lost. Hence one array, imported three ways.
 *
 * Nothing here is India-specific except INDIA_STATES and the GMV bands, which
 * are deliberately rupee-denominated.
 */

/* ─── Topics ──────────────────────────────────────────────────────────────── */

export interface ContactSubject {
    id: string;
    label: string;
}

export type ContactTeam =
    | 'sales'
    | 'support'
    | 'billing'
    | 'payments'
    | 'logistics'
    | 'compliance'
    | 'developers'
    | 'partnerships'
    | 'press'
    | 'careers'
    | 'trust_safety'
    | 'privacy';

export interface ContactTopic {
    id: string;
    label: string;
    /** One line under the topic card. Written for a merchant, not for us. */
    description: string;
    /** Which inbox owns the reply. Drives routing + the alert email subject. */
    team: ContactTeam;
    /**
     * Working hours we promise for a FIRST response at normal urgency. Urgency
     * shortens it (see resolveContactResponseHours) but never lengthens it.
     */
    responseHours: number;
    /** The "Subject" dropdown for this topic. Always ends with `other`. */
    subjects: ContactSubject[];
    /**
     * Extra question groups this topic unlocks. The form hides everything else
     * so a merchant reporting a down store is not asked about their budget.
     */
    reveals: ReadonlyArray<'business' | 'commerce' | 'order' | 'plan' | 'technical'>;
}

const OTHER_SUBJECT: ContactSubject = { id: 'other', label: 'Something else' };

export const CONTACT_TOPICS: readonly ContactTopic[] = [
    {
        id: 'sales',
        label: 'Sales & pricing',
        description: 'Plans, quotes, a demo, or moving a larger catalogue across.',
        team: 'sales',
        responseHours: 4,
        reveals: ['business', 'commerce', 'plan'],
        subjects: [
            { id: 'plan_advice', label: 'Which plan fits my business' },
            { id: 'custom_quote', label: 'Custom or high-volume quote' },
            { id: 'book_demo', label: 'Book a guided demo' },
            { id: 'migration', label: 'Migrate from Shopify, WooCommerce or another platform' },
            { id: 'founding_program', label: 'Founding merchant program' },
            { id: 'multi_store', label: 'Multiple stores or brands' },
            OTHER_SUBJECT,
        ],
    },
    {
        id: 'support',
        label: 'Merchant support',
        description: 'Something in your live store is not behaving as it should.',
        team: 'support',
        responseHours: 8,
        reveals: ['commerce', 'order', 'technical'],
        subjects: [
            { id: 'store_down', label: 'Store is down or unreachable' },
            { id: 'products', label: 'Products, variants or inventory' },
            { id: 'themes', label: 'Theme, design or storefront layout' },
            { id: 'domains', label: 'Custom domain or DNS' },
            { id: 'account_access', label: 'Cannot sign in to my store' },
            { id: 'onboarding', label: 'Setting up a new store' },
            OTHER_SUBJECT,
        ],
    },
    {
        id: 'billing',
        label: 'Billing & subscription',
        description: 'Invoices, plan changes, renewals and refunds on your LetBuyy plan.',
        team: 'billing',
        responseHours: 8,
        reveals: ['commerce', 'plan'],
        subjects: [
            { id: 'invoice', label: 'Invoice or receipt request' },
            { id: 'plan_change', label: 'Upgrade, downgrade or cancel' },
            { id: 'payment_failed', label: 'Subscription payment failed' },
            { id: 'refund', label: 'Refund on a plan charge' },
            { id: 'gst_details', label: 'Update GSTIN or billing details' },
            OTHER_SUBJECT,
        ],
    },
    {
        id: 'payments',
        label: 'Payments, payouts & settlements',
        description: 'UPI, cards, cash on delivery, settlement timing and payout accounts.',
        team: 'payments',
        responseHours: 4,
        reveals: ['commerce', 'order'],
        subjects: [
            { id: 'payout_delay', label: 'Payout has not arrived' },
            { id: 'settlement_mismatch', label: 'Settlement amount looks wrong' },
            { id: 'razorpay_setup', label: 'Connecting a payment provider' },
            { id: 'cod', label: 'Cash on delivery and COD reconciliation' },
            { id: 'customer_refund', label: 'Refunding a customer order' },
            { id: 'chargeback', label: 'Chargeback or disputed payment' },
            OTHER_SUBJECT,
        ],
    },
    {
        id: 'orders_shipping',
        label: 'Orders & shipping',
        description: 'Order lifecycle, courier pickups, tracking, returns and RTO.',
        team: 'logistics',
        responseHours: 8,
        reveals: ['commerce', 'order'],
        subjects: [
            { id: 'order_stuck', label: 'An order is stuck in a status' },
            { id: 'label_pickup', label: 'Shipping label or courier pickup' },
            { id: 'tracking', label: 'Tracking not updating' },
            { id: 'rates_zones', label: 'Shipping rates, zones or serviceability' },
            { id: 'returns', label: 'Returns, exchanges and RTO' },
            OTHER_SUBJECT,
        ],
    },
    {
        id: 'gst_compliance',
        label: 'GST & compliance',
        description: 'Tax rates, GST invoices, HSN codes and statutory reporting.',
        team: 'compliance',
        responseHours: 12,
        reveals: ['business', 'commerce'],
        subjects: [
            { id: 'gst_invoice', label: 'GST invoice format or correction' },
            { id: 'tax_rates', label: 'Tax rates and HSN codes' },
            { id: 'gstin', label: 'GSTIN verification' },
            { id: 'reporting', label: 'Reports for filing' },
            OTHER_SUBJECT,
        ],
    },
    {
        id: 'developers',
        label: 'Developers & API',
        description: 'REST and GraphQL APIs, webhooks, app extensions and themes.',
        team: 'developers',
        responseHours: 12,
        reveals: ['technical'],
        subjects: [
            { id: 'api_access', label: 'API keys and access' },
            { id: 'webhooks', label: 'Webhooks not firing or failing' },
            { id: 'rate_limits', label: 'Rate limits and quotas' },
            { id: 'app_build', label: 'Building an app or extension' },
            { id: 'theme_build', label: 'Building or publishing a theme' },
            { id: 'bug_report', label: 'Report an API bug' },
            OTHER_SUBJECT,
        ],
    },
    {
        id: 'partnerships',
        label: 'Partnerships & agencies',
        description: 'Agencies, resellers, technology partners and integrations.',
        team: 'partnerships',
        responseHours: 24,
        reveals: ['business', 'commerce'],
        subjects: [
            { id: 'agency', label: 'Agency or freelancer partnership' },
            { id: 'reseller', label: 'Reseller or referral programme' },
            { id: 'technology', label: 'Technology or logistics integration' },
            { id: 'marketplace_listing', label: 'List an app or theme with us' },
            OTHER_SUBJECT,
        ],
    },
    {
        id: 'press',
        label: 'Press & media',
        description: 'Interviews, brand assets, product facts and analyst briefings.',
        team: 'press',
        responseHours: 24,
        reveals: [],
        subjects: [
            { id: 'interview', label: 'Interview or comment request' },
            { id: 'brand_assets', label: 'Logos and brand assets' },
            { id: 'fact_check', label: 'Fact check a claim about LetBuyy' },
            OTHER_SUBJECT,
        ],
    },
    {
        id: 'careers',
        label: 'Careers',
        description: 'Roles, internships and open applications.',
        team: 'careers',
        responseHours: 48,
        reveals: [],
        subjects: [
            { id: 'open_role', label: 'A specific open role' },
            { id: 'open_application', label: 'Open application' },
            { id: 'internship', label: 'Internship' },
            OTHER_SUBJECT,
        ],
    },
    {
        id: 'trust_safety',
        label: 'Trust & safety',
        description: 'Report a store, counterfeit goods, fraud or platform abuse.',
        team: 'trust_safety',
        /* Deliberately the fastest promise on the list. An abuse report that
           sits for a day is a reputational and legal problem, not a ticket. */
        responseHours: 4,
        reveals: [],
        subjects: [
            { id: 'report_store', label: 'Report a store or listing' },
            { id: 'counterfeit', label: 'Counterfeit or IP infringement' },
            { id: 'fraud', label: 'Fraud or scam' },
            { id: 'security', label: 'Security vulnerability' },
            OTHER_SUBJECT,
        ],
    },
    {
        id: 'privacy',
        label: 'Data & privacy',
        description: 'DPDP requests, data export, deletion and the grievance officer.',
        team: 'privacy',
        responseHours: 24,
        reveals: [],
        subjects: [
            { id: 'data_access', label: 'Access a copy of my data' },
            { id: 'data_deletion', label: 'Delete my data' },
            { id: 'consent', label: 'Withdraw consent' },
            { id: 'grievance', label: 'Raise a grievance' },
            OTHER_SUBJECT,
        ],
    },
    {
        id: 'other',
        label: 'Something else',
        description: 'Not sure where it belongs? Start here and we will route it.',
        team: 'support',
        responseHours: 24,
        reveals: [],
        subjects: [{ id: 'general', label: 'General enquiry' }, OTHER_SUBJECT],
    },
] as const;

export const CONTACT_TOPIC_IDS = CONTACT_TOPICS.map((topic) => topic.id);

export function getContactTopic(id: string | null | undefined): ContactTopic | null {
    if (!id) return null;
    return CONTACT_TOPICS.find((topic) => topic.id === id) ?? null;
}

export function getContactSubject(
    topicId: string | null | undefined,
    subjectId: string | null | undefined,
): ContactSubject | null {
    const topic = getContactTopic(topicId);
    if (!topic || !subjectId) return null;
    return topic.subjects.find((subject) => subject.id === subjectId) ?? null;
}

/* ─── Urgency ─────────────────────────────────────────────────────────────── */

export interface ContactUrgency {
    id: string;
    label: string;
    description: string;
    /** Multiplier on the topic's promise. Never above 1 — urgency only speeds up. */
    factor: number;
}

export const CONTACT_URGENCIES: readonly ContactUrgency[] = [
    { id: 'low', label: 'Whenever suits', description: 'No deadline on my side.', factor: 1 },
    { id: 'normal', label: 'Normal', description: 'Standard response is fine.', factor: 1 },
    { id: 'high', label: 'Urgent', description: 'It is blocking work today.', factor: 0.5 },
    {
        id: 'critical',
        label: 'Store is down',
        description: 'Customers cannot buy right now.',
        factor: 0.25,
    },
] as const;

export const CONTACT_URGENCY_IDS = CONTACT_URGENCIES.map((level) => level.id);

/**
 * Working hours we commit to for a first response.
 *
 * Rounded UP to the hour and floored at one, so the number shown to a merchant
 * is one we can actually hit — never "0 hours", never a fraction.
 */
export function resolveContactResponseHours(
    topicId: string | null | undefined,
    urgencyId: string | null | undefined,
): number {
    const topic = getContactTopic(topicId);
    const base = topic?.responseHours ?? 24;
    const urgency = CONTACT_URGENCIES.find((level) => level.id === urgencyId);
    return Math.max(1, Math.ceil(base * (urgency?.factor ?? 1)));
}

/* ─── Working hours → wall clock ──────────────────────────────────────────── */

/** Hours in one working day. Everything that phrases a promise in days uses it. */
export const WORKING_DAY_HOURS = 8;

/* The support window, in IST. India observes no DST, so a fixed +05:30 is exact
   arithmetic rather than an approximation — no timezone database required in a
   Worker. Monday to Saturday, matching what the contact page tells people. */
const WORK_START_HOUR = 9;
const WORK_END_HOUR = WORK_START_HOUR + WORKING_DAY_HOURS; // 17:00 IST
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Convert a WORKING-hours promise into the actual instant it falls due.
 *
 * Every layer states the promise in working hours — the catalog, the form, the
 * acknowledgement email ("within 2 working days"). Storing `now + hours` in
 * calendar time silently contradicts all of them: a 48-working-hour reply filed
 * on Friday evening is due the following Friday, not Sunday. Since the stored
 * value is what the breach report sorts on AND what the submitter is shown by
 * the ticket lookup, the two must be the same number.
 *
 * Sundays are skipped; Saturday is a working day.
 */
export function addWorkingHours(hours: number, from: Date | number = Date.now()): Date {
    const startMs = typeof from === 'number' ? from : from.getTime();
    let remaining = Math.max(0, hours);

    // Shift into IST so the UTC getters below read as local wall-clock time.
    let cursor = new Date(startMs + IST_OFFSET_MS);

    const atHour = (date: Date, hour: number) => {
        const next = new Date(date.getTime());
        next.setUTCHours(hour, 0, 0, 0);
        return next;
    };
    const nextWorkingDayStart = (date: Date) => {
        let next = atHour(new Date(date.getTime() + DAY_MS), WORK_START_HOUR);
        // 0 = Sunday. Saturday (6) is a working day here.
        while (next.getUTCDay() === 0) next = atHour(new Date(next.getTime() + DAY_MS), WORK_START_HOUR);
        return next;
    };

    /* Bounded rather than `while (remaining > 0)`: the largest promise in the
       catalog is 48 hours, so a loop that has not converged in a few hundred
       iterations is a bug, and an infinite loop in a Worker is an outage. */
    for (let guard = 0; guard < 500 && remaining > 0; guard += 1) {
        if (cursor.getUTCDay() === 0) {
            cursor = nextWorkingDayStart(new Date(cursor.getTime() - DAY_MS));
            continue;
        }

        const dayStart = atHour(cursor, WORK_START_HOUR);
        const dayEnd = atHour(cursor, WORK_END_HOUR);

        if (cursor < dayStart) cursor = dayStart;
        if (cursor >= dayEnd) {
            cursor = nextWorkingDayStart(cursor);
            continue;
        }

        const availableHours = (dayEnd.getTime() - cursor.getTime()) / HOUR_MS;
        if (remaining <= availableHours) {
            cursor = new Date(cursor.getTime() + remaining * HOUR_MS);
            remaining = 0;
            break;
        }

        remaining -= availableHours;
        cursor = nextWorkingDayStart(cursor);
    }

    return new Date(cursor.getTime() - IST_OFFSET_MS);
}

/**
 * The promise in words. Shared so the email, the success screen and the ticket
 * lookup cannot describe the same number three different ways.
 */
export function describeResponseHours(hours: number): string {
    if (hours <= 1) return 'within the hour';
    if (hours < WORKING_DAY_HOURS + 1) return `within ${hours} working hours`;
    const days = Math.max(1, Math.round(hours / WORKING_DAY_HOURS));
    return days === 1 ? 'within one working day' : `within ${days} working days`;
}

/* ─── Reply preferences ───────────────────────────────────────────────────── */

export const CONTACT_CHANNELS = [
    { id: 'email', label: 'Email' },
    { id: 'phone', label: 'Phone call' },
    { id: 'whatsapp', label: 'WhatsApp' },
] as const;

export const CONTACT_CHANNEL_IDS = CONTACT_CHANNELS.map((channel) => channel.id);

/** Languages we answer in. Kept in step with the marketing-site locale registry. */
export const CONTACT_LANGUAGES = [
    { id: 'en', label: 'English' },
    { id: 'hi', label: 'हिन्दी / Hindi' },
    { id: 'ta', label: 'தமிழ் / Tamil' },
] as const;

export const CONTACT_LANGUAGE_IDS = CONTACT_LANGUAGES.map((language) => language.id);

/** IST windows. A prospect picking "morning" means their morning, in India. */
export const CONTACT_TIME_WINDOWS = [
    { id: 'any', label: 'Any time' },
    { id: 'morning', label: 'Morning (9am – 12pm IST)' },
    { id: 'afternoon', label: 'Afternoon (12pm – 4pm IST)' },
    { id: 'evening', label: 'Evening (4pm – 8pm IST)' },
] as const;

export const CONTACT_TIME_WINDOW_IDS = CONTACT_TIME_WINDOWS.map((window) => window.id);

/* ─── Business context ────────────────────────────────────────────────────── */

export const CONTACT_RELATIONSHIPS = [
    { id: 'prospect', label: 'I am exploring LetBuyy' },
    { id: 'merchant', label: 'I already sell on LetBuyy' },
    { id: 'developer', label: 'I am a developer or partner' },
    { id: 'agency', label: 'I run an agency' },
    { id: 'shopper', label: 'I bought from a LetBuyy store' },
    { id: 'other', label: 'Something else' },
] as const;

export const CONTACT_RELATIONSHIP_IDS = CONTACT_RELATIONSHIPS.map((entry) => entry.id);

export const CONTACT_BUSINESS_TYPES = [
    'Fashion & apparel',
    'Jewellery & accessories',
    'Beauty & personal care',
    'Electronics',
    'Home & furniture',
    'Grocery & food',
    'Health & wellness',
    'Sports & fitness',
    'Books & stationery',
    'Handmade & crafts',
    'Digital products',
    'Services',
    'Other',
] as const;

export const CONTACT_CURRENT_CHANNELS = [
    'Not selling online yet',
    'Instagram',
    'WhatsApp',
    'Own website',
    'Shopify',
    'WooCommerce',
    'Amazon or Flipkart',
    'Offline store only',
    'Other',
] as const;

export const CONTACT_ORDER_BANDS = [
    'Not selling yet',
    'Under 50 a month',
    '50 – 250 a month',
    '250 – 1,000 a month',
    '1,000 – 5,000 a month',
    'Over 5,000 a month',
] as const;

export const CONTACT_GMV_BANDS = [
    'Not selling yet',
    'Under ₹50,000',
    '₹50,000 – ₹2 lakh',
    '₹2 lakh – ₹10 lakh',
    '₹10 lakh – ₹50 lakh',
    'Over ₹50 lakh',
] as const;

export const CONTACT_TIMELINES = [
    { id: 'now', label: 'Ready now' },
    { id: 'this_month', label: 'Within a month' },
    { id: 'this_quarter', label: 'Within three months' },
    { id: 'exploring', label: 'Just exploring' },
] as const;

export const CONTACT_TIMELINE_IDS = CONTACT_TIMELINES.map((entry) => entry.id);

export const CONTACT_HEARD_ABOUT = [
    'Google search',
    'Instagram',
    'YouTube',
    'X (Twitter)',
    'LinkedIn',
    'WhatsApp group',
    'A friend or colleague',
    'An agency or developer',
    'News or a blog',
    'Other',
] as const;

/** States and union territories, for a GST-aware India-first form. */
export const INDIA_STATES = [
    'Andaman and Nicobar Islands',
    'Andhra Pradesh',
    'Arunachal Pradesh',
    'Assam',
    'Bihar',
    'Chandigarh',
    'Chhattisgarh',
    'Dadra and Nagar Haveli and Daman and Diu',
    'Delhi',
    'Goa',
    'Gujarat',
    'Haryana',
    'Himachal Pradesh',
    'Jammu and Kashmir',
    'Jharkhand',
    'Karnataka',
    'Kerala',
    'Ladakh',
    'Lakshadweep',
    'Madhya Pradesh',
    'Maharashtra',
    'Manipur',
    'Meghalaya',
    'Mizoram',
    'Nagaland',
    'Odisha',
    'Puducherry',
    'Punjab',
    'Rajasthan',
    'Sikkim',
    'Tamil Nadu',
    'Telangana',
    'Tripura',
    'Uttar Pradesh',
    'Uttarakhand',
    'West Bengal',
] as const;

/* ─── Lead scoring ────────────────────────────────────────────────────────── */

export type ContactLeadBand = 'hot' | 'warm' | 'standard';

export interface ContactLeadSignals {
    topicId?: string | null;
    urgencyId?: string | null;
    relationship?: string | null;
    monthlyOrders?: string | null;
    monthlyGmv?: string | null;
    timeline?: string | null;
    interestedPlan?: string | null;
    companyName?: string | null;
    websiteUrl?: string | null;
    messageLength?: number;
}

/**
 * A 0–100 triage score, computed at the gateway and stamped on the row.
 *
 * It exists so the team's inbox can be sorted without opening every message,
 * and so the alert email can lead with "hot lead" rather than burying it. It is
 * deliberately transparent arithmetic rather than a model: whoever reads the
 * number has to be able to argue with it.
 */
export function scoreContactLead(signals: ContactLeadSignals): {
    score: number;
    band: ContactLeadBand;
} {
    let score = 0;

    // Intent to buy is worth more than any other single signal.
    if (signals.topicId === 'sales') score += 25;
    else if (signals.topicId === 'partnerships') score += 15;
    else if (signals.topicId === 'payments' || signals.topicId === 'billing') score += 10;

    // An existing merchant in trouble is as important as a new deal.
    if (signals.relationship === 'merchant') score += 15;
    else if (signals.relationship === 'agency') score += 12;
    else if (signals.relationship === 'developer') score += 6;

    if (signals.urgencyId === 'critical') score += 20;
    else if (signals.urgencyId === 'high') score += 10;

    // Scale bands: the top two are where a single account changes the quarter.
    const gmvIndex = CONTACT_GMV_BANDS.indexOf(
        (signals.monthlyGmv ?? '') as (typeof CONTACT_GMV_BANDS)[number],
    );
    if (gmvIndex >= 4) score += 20;
    else if (gmvIndex === 3) score += 12;
    else if (gmvIndex === 2) score += 6;

    const orderIndex = CONTACT_ORDER_BANDS.indexOf(
        (signals.monthlyOrders ?? '') as (typeof CONTACT_ORDER_BANDS)[number],
    );
    if (orderIndex >= 4) score += 10;
    else if (orderIndex === 3) score += 6;

    if (signals.timeline === 'now') score += 10;
    else if (signals.timeline === 'this_month') score += 6;

    if (signals.interestedPlan) score += 4;
    if (signals.companyName) score += 3;
    if (signals.websiteUrl) score += 3;
    // A long message is effort, and effort correlates with intent.
    if ((signals.messageLength ?? 0) >= 240) score += 4;

    const bounded = Math.max(0, Math.min(100, score));
    const band: ContactLeadBand = bounded >= 60 ? 'hot' : bounded >= 35 ? 'warm' : 'standard';
    return { score: bounded, band };
}

/* ─── Submission contract ─────────────────────────────────────────────────── */

/**
 * Field caps. Generous for a person, hostile to a script — and identical on
 * both sides of the wire, so the form can show a counter that matches exactly
 * what the gateway will accept.
 */
export const CONTACT_LIMITS = {
    name: 120,
    email: 254,
    phone: 24,
    company: 160,
    url: 400,
    subjectText: 160,
    message: 4000,
    messageMin: 20,
    shortChoice: 80,
    reference: 120,
    city: 80,
    gstin: 15,
    listLength: 12,
} as const;

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
    trimmed(max)
        .optional()
        .transform((value) => (value ? value : null))
        .nullable();

/**
 * What the browser is allowed to post.
 *
 * `turnstile_token` is intentionally NOT part of it: bot verification happens
 * before parsing, so a body that fails the challenge never reaches this schema.
 */
export const ContactRequestSubmissionSchema = z.object({
    full_name: trimmed(CONTACT_LIMITS.name).min(2, 'Please tell us your name'),
    email: trimmed(CONTACT_LIMITS.email).email('That email address does not look right').toLowerCase(),
    phone: trimmed(CONTACT_LIMITS.phone).min(6, 'Please add a phone number we can reach you on'),
    phone_country_code: optionalText(8),

    relationship: z.enum(CONTACT_RELATIONSHIP_IDS as [string, ...string[]]).default('prospect'),
    company_name: optionalText(CONTACT_LIMITS.company),
    website_url: optionalText(CONTACT_LIMITS.url),
    store_subdomain: optionalText(CONTACT_LIMITS.shortChoice),
    gstin: optionalText(CONTACT_LIMITS.gstin),
    city: optionalText(CONTACT_LIMITS.city),
    state: optionalText(CONTACT_LIMITS.shortChoice),

    business_type: optionalText(CONTACT_LIMITS.shortChoice),
    current_channel: optionalText(CONTACT_LIMITS.shortChoice),
    monthly_orders: optionalText(CONTACT_LIMITS.shortChoice),
    monthly_gmv_band: optionalText(CONTACT_LIMITS.shortChoice),
    interested_plan: optionalText(CONTACT_LIMITS.shortChoice),
    timeline: optionalText(CONTACT_LIMITS.shortChoice),

    topic: z.enum(CONTACT_TOPIC_IDS as [string, ...string[]]),
    subject_id: trimmed(CONTACT_LIMITS.shortChoice).min(1, 'Please choose a subject'),
    subject_text: optionalText(CONTACT_LIMITS.subjectText),
    message: trimmed(CONTACT_LIMITS.message).min(
        CONTACT_LIMITS.messageMin,
        'A little more detail helps us answer properly',
    ),
    urgency: z.enum(CONTACT_URGENCY_IDS as [string, ...string[]]).default('normal'),
    order_reference: optionalText(CONTACT_LIMITS.reference),

    preferred_channel: z.enum(CONTACT_CHANNEL_IDS as [string, ...string[]]).default('email'),
    preferred_language: z.enum(CONTACT_LANGUAGE_IDS as [string, ...string[]]).default('en'),
    preferred_time_window: z.enum(CONTACT_TIME_WINDOW_IDS as [string, ...string[]]).default('any'),

    heard_about_us: optionalText(CONTACT_LIMITS.shortChoice),
    /* The privacy notice must be accepted, and it must be accepted by an act —
       hence a literal true rather than a coerced boolean. */
    consent_privacy: z.literal(true),
    consent_marketing: z.boolean().default(false),

    /** Client-generated, so a double-click returns the first ticket instead of opening two. */
    client_token: trimmed(64).min(8),
    locale: optionalText(16),
    source_path: optionalText(CONTACT_LIMITS.url),
    referrer: optionalText(CONTACT_LIMITS.url),
    utm: z.record(z.string(), z.string().max(200)).default({}),
});

export type ContactRequestSubmission = z.infer<typeof ContactRequestSubmissionSchema>;

/** Cross-field rules the flat schema cannot express. */
export function validateContactSubmission(input: ContactRequestSubmission): string | null {
    const topic = getContactTopic(input.topic);
    if (!topic) return 'Choose what your message is about';

    if (!topic.subjects.some((subject) => subject.id === input.subject_id)) {
        return 'Choose a subject that matches your topic';
    }
    // "Something else" is only meaningful with a line of their own words.
    if (input.subject_id === 'other' && !input.subject_text) {
        return 'Add a short subject line so we know what to expect';
    }
    return null;
}

/** The line the confirmation email and the ticket header both print. */
export function resolveContactSubjectLine(input: {
    topic: string;
    subject_id: string;
    subject_text?: string | null;
}): string {
    if (input.subject_text) return input.subject_text;
    return getContactSubject(input.topic, input.subject_id)?.label
        ?? getContactTopic(input.topic)?.label
        ?? 'Enquiry';
}

/** What the gateway returns and the success screen renders. */
export interface ContactRequestReceipt {
    /** Human ticket reference, e.g. LB-2608-000142. This is what people quote. */
    ticket_ref: string;
    topic: string;
    subject_line: string;
    /** Working hours, from resolveContactResponseHours. */
    response_hours: number;
    team: ContactTeam;
    /** True when this token had already been submitted — same ticket, not a new one. */
    duplicate: boolean;
}
