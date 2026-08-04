import { Hono } from 'hono';
import type { Env } from '../index';
import { getSupabaseAdmin, success, failureBody } from '../lib/supabase';
import { extractTurnstileToken, verifyTurnstileToken } from '../middleware/security';
import { rateLimit } from '../middleware/rateLimit';
import { sendResendEmail } from '@letbuyy/infrastructure/resend-adapter';
import {
    ContactRequestSubmissionSchema,
    addWorkingHours,
    getContactTopic,
    resolveContactResponseHours,
    resolveContactSubjectLine,
    scoreContactLead,
    validateContactSubmission,
    type ContactRequestReceipt,
    type ContactTeam,
} from '@letbuyy/shared-types';
import {
    buildContactAcknowledgementEmail,
    buildContactTeamAlertEmail,
    type ContactRequestSummary,
} from '../lib/contact-request-email';

/**
 * PUBLIC contact-form intake and ticket lookup.
 *
 * Mounted BEFORE the auth middleware: most people writing in have no account,
 * so there is no session to check. That makes this one of the very few
 * unauthenticated writes in the gateway, and it is defended in depth:
 *
 *   1. an IP rate limit on the route, before the handler runs
 *   2. Turnstile verified before anything touches the database
 *   3. every field parsed against the SHARED catalog schema — the same one the
 *      form renders from, so an unknown topic is impossible rather than merely
 *      unlikely
 *   4. a per-email throttle read from the table itself, which survives an
 *      attacker rotating IPs
 *   5. the IP hashed before storage, never kept raw
 *   6. a UNIQUE client_token, so a double-click or a retry returns the FIRST
 *      ticket instead of opening a second one — the index is what makes that
 *      race-safe, not the read-before-write below
 *
 * Email is best-effort and deliberately AFTER the row is committed: a Resend
 * outage must never turn a captured enquiry into a 500 that makes the person
 * submit again.
 */

const router = new Hono<{ Bindings: Env }>();

/* Generous for a person filling in a long form, hostile to a script hammering
   it. Ten minutes rather than one, because a genuine submitter posts once. */
router.use(
    '/contact-requests',
    rateLimit({
        windowMs: 10 * 60_000,
        max: 8,
        prefix: 'contact-intake',
        keyGenerator: (c) =>
            c.req.header('cf-connecting-ip')
            ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
            ?? 'anonymous',
    }),
);

router.use(
    '/contact-requests/status',
    rateLimit({
        windowMs: 60_000,
        max: 20,
        prefix: 'contact-status',
        keyGenerator: (c) =>
            c.req.header('cf-connecting-ip')
            ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
            ?? 'anonymous',
    }),
);

/** How many submissions one email address may file in the window below. */
const EMAIL_THROTTLE_MAX = 4;
const EMAIL_THROTTLE_WINDOW_MS = 30 * 60_000;

/** Postgres SQLSTATE for a unique-constraint violation. */
const UNIQUE_VIOLATION = '23505';

type Db = ReturnType<typeof getSupabaseAdmin>;

function clientIp(headers: { get(name: string): string | null } | Headers): string | null {
    return (
        headers.get('cf-connecting-ip')
        ?? headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        ?? null
    );
}

/**
 * Hash the IP with the service-role key as salt.
 *
 * The raw address is personal data with no operational use here — an operator
 * only ever needs "was this the same source", which a stable hash answers.
 * Salting with a secret means the table alone cannot be rainbow-tabled back to
 * addresses.
 */
async function hashIp(ip: string | null, salt: string): Promise<string | null> {
    if (!ip) return null;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${ip}`));
    return Array.from(new Uint8Array(digest))
        .slice(0, 16)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Turn a Zod issue into something a caller can act on.
 *
 * The form validates the same rules before posting, so anything reaching here
 * is a direct API caller or a stale client. Zod's own text for a missing field
 * is "expected string, received undefined", which names neither the field nor
 * the fix — useless in exactly the case where the caller has no form to look at.
 */
function describeIssue(issue: { message?: string; path?: PropertyKey[]; code?: string } | undefined): string {
    if (!issue) return 'Please check the form and try again';

    const field = issue.path?.filter((part) => typeof part === 'string').join('.');
    if (!field) return issue.message || 'Please check the form and try again';
    if (issue.code === 'invalid_type') return `Missing or invalid field: ${field}`;
    return `${field}: ${issue.message}`;
}

function configuredValue(value: string | undefined): boolean {
    const normalized = String(value || '').toLowerCase();
    return Boolean(normalized)
        && !normalized.includes('placeholder')
        && !normalized.includes('replace-with')
        && !normalized.includes('skip_needs_human')
        && !normalized.includes('dev-only');
}

/**
 * Which inbox gets the alert.
 *
 * CONTACT_TEAM_INBOXES is an optional JSON map of team → address, so routing
 * can change without a deploy. A malformed value must not lose a lead, so it
 * degrades to the default inbox rather than throwing.
 */
function resolveTeamInbox(env: Env, team: ContactTeam): string {
    const fallback = env.CONTACT_NOTIFY_EMAIL || env.SUPPORT_EMAIL || 'support@letbuyy.com';
    const raw = env.CONTACT_TEAM_INBOXES?.trim();
    if (!raw) return fallback;

    try {
        const map = JSON.parse(raw) as Record<string, unknown>;
        const address = map[team];
        return typeof address === 'string' && address.includes('@') ? address : fallback;
    } catch {
        return fallback;
    }
}

/* ─── Submit ──────────────────────────────────────────────────────────────── */

router.post('/contact-requests', async (c) => {
    let body: Record<string, unknown>;
    try {
        body = (await c.req.json()) as Record<string, unknown>;
    } catch {
        return c.json(failureBody('INVALID_BODY', 'Expected a JSON body'), 400);
    }

    // ── Bot check, before any database work ─────────────────────────────────
    const ip = clientIp(c.req.raw.headers);
    const passedTurnstile = await verifyTurnstileToken(
        c.env,
        extractTurnstileToken(body),
        ip ?? undefined,
    );
    if (!passedTurnstile) {
        return c.json(failureBody('VERIFICATION_FAILED', 'Could not verify this request'), 403);
    }

    // ── Shape, against the same catalog the form rendered from ──────────────
    const parsed = ContactRequestSubmissionSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(failureBody('VALIDATION_FAILED', describeIssue(parsed.error.issues[0])), 400);
    }
    const input = parsed.data;

    const crossFieldError = validateContactSubmission(input);
    if (crossFieldError) {
        return c.json(failureBody('VALIDATION_FAILED', crossFieldError), 400);
    }

    const db = getSupabaseAdmin(c);
    const ipHash = await hashIp(ip, c.env.SUPABASE_SERVICE_ROLE_KEY ?? 'letbuyy');

    /* Per-email throttle. The route's IP limit does not catch a script rotating
       addresses, and this is the cheap read that does. It runs AFTER Turnstile
       so a bot never reaches the query.

       A bounded row fetch rather than count:'exact': the limit is 4, so reading
       up to 4 ids answers the question and the planner can stop there, where an
       exact count must visit every matching row. */
    const throttleSince = new Date(Date.now() - EMAIL_THROTTLE_WINDOW_MS).toISOString();
    const { data: recentRows, error: throttleError } = await db
        .from('contact_requests')
        .select('id')
        .eq('email', input.email)
        .gte('created_at', throttleSince)
        .limit(EMAIL_THROTTLE_MAX);

    /* Fail CLOSED. supabase-js resolves a PostgREST failure rather than
       throwing, so an unchecked error here reads as "no recent messages" and
       quietly removes the one defence that survives IP rotation. Refusing a
       genuine sender for a few minutes is recoverable; a silently disabled
       throttle is not. */
    if (throttleError) {
        console.warn('[contact] throttle lookup failed; refusing to fail open', {
            code: throttleError.code,
        });
        return c.json(
            failureBody('THROTTLE_UNAVAILABLE', 'We could not accept that just now. Please try again shortly.'),
            503,
        );
    }

    if ((recentRows?.length ?? 0) >= EMAIL_THROTTLE_MAX) {
        return c.json(
            failureBody(
                'TOO_MANY_REQUESTS',
                'You have sent us several messages already — we are on them. Reply to your ticket email to add anything else.',
            ),
            429,
        );
    }

    // ── Derived fields. Computed here so the row carries the promise we made ──
    const topic = getContactTopic(input.topic);
    const team = (topic?.team ?? 'support') as ContactTeam;
    const subjectLine = resolveContactSubjectLine(input);
    const responseHours = resolveContactResponseHours(input.topic, input.urgency);
    const { score, band } = scoreContactLead({
        topicId: input.topic,
        urgencyId: input.urgency,
        relationship: input.relationship,
        monthlyOrders: input.monthly_orders,
        monthlyGmv: input.monthly_gmv_band,
        timeline: input.timeline,
        interestedPlan: input.interested_plan,
        companyName: input.company_name,
        websiteUrl: input.website_url,
        messageLength: input.message.length,
    });

    const now = Date.now();
    const record = {
        full_name: input.full_name,
        email: input.email,
        phone: input.phone,
        phone_country_code: input.phone_country_code,
        relationship: input.relationship,
        company_name: input.company_name,
        website_url: input.website_url,
        store_subdomain: input.store_subdomain,
        gstin: input.gstin,
        city: input.city,
        state: input.state,

        business_type: input.business_type,
        current_channel: input.current_channel,
        monthly_orders: input.monthly_orders,
        monthly_gmv_band: input.monthly_gmv_band,
        interested_plan: input.interested_plan,
        timeline: input.timeline,

        topic: input.topic,
        subject_id: input.subject_id,
        subject_text: input.subject_text,
        subject_line: subjectLine,
        message: input.message,
        urgency: input.urgency,
        order_reference: input.order_reference,

        preferred_channel: input.preferred_channel,
        preferred_language: input.preferred_language,
        preferred_time_window: input.preferred_time_window,

        consent_privacy: input.consent_privacy,
        consent_marketing: input.consent_marketing,

        team,
        lead_score: score,
        lead_band: band,
        response_hours: responseHours,
        /* WORKING hours, not elapsed. The catalog, the form and the
           acknowledgement email all state this promise in working hours, and
           this same value is handed back to the submitter by the ticket lookup
           — computing it in calendar time would show one person two dates a
           week apart and sort the breach report on the wrong one. */
        first_response_due_at: addWorkingHours(responseHours, now).toISOString(),

        heard_about_us: input.heard_about_us,
        locale: input.locale,
        source_path: input.source_path,
        referrer: input.referrer,
        utm: input.utm,
        ip_hash: ipHash,
        user_agent: c.req.header('user-agent')?.slice(0, 400) ?? null,
        client_token: input.client_token,
        status: 'new' as const,
    };

    const { data, error } = await db
        .from('contact_requests')
        .insert(record)
        .select('id,ticket_ref,created_at')
        .single();

    if (error || !data) {
        /* Exactly ONE failure mode is benign: a unique violation on
           client_token, meaning this exact submission already landed (a
           double-click, or a retry after a flaky network). Treating every
           error as that case is how a real constraint violation turns into a
           lost lead — the recovery lookup finds nothing, the sender gets an
           opaque 500, and no alert is ever sent. So the benign path is opted
           into by SQLSTATE, and everything else is logged loudly. */
        const sqlState = (error as { code?: string } | null)?.code;

        if (sqlState === UNIQUE_VIOLATION) {
            const { data: existing } = await db
                .from('contact_requests')
                .select('ticket_ref,topic,subject_line,response_hours,team')
                .eq('client_token', input.client_token)
                .maybeSingle();

            if (existing) {
                const receipt: ContactRequestReceipt = {
                    ticket_ref: String(existing.ticket_ref),
                    topic: String(existing.topic),
                    subject_line: String(existing.subject_line),
                    response_hours: Number(existing.response_hours),
                    team: String(existing.team) as ContactTeam,
                    duplicate: true,
                };
                return c.json(success(receipt), 200);
            }

            /* A unique violation that is NOT this client_token — the ticket_ref
               sequence colliding, say. Genuinely unexpected, so it is logged as
               such rather than reported as a duplicate. */
            console.error('[contact] unique violation outside client_token', { sqlState });
        } else {
            /* Never echo the database's own words: the message can carry column
               values and constraint internals. The SQLSTATE is enough for an
               operator and means nothing to an attacker. */
            console.error('[contact] insert failed', { sqlState });
        }

        return c.json(failureBody('SAVE_FAILED', 'Could not save your message'), 500);
    }

    const summary: ContactRequestSummary = {
        ticketRef: String(data.ticket_ref),
        fullName: input.full_name,
        email: input.email,
        phone: input.phone,
        phoneCountryCode: input.phone_country_code,
        relationship: input.relationship,
        companyName: input.company_name,
        websiteUrl: input.website_url,
        storeSubdomain: input.store_subdomain,
        gstin: input.gstin,
        city: input.city,
        state: input.state,
        businessType: input.business_type,
        currentChannel: input.current_channel,
        monthlyOrders: input.monthly_orders,
        monthlyGmvBand: input.monthly_gmv_band,
        interestedPlan: input.interested_plan,
        timeline: input.timeline,
        topic: input.topic,
        subjectId: input.subject_id,
        subjectText: input.subject_text,
        subjectLine,
        message: input.message,
        urgency: input.urgency,
        orderReference: input.order_reference,
        preferredChannel: input.preferred_channel,
        preferredLanguage: input.preferred_language,
        preferredTimeWindow: input.preferred_time_window,
        heardAboutUs: input.heard_about_us,
        consentMarketing: input.consent_marketing,
        locale: input.locale,
        sourcePath: input.source_path,
        team,
        leadScore: score,
        leadBand: band,
        responseHours,
        submittedAt: String(data.created_at ?? new Date(now).toISOString()),
    };

    await dispatchContactEmails(c.env, summary);

    const receipt: ContactRequestReceipt = {
        ticket_ref: summary.ticketRef,
        topic: input.topic,
        subject_line: subjectLine,
        response_hours: responseHours,
        team,
        duplicate: false,
    };
    return c.json(success(receipt), 201);
});

/* ─── Ticket status ───────────────────────────────────────────────────────── */

/**
 * Two-factor ticket lookup.
 *
 * POST rather than GET on purpose: the email address is personal data and must
 * not end up in a URL, a proxy log or a Referer header. The RPC returns the
 * same negative shape for an unknown reference and a wrong email, so a guessed
 * reference — and they ARE guessable, being sequential — discloses nothing.
 */
router.post('/contact-requests/status', async (c) => {
    let body: Record<string, unknown>;
    try {
        body = (await c.req.json()) as Record<string, unknown>;
    } catch {
        return c.json(failureBody('INVALID_BODY', 'Expected a JSON body'), 400);
    }

    const ticketRef = typeof body.ticket_ref === 'string' ? body.ticket_ref.trim().slice(0, 32) : '';
    const email = typeof body.email === 'string' ? body.email.trim().slice(0, 254) : '';
    if (!ticketRef || !email) {
        return c.json(
            failureBody('MISSING_FIELDS', 'Enter both your ticket reference and the email you used'),
            400,
        );
    }

    const db = getSupabaseAdmin(c);
    const { data, error } = await db.rpc('get_contact_request_status', {
        p_ticket_ref: ticketRef,
        p_email: email,
    });

    if (error) {
        return c.json(failureBody('LOOKUP_FAILED', 'Could not look that ticket up right now'), 500);
    }

    const result = (data as Record<string, unknown> | null) ?? { found: false };
    if (!result.found) {
        return c.json(
            failureBody('TICKET_NOT_FOUND', 'No ticket matches that reference and email'),
            404,
        );
    }

    return c.json(success(result));
});

/* ─── Email dispatch ──────────────────────────────────────────────────────── */

/**
 * Both emails, best-effort.
 *
 * Never throws and never awaits a failure into the response: the row is already
 * committed, and a Resend outage must not surface as an error that prompts the
 * sender to submit again.
 */
async function dispatchContactEmails(env: Env, summary: ContactRequestSummary): Promise<void> {
    /* The contact form has its own Resend key. Falling back to the shared one
       is deliberate but secondary — if the dedicated key is unset in an
       environment the form still answers people, rather than silently
       swallowing every acknowledgement. */
    const apiKey = env.CONTACT_RESEND_API_KEY || env.RESEND_API_KEY;
    if (!configuredValue(apiKey)) return;

    const brand = {
        siteUrl: (env.MARKETING_SITE_URL || 'https://letbuyy.com').replace(/\/+$/, ''),
        /* Images, unlike links, must resolve from OUTSIDE our network — the
           reader's mail client fetches them. A localhost MARKETING_SITE_URL in
           staging would render the logo as a broken-image box, so the asset
           origin is configured separately and defaults to the public one. */
        assetUrl: (env.EMAIL_ASSET_BASE_URL || 'https://letbuyy.com').replace(/\/+$/, ''),
        supportEmail: env.SUPPORT_EMAIL || 'support@letbuyy.com',
    };
    const from = env.CONTACT_RESEND_FROM_EMAIL
        || env.RESEND_FROM_EMAIL
        || 'LetBuyy <noreply@letbuyy.com>';

    const acknowledgement = buildContactAcknowledgementEmail(summary, brand);
    const alert = buildContactTeamAlertEmail(
        summary,
        brand,
        resolveTeamInbox(env, summary.team as ContactTeam),
    );

    await Promise.allSettled(
        [acknowledgement, alert]
            .filter((message): message is NonNullable<typeof message> => Boolean(message))
            .map((message) => sendResendEmail({ apiKey, from, ...message })),
    );
}

export default router;
