import { renderEmailShell, ctaButton, ctaRow } from '@letbuyy/notification-core/email';

/**
 * Demo-request transactional emails.
 *
 * Two messages per submission: a confirmation to the prospect and a lead alert
 * to the team. The branded shell is defined once, here.
 *
 * EMAIL IS NOT THE WEB. Four constraints shape everything below:
 *   • Tables, not flex or grid — Outlook renders with Word, which supports
 *     neither, and it is still a large share of B2B inboxes.
 *   • Inline styles — Gmail strips <style> blocks in several contexts, so the
 *     <style> here carries only progressive enhancement (responsive + dark
 *     mode) and never anything the layout depends on.
 *   • Images are blocked by default in many clients, so nothing essential may
 *     live in one. The wordmark has styled alt text that reads as the brand
 *     when the image does not load.
 *   • Absolute URLs on a public host. A dev origin in an <img> produces the
 *     broken-image box that shipped in the first version of this file.
 */

const INK = '#271F2D';
const INK_SOFT = '#271F2D';
const PRIMARY = '#6A436B';
const PRIMARY_DEEP = '#4D3652';
const ON_DARK = '#ffffff';
const ON_DARK_MUTED = 'rgba(255,255,255,0.60)';
const BODY = '#6A5E70';
const HEADING = '#2D2431';
const SUBTLE = '#6A5E70';
const CANVAS = '#F4F0F5';
const CARD = '#ffffff';
const HAIRLINE = '#8B7C90';

const FONT =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

export interface DemoEmailBrand {
    /** Public origin for links. */
    siteUrl: string;
    /**
     * Public origin for IMAGES. Separate from siteUrl on purpose: siteUrl is
     * whatever the runtime is configured with — on a dev machine that is
     * localhost, which a mail client can never fetch. Assets must always point
     * somewhere publicly reachable.
     */
    assetUrl: string;
    supportEmail: string;
    /** Public gateway origin — the calendar link is served from there. */
    apiUrl: string;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function shell(brand: DemoEmailBrand, bodyHtml: string, preheader: string): string {
    return renderEmailShell(brand, bodyHtml, {preheader,reason:'You requested a LetBuyy product demo or receive its team notifications.',category:'transactional'});
}

/** Bulletproof-ish button: table-wrapped so Word fills the background. */
function button(href: string, label: string): string {
    return ctaRow([ctaButton(href,label)]);
}

/** One label/value pair. Stacks on narrow screens via .lb-row-* classes. */
function row(label: string, value: string, last = false): string {
    const border = last ? '' : `border-bottom:1px solid ${HAIRLINE};`;
    return `<tr>
<td class="lb-label lb-hairline lb-subtle" style="${border}padding:11px 16px 11px 0;font-family:${FONT};font-size:11.5px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${SUBTLE};width:168px;vertical-align:top;">${label}</td>
<td class="lb-value lb-hairline lb-body" style="${border}padding:11px 0;font-family:${FONT};font-size:14px;line-height:1.55;color:${BODY};">${value}</td>
</tr>`;
}

export interface DemoRequestSummary {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    companyName?: string | null;
    websiteUrl?: string | null;
    businessType?: string | null;
    currentChannel?: string | null;
    monthlyOrders?: string | null;
    monthlyGmvBand?: string | null;
    productCategories: string[];
    interestedPlan?: string | null;
    goals: string[];
    whyLetbuyy?: string | null;
    heardAboutUs?: string | null;
    heardAboutDetail?: string | null;
    preferredAt?: string | null;
    preferredTimezone?: string | null;
    preferredLanguage: string;
    locale?: string | null;
}

/** Human-readable slot, or an honest line when none was chosen. */
function formatSlot(req: DemoRequestSummary): string {
    if (!req.preferredAt) return 'No preference given — we will suggest times';
    const zone = req.preferredTimezone || 'Asia/Kolkata';
    try {
        const formatted = new Intl.DateTimeFormat('en-IN', {
            dateStyle: 'full',
            timeStyle: 'short',
            timeZone: zone,
        }).format(new Date(req.preferredAt));
        return `${formatted} · ${zone}`;
    } catch {
        // An unknown IANA zone must not take the whole email down.
        return `${req.preferredAt} · ${zone}`;
    }
}

/** Confirmation to the prospect. */
export function buildDemoConfirmationEmail(req: DemoRequestSummary, brand: DemoEmailBrand) {
    const to = req.email.trim();
    if (!to) return null;

    const firstNameRaw = req.fullName.trim().split(/\s+/)[0] || 'there';
    const firstName = escapeHtml(firstNameRaw);
    const booked = Boolean(req.preferredAt);
    const subject = booked
        ? 'Your LetBuyy demo — slot requested'
        : 'Your LetBuyy demo request — received';

    /* Split date and time so the ticket can set them at different weights, the
       way a boarding pass does. Falls back to one line if the zone is unknown. */
    const zone = req.preferredTimezone || 'Asia/Kolkata';
    let ticketDate = 'To be confirmed';
    let ticketTime = 'We will suggest times';
    if (req.preferredAt) {
        try {
            const at = new Date(req.preferredAt);
            ticketDate = new Intl.DateTimeFormat('en-IN', {
                weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: zone,
            }).format(at);
            ticketTime = `${new Intl.DateTimeFormat('en-IN', {
                hour: 'numeric', minute: '2-digit', timeZone: zone,
            }).format(at)} · ${zone.split('/').pop()}`;
        } catch {
            ticketDate = req.preferredAt;
            ticketTime = zone;
        }
    }

    const calendarUrl = `${brand.apiUrl}/demo-requests/${req.id}/calendar.ics`;

    const agenda: Array<[string, string]> = [
        ['Your catalogue, live', 'A storefront generated from your own products — not a sample store.'],
        ['A real order, end to end', 'We put a UPI and a COD order through checkout while you watch.'],
        ['The GST invoice it produces', 'Generated automatically, immutable, and correct for your place of supply.'],
    ];

    const text = [
        `Hi ${firstNameRaw},`,
        '',
        booked
            ? `We have your demo request for ${ticketDate}, ${ticketTime}.`
            : 'We have your demo request.',
        'A member of the team will confirm within one working day.',
        '',
        ...(booked ? [`Add it to your calendar: ${calendarUrl}`, ''] : []),
        'What we will cover:',
        ...agenda.map(([title, detail], i) => `  ${i + 1}. ${title} — ${detail}`),
        '',
        `Reference: ${req.id}`,
        '',
        `Need to move it? Reply to this email or write to ${brand.supportEmail}.`,
        '',
        '— The LetBuyy team',
    ].join('\n');

    /* Timeline is a nested table, not absolutely-positioned divs. Email clients
       strip position, so a "connector line" drawn that way vanishes in Outlook
       and overlaps in Gmail. A bordered spacer cell gives the same rule and
       renders everywhere. */
    const timeline = agenda
        .map(
            ([title, detail], index) => `<tr>
<td width="34" valign="top" style="padding:0 14px 0 0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
  <td width="26" height="26" align="center" valign="middle" style="width:26px;height:26px;background:#F4F0F5;border-radius:13px;font-family:${MONO};font-size:11px;font-weight:700;color:${PRIMARY};">${index + 1}</td>
  </tr></table>
</td>
<td class="lb-bento" style="padding:15px 18px;background:${CANVAS};border-radius:14px;">
  <p class="lb-strong" style="margin:0 0 4px;font-family:${FONT};font-size:14px;font-weight:700;letter-spacing:-0.015em;color:${HEADING};">${title}</p>
  <p class="lb-body" style="margin:0;font-family:${FONT};font-size:13px;line-height:1.55;color:${BODY};">${detail}</p>
</td>
</tr>
${index < agenda.length - 1 ? `<tr><td width="34" style="padding:0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td width="1" height="14" class="lb-connector" style="width:1px;height:14px;background:#8B7C90;font-size:0;line-height:0;">&nbsp;</td></tr></table></td><td style="height:14px;font-size:0;line-height:0;">&nbsp;</td></tr>` : ''}`,
        )
        .join('');

    const body = `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;">
<tr><td style="background:#F4F0F5;border-radius:20px;padding:6px 14px;">
  <span style="font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:${PRIMARY};">
    ${booked ? 'Slot requested' : 'Request received'}
  </span>
</td></tr></table>

<h1 class="lb-h1" style="margin:0 0 14px;font-family:${FONT};font-size:34px;line-height:1.05;font-weight:800;color:${HEADING};letter-spacing:-0.04em;">
  Demo requested, ${firstName}.
</h1>
<p class="lb-body" style="margin:0 0 28px;font-family:${FONT};font-size:15px;line-height:1.65;color:${BODY};">
  A member of the team will confirm within one working day. If the time below
  stops working, reply to this email and we will move it.
</p>

<!-- Ticket -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       class="lb-ticket" style="background:${INK};border-radius:20px;">
  <tr><td style="padding:26px 28px;">
    <p style="margin:0 0 6px;font-family:${FONT};font-size:10.5px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#9b83ff;">Requested slot</p>
    <p style="margin:0 0 2px;font-family:${FONT};font-size:22px;font-weight:750;letter-spacing:-0.025em;line-height:1.2;color:${ON_DARK};">${escapeHtml(ticketDate)}</p>
    <p style="margin:0;font-family:${FONT};font-size:18px;font-weight:650;letter-spacing:-0.02em;color:#4fd6b8;">${escapeHtml(ticketTime)}</p>

    ${
        booked
            ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0;">
<tr><td class="lb-cta" align="center" style="background:${ON_DARK};border-radius:11px;">
<a href="${calendarUrl}" class="lb-cta" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:13.5px;font-weight:700;color:${INK};letter-spacing:-0.01em;">Add to calendar</a>
</td></tr></table>`
            : ''
    }

    <!-- Perforation. A dashed border on a spacer row, because a real dashed
         rule between table cells is the one border style Outlook renders. -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0;">
      <tr><td style="border-top:1px dashed rgba(255,255,255,0.18);font-size:0;line-height:0;padding-top:14px;">
        <p style="margin:0;font-family:${MONO};font-size:10.5px;letter-spacing:0.08em;color:rgba(255,255,255,0.42);">REF · ${escapeHtml(req.id.slice(0, 13).toUpperCase())}</p>
      </td></tr>
    </table>
  </td></tr>
</table>

<p class="lb-strong" style="margin:32px 0 14px;font-family:${FONT};font-size:11.5px;font-weight:700;letter-spacing:0.13em;text-transform:uppercase;color:${SUBTLE};">
  What we will cover
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  ${timeline}
</table>

${button(`${brand.siteUrl}/in/pricing`, 'See pricing while you wait')}

<p class="lb-subtle" style="margin:16px 0 0;font-family:${FONT};font-size:12.5px;line-height:1.6;color:${SUBTLE};">
  Nothing is charged for a demo, and no card is required to start a store.
</p>`;

    return {
        to,
        subject,
        text,
        html: shell(
            brand,
            body,
            booked
                ? `${ticketDate} at ${ticketTime} — add it to your calendar.`
                : 'We have your demo request — a slot confirmation follows within one working day.',
        ),
    };
}

/** Internal lead alert. Every answer, so nobody has to open the dashboard. */
export function buildDemoLeadAlertEmail(
    req: DemoRequestSummary,
    brand: DemoEmailBrand,
    to: string,
) {
    const recipient = (to || '').trim();
    if (!recipient) return null;

    const company = req.companyName?.trim() || '—';
    const subject = `Demo request — ${req.fullName.trim()}${req.companyName ? ` (${req.companyName.trim()})` : ''}`;

    const list = (values: string[]) => (values.length ? escapeHtml(values.join(', ')) : '—');
    const or = (value?: string | null) => (value?.trim() ? escapeHtml(value.trim()) : '—');

    const text = [
        `New demo request: ${req.fullName} (${company})`,
        `Email: ${req.email}`,
        `Phone: ${req.phone}`,
        `Slot:  ${formatSlot(req)}`,
        `Plan:  ${req.interestedPlan ?? '—'}`,
        `Selling today: ${req.currentChannel ?? '—'}`,
        `Heard via: ${req.heardAboutUs ?? '—'}`,
        `Why LetBuyy: ${req.whyLetbuyy ?? '—'}`,
        `Reference: ${req.id}`,
    ].join('\n');

    const body = `
<p style="margin:0 0 10px;font-size:11.5px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${PRIMARY};">
  New demo request
</p>
<h1 class="lb-h1" style="margin:0 0 6px;font-size:24px;line-height:1.2;font-weight:750;color:${HEADING};letter-spacing:-0.03em;">
  ${escapeHtml(req.fullName.trim())}
</h1>
<p class="lb-subtle" style="margin:0 0 22px;font-size:14px;color:${SUBTLE};">${escapeHtml(company)}</p>

<!-- Contact first: this is what someone acts on. -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       class="lb-panel" style="background:${CANVAS};border-radius:14px;margin-bottom:22px;">
  <tr><td style="padding:6px 20px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${row('Email', `<a href="mailto:${escapeHtml(req.email)}" style="color:${PRIMARY};font-weight:600;">${escapeHtml(req.email)}</a>`)}
      ${row('Phone', `<a href="tel:${escapeHtml(req.phone)}" style="color:${PRIMARY};font-weight:600;">${escapeHtml(req.phone)}</a>`)}
      ${row('Requested slot', escapeHtml(formatSlot(req)))}
      ${row('Reply language', or(req.preferredLanguage), true)}
    </table>
  </td></tr>
</table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  ${row('Website', or(req.websiteUrl))}
  ${row('Business type', or(req.businessType))}
  ${row('Selling today via', or(req.currentChannel))}
  ${row('Monthly orders', or(req.monthlyOrders))}
  ${row('Monthly sales', or(req.monthlyGmvBand))}
  ${row('Categories', list(req.productCategories))}
  ${row('Interested plan', or(req.interestedPlan))}
  ${row('Goals', list(req.goals))}
  ${row(
      'Heard about us',
      `${or(req.heardAboutUs)}${req.heardAboutDetail ? ` — ${escapeHtml(req.heardAboutDetail)}` : ''}`,
  )}
  ${row('Locale', or(req.locale), true)}
</table>

<p style="margin:24px 0 8px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${SUBTLE};">
  Why LetBuyy
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       class="lb-panel" style="background:${CANVAS};border-radius:14px;">
  <tr><td class="lb-body" style="padding:16px 20px;font-family:${FONT};font-size:14.5px;line-height:1.7;color:${BODY};">${or(req.whyLetbuyy)}</td></tr>
</table>

<p style="margin:22px 0 0;font-family:${MONO};font-size:11.5px;color:${SUBTLE};">${escapeHtml(req.id)}</p>`;

    return {
        to: recipient,
        subject,
        text,
        html: shell(brand, body, `${req.fullName.trim()} · ${formatSlot(req)}`),
    };
}
