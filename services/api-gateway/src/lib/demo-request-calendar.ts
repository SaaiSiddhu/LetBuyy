/**
 * Calendar invite for a booked demo.
 *
 * Served as a real ICS file rather than a "click to add" link to a third-party
 * scheduler: an .ics opens natively in Apple Calendar, Google Calendar, Outlook
 * and every Android calendar app, needs no account, and keeps the booking on
 * our own origin.
 */

const CALENDAR_PRODID = '-//LetBuyy//Demo Scheduling//EN';
const DEFAULT_DURATION_MINUTES = 30;

export interface DemoCalendarInput {
    id: string;
    fullName: string;
    /** ISO instant. Null means nothing was booked, so there is no event. */
    preferredAt: string | null;
    supportEmail: string;
    siteUrl: string;
}

/** ICS wants UTC as YYYYMMDDTHHMMSSZ with no separators. */
function icsStamp(date: Date): string {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * RFC 5545 §3.1: lines are folded at 75 octets, continuation lines start with
 * a single space. Long summaries and URLs routinely exceed this, and an
 * unfolded file is rejected outright by Outlook.
 */
function fold(line: string): string {
    if (line.length <= 73) return line;
    const parts: string[] = [];
    let remaining = line;
    parts.push(remaining.slice(0, 73));
    remaining = remaining.slice(73);
    while (remaining.length > 72) {
        parts.push(` ${remaining.slice(0, 72)}`);
        remaining = remaining.slice(72);
    }
    if (remaining) parts.push(` ${remaining}`);
    return parts.join('\r\n');
}

/** Escape the characters ICS treats as structural. */
function icsText(value: string): string {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\r?\n/g, '\\n');
}

/** Returns null when no slot was chosen — there is nothing to put in a calendar. */
export function buildDemoCalendar(input: DemoCalendarInput): string | null {
    if (!input.preferredAt) return null;

    const start = new Date(input.preferredAt);
    if (Number.isNaN(start.getTime())) return null;
    const end = new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60_000);

    const description = [
        'Your LetBuyy demo.',
        '',
        'We will cover:',
        '1. A storefront set up against your own catalogue',
        '2. A live UPI and COD order taken through checkout',
        '3. The GST invoice it produces, end to end',
        '',
        `Need to move it? Reply to your confirmation email or write to ${input.supportEmail}.`,
        '',
        `Reference: ${input.id}`,
    ].join('\n');

    /* CRLF line endings throughout — RFC 5545 requires them, and Outlook
       rejects a file that uses bare LF. */
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        `PRODID:${CALENDAR_PRODID}`,
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        /* UID must be globally unique and STABLE: re-importing the same file,
           or a later reschedule, has to update the existing event rather than
           create a duplicate. The request id gives us exactly that. */
        `UID:demo-${input.id}@letbuyy.com`,
        `DTSTAMP:${icsStamp(new Date(0))}`,
        `DTSTART:${icsStamp(start)}`,
        `DTEND:${icsStamp(end)}`,
        fold(`SUMMARY:${icsText('LetBuyy demo · 30 minutes')}`),
        fold(`DESCRIPTION:${icsText(description)}`),
        fold(`URL:${input.siteUrl}`),
        'STATUS:CONFIRMED',
        'SEQUENCE:0',
        'TRANSP:OPAQUE',
        'BEGIN:VALARM',
        'TRIGGER:-PT30M',
        'ACTION:DISPLAY',
        fold(`DESCRIPTION:${icsText('LetBuyy demo in 30 minutes')}`),
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR',
    ];

    return `${lines.join('\r\n')}\r\n`;
}

/**
 * DTSTAMP is fixed at the epoch on purpose.
 *
 * It means the same request always produces a byte-identical file, so the
 * endpoint is cacheable and a re-download does not look like a modification to
 * a calendar client. SEQUENCE is what signals a genuine change, and it is
 * bumped explicitly if a booking is ever rescheduled.
 */
