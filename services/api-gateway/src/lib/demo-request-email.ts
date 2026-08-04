import { BRAND_PROFILES } from '@letbuyy/shared-types';

/**
 * Demo-request transactional emails.
 *
 * Two messages per submission: a confirmation to the prospect and a lead alert
 * to the team. Both are built here so the branded shell is defined once.
 *
 * EMAIL IS NOT THE WEB. Three constraints shape everything below:
 *   • Tables, not flex or grid — Outlook's Word rendering engine supports
 *     neither, and it is still a large share of B2B inboxes.
 *   • Inline styles — Gmail strips <style> blocks in some clients.
 *   • No external CSS, no webfonts.
 *
 * DARK MODE: the logo is served as a light-on-dark PNG inside a dark panel, so
 * it reads on both. `prefers-color-scheme` inside email is unreliable (Gmail
 * ignores it), so the design does not depend on it — the header is dark in
 * every client rather than attempting to invert.
 */

const BRAND_INK = '#0a0912';
const BRAND_PANEL = '#12101f';
const BRAND_PRIMARY = '#7c5cff';
const TEXT_ON_DARK = '#ffffff';
const TEXT_MUTED_ON_DARK = 'rgba(255,255,255,0.62)';
const TEXT_BODY = '#3f3a52';
const TEXT_SUBTLE = '#8b849c';
const SURFACE = '#f7f6fb';
const HAIRLINE = '#e8e3fa';

const FONT_STACK =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

export interface DemoEmailBrand {
    /** Absolute origin of the marketing site — logo and links resolve against it. */
    siteUrl: string;
    supportEmail: string;
}

function socialRow(): string {
    const entries: Array<[string, string]> = [
        ['X', BRAND_PROFILES.x],
        ['Instagram', BRAND_PROFILES.instagram],
        ['YouTube', BRAND_PROFILES.youtube],
        ['Facebook', BRAND_PROFILES.facebook],
        ['LinkedIn', BRAND_PROFILES.linkedin],
    ];
    const links = entries
        .filter(([, href]) => Boolean(href))
        .map(
            ([label, href]) =>
                `<a href="${href}" style="color:${TEXT_MUTED_ON_DARK};text-decoration:none;font-size:12px;padding:0 8px;">${label}</a>`,
        );
    // Word marks rather than icon images: image-blocking is on by default in
    // many clients, and a row of broken-image boxes is worse than plain text.
    return links.join(`<span style="color:rgba(255,255,255,0.24);">&middot;</span>`);
}

function shell(brand: DemoEmailBrand, bodyHtml: string, preheader: string): string {
    const logo = `${brand.siteUrl}/icons/letbuyy-logo-512.png`;

    return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>LetBuyy</title>
</head>
<body style="margin:0;padding:0;background:${SURFACE};">
<!-- Preheader: the grey line inboxes show after the subject. Hidden in the
     body itself, otherwise it prints twice. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${SURFACE};">
<tr><td align="center" style="padding:28px 16px;">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;border-radius:18px;overflow:hidden;background:#ffffff;">

  <!-- Header: dark panel so the light wordmark reads regardless of client theme -->
  <tr><td style="background:${BRAND_INK};padding:26px 32px;">
    <img src="${logo}" width="132" height="43" alt="LetBuyy"
         style="display:block;border:0;outline:none;height:43px;width:132px;">
  </td></tr>

  <tr><td style="padding:32px;font-family:${FONT_STACK};">${bodyHtml}</td></tr>

  <!-- Footer -->
  <tr><td style="background:${BRAND_PANEL};padding:24px 32px;font-family:${FONT_STACK};">
    <p style="margin:0 0 12px;color:${TEXT_MUTED_ON_DARK};font-size:12px;line-height:1.6;">
      LetBuyy — an India-first commerce operating system.<br>
      Questions? Reply to this email or write to
      <a href="mailto:${brand.supportEmail}" style="color:#c4b5fd;text-decoration:none;">${brand.supportEmail}</a>.
    </p>
    <p style="margin:0 0 10px;">${socialRow()}</p>
    <p style="margin:0;color:rgba(255,255,255,0.34);font-size:11px;">
      You are receiving this because you requested a LetBuyy demo.
    </p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}

function button(href: string, label: string): string {
    // Table-wrapped so Outlook renders the fill; a styled <a> alone collapses.
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 4px;">
<tr><td style="background:${BRAND_PRIMARY};border-radius:10px;">
<a href="${href}" style="display:inline-block;padding:13px 26px;font-family:${FONT_STACK};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${label}</a>
</td></tr></table>`;
}

function detailRow(label: string, value: string): string {
    return `<tr>
<td style="padding:9px 0;border-bottom:1px solid ${HAIRLINE};font-family:${FONT_STACK};font-size:12px;color:${TEXT_SUBTLE};width:170px;vertical-align:top;">${label}</td>
<td style="padding:9px 0;border-bottom:1px solid ${HAIRLINE};font-family:${FONT_STACK};font-size:13px;color:${TEXT_BODY};">${value}</td>
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

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

/** Human-readable slot, or an honest line when none was chosen. */
function formatSlot(req: DemoRequestSummary): string {
    if (!req.preferredAt) return 'No preference given — we will suggest times'
    const zone = req.preferredTimezone || 'Asia/Kolkata'
    try {
        const formatted = new Intl.DateTimeFormat('en-IN', {
            dateStyle: 'full',
            timeStyle: 'short',
            timeZone: zone,
        }).format(new Date(req.preferredAt))
        return `${formatted} (${zone})`
    } catch {
        // An unknown IANA zone must not take the email down with it.
        return `${req.preferredAt} (${zone})`
    }
}

/** Confirmation to the prospect. */
export function buildDemoConfirmationEmail(req: DemoRequestSummary, brand: DemoEmailBrand) {
    const to = req.email.trim()
    if (!to) return null

    const firstName = escapeHtml(req.fullName.trim().split(/\s+/)[0] || 'there')
    const slot = escapeHtml(formatSlot(req))
    const subject = 'Your LetBuyy demo request — received'

    const text = [
        `Hi ${req.fullName.trim().split(/\s+/)[0] || 'there'},`,
        '',
        'We have your demo request. A member of the team will confirm your slot within one working day.',
        '',
        `Requested time: ${formatSlot(req)}`,
        `Reference: ${req.id}`,
        '',
        'In the meantime you can browse guides and pricing at ' + brand.siteUrl,
        '',
        `Questions? Reply to this email or write to ${brand.supportEmail}.`,
        '',
        '— The LetBuyy team',
    ].join('\n')

    const body = `
<h1 style="margin:0 0 12px;font-size:23px;line-height:1.25;font-weight:700;color:${BRAND_INK};letter-spacing:-0.02em;">
  Your demo request is in, ${firstName}.
</h1>
<p style="margin:0 0 18px;font-size:14.5px;line-height:1.65;color:${TEXT_BODY};">
  A member of the team will confirm your slot within one working day. If the time
  below does not suit any more, just reply to this email and we will move it.
</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:${SURFACE};border-radius:12px;padding:4px 16px;">
  ${detailRow('Requested time', slot)}
  <tr>
    <td style="padding:9px 0;font-family:${FONT_STACK};font-size:12px;color:${TEXT_SUBTLE};">Reference</td>
    <td style="padding:9px 0;font-family:${FONT_STACK};font-size:12px;color:${TEXT_SUBTLE};font-family:monospace;">${escapeHtml(req.id)}</td>
  </tr>
</table>

${button(brand.siteUrl + '/in/pricing', 'See pricing while you wait')}

<p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:${TEXT_SUBTLE};">
  Nothing is charged for a demo, and no card is required to start a store.
</p>`

    return {
        to,
        subject,
        text,
        html: shell(brand, body, 'We have your demo request — a slot confirmation follows within one working day.'),
    }
}

/** Internal lead alert. Every answer, so nobody has to open the dashboard. */
export function buildDemoLeadAlertEmail(
    req: DemoRequestSummary,
    brand: DemoEmailBrand,
    to: string,
) {
    const recipient = (to || '').trim()
    if (!recipient) return null

    const company = req.companyName?.trim() || '—'
    const subject = `Demo request — ${req.fullName.trim()}${req.companyName ? ` (${req.companyName.trim()})` : ''}`

    const list = (values: string[]) => (values.length ? escapeHtml(values.join(', ')) : '—')
    const or = (value?: string | null) => (value?.trim() ? escapeHtml(value.trim()) : '—')

    const text = [
        `New demo request: ${req.fullName} (${company})`,
        `Email: ${req.email}`,
        `Phone: ${req.phone}`,
        `Slot:  ${formatSlot(req)}`,
        `Plan:  ${req.interestedPlan ?? '—'}`,
        `Channel today: ${req.currentChannel ?? '—'}`,
        `Heard via: ${req.heardAboutUs ?? '—'}`,
        `Why LetBuyy: ${req.whyLetbuyy ?? '—'}`,
        `Reference: ${req.id}`,
    ].join('\n')

    const body = `
<p style="margin:0 0 6px;font-family:${FONT_STACK};font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${BRAND_PRIMARY};">
  New demo request
</p>
<h1 style="margin:0 0 18px;font-size:22px;line-height:1.25;font-weight:700;color:${BRAND_INK};letter-spacing:-0.02em;">
  ${escapeHtml(req.fullName.trim())}${req.companyName ? ` &middot; ${escapeHtml(req.companyName.trim())}` : ''}
</h1>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  ${detailRow('Email', `<a href="mailto:${escapeHtml(req.email)}" style="color:${BRAND_PRIMARY};text-decoration:none;">${escapeHtml(req.email)}</a>`)}
  ${detailRow('Phone', `<a href="tel:${escapeHtml(req.phone)}" style="color:${BRAND_PRIMARY};text-decoration:none;">${escapeHtml(req.phone)}</a>`)}
  ${detailRow('Website', or(req.websiteUrl))}
  ${detailRow('Requested slot', escapeHtml(formatSlot(req)))}
  ${detailRow('Reply language', or(req.preferredLanguage))}
  ${detailRow('Business type', or(req.businessType))}
  ${detailRow('Selling today via', or(req.currentChannel))}
  ${detailRow('Monthly orders', or(req.monthlyOrders))}
  ${detailRow('Monthly GMV', or(req.monthlyGmvBand))}
  ${detailRow('Categories', list(req.productCategories))}
  ${detailRow('Interested plan', or(req.interestedPlan))}
  ${detailRow('Goals', list(req.goals))}
  ${detailRow('Heard about us', `${or(req.heardAboutUs)}${req.heardAboutDetail ? ` — ${escapeHtml(req.heardAboutDetail)}` : ''}`)}
  ${detailRow('Locale', or(req.locale))}
</table>

<p style="margin:18px 0 6px;font-family:${FONT_STACK};font-size:12px;font-weight:700;color:${TEXT_SUBTLE};text-transform:uppercase;letter-spacing:0.1em;">
  Why LetBuyy
</p>
<p style="margin:0;font-family:${FONT_STACK};font-size:14px;line-height:1.65;color:${TEXT_BODY};white-space:pre-wrap;">${or(req.whyLetbuyy)}</p>

<p style="margin:22px 0 0;font-family:${FONT_STACK};font-size:11px;color:${TEXT_SUBTLE};font-family:monospace;">${escapeHtml(req.id)}</p>`

    return {
        to: recipient,
        subject,
        text,
        html: shell(brand, body, `${req.fullName.trim()} — ${formatSlot(req)}`),
    }
}
