import { Hono } from 'hono';
import type { Env } from '../index';
import { getSupabaseAdmin, success, failureBody } from '../lib/supabase';
import { extractTurnstileToken, verifyTurnstileToken } from '../middleware/security';
import { sendResendEmail } from '@letbuyy/infrastructure/resend-adapter';
import {
    buildDemoConfirmationEmail,
    buildDemoLeadAlertEmail,
    type DemoRequestSummary,
} from '../lib/demo-request-email';
import { buildDemoCalendar } from '../lib/demo-request-calendar';

/**
 * PUBLIC demo-request intake. Mounted BEFORE the auth middleware — the
 * submitter is a prospect with no account, so there is no session to check.
 *
 * That makes this one of the very few unauthenticated writes in the gateway,
 * so it is defended in depth:
 *   1. Turnstile verified before anything touches the database
 *   2. every field validated and length-capped here, not trusted from the form
 *   3. the IP is hashed before storage, never kept raw
 *   4. a repeat submitter with an open request UPDATES it rather than
 *      inserting again — enforced by a unique partial index, so two
 *      simultaneous posts cannot both create a row
 *
 * Email is best-effort and deliberately AFTER the row is committed: a Resend
 * outage must not lose a lead.
 */

const router = new Hono<{ Bindings: Env }>();

/* Caps are generous for a human and hostile to a script. Anything longer is
   truncated rather than rejected — a prospect who pastes a long paragraph
   should not lose their submission over it. */
const LIMITS = {
    name: 120,
    email: 254,
    phone: 32,
    company: 160,
    url: 400,
    shortChoice: 64,
    freeText: 2000,
    listItem: 64,
    listLength: 12,
} as const;

type Json = Record<string, unknown>;

function str(value: unknown, max: number): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, max);
}

function strList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.trim())
        .filter(Boolean)
        .slice(0, LIMITS.listLength)
        .map(item => item.slice(0, LIMITS.listItem));
}

const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Hash the IP with the service-role key as salt.
 *
 * The raw address is personal data with no operational use here — an operator
 * only needs to know "was this the same source", which a stable hash answers.
 * Salting with a secret means the table alone cannot be rainbow-tabled back to
 * addresses.
 */
async function hashIp(ip: string | null, salt: string): Promise<string | null> {
    if (!ip) return null;
    const data = new TextEncoder().encode(`${salt}:${ip}`);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
        .slice(0, 16)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/** ISO instant in a sane window, or null. Never trust a client clock. */
function parseSlot(value: unknown): string | null {
    const raw = str(value, 40);
    if (!raw) return null;
    const at = new Date(raw);
    if (Number.isNaN(at.getTime())) return null;

    const now = Date.now();
    // Past slots and slots more than a year out are both nonsense.
    if (at.getTime() < now - 60 * 60 * 1000) return null;
    if (at.getTime() > now + 365 * 24 * 60 * 60 * 1000) return null;
    return at.toISOString();
}

/** IANA zone, validated by asking Intl rather than by pattern-matching. */
function parseTimezone(value: unknown): string | null {
    const zone = str(value, 64);
    if (!zone) return null;
    try {
        new Intl.DateTimeFormat('en', { timeZone: zone });
        return zone;
    } catch {
        return null;
    }
}

router.post('/demo-requests', async (c) => {
    let body: Json;
    try {
        body = (await c.req.json()) as Json;
    } catch {
        return c.json(failureBody('INVALID_BODY', 'Expected a JSON body'), 400);
    }

    // ── Bot check, before any database work ─────────────────────────────────
    const ip =
        c.req.header('cf-connecting-ip') ??
        c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
        null;
    const passedTurnstile = await verifyTurnstileToken(
        c.env,
        extractTurnstileToken(body),
        ip ?? undefined,
    );
    if (!passedTurnstile) {
        return c.json(failureBody('VERIFICATION_FAILED', 'Could not verify this request'), 403);
    }

    // ── Required fields ─────────────────────────────────────────────────────
    const fullName = str(body.full_name ?? body.fullName, LIMITS.name);
    const email = str(body.email, LIMITS.email)?.toLowerCase() ?? null;
    const phone = str(body.phone, LIMITS.phone);

    const missing: string[] = [];
    if (!fullName) missing.push('full_name');
    if (!email) missing.push('email');
    if (!phone) missing.push('phone');
    if (missing.length) {
        return c.json(
            failureBody('MISSING_FIELDS', `Required: ${missing.join(', ')}`),
            400,
        );
    }
    if (!EMAIL_SHAPE.test(email!)) {
        return c.json(failureBody('INVALID_EMAIL', 'That email address does not look right'), 400);
    }

    const record = {
        full_name: fullName!,
        email: email!,
        phone: phone!,
        company_name: str(body.company_name ?? body.companyName, LIMITS.company),
        website_url: str(body.website_url ?? body.websiteUrl, LIMITS.url),
        business_type: str(body.business_type ?? body.businessType, LIMITS.shortChoice),
        current_channel: str(body.current_channel ?? body.currentChannel, LIMITS.shortChoice),
        monthly_orders: str(body.monthly_orders ?? body.monthlyOrders, LIMITS.shortChoice),
        monthly_gmv_band: str(body.monthly_gmv_band ?? body.monthlyGmvBand, LIMITS.shortChoice),
        product_categories: strList(body.product_categories ?? body.productCategories),
        interested_plan: str(body.interested_plan ?? body.interestedPlan, LIMITS.shortChoice),
        goals: strList(body.goals),
        why_letbuyy: str(body.why_letbuyy ?? body.whyLetbuyy, LIMITS.freeText),
        heard_about_us: str(body.heard_about_us ?? body.heardAboutUs, LIMITS.shortChoice),
        heard_about_detail: str(body.heard_about_detail ?? body.heardAboutDetail, LIMITS.shortChoice),
        preferred_at: parseSlot(body.preferred_at ?? body.preferredAt),
        preferred_timezone: parseTimezone(body.preferred_timezone ?? body.preferredTimezone),
        preferred_language: str(body.preferred_language ?? body.preferredLanguage, 8) ?? 'en',
        locale: str(body.locale, 16),
        source_path: str(body.source_path ?? body.sourcePath, LIMITS.url),
        utm: typeof body.utm === 'object' && body.utm !== null ? body.utm : {},
        ip_hash: await hashIp(ip, c.env.SUPABASE_SERVICE_ROLE_KEY ?? 'letbuyy'),
        user_agent: str(c.req.header('user-agent'), 400),
        status: 'new' as const,
    };

    const db = getSupabaseAdmin(c);

    /* Insert, then treat a unique violation as "they already have an open
       request" and update it instead.

       Not .upsert(): the dedupe index is PARTIAL and on an EXPRESSION —
       UNIQUE (lower(email)) WHERE status IN (...) — and PostgREST's on_conflict
       only accepts plain column names, so it could never target that index.
       Insert-then-catch is what actually works, and the race is still closed by
       the index rather than by application timing. */
    const inserted = await db.from('demo_requests').insert(record).select('id').single();

    if (!inserted.error && inserted.data) {
        await dispatchEmails(c.env, { ...record, id: inserted.data.id });
        return c.json(success({ id: inserted.data.id, deduplicated: false }), 201);
    }

    const UNIQUE_VIOLATION = '23505';
    if (inserted.error?.code !== UNIQUE_VIOLATION) {
        return c.json(failureBody('SAVE_FAILED', 'Could not save your request'), 500);
    }

    /* Refresh the open request with the newer answers. From the submitter's
       side this is a success — their request is on file — so it must not
       surface as an error. */
    const refreshed = await db
        .from('demo_requests')
        .update(record)
        .eq('email', record.email)
        .in('status', ['new', 'contacted', 'scheduled'])
        .select('id')
        .maybeSingle();

    if (!refreshed.data) {
        return c.json(failureBody('SAVE_FAILED', 'Could not save your request'), 500);
    }

    await dispatchEmails(c.env, { ...record, id: refreshed.data.id });
    return c.json(success({ id: refreshed.data.id, deduplicated: true }), 200);
});

/**
 * Both emails, best-effort.
 *
 * Never throws: the row is already committed, and a Resend failure must not
 * turn a captured lead into a 500 that prompts the prospect to submit again.
 */
async function dispatchEmails(
    env: Env,
    row: Record<string, unknown> & { id: string },
): Promise<void> {
    /* The demo form has its own Resend key. Falling back to the shared one is
       deliberate but secondary — if the dedicated key is unset in an
       environment the form still works, rather than silently dropping leads. */
    const apiKey = env.DEMO_RESEND_API_KEY || env.RESEND_API_KEY;
    const configured =
        apiKey &&
        !apiKey.toLowerCase().includes('placeholder') &&
        !apiKey.toLowerCase().includes('skip_needs_human');
    if (!configured) return;

    const summary: DemoRequestSummary = {
        id: row.id,
        fullName: String(row.full_name ?? ''),
        email: String(row.email ?? ''),
        phone: String(row.phone ?? ''),
        companyName: (row.company_name as string) ?? null,
        websiteUrl: (row.website_url as string) ?? null,
        businessType: (row.business_type as string) ?? null,
        currentChannel: (row.current_channel as string) ?? null,
        monthlyOrders: (row.monthly_orders as string) ?? null,
        monthlyGmvBand: (row.monthly_gmv_band as string) ?? null,
        productCategories: (row.product_categories as string[]) ?? [],
        interestedPlan: (row.interested_plan as string) ?? null,
        goals: (row.goals as string[]) ?? [],
        whyLetbuyy: (row.why_letbuyy as string) ?? null,
        heardAboutUs: (row.heard_about_us as string) ?? null,
        heardAboutDetail: (row.heard_about_detail as string) ?? null,
        preferredAt: (row.preferred_at as string) ?? null,
        preferredTimezone: (row.preferred_timezone as string) ?? null,
        preferredLanguage: String(row.preferred_language ?? 'en'),
        locale: (row.locale as string) ?? null,
    };

    const stripSlash = (value: string) => value.replace(/\/+$/, '');
    const brand = {
        siteUrl: stripSlash(env.MARKETING_SITE_URL || 'https://letbuyy.com'),
        /* Images must resolve from a mail client, which is not on this network.
           MARKETING_SITE_URL is localhost on a dev machine, and an <img>
           pointing there renders as a broken-image box in the inbox — which is
           exactly what happened. EMAIL_ASSET_BASE_URL therefore defaults to the
           public origin and is only overridden for a CDN. */
        assetUrl: stripSlash(env.EMAIL_ASSET_BASE_URL || 'https://letbuyy.com'),
        /* Where the calendar invite is served from. Same reasoning as assetUrl:
           the link is followed from a mail client, so it cannot be localhost. */
        apiUrl: stripSlash(env.PUBLIC_API_BASE_URL || 'https://api.letbuyy.com/v1'),
        supportEmail: env.SUPPORT_EMAIL || 'support@letbuyy.com',
    };
    const from = env.DEMO_RESEND_FROM_EMAIL || env.RESEND_FROM_EMAIL || 'LetBuyy <noreply@letbuyy.com>';

    const confirmation = buildDemoConfirmationEmail(summary, brand);
    const alertTo = env.DEMO_REQUEST_NOTIFY_EMAIL || brand.supportEmail;
    const alert = buildDemoLeadAlertEmail(summary, brand, alertTo);

    await Promise.allSettled(
        [confirmation, alert]
            .filter((message): message is NonNullable<typeof message> => Boolean(message))
            .map(message => sendResendEmail({ apiKey, from, ...message })),
    );
}

/**
 * Calendar invite for a booked demo.
 *
 * Public but unguessable: the id is a v4 UUID, which is the same protection an
 * unsubscribe or magic link relies on. It returns only the time and the agenda
 * — no phone number, no email, none of the business answers — so a leaked link
 * exposes nothing beyond "a demo is booked at this time".
 */
router.get('/demo-requests/:id/calendar.ics', async (c) => {
    const id = c.req.param('id');
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
        return c.json(failureBody('INVALID_ID', 'Not a valid request id'), 400);
    }

    const db = getSupabaseAdmin(c);
    const { data } = await db
        .from('demo_requests')
        .select('id, full_name, preferred_at')
        .eq('id', id)
        .maybeSingle();

    if (!data?.preferred_at) {
        return c.json(failureBody('NOT_FOUND', 'No scheduled demo for that reference'), 404);
    }

    const ics = buildDemoCalendar({
        id: data.id,
        fullName: data.full_name,
        preferredAt: data.preferred_at,
        supportEmail: c.env.SUPPORT_EMAIL || 'support@letbuyy.com',
        /* Public origin, not MARKETING_SITE_URL. An .ics is a file the
           recipient keeps — a localhost URL inside it is dead the moment it
           leaves this machine, exactly like the logo src was. */
        siteUrl: (c.env.EMAIL_ASSET_BASE_URL || 'https://letbuyy.com').replace(/\/+$/, ''),
    });

    if (!ics) return c.json(failureBody('NOT_FOUND', 'No scheduled demo for that reference'), 404);

    return new Response(ics, {
        headers: {
            'content-type': 'text/calendar; charset=utf-8',
            'content-disposition': 'attachment; filename="letbuyy-demo.ics"',
            'cache-control': 'private, max-age=300',
        },
    });
});

export default router;
