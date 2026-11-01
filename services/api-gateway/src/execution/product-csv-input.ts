import { CreateProductSchema } from '@letbuyy/commerce-core';
import { PRODUCT_IMPORT_MAX_ROWS } from '@letbuyy/shared-types';

export class CsvInputError extends Error {
    constructor(readonly publicMessage: string, readonly code = 'INVALID_CSV', readonly status: 400 | 413 = 400) {
        super(publicMessage);
        this.name = 'CsvInputError';
    }
}

/** One bounded pass: record separators inside quoted fields are data. */
export function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [], pieces: string[] = [];
    let start = text.charCodeAt(0) === 0xfeff ? 1 : 0;
    let quoted = false, closed = false, wasQuoted = false;
    const field = (end: number) => {
        pieces.push(text.slice(start, end));
        const value = pieces.join('');
        row.push(wasQuoted ? value : value.trim());
        pieces = []; wasQuoted = false; closed = false;
    };
    const record = () => {
        if (row.some(value => value.trim() !== '')) {
            rows.push(row);
            if (rows.length > PRODUCT_IMPORT_MAX_ROWS + 1) throw new CsvInputError(`Product CSV imports are capped at ${PRODUCT_IMPORT_MAX_ROWS} rows per job`, 'IMPORT_TOO_LARGE', 413);
        }
        row = [];
    };
    for (let index = start; index < text.length; index++) {
        const ch = text[index];
        if (quoted) {
            if (ch !== '"') continue;
            pieces.push(text.slice(start, index));
            if (text[index + 1] === '"') { pieces.push('"'); index++; start = index + 1; }
            else { quoted = false; closed = true; start = index + 1; }
            continue;
        }
        if (ch === ',' || ch === '\r' || ch === '\n') {
            field(closed ? start : index);
            if (ch !== ',') {
                record();
                if (ch === '\r' && text[index + 1] === '\n') index++;
            }
            start = index + 1;
        } else if (ch === '"') {
            if (closed || text.slice(start, index).trim() !== '') throw new CsvInputError('CSV contains an unexpected quote.');
            quoted = true; wasQuoted = true; start = index + 1;
        } else if (closed && ch !== ' ' && ch !== '\t') {
            throw new CsvInputError('CSV contains text after a closing quote.');
        }
    }
    if (quoted) throw new CsvInputError('CSV contains an unclosed quoted field.');
    if (start < text.length || pieces.length || wasQuoted || row.length) {
        field(closed ? start : text.length);
        record();
    }
    return rows;
}

export function productCsvInputs(csv: string, storeId: string) {
    if(csv.includes('\u0000')||new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(new TextEncoder().encode(csv))!==csv)
        throw new CsvInputError('CSV contains invalid text. Save a valid UTF-8 CSV without null characters.');
    const rows = parseCsv(csv);
    if (rows.length < 2) throw new CsvInputError('CSV must have headers and at least one product row.');
    const headers = rows[0].map(value => value.trim().toLowerCase());
    if (!headers.includes('name')) throw new CsvInputError('CSV must have a "name" column.');
    if (new Set(headers).size !== headers.length) throw new CsvInputError('CSV column names must be unique.');
    const supported = new Set(['name','price','description','category','stock','tags','images']);
    if(headers.some(header=>!supported.has(header)))throw new CsvInputError('CSV has unsupported columns. Use name, price, description, category, stock, tags and images.');
    const index = (name: string) => headers.indexOf(name);
    const name = index('name'), price = index('price'), description = index('description'), category = index('category');
    const stock = index('stock'), tags = index('tags'), images = index('images');
    return rows.slice(1).map((row, position) => {
        if (row.length > headers.length) throw new CsvInputError(`CSV row ${position + 2} has more fields than the header.`);
        const parsed = CreateProductSchema.safeParse({
            store_id: storeId, name: row[name] || '',
            description: description >= 0 ? row[description] || '' : '',
            price: price >= 0 && row[price]?.trim() ? Number(row[price]) : 0,
            category: category >= 0 ? row[category] || undefined : undefined,
            stock: stock >= 0 && row[stock]?.trim() ? Number(row[stock]) : 0,
            tags: tags >= 0 && row[tags] ? row[tags].split(';').map(value => value.trim()).filter(Boolean) : [],
            images: images >= 0 && row[images] ? row[images].split(';').map(value => value.trim()).filter(Boolean) : [],
            is_active: true,
        });
        if (!parsed.success) {
            const key = parsed.error.issues[0]?.path.join('.') || 'fields';
            throw new CsvInputError(`CSV row ${position + 2} has an invalid ${key}.`);
        }
        return parsed.data;
    });
}

