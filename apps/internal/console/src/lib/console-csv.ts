/** Spreadsheet-safe CSV cell; numeric values keep their numeric meaning. */
export function consoleCsvCell(value: string | number | null | undefined): string {
    let text = value == null ? '' : String(value);
    if (typeof value === 'string' && /^\s*[=+\-@]/u.test(text)) text = "'" + text;
    return /[",\r\n]/u.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}
