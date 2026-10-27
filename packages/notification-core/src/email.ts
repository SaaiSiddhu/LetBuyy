import { BRAND_PROFILES, DEFAULT_PLATFORM_ORIGIN, DEFAULT_PLATFORM_DOMAIN } from '@letbuyy/shared-types';

/**
 * The LetBuyy transactional email shell.
 *
 * One branded chrome — header, footer, buttons, tables, dark mode — so every
 * message we send looks like it came from the same company. Templates supply
 * only the middle.
 *
 * EMAIL IS NOT THE WEB. Four constraints shape everything below:
 *   • Tables, not flex or grid — Outlook renders with Word, which supports
 *     neither, and it is still a large share of B2B inboxes.
 *   • Inline styles carry the design. Gmail strips <style> blocks in several
 *     contexts, so the <style> block may only ADD (dark mode, breakpoints) and
 *     may never be the only place a rule lives.
 *   • No external CSS, no webfonts, no SVG. SVG in particular is stripped by
 *     Gmail, which is why the mark below is a PNG.
 *   • Images are blocked by default in many clients, so nothing essential —
 *     including the wordmark — may exist only inside an image.
 *
 * DARK MODE. Handled honestly rather than optimistically:
 *   • the header and footer panels are dark in BOTH schemes, so the light
 *     wordmark on them always reads. Swapping the logo per scheme would look
 *     clever and break the moment a client (Gmail) ignores the media query, or
 *     auto-inverts the background but not the image.
 *   • the middle of the message DOES follow the reader's scheme, via the
 *     prefers-color-scheme block. Clients that honour it (Apple Mail, iOS,
 *     Outlook.com) get a real dark email; clients that do not keep the light
 *     one, which is a correct design rather than a degraded one.
 *   • `color-scheme` is declared so iOS and macOS Mail stop auto-inverting and
 *     let the rules below do the work.
 */

/* Palette. Deliberately literal: an email cannot resolve a CSS variable in
   Outlook, so the token values are frozen here at the boundary. */
const INK = '#271F2D';
const INK_RAISED = '#2D2431';
const PANEL = '#271F2D';
const PRIMARY = '#6A436B';
const PRIMARY_SOFT = '#D7BE98';
const ON_DARK = '#F4F0F5';
const ON_DARK_MUTED = '#D7BE98';
const ON_DARK_FAINT = '#D7BE98';
const HAIRLINE_DARK = '#8B7C90';

const TEXT_STRONG = '#2D2431';
const TEXT_BODY = '#6A5E70';
const TEXT_SUBTLE = '#6A5E70';
const SURFACE = '#F4F0F5';
const SURFACE_RAISED = '#FFFFFF';
const HAIRLINE = '#8B7C90';

export const EMAIL_FONT_STACK =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
const MONO_STACK = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";

export interface LetbuyyEmailBrand {
    /** Absolute origin of the marketing site — every LINK resolves against it. */
    siteUrl: string;
    /**
     * Origin that email IMAGES are fetched from. Separate from siteUrl on
     * purpose: a mail client is not on your network, so a localhost or preview
     * siteUrl renders the logo as a broken-image box in the inbox. Callers pass
     * EMAIL_ASSET_BASE_URL, which is always a publicly reachable origin.
     */
    assetUrl: string;
    supportEmail: string;
}

export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Only known-safe schemes survive.
 *
 * Every href in these templates is built from submitted data or configuration,
 * and `javascript:` in an anchor is a live XSS in the handful of clients that
 * still honour it. `data:` is the same story. Anything outside the allowlist
 * collapses to the fallback.
 *
 * `tel:` is on the list deliberately: it is the scheme behind the Call button
 * in the internal alert, and leaving it off does not fail loudly — it silently
 * rewrites the button to the marketing site, which looks like it works.
 *
 * A bare hostname (`instagram.com/shop`, which is what people actually type
 * into a website field) is promoted to https rather than dropped, so a real
 * answer is not lost to a missing scheme.
 */
export function safeHref(value: string, fallback: string): string {
    const candidate = value.trim();
    if (!candidate) return escapeHtml(fallback);

    if (/^(?:https?:\/\/|mailto:|tel:)/i.test(candidate)) return escapeHtml(candidate);

    /* No scheme at all AND no colon anywhere — a colon here would mean some
       other scheme trying to sneak past, so those fall through to the
       fallback rather than being prefixed into something valid. */
    if (!candidate.includes(':') && /^[\w-]+(\.[\w-]+)+/.test(candidate)) {
        return escapeHtml(`https://${candidate}`);
    }

    return escapeHtml(fallback);
}

/**
 * Strip anything that could break out of a header value.
 *
 * Subjects are built from submitted text (a person's own subject line, their
 * name). CR/LF in a header is the classic injection, and although the Resend
 * API takes JSON rather than raw SMTP, relying on a downstream service to
 * sanitise our input is not a control we own. Collapsed to spaces and capped,
 * because a 4,000-character subject is its own kind of broken.
 */
export function safeSubject(value: string, max = 180): string {
    const flattened = value.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    return flattened.length > max ? `${flattened.slice(0, max - 1)}…` : flattened;
}

function socialRow(): string {
    const entries: Array<[string, string]> = [
        ['Instagram', BRAND_PROFILES.instagram],
        ['X', BRAND_PROFILES.x],
        ['YouTube', BRAND_PROFILES.youtube],
        ['Facebook', BRAND_PROFILES.facebook],
        ['LinkedIn', BRAND_PROFILES.linkedin],
    ];

    /* Word marks rather than icon images. Image blocking is on by default in a
       lot of inboxes, and a row of broken-image boxes reads as a broken email;
       five words never do. Empty profiles are dropped rather than linked to
       nowhere — BRAND_PROFILES carries blanks for accounts not yet claimed. */
    return entries
        .filter(([, href]) => Boolean(href))
        .map(
            ([label, href]) =>
                `<a href="${safeHref(href, 'https://letbuyy.com')}" style="color:${ON_DARK_MUTED};text-decoration:none;font-size:12px;font-weight:600;padding:0 9px;">${label}</a>`,
        )
        .join(`<span style="color:${ON_DARK_FAINT};">&middot;</span>`);
}

export interface EmailShellOptions {
    /** The grey line inboxes print after the subject. Write it; do not leave it to chance. */
    preheader: string;
    /** Security mail stays focused on the requested account action. */
    category?: 'security' | 'onboarding' | 'transactional';
    /** Footer line explaining why this message arrived. Required — it is what keeps us out of spam. */
    reason: string;
    /** Optional small print under the reason, e.g. a ticket reference. */
    footnote?: string;
}

export function renderEmailShell(
    brand: LetbuyyEmailBrand,
    bodyHtml: string,
    options: EmailShellOptions,
): string {
    const site = brand.siteUrl.replace(/\/+$/, '');
    const mark = `${brand.assetUrl.replace(/\/+$/, '')}/icons/letbuyy-logo-512.png`;

    return `<!DOCTYPE html>
<html lang="en" style="margin:0;padding:0;">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>LetBuyy</title>
<style>
  /* Additive only. Every rule below has an inline light-mode counterpart, so a
     client that strips this block still renders a complete email. */
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  a { text-decoration: none; }
  @media (max-width: 620px) {
    .lb-pad { padding-left: 22px !important; padding-right: 22px !important; }
    .lb-h1 { font-size: 22px !important; }
    .lb-label { border-bottom:0 !important; display: block !important; width: 100% !important; padding-bottom: 2px !important; }
    .lb-value { display: block !important; width: 100% !important; padding-top: 0 !important; }
    /* Both the inline-block wrapper AND the td inside it. Widening only the
       td does nothing: its parent table is shrink-to-fit, so the cell has no
       width to grow into and the button stays its natural size. */
    .lb-cta, .lb-cta table, .lb-cta tr, .lb-cta td, .lb-cta a { display: block !important; width: 100% !important; }
  }
  @media (prefers-color-scheme: dark) {
    .lb-canvas { background: ${INK} !important; }
    .lb-card { background: ${INK_RAISED} !important; }
    .lb-strong { color: ${ON_DARK} !important; }
    .lb-body { color: ${ON_DARK} !important; }
    .lb-accent { color: ${PRIMARY_SOFT} !important; }
    .lb-subtle { color: ${ON_DARK_MUTED} !important; }
    .lb-well { background: ${PANEL} !important; }
    .lb-rule { border-color: ${HAIRLINE_DARK} !important; }
    .lb-hairline td { border-bottom-color: ${HAIRLINE_DARK} !important; }
  }
</style>
</head>
<body class="lb-canvas" style="margin:0;padding:0;background:${SURFACE};-webkit-font-smoothing:antialiased;">
<!-- Preheader. Hidden in the body itself, otherwise the line prints twice. The
     trailing whitespace stops the client from padding it with body copy. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(options.preheader)}&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="lb-canvas" style="background:${SURFACE};">
<tr><td align="center" style="padding:28px 14px 40px;">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="lb-card" style="width:100%;max-width:600px;background:${SURFACE_RAISED};border-radius:20px;overflow:hidden;box-shadow:0 1px 2px rgba(20,17,34,0.04),0 12px 32px rgba(20,17,34,0.07);">

  <!-- Header. Dark in both schemes, so the light wordmark always reads. -->
  <tr><td style="background:${INK};padding:0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td class="lb-pad" style="padding:24px 32px 22px;" valign="middle">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="40" valign="middle" style="padding-right:12px;">
                <a href="${safeHref(site, 'https://letbuyy.com')}">
                  <img src="${escapeHtml(mark)}" width="40" height="40" alt="LetBuyy"
                       style="display:block;border:0;outline:none;width:40px;height:40px;border-radius:11px;">
                </a>
              </td>
              <td valign="middle">
                <!-- The wordmark is TEXT, not part of the image, so the brand
                     still reads when images are blocked. -->
                <a href="${safeHref(site, 'https://letbuyy.com')}" style="font-family:${EMAIL_FONT_STACK};font-size:19px;font-weight:700;letter-spacing:-0.02em;color:${ON_DARK};text-decoration:none;">LetBuyy</a>
                <div style="font-family:${EMAIL_FONT_STACK};font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:${ON_DARK_FAINT};padding-top:3px;">Commerce, built for India</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <!-- Brand rule. A gradient in clients that render one, a solid brand line
         everywhere else — the fallback colour is on the element itself. -->
    <div style="height:3px;line-height:3px;font-size:0;background:${PRIMARY};background-image:linear-gradient(90deg,${PRIMARY},${PRIMARY_SOFT});">&nbsp;</div>
  </td></tr>

  <!-- Body -->
  <tr><td class="lb-pad lb-body" style="padding:34px 32px 30px;color:${TEXT_BODY};font-family:${EMAIL_FONT_STACK};overflow-wrap:anywhere;word-break:break-word;">${bodyHtml}</td></tr>

  <!-- Footer. Dark in both schemes, matching the header. -->
  <tr><td style="background:${PANEL};padding:26px 32px;font-family:${EMAIL_FONT_STACK};" class="lb-pad">
    <p style="margin:0 0 14px;color:${ON_DARK_MUTED};font-size:12.5px;line-height:1.65;">
      <strong style="color:${ON_DARK};font-weight:650;">LetBuyy</strong> — an India-first commerce operating system.<br>
      Reply to this email, or write to
      <a href="mailto:${escapeHtml(brand.supportEmail)}" style="color:${PRIMARY_SOFT};text-decoration:none;font-weight:600;">${escapeHtml(brand.supportEmail)}</a>.
    </p>
    ${options.category === 'security' ? '' : `<p style="margin:0 0 14px;">${socialRow()}</p>`}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="border-top:1px solid ${HAIRLINE_DARK};padding-top:13px;">
        <p style="margin:0 0 6px;color:${ON_DARK_FAINT};font-size:11px;line-height:1.6;">${escapeHtml(options.reason)}</p>
        ${options.footnote ? `<p style="margin:0 0 6px;color:${ON_DARK_FAINT};font-size:11px;line-height:1.6;">${options.footnote}</p>` : ''}
        <p style="margin:0;color:${ON_DARK_FAINT};font-size:11px;line-height:1.6;">
          <a href="${safeHref(`${site}/in/legal/privacy`, 'https://letbuyy.com')}" style="color:${ON_DARK_FAINT};text-decoration:underline;">Privacy</a>
          &nbsp;&middot;&nbsp;
          <a href="${safeHref(`${site}/in/legal/terms`, 'https://letbuyy.com')}" style="color:${ON_DARK_FAINT};text-decoration:underline;">Terms</a>
          &nbsp;&middot;&nbsp;
          <a href="${safeHref(`${site}/in/contact`, 'https://letbuyy.com')}" style="color:${ON_DARK_FAINT};text-decoration:underline;">Contact</a>
        </p>
      </td></tr>
    </table>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}

/* ─── Body primitives ─────────────────────────────────────────────────────── */

export function eyebrow(text: string, color = PRIMARY): string {
    return `<p class="lb-accent" style="margin:0 0 8px;font-family:${EMAIL_FONT_STACK};font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${color};">${escapeHtml(text)}</p>`;
}

export function heading(html: string): string {
    return `<h1 class="lb-h1 lb-strong" style="margin:0 0 14px;font-family:${EMAIL_FONT_STACK};font-size:25px;line-height:1.22;font-weight:750;letter-spacing:-0.025em;color:${TEXT_STRONG};">${html}</h1>`;
}

export function paragraph(html: string): string {
    return `<p class="lb-body" style="margin:0 0 18px;font-family:${EMAIL_FONT_STACK};font-size:14.5px;line-height:1.68;color:${TEXT_BODY};">${html}</p>`;
}

export function smallPrint(html: string): string {
    return `<p class="lb-subtle" style="margin:16px 0 0;font-family:${EMAIL_FONT_STACK};font-size:12.5px;line-height:1.6;color:${TEXT_SUBTLE};">${html}</p>`;
}

/** Table-wrapped so Outlook renders the fill; a styled <a> alone collapses there. */
export function ctaButton(href: string, label: string, variant: 'primary' | 'ghost' = 'primary'): string {
    const isPrimary = variant === 'primary';
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="lb-cta" style="display:inline-block;width:auto;margin:0 8px 8px 0;">
<tr><td align="center" style="${isPrimary ? `background:${PRIMARY};` : `background:transparent;border:1px solid ${HAIRLINE};`}border-radius:11px;">
<a href="${safeHref(href, 'https://letbuyy.com')}" style="display:inline-block;box-sizing:border-box;line-height:20px;padding:${isPrimary ? '13px 26px' : '12px 25px'};font-family:${EMAIL_FONT_STACK};font-size:14px;font-weight:650;color:${isPrimary ? ON_DARK : TEXT_STRONG};text-decoration:none;" class="${isPrimary ? '' : 'lb-strong'}">${escapeHtml(label)}</a>
</td></tr></table>`;
}

export function ctaRow(buttons: string[]): string {
    return `<div style="margin:22px 0 4px;">${buttons.join('')}</div>`;
}

/**
 * The ticket panel — the single most important thing in an acknowledgement,
 * so it gets its own slab rather than a line in a table.
 */
export function ticketPanel(input: {
    ticketRef: string;
    subjectLine: string;
    responseLine: string;
}): string {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="lb-well" style="background:${SURFACE};border-radius:14px;margin:0 0 22px;">
<tr><td style="padding:20px 22px;font-family:${EMAIL_FONT_STACK};">
  <p class="lb-subtle" style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${TEXT_SUBTLE};">Your ticket</p>
  <p style="margin:0 0 12px;font-family:${MONO_STACK};font-size:23px;font-weight:700;letter-spacing:0.02em;color:${PRIMARY};">${escapeHtml(input.ticketRef)}</p>
  <p class="lb-strong" style="margin:0 0 4px;font-size:14.5px;font-weight:650;line-height:1.45;color:${TEXT_STRONG};">${escapeHtml(input.subjectLine)}</p>
  <p class="lb-subtle" style="margin:0;font-size:13px;line-height:1.55;color:${TEXT_SUBTLE};">${escapeHtml(input.responseLine)}</p>
</td></tr></table>`;
}

export function sectionLabel(text: string): string {
    return `<p class="lb-subtle" style="margin:24px 0 8px;font-family:${EMAIL_FONT_STACK};font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${TEXT_SUBTLE};">${escapeHtml(text)}</p>`;
}

/** `value` is raw HTML so callers can pass a mailto/tel link. Escape before calling. */
export function detailRow(label: string, value: string): string {
    return `<tr class="lb-hairline">
<td class="lb-label lb-subtle" width="168" style="padding:10px 12px 10px 0;border-bottom:1px solid ${HAIRLINE};font-family:${EMAIL_FONT_STACK};font-size:12px;line-height:1.5;color:${TEXT_SUBTLE};vertical-align:top;">${escapeHtml(label)}</td>
<td class="lb-value lb-body" style="padding:10px 0;border-bottom:1px solid ${HAIRLINE};font-family:${EMAIL_FONT_STACK};font-size:13.5px;line-height:1.55;color:${TEXT_BODY};vertical-align:top;">${value}</td>
</tr>`;
}

export function detailTable(rows: string[]): string {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rows.join('')}</table>`;
}

/** Submitted free text. Pre-wrapped so the paragraphs the person typed survive. */
export function quotedBlock(text: string): string {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="lb-well" style="background:${SURFACE};border-radius:12px;">
<tr><td style="padding:16px 18px;border-left:3px solid ${PRIMARY};border-radius:12px;">
<p class="lb-body" style="margin:0;font-family:${EMAIL_FONT_STACK};font-size:13.5px;line-height:1.7;color:${TEXT_BODY};white-space:pre-wrap;">${escapeHtml(text)}</p>
</td></tr></table>`;
}

/** Coloured priority chip for the internal alert. */
export function badge(text: string, tone: 'hot' | 'warm' | 'neutral' | 'critical'): string {
    const tones: Record<typeof tone, { bg: string; fg: string }> = {
        hot: { bg: '#fef1f1', fg: '#b42318' },
        warm: { bg: '#fff6e8', fg: '#b54708' },
        neutral: { bg: '#eef0f6', fg: '#475069' },
        critical: { bg: '#b42318', fg: '#ffffff' },
    };
    const { bg, fg } = tones[tone];
    return `<span style="display:inline-block;background:${bg};color:${fg};font-family:${EMAIL_FONT_STACK};font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;padding:5px 10px;border-radius:999px;margin:0 6px 6px 0;">${escapeHtml(text)}</span>`;
}

export function divider(): string {
    return `<div class="lb-rule" style="border-top:1px solid ${HAIRLINE};margin:26px 0 0;"></div>`;
}

/** One readable, copyable code. The sender owns code validity and expiry. */
export function verificationCode(code: string): string {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="lb-well" style="background:${SURFACE};border:1px solid ${HAIRLINE};border-radius:14px;margin:24px 0;">
<tr><td align="center" style="padding:24px 18px;"><p class="lb-strong" dir="ltr" style="margin:0;font-family:${MONO_STACK};font-size:34px;font-weight:700;line-height:1.3;letter-spacing:0.18em;color:${TEXT_STRONG};">${escapeHtml(code)}</p></td></tr></table>`;
}

export const DEFAULT_EMAIL_BRAND: LetbuyyEmailBrand = Object.freeze({
    siteUrl: DEFAULT_PLATFORM_ORIGIN,
    assetUrl: DEFAULT_PLATFORM_ORIGIN,
    supportEmail: `support@${DEFAULT_PLATFORM_DOMAIN}`,
});

export type RenderedEmailMessage = { subject: string; html: string; text: string };

/** One configured mailbox, with a stable brand label; never double-wrap a display-name sender. */
export function formatEmailSender(configured: string | undefined): string {
    const value = (configured || `noreply@${DEFAULT_PLATFORM_DOMAIN}`).trim();
    if (/[\r\n]/.test(value)) throw new Error('Invalid email sender configuration');
    const address = /^([^<>]+)<([^<>]+)>$/.exec(value)?.[2].trim() || value;
    if (!/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(address)) throw new Error('Invalid email sender configuration');
    return `LetBuyy <${address}>`;
}
