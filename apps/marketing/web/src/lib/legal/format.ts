/**
 * Legal dates are rendered in en-IN long form ("3 August 2026") rather than a
 * numeric format: 03/08/2026 and 08/03/2026 are the same string to a machine
 * and opposite dates to a reader, and an effective date is exactly the wrong
 * thing to leave ambiguous.
 */
export function formatLegalDate(iso: string): string {
    if (!iso) return 'Not yet set'

    const date = new Date(`${iso}T00:00:00.000Z`)
    if (Number.isNaN(date.getTime())) return 'Not yet set'

    return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(date)
}

/** Clause numbering: "01", "02" … stable against edits to the text itself. */
export function clauseNumber(index: number): string {
    return String(index + 1).padStart(2, '0')
}
