import {
    getContactSubject,
    getContactTopic,
    CONTACT_URGENCIES,
    CONTACT_CHANNELS,
    CONTACT_LANGUAGES,
    CONTACT_TIME_WINDOWS,
    CONTACT_RELATIONSHIPS,
    CONTACT_TIMELINES,
    describeResponseHours,
    type ContactLeadBand,
} from '@letbuyy/shared-types';
import {
    badge,
    ctaButton,
    ctaRow,
    detailRow,
    detailTable,
    divider,
    escapeHtml,
    eyebrow,
    heading,
    paragraph,
    quotedBlock,
    renderEmailShell,
    safeHref,
    safeSubject,
    sectionLabel,
    smallPrint,
    ticketPanel,
    type LetbuyyEmailBrand,
} from './letbuyy-email-shell';

/**
 * Contact-request transactional emails.
 *
 * Two messages per submission, both built on the shared shell:
 *   1. an acknowledgement to the person, leading with their ticket reference
 *   2. an alert to the team that owns the topic, carrying every answer so
 *      nobody has to open a dashboard to decide whether to pick it up
 *
 * Both return a plain-text part as well as HTML. That is not politeness: a
 * text/plain alternative measurably lowers the spam score, and an
 * acknowledgement that lands in spam is the same as no acknowledgement.
 */

export interface ContactRequestSummary {
    ticketRef: string;
    fullName: string;
    email: string;
    phone: string;
    phoneCountryCode?: string | null;
    relationship: string;
    companyName?: string | null;
    websiteUrl?: string | null;
    storeSubdomain?: string | null;
    gstin?: string | null;
    city?: string | null;
    state?: string | null;

    businessType?: string | null;
    currentChannel?: string | null;
    monthlyOrders?: string | null;
    monthlyGmvBand?: string | null;
    interestedPlan?: string | null;
    timeline?: string | null;

    topic: string;
    subjectId: string;
    subjectText?: string | null;
    subjectLine: string;
    message: string;
    urgency: string;
    orderReference?: string | null;

    preferredChannel: string;
    preferredLanguage: string;
    preferredTimeWindow: string;

    heardAboutUs?: string | null;
    consentMarketing: boolean;
    locale?: string | null;
    sourcePath?: string | null;

    team: string;
    leadScore: number;
    leadBand: ContactLeadBand;
    responseHours: number;
    submittedAt: string;
}

const TEAM_LABELS: Record<string, string> = {
    sales: 'Sales',
    support: 'Merchant support',
    billing: 'Billing',
    payments: 'Payments',
    logistics: 'Orders & shipping',
    compliance: 'GST & compliance',
    developers: 'Developer relations',
    partnerships: 'Partnerships',
    press: 'Press',
    careers: 'People',
    trust_safety: 'Trust & safety',
    privacy: 'Privacy',
};

function labelFor(list: ReadonlyArray<{ id: string; label: string }>, id: string): string {
    return list.find((entry) => entry.id === id)?.label ?? id;
}

function teamLabel(team: string): string {
    return TEAM_LABELS[team] ?? 'LetBuyy';
}

/* "within 4 working hours" / "within 1 working day". Shared with the form and
   the ticket lookup so the same number is never phrased three different ways —
   and so it stays in step with the working day addWorkingHours schedules on. */
const responsePhrase = describeResponseHours;

function firstName(fullName: string): string {
    return fullName.trim().split(/\s+/)[0] || 'there';
}

function fullPhone(req: ContactRequestSummary): string {
    const code = req.phoneCountryCode?.trim();
    const number = req.phone.trim();
    if (!code || number.startsWith('+')) return number;
    return `${code} ${number}`;
}

/** Digits only — what wa.me and tel: both want. */
function dialable(value: string): string {
    return value.replace(/[^\d]/g, '');
}

function dash(value?: string | null): string {
    const text = value?.trim();
    return text ? escapeHtml(text) : '—';
}

/* ─── 1. Acknowledgement to the person who wrote in ───────────────────────── */

export function buildContactAcknowledgementEmail(
    req: ContactRequestSummary,
    brand: LetbuyyEmailBrand,
): { to: string; subject: string; text: string; html: string; replyTo?: string } | null {
    const to = req.email.trim();
    if (!to) return null;

    const site = brand.siteUrl.replace(/\/+$/, '');
    const topic = getContactTopic(req.topic);
    const phrase = responsePhrase(req.responseHours);
    const owner = teamLabel(req.team);

    /* The reference leads the subject line so the thread is searchable by it
       from the very first message, before anyone has replied. safeSubject
       because subjectLine can be the sender's own words. */
    const subject = safeSubject(`[${req.ticketRef}] We have your message — ${req.subjectLine}`);

    const text = [
        `Hi ${firstName(req.fullName)},`,
        '',
        `Thanks for writing to LetBuyy. Your message is with our ${owner} team and you can expect a reply ${phrase}.`,
        '',
        `Ticket:   ${req.ticketRef}`,
        `Subject:  ${req.subjectLine}`,
        `Topic:    ${topic?.label ?? req.topic}`,
        `Reply to: ${labelFor(CONTACT_CHANNELS, req.preferredChannel)} (${labelFor(CONTACT_LANGUAGES, req.preferredLanguage)})`,
        '',
        'What you sent us:',
        req.message,
        '',
        `Just reply to this email to add anything — it reaches the same ticket. Or write to ${brand.supportEmail} quoting ${req.ticketRef}.`,
        '',
        `Track your ticket: ${site}/in/contact?ticket=${encodeURIComponent(req.ticketRef)}`,
        '',
        '— The LetBuyy team',
    ].join('\n');

    const body = [
        eyebrow('Message received'),
        heading(`Thanks, ${escapeHtml(firstName(req.fullName))}. We have it.`),
        paragraph(
            `Your message is with our <strong>${escapeHtml(owner)}</strong> team. A person — not an autoresponder — will come back to you <strong>${escapeHtml(phrase)}</strong>, in ${escapeHtml(labelFor(CONTACT_LANGUAGES, req.preferredLanguage))}, by ${escapeHtml(labelFor(CONTACT_CHANNELS, req.preferredChannel).toLowerCase())}.`,
        ),
        ticketPanel({
            ticketRef: req.ticketRef,
            subjectLine: req.subjectLine,
            responseLine: `${topic?.label ?? req.topic} · first reply ${phrase}`,
        }),
        sectionLabel('What you sent us'),
        quotedBlock(req.message),
        ctaRow([
            ctaButton(
                `${site}/in/contact?ticket=${encodeURIComponent(req.ticketRef)}`,
                'Track this ticket',
            ),
            ctaButton(`${site}/in/resources`, 'Browse the guides', 'ghost'),
        ]),
        smallPrint(
            `Need to add something? Reply to this email — it reaches the same ticket. Keep <strong>${escapeHtml(req.ticketRef)}</strong> in the subject line if you write from a different address.`,
        ),
        divider(),
        smallPrint(
            req.consentMarketing
                ? 'You also asked to hear about new LetBuyy features. You can opt out of those from any such email; this ticket update is not affected.'
                : 'We will only use these details to answer this enquiry.',
        ),
    ].join('\n');

    return {
        to,
        subject,
        text,
        replyTo: brand.supportEmail,
        html: renderEmailShell(brand, body, {
            preheader: `Ticket ${req.ticketRef} — our ${owner} team replies ${phrase}.`,
            reason: `You are receiving this because you contacted LetBuyy at ${site.replace(/^https?:\/\//, '')}.`,
            footnote: `Ticket reference ${escapeHtml(req.ticketRef)}`,
        }),
    };
}

/* ─── 2. Alert to the team that owns the topic ────────────────────────────── */

export function buildContactTeamAlertEmail(
    req: ContactRequestSummary,
    brand: LetbuyyEmailBrand,
    to: string,
): { to: string; subject: string; text: string; html: string; replyTo?: string } | null {
    const recipient = (to || '').trim();
    if (!recipient) return null;

    const topic = getContactTopic(req.topic);
    const urgency = CONTACT_URGENCIES.find((level) => level.id === req.urgency);
    const isCritical = req.urgency === 'critical';
    const phone = fullPhone(req);

    const flag = isCritical ? '[CRITICAL] ' : req.leadBand === 'hot' ? '[HOT] ' : '';
    const subject = safeSubject(
        `${flag}${teamLabel(req.team)} · ${req.subjectLine} — ${req.fullName.trim()}${req.companyName ? ` (${req.companyName.trim()})` : ''}`,
    );

    const text = [
        `${req.ticketRef} — ${topic?.label ?? req.topic} / ${req.subjectLine}`,
        `Lead score ${req.leadScore}/100 (${req.leadBand}) · urgency ${urgency?.label ?? req.urgency} · reply due in ${req.responseHours}h`,
        '',
        `Name:     ${req.fullName}`,
        `Email:    ${req.email}`,
        `Phone:    ${phone}`,
        `Company:  ${req.companyName ?? '—'}`,
        `Website:  ${req.websiteUrl ?? '—'}`,
        `Store:    ${req.storeSubdomain ?? '—'}`,
        `Relation: ${labelFor(CONTACT_RELATIONSHIPS, req.relationship)}`,
        `Prefers:  ${labelFor(CONTACT_CHANNELS, req.preferredChannel)} · ${labelFor(CONTACT_LANGUAGES, req.preferredLanguage)} · ${labelFor(CONTACT_TIME_WINDOWS, req.preferredTimeWindow)}`,
        '',
        'Message:',
        req.message,
        '',
        `Submitted ${req.submittedAt}`,
    ].join('\n');

    const identityRows = [
        detailRow(
            'Email',
            `<a href="mailto:${escapeHtml(req.email)}?subject=${encodeURIComponent(`Re: [${req.ticketRef}] ${req.subjectLine}`)}" style="color:#7c5cff;text-decoration:none;font-weight:600;">${escapeHtml(req.email)}</a>`,
        ),
        detailRow(
            'Phone',
            `<a href="tel:${escapeHtml(dialable(phone))}" style="color:#7c5cff;text-decoration:none;font-weight:600;">${escapeHtml(phone)}</a>`,
        ),
        detailRow('Relationship', escapeHtml(labelFor(CONTACT_RELATIONSHIPS, req.relationship))),
        detailRow('Company', dash(req.companyName)),
        detailRow(
            'Website',
            /* safeHref, not escapeHtml. Escaping makes `javascript:alert(1)`
               safe to PRINT; it does nothing about it being a live href. This
               is submitted text going straight into an anchor. */
            req.websiteUrl
                ? `<a href="${safeHref(req.websiteUrl, brand.siteUrl)}" style="color:#7c5cff;text-decoration:none;">${escapeHtml(req.websiteUrl)}</a>`
                : '—',
        ),
        detailRow('LetBuyy store', dash(req.storeSubdomain)),
        detailRow('Location', [req.city, req.state].filter(Boolean).length
            ? escapeHtml([req.city, req.state].filter(Boolean).join(', '))
            : '—'),
        detailRow('GSTIN', dash(req.gstin)),
    ];

    const enquiryRows = [
        detailRow('Topic', escapeHtml(topic?.label ?? req.topic)),
        detailRow(
            'Subject',
            escapeHtml(getContactSubject(req.topic, req.subjectId)?.label ?? req.subjectId),
        ),
        detailRow('Their subject line', dash(req.subjectText)),
        detailRow('Urgency', escapeHtml(urgency?.label ?? req.urgency)),
        detailRow('Order / payment ref', dash(req.orderReference)),
        detailRow('Reply due', `${req.responseHours} working hours from submission`),
    ];

    /* Only printed when the topic actually asked for them — an empty commercial
       block on a trust-and-safety report is noise that hides the signal. */
    const commercialRows = [
        req.businessType ? detailRow('Category', escapeHtml(req.businessType)) : '',
        req.currentChannel ? detailRow('Selling today via', escapeHtml(req.currentChannel)) : '',
        req.monthlyOrders ? detailRow('Monthly orders', escapeHtml(req.monthlyOrders)) : '',
        req.monthlyGmvBand ? detailRow('Monthly GMV', escapeHtml(req.monthlyGmvBand)) : '',
        req.interestedPlan ? detailRow('Interested plan', escapeHtml(req.interestedPlan)) : '',
        /* labelFor, not the raw value: the form posts a catalog ID here
           ("this_quarter"), unlike the sibling rows which post their own label. */
        req.timeline ? detailRow('Timeline', escapeHtml(labelFor(CONTACT_TIMELINES, req.timeline))) : '',
    ].filter(Boolean);

    const preferenceRows = [
        detailRow('Preferred channel', escapeHtml(labelFor(CONTACT_CHANNELS, req.preferredChannel))),
        detailRow('Language', escapeHtml(labelFor(CONTACT_LANGUAGES, req.preferredLanguage))),
        detailRow('Best time', escapeHtml(labelFor(CONTACT_TIME_WINDOWS, req.preferredTimeWindow))),
        detailRow('Heard about us', dash(req.heardAboutUs)),
        detailRow('Marketing opt-in', req.consentMarketing ? 'Yes' : 'No'),
        detailRow('Locale / page', `${dash(req.locale)} &middot; ${dash(req.sourcePath)}`),
    ];

    const quickActions = [
        ctaButton(
            `mailto:${req.email}?subject=${encodeURIComponent(`Re: [${req.ticketRef}] ${req.subjectLine}`)}`,
            'Reply by email',
        ),
        ctaButton(`tel:${dialable(phone)}`, 'Call', 'ghost'),
        ...(req.preferredChannel === 'whatsapp' && dialable(phone)
            ? [ctaButton(`https://wa.me/${dialable(phone)}`, 'WhatsApp', 'ghost')]
            : []),
    ];

    const body = [
        eyebrow(`${teamLabel(req.team)} · ${req.ticketRef}`, isCritical ? '#b42318' : '#7c5cff'),
        heading(escapeHtml(req.subjectLine)),
        `<div style="margin:0 0 18px;">${[
            isCritical ? badge('Store down', 'critical') : '',
            req.leadBand === 'hot' ? badge('Hot lead', 'hot') : '',
            req.leadBand === 'warm' ? badge('Warm lead', 'warm') : '',
            badge(`Score ${req.leadScore}/100`, 'neutral'),
            badge(`Reply in ${req.responseHours}h`, isCritical ? 'hot' : 'neutral'),
        ]
            .filter(Boolean)
            .join('')}</div>`,
        paragraph(
            `<strong>${escapeHtml(req.fullName.trim())}</strong>${req.companyName ? ` &middot; ${escapeHtml(req.companyName.trim())}` : ''} wrote in. Hitting reply on this email goes to the team inbox — use the button below to answer them directly.`,
        ),
        sectionLabel('Their message'),
        quotedBlock(req.message),
        ctaRow(quickActions),
        sectionLabel('Who they are'),
        detailTable(identityRows),
        sectionLabel('What they asked'),
        detailTable(enquiryRows),
        ...(commercialRows.length
            ? [sectionLabel('Their business'), detailTable(commercialRows)]
            : []),
        sectionLabel('How to reach them'),
        detailTable(preferenceRows),
        smallPrint(`Submitted ${escapeHtml(req.submittedAt)} · ticket ${escapeHtml(req.ticketRef)}`),
    ].join('\n');

    return {
        to: recipient,
        subject,
        text,
        /* Reply goes to the person, not back into the alert inbox. This single
           header is the difference between a one-click answer and a copy-paste. */
        replyTo: req.email,
        html: renderEmailShell(brand, body, {
            preheader: `${req.fullName.trim()} · ${topic?.label ?? req.topic} · score ${req.leadScore}/100 · reply within ${req.responseHours}h`,
            reason: 'Internal lead alert from the LetBuyy contact form.',
            footnote: `Ticket ${escapeHtml(req.ticketRef)}`,
        }),
    };
}
