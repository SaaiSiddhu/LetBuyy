import { BRAND_PROFILES } from '@letbuyy/shared-types';

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

const INK = '#0a0912';
const INK_SOFT = '#141122';
const PRIMARY = '#7c5cff';
const PRIMARY_DEEP = '#6944f5';
const ON_DARK = '#ffffff';
const ON_DARK_MUTED = 'rgba(255,255,255,0.60)';
const BODY = '#403a54';
const HEADING = '#14111f';
const SUBTLE = '#8b849c';
const CANVAS = '#f4f2fa';
const CARD = '#ffffff';
const HAIRLINE = '#ece8f8';

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
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function socialRow(): string {
    const entries: Array<[string, string]> = [
        ['X', BRAND_PROFILES.x],
        ['Instagram', BRAND_PROFILES.instagram],
        ['YouTube', BRAND_PROFILES.youtube],
        ['Facebook', BRAND_PROFILES.facebook],
        ['LinkedIn', BRAND_PROFILES.linkedin],
    ];
    return entries
        .filter(([, href]) => Boolean(href))
        .map(
            ([label, href]) =>
                `<a href="${href}" style="color:${ON_DARK_MUTED};text-decoration:none;font-size:12px;font-weight:500;">${label}</a>`,
        )
        .join(`<span style="color:rgba(255,255,255,0.20);padding:0 9px;">&#183;</span>`);
}

/**
 * The shell.
 *
 * `mso-hide` / conditional comments are avoided by keeping the structure
 * simple enough that Word renders it unaided — one 600px table, nested tables
 * for rows, no negative margins and no positioning.
 */
function shell(brand: DemoEmailBrand, bodyHtml: string, preheader: string): string {
    const logo = `${brand.assetUrl}/icons/letbuyy-logo-512.png`;

    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>LetBuyy</title>
<style>
  /* Progressive enhancement only. Everything the layout needs is inline, so a
     client that drops this block still renders correctly. */
  body { margin:0 !important; padding:0 !important; width:100% !important; }
  table { border-collapse:collapse !important; }
  img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
  a { text-decoration:none; }

  /* Phones. 600px is the historical safe width; below that the shell and its
     gutters have to shrink or the message scrolls sideways in the app. */
  @media only screen and (max-width:620px) {
    .lb-shell { width:100% !important; border-radius:0 !important; }
    .lb-pad { padding-left:22px !important; padding-right:22px !important; }
    .lb-pad-y { padding-top:26px !important; padding-bottom:26px !important; }
    .lb-h1 { font-size:21px !important; line-height:1.25 !important; }
    /* Label/value pairs stack rather than squeezing a 170px label column
       against a value that then wraps every second word. */
    .lb-row-label, .lb-row-value {
      display:block !important;
      width:100% !important;
      padding-left:0 !important;
      padding-right:0 !important;
    }
    .lb-row-label { padding-bottom:2px !important; }
    .lb-row-value { padding-bottom:12px !important; }
    .lb-cta { display:block !important; width:100% !important; text-align:center !important; }
    .lb-social a { display:inline-block !important; padding:4px 0 !important; }
  }

  /* Dark mode where the client honours it — Apple Mail, iOS, Outlook.com.
     Gmail ignores this, which is why the design already works on light. */
  @media (prefers-color-scheme: dark) {
    .lb-canvas { background:#08070d !important; }
    .lb-card { background:${INK_SOFT} !important; }
    .lb-h1, .lb-strong { color:${ON_DARK} !important; }
    .lb-body { color:rgba(255,255,255,0.72) !important; }
    .lb-muted { color:rgba(255,255,255,0.48) !important; }
    .lb-panel { background:rgba(255,255,255,0.05) !important; }
    .lb-hairline { border-color:rgba(255,255,255,0.10) !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${CANVAS};">
<!-- Preheader: the grey line inboxes show beside the subject. Padded so a
     client does not pull body copy in after it. -->
<div style="display:none;font-size:1px;color:${CANVAS};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  ${escapeHtml(preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
</div>

<table role="presentation" class="lb-canvas" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CANVAS};">
<tr><td align="center" style="padding:32px 12px;">

<table role="presentation" class="lb-shell lb-card" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${CARD};border-radius:20px;overflow:hidden;">

  <!-- Header. Dark band so the light wordmark reads in every client, and a
       thin accent rule beneath it so the panel has an edge without a border. -->
  <tr><td class="lb-pad" style="background:${INK};padding:26px 34px;">
    <a href="${brand.siteUrl}" style="text-decoration:none;">
      <img src="${logo}" width="128" height="42" alt="LetBuyy"
           style="display:block;height:42px;width:128px;color:${ON_DARK};font-family:${FONT};font-size:19px;font-weight:700;letter-spacing:-0.02em;" />
    </a>
  </td></tr>
  <tr><td style="height:3px;background:linear-gradient(90deg,${PRIMARY} 0%,${PRIMARY_DEEP} 55%,#3ecfb2 100%);font-size:0;line-height:0;">&nbsp;</td></tr>

  <tr><td class="lb-pad lb-pad-y" style="padding:34px;font-family:${FONT};">${bodyHtml}</td></tr>

  <!-- Footer -->
  <tr><td class="lb-pad" style="background:${INK};padding:26px 34px;font-family:${FONT};">
    <p class="lb-muted" style="margin:0 0 14px;color:${ON_DARK_MUTED};font-size:12.5px;line-height:1.65;">
      LetBuyy — an India-first commerce operating system.<br />
      Questions? Reply to this email, or write to
      <a href="mailto:${brand.supportEmail}" style="color:#c9b8ff;text-decoration:underline;">${brand.supportEmail}</a>.
    </p>
    <p class="lb-social" style="margin:0 0 12px;">${socialRow()}</p>
    <p style="margin:0;color:rgba(255,255,255,0.30);font-size:11px;line-height:1.5;">
      You are receiving this because you requested a LetBuyy demo.
    </p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}

/** Bulletproof-ish button: table-wrapped so Word fills the background. */
function button(href: string, label: string): string {
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 6px;">
<tr><td class="lb-cta" align="center" style="background:${PRIMARY};border-radius:11px;">
<a href="${href}" class="lb-cta" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:14.5px;font-weight:650;color:#ffffff;letter-spacing:-0.01em;">${label}</a>
</td></tr></table>`;
}

/** One label/value pair. Stacks on narrow screens via .lb-row-* classes. */
function row(label: string, value: string, last = false): string {
    const border = last ? '' : `border-bottom:1px solid ${HAIRLINE};`;
    return `<tr>
<td class="lb-row-label lb-hairline lb-muted" style="${border}padding:11px 16px 11px 0;font-family:${FONT};font-size:11.5px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${SUBTLE};width:168px;vertical-align:top;">${label}</td>
<td class="lb-row-value lb-hairline lb-body" style="${border}padding:11px 0;font-family:${FONT};font-size:14px;line-height:1.55;color:${BODY};">${value}</td>
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
    const slot = escapeHtml(formatSlot(req));
    const subject = 'Your LetBuyy demo request — received';

    const text = [
        `Hi ${firstNameRaw},`,
        '',
        'We have your demo request. A member of the team will confirm your slot within one working day.',
        '',
        `Requested time: ${formatSlot(req)}`,
        `Reference: ${req.id}`,
        '',
        'What the call covers:',
        '  1. A storefront set up against your own catalogue',
        '  2. A live UPI and COD order taken through checkout',
        '  3. The GST invoice it produces, end to end',
        '',
        `Browse pricing meanwhile: ${brand.siteUrl}/in/pricing`,
        '',
        `Questions? Reply to this email or write to ${brand.supportEmail}.`,
        '',
        '— The LetBuyy team',
    ].join('\n');

    const body = `
<p class="lb-muted" style="margin:0 0 10px;font-size:11.5px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${PRIMARY};">
  Request received
</p>
<h1 class="lb-h1" style="margin:0 0 14px;font-size:26px;line-height:1.2;font-weight:750;color:${HEADING};letter-spacing:-0.03em;">
  Your demo request is in, ${firstName}.
</h1>
<p class="lb-body" style="margin:0 0 24px;font-size:15px;line-height:1.65;color:${BODY};">
  A member of the team will confirm your slot within one working day. If the time
  below stops working, just reply to this email and we will move it.
</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       class="lb-panel" style="background:${CANVAS};border-radius:14px;">
  <tr><td style="padding:6px 20px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${row('Requested time', slot)}
      ${row('Reference', `<span style="font-family:${MONO};font-size:12.5px;color:${SUBTLE};">${escapeHtml(req.id)}</span>`, true)}
    </table>
  </td></tr>
</table>

<p class="lb-strong" style="margin:28px 0 12px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${SUBTLE};">
  What we will show you
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  ${[
      'A storefront set up against your own catalogue',
      'A live UPI and COD order taken through checkout',
      'The GST invoice it produces, end to end',
  ]
      .map(
          (item, index) => `<tr>
<td width="26" valign="top" style="padding:5px 0;font-family:${MONO};font-size:12px;font-weight:700;color:${PRIMARY};">${index + 1}</td>
<td class="lb-body" style="padding:5px 0;font-family:${FONT};font-size:14px;line-height:1.6;color:${BODY};">${item}</td>
</tr>`,
      )
      .join('')}
</table>

${button(`${brand.siteUrl}/in/pricing`, 'See pricing while you wait')}

<p class="lb-muted" style="margin:16px 0 0;font-size:12.5px;line-height:1.6;color:${SUBTLE};">
  Nothing is charged for a demo, and no card is required to start a store.
</p>`;

    return {
        to,
        subject,
        text,
        html: shell(
            brand,
            body,
            'We have your demo request — a slot confirmation follows within one working day.',
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
<p class="lb-muted" style="margin:0 0 22px;font-size:14px;color:${SUBTLE};">${escapeHtml(company)}</p>

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
