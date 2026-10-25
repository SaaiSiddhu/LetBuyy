import type { ProductVariant } from '@letbuyy/commerce-core';
export type PickerVariant = Pick<Partial<ProductVariant>, 'id' | 'price' | 'options' | 'stock' | 'stock_quantity' | 'inventory_qty'> & {
    label?: string;
    factPresentation?: VariantFactDisplay;
};
/** Option labels are data. They need not be JavaScript identifiers. */
function readOptions(value: unknown): Record<string, string> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const fields = Object.getOwnPropertyDescriptors(value);
    const entries = Object.entries(fields);
    if (entries.length > 10) {
        return null;
    }
    const result = Object.create(null) as Record<string, string>;
    for (const [key, field] of entries) {
        if (!key.length || key.length > 100 || !('value' in field) || typeof field.value !== 'string' || field.value.length > 100) {
            return null;
        }
        result[key] = field.value;
    }
    return result;
}
/** Bounded scalar carrier survives the generic Liquid identifier/depth scrub unchanged. */
export function encodeVariantOptions(value: unknown): string | undefined {
    const options = readOptions(value);
    return options ? JSON.stringify(options).replace(/[<>&]/g, character => ({ '<': '\\u003c', '>': '\\u003e', '&': '\\u0026' })[character]!) : undefined;
}
export function parsePickerVariants(serialized: string | undefined): PickerVariant[] {
    if (!serialized || serialized.length > 1048576) {
        return [];
    }
    let rows: unknown;
    try {
        rows = JSON.parse(serialized);
    }
    catch {
        return [];
    }
    if (!Array.isArray(rows) || rows.length > 100) {
        return [];
    }
    return rows.flatMap((row: unknown) => {
        if (!row || typeof row !== 'object' || Array.isArray(row)) {
            return [];
        }
        const input = row as Record<string, unknown>;
        let options: Record<string, string> | null;
        if (Object.hasOwn(input, 'options_json')) {
            if (typeof input.options_json !== 'string' || input.options_json.length > 16384) {
                return [];
            }
            try {
                options = readOptions(JSON.parse(input.options_json));
            }
            catch {
                return [];
            }
        }
        else {
            options = readOptions(input.options);
        }
        if (!options || typeof input.id !== 'string' || !input.id || input.id.length > 100) {
            return [];
        }
        const number = (key: string): number | undefined => typeof input[key] === 'number' && Number.isFinite(input[key]) && input[key] >= 0 ? input[key] : undefined;
        const label = [input.title, input.name].find((value): value is string => typeof value === 'string' && value.length <= 200 && value.trim().length > 0);
        const facts = parseVariantFactPresentation(input.facts_json);
        return [{ id: input.id, options, price: number('price'), stock: number('stock'), stock_quantity: number('stock_quantity'), inventory_qty: number('inventory_qty'), ...(label ? { label } : {}), ...(facts ? { factPresentation: facts } : {}) }];
    });
}
/** Display-only facts, already resolved by commerce-core. Never a persistence DTO. */
export interface VariantFactDisplay {
    food?: {
        netQuantityValue: number;
        netQuantityUnit: 'g' | 'ml';
        basisQuantity: 100;
        unitPriceMinor?: number;
    };
    furniture?: Partial<Record<'assembled' | 'package' | 'weight' | 'seat_height' | 'materials' | 'assembly' | 'care', string>>;
    sports?: Partial<Record<'length' | 'weight' | 'grip' | 'dimensions', string>>;
    toys?: Partial<Record<'age' | 'contents' | 'dimensions' | 'additional_dimensions' | 'materials' | 'finish' | 'care' | 'warnings', string>>;
    books?: Partial<Record<'authors' | 'language' | 'format' | 'edition' | 'dimensions', string>>;
}
export const MAX_VARIANT_FACT_CARRIER_BYTES = 32768;
export const MAX_PRODUCT_FACT_CARRIER_BYTES = 131072;
const DISPLAY_KEYS = {
    furniture: ['assembled', 'package', 'weight', 'seat_height', 'materials', 'assembly', 'care'],
    sports: ['length', 'weight', 'grip', 'dimensions'],
    toys: ['age', 'contents', 'dimensions', 'additional_dimensions', 'materials', 'finish', 'care', 'warnings'],
    books: ['authors', 'language', 'format', 'edition', 'dimensions'],
} as const;
const ownValue = (value: unknown, key: string): unknown => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }
    const field = Object.getOwnPropertyDescriptor(value, key);
    return field && 'value' in field ? field.value : undefined;
};
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
function readFactDisplay(value: unknown, strict: boolean): VariantFactDisplay | null {
    if (!record(value)) {
        return null;
    }
    if (strict && Object.keys(value).some(key => !['food', ...Object.keys(DISPLAY_KEYS)].includes(key))) {
        return null;
    }
    const output: VariantFactDisplay = {};
    const food = ownValue(value, 'food');
    if (food !== undefined) {
        if (!record(food)) {
            return null;
        }
        if (strict && Object.keys(food).some(key => !['netQuantityValue', 'netQuantityUnit', 'basisQuantity', 'unitPriceMinor'].includes(key))) {
            return null;
        }
        const quantity = ownValue(food, 'netQuantityValue'), unit = ownValue(food, 'netQuantityUnit'), price = ownValue(food, 'unitPriceMinor');
        if (quantity !== undefined || unit !== undefined) {
            if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0 || quantity > 1000000000 || (unit !== 'g' && unit !== 'ml')) {
                return null;
            }
            if (strict && ownValue(food, 'basisQuantity') !== 100) {
                return null;
            }
            if (price !== undefined && (typeof price !== 'number' || !Number.isSafeInteger(price) || price < 0)) {
                return null;
            }
            output.food = { netQuantityValue: quantity, netQuantityUnit: unit as 'g' | 'ml', basisQuantity: 100, ...(price !== undefined ? { unitPriceMinor: price as number } : {}) };
        }
        else if (strict) {
            return null;
        }
    }
    for (const namespace of Object.keys(DISPLAY_KEYS) as Array<keyof typeof DISPLAY_KEYS>) {
        const input = ownValue(value, namespace);
        if (input === undefined) {
            continue;
        }
        if (!record(input) || (strict && Object.keys(input).some(key => !(DISPLAY_KEYS[namespace] as readonly string[]).includes(key)))) {
            return null;
        }
        const fields: Record<string, string> = {};
        for (const key of DISPLAY_KEYS[namespace]) {
            const field = ownValue(input, key);
            if (field === undefined) {
                continue;
            }
            if (typeof field !== 'string' || field.length > 12000) {
                return null;
            }
            if (field.trim()) {
                fields[key] = field;
            }
        }
        if (Object.keys(fields).length) {
            output[namespace] = fields;
        }
    }
    return output;
}
/** Server-only caller supplies validated helper output; explicit projection excludes raw metadata. */
export function encodeVariantFactPresentation(presentation: Record<string, unknown>): string | undefined {
    const toy = ownValue(presentation, 'toys'), card = ownValue(presentation, 'toys_card');
    const dimension = (input: unknown): string | undefined => {
        if (!record(input)) {
            return undefined;
        }
        const parts = ['length', 'width', 'height'].flatMap(key => typeof ownValue(input, key) === 'number' ? [`${ownValue(input, key)} ${key}`] : []);
        return parts.length ? `${parts.join(' × ')} ${ownValue(input, 'unit')}` : undefined;
    };
    const contents = ownValue(card, 'contentsLabel');
    const warnings = ownValue(toy, 'warnings');
    const additional = ownValue(toy, 'additionalDimensions');
    const projected = {
        food: ownValue(presentation, 'food'), furniture: ownValue(presentation, 'furniture_display'),
        sports: ownValue(presentation, 'sports_display'), books: ownValue(presentation, 'books_display'),
        toys: {
            age: ownValue(card, 'ageLabel'),
            contents: typeof contents === 'string' ? `${contents}${ownValue(card, 'contentsComplete') === true ? '' : ' · Partial contents list'}` : undefined,
            dimensions: dimension(ownValue(toy, 'dimensions')),
            additional_dimensions: Array.isArray(additional) ? additional.map(row => [ownValue(row, 'label'), dimension(row)].filter(Boolean).join(': ')).join(' · ') || undefined : undefined,
            materials: ownValue(toy, 'materials'), finish: ownValue(toy, 'finish'), care: ownValue(toy, 'care'),
            warnings: Array.isArray(warnings) ? warnings.map(row => [ownValue(row, 'text'), ownValue(row, 'sourceLabel'), ownValue(row, 'editionLabel')].filter(Boolean).join(' · ')).join('; ') || undefined : undefined,
        },
    };
    const facts = readFactDisplay(projected, false);
    if (!facts || !Object.keys(facts).length) {
        return undefined;
    }
    const encoded = JSON.stringify(facts).replace(/[<>&]/g, character => ({ '<': '\\u003c', '>': '\\u003e', '&': '\\u0026' })[character]!);
    return new TextEncoder().encode(encoded).byteLength <= MAX_VARIANT_FACT_CARRIER_BYTES ? encoded : undefined;
}
export function parseVariantFactPresentation(serialized: unknown): VariantFactDisplay | null {
    if (typeof serialized !== 'string' || serialized.length > MAX_VARIANT_FACT_CARRIER_BYTES || new TextEncoder().encode(serialized).byteLength > MAX_VARIANT_FACT_CARRIER_BYTES) {
        return null;
    }
    try {
        return readFactDisplay(JSON.parse(serialized), true);
    }
    catch {
        return null;
    }
}
