import { readProductNicheFacts, type ProductNicheFacts, type ProductNicheNamespace } from './niche-product-facts';
import { AcceptedPersonalizationSchema, type AcceptedPersonalization } from './madeyours-facts';
import type { ProductVariant } from './index';

/** Presentation rows only; never an order DTO, persistence format or product lookup. */
export interface ProductFactSummaryRow { label: string; value: string }
export interface ProductFactSummarySection { id: ProductNicheNamespace | 'selected-options' | 'unavailable'; title: string; rows: ProductFactSummaryRow[] }
const UNKNOWN = 'Not recorded with this order.';
const titles: Record<ProductNicheNamespace, string> = {
    toys: 'Toy details', electronics: 'Device and accessory details', food: 'Food details', furniture: 'Furniture details',
    gifts: 'Gift contents', personalization: 'Accepted personalization', beauty: 'Care details', sports: 'Equipment details', books: 'Book and paper details',
};
function supplied(value: string | number | null | undefined): string | undefined {
    if (typeof value === 'string') return value.trim() ? value : undefined;
    return typeof value === 'number' && Number.isFinite(value) ? String(value) : undefined;
}
function measure(value: { value: number; unit: string } | null | undefined): string | undefined {
    return value ? `${value.value} ${value.unit}` : undefined;
}
function dimensions(value: { unit: string; length?: number; width?: number; depth?: number; height?: number; diameter?: number } | null | undefined): string | undefined {
    if (!value) return undefined;
    return ([['length', 'Length'], ['width', 'Width'], ['depth', 'Depth'], ['height', 'Height'], ['diameter', 'Diameter']] as const)
        .flatMap(([key, label]) => value[key] === undefined ? [] : [`${label} ${value[key]} ${value.unit}`]).join(' · ') || undefined;
}
function ownOption(options: ProductVariant['options'] | null | undefined, name: string): string | undefined {
    if (!options || typeof options !== 'object' || Array.isArray(options)) return undefined;
    try {
        const field = Object.getOwnPropertyDescriptor(options, name);
        return field && 'value' in field && typeof field.value === 'string' ? supplied(field.value) : undefined;
    } catch { return undefined; }
}
function selectedOptionRows(options: ProductVariant['options'] | null | undefined): ProductFactSummaryRow[] {
    if (!options || typeof options !== 'object' || Array.isArray(options)) return [];
    try {
        return Object.entries(Object.getOwnPropertyDescriptors(options)).flatMap(([label, field]) =>
            label.trim() && label.length <= 100 && 'value' in field && typeof field.value === 'string' && field.value.trim() && field.value.length <= 200
                ? [{ label, value: field.value }] : []).slice(0, 10);
    } catch { return []; }
}

/**
 * Format already-resolved facts saved on an order line. No current catalog, SKU
 * selection, quantity multiplication, delivery inference or snapshot writing.
 * Labels/values are plain text; the host renders them with its normal escaping.
 */
export function summarizeProductFacts(
    input: ProductNicheFacts | null | undefined,
    personalization?: AcceptedPersonalization | null,
    options?: ProductVariant['options'] | null,
): ProductFactSummarySection[] {
    let facts: ProductNicheFacts = {};
    let accepted: AcceptedPersonalization | null = null;
    try { facts = readProductNicheFacts(input); } catch { /* Malformed historical input stays unavailable. */ }
    try { const parsed = AcceptedPersonalizationSchema.safeParse(personalization); if (parsed.success) accepted = parsed.data; } catch { /* Do not echo unvalidated input. */ }
    const sections: ProductFactSummarySection[] = [];
    const selected = selectedOptionRows(options);
    if (selected.length) sections.push({ id: 'selected-options', title: 'Saved options', rows: selected });
    const addSection = (id: ProductNicheNamespace, build: (row: (label: string, value?: string | number | null, showUnknown?: boolean) => void) => void) => {
        const rows: ProductFactSummaryRow[] = [];
        build((label, value, showUnknown = false) => {
            const display = supplied(value);
            if (display !== undefined || showUnknown) rows.push({ label, value: display ?? UNKNOWN });
        });
        sections.push({ id, title: titles[id], rows: rows.length ? rows : [{ label: 'Details', value: UNKNOWN }] });
    };
    if (facts.toys) {
        const f = facts.toys;
        addSection('toys', row => {
            row('Age statement', f.ageStatement, true);
            row('Supplied age bands', f.ageBands.length ? f.ageBands.map(band => band.replace('-', '–')).join(', ') : undefined);
            row('Product type', f.productType); row('Interests', f.interests.join(', '));
            row('Contents', f.contents.map(item => `${item.quantity} × ${item.label}`).join('\n'), true);
            row('Contents statement', f.contentsComplete ? 'Merchant marked the listed contents complete.' : undefined, true);
            row('Dimensions', dimensions(f.dimensions), true);
            for (const item of f.additionalDimensions) row(item.label || 'Additional dimensions', dimensions(item));
            row('Materials', f.materials, true); row('Finish', f.finish); row('Care', f.care);
            row('Warnings', f.warnings.map(item => `${item.text}\nSource: ${item.sourceLabel}${item.editionLabel ? ` · ${item.editionLabel}` : ''}`).join('\n\n'), true);
        });
    }
    if (facts.electronics) {
        const f = facts.electronics;
        const roles = { host: 'host', 'power-input': 'power input', 'power-output': 'power output', data: 'data', video: 'video', 'card-reader': 'card reader', audio: 'audio' };
        addSection('electronics', row => {
            row('Manufacturer', f.manufacturer, true); row('Model', f.model, true); row('Product type', f.kind);
            row('Connectors', f.connectors.map(item => `${item.count} × ${item.kind.toUpperCase()} (${roles[item.role]})`).join('\n'), true);
            row('Power input', f.power_input_w === undefined ? undefined : `${f.power_input_w} W`);
            row('Power output', f.power_output_w === undefined ? undefined : `${f.power_output_w} W`);
            row('Rated carrying capacity', f.power_capacity_w === undefined ? undefined : `${f.power_capacity_w} W`);
            row('Pass-through output', f.pass_through_output_w === undefined ? undefined : `${f.pass_through_output_w} W`);
            row('Data rate', f.data_rate_mbps === undefined ? undefined : `${f.data_rate_mbps} Mb/s`);
            row('Length', f.length_mm === undefined ? undefined : `${f.length_mm} mm`);
            row('Dimensions', f.dimensions_mm && dimensions({ ...f.dimensions_mm, unit: 'mm' }));
            row('Video specification', f.video && `${f.video.width_px} × ${f.video.height_px} px at ${f.video.refresh_hz} Hz`);
            row('Box contents', f.box_contents.map(item => `${item.quantity} × ${item.label}`).join('\n'), true);
            row('Host requirements', f.host_requirements.join('\n'), true);
            row('Referenced devices', f.compatible_devices.map(item => `${item.manufacturer} ${item.model}\nReference: ${item.reference} · ${item.source_date}`).join('\n\n'), true);
            row('Fact-sheet reference', f.fact_sheet && `${f.fact_sheet.reference} · ${f.fact_sheet.source_date}`); row('Merchant notes', f.notes);
        });
    }
    if (facts.food) {
        const f = facts.food;
        addSection('food', row => {
            row('Per-item net quantity', measure(f.netQuantity), true); row('Ingredients', f.ingredients, true);
            row('Allergen statement', f.allergens.status === 'supplied' ? f.allergens.statement : undefined, true);
            if (f.allergens.status === 'supplied') row('Allergen source', f.allergens.source);
            row('Storage', f.storage, true); row('Preparation', f.preparation, true); row('Nutrition statement', f.nutritionText, true);
        });
    }
    if (facts.furniture) {
        const f = facts.furniture;
        addSection('furniture', row => {
            row('Assembled dimensions', dimensions(f.assembled), true); row('Package dimensions', dimensions(f.package), true);
            row('Seat height', measure(f.seat_height)); row('Weight', measure(f.weight));
            row('Materials', f.materials?.join(', '), true); row('Finish', f.finish, true);
            row('Assembly', f.assembly?.status === 'assembled' ? 'Supplied assembled.' : f.assembly?.status === 'required' ? 'Assembly required.' : undefined, true);
            row('Assembly instructions', f.assembly?.instructions); row('Assembly tools', f.assembly?.tools); row('Care', f.care, true);
        });
    }
    if (facts.gifts) {
        const f = facts.gifts;
        addSection('gifts', row => {
            row('Contents', f.contents?.map(item => `${item.quantity} × ${item.label}${item.detail ? ` · ${item.detail}` : ''}${item.care ? `\nCare: ${item.care}` : ''}`).join('\n\n'), true);
            row('Suitability note', f.suitabilityNote);
            row('Merchant occasion categories', f.occasions?.join(', ')); row('Merchant recipient categories', f.recipients?.join(', '));
        });
    }
    if (facts.personalization || accepted) {
        const f = facts.personalization;
        addSection('personalization', row => {
            row('Accepted text', accepted?.text, true); row('Method', accepted?.method.label, true);
            row('Style', accepted?.style.label, true); row('Placement', accepted?.placement.label, true);
            row('Merchant production note', f?.production_note);
        });
    }
    if (facts.beauty) {
        const f = facts.beauty;
        const selected = ownOption(options, f.shadeOptionName);
        const shade = f.shades.find(item => item.value === selected);
        addSection('beauty', row => {
            row('Routine stage', f.routineStage); row('Product format', f.format, true); row('Per-item net quantity', measure(f.netQuantity), true);
            if (f.shades.length || selected) {
                row('Selected shade', selected, true); row('Shade code', shade?.code, true);
                if (shade?.color) row('Supplied colour reference', shade.color);
            }
            row('Product ingredient statement', f.ingredients, true);
            if (shade && Object.hasOwn(shade, 'ingredients')) row('Selected-shade ingredients', shade.ingredients, true);
            row('Directions', f.directions, true); row('Warnings', f.warnings, true);
        });
    }
    if (facts.sports) {
        const f = facts.sports;
        addSection('sports', row => {
            row('Activity', f.activity); row('Equipment type', f.equipmentType);
            row('Length', measure(f.length)); row('Weight', measure(f.weight)); row('Grip circumference', measure(f.gripCircumference)); row('Dimensions', dimensions(f.dimensions));
            row('Materials', f.material, true); row('Contents', f.contents?.join('\n'), true); row('Use conditions', f.conditions, true); row('Care', f.care);
            row('Compatibility status', f.compatibility?.status === 'merchant-supplied' ? 'Merchant-supplied reference.' : f.compatibility?.status === 'unconfirmed' ? 'Unconfirmed.' : undefined, true);
            row('Compatibility reference', f.compatibility?.status === 'merchant-supplied' ? f.compatibility.reference : undefined, true);
            row('Compatibility note', f.compatibility?.note);
        });
    }
    if (facts.books) {
        const f = facts.books;
        const formats = { paperback: 'Paperback', hardback: 'Hardback', 'board-book': 'Board book', 'spiral-bound': 'Spiral bound', other: 'Other' };
        addSection('books', row => {
            row('Item type', f.kind === 'book' ? 'Book' : 'Stationery');
            if (f.kind === 'book') {
                row('Authors', f.authors?.join(', '), true); row('Language', f.language, true); row('Format', f.format && formats[f.format], true);
                row('Edition', f.edition, true); row('Publisher', f.publisher); row('Publication year', f.publication_year); row('Pages', f.pages);
                row('Subjects', f.subjects?.join(', ')); row('ISBN', f.isbn);
            } else {
                row('Paper weight', f.paper_gsm === undefined ? undefined : `${f.paper_gsm} g/m²`, true);
                row('Page count', f.page_count, true); row('Sheet count', f.sheet_count, true); row('Ruling', f.ruling, true); row('Binding', f.binding);
                row('Included items', f.included?.join('\n'), true); row('Materials', f.materials);
            }
            row('Dimensions', f.dimensions_mm && dimensions({ ...f.dimensions_mm, unit: 'mm' }), true);
        });
    }
    for (const namespace of Object.keys(titles) as ProductNicheNamespace[]) {
        if (sections.some(section => section.id === namespace)) continue;
        let present = false;
        try { const field = input && Object.getOwnPropertyDescriptor(input, namespace); present = Boolean(field && 'value' in field && field.value != null); } catch { /* Treat malformed input as absent. */ }
        if (present) sections.push({ id: namespace, title: titles[namespace], rows: [{ label: 'Details', value: UNKNOWN }] });
    }
    return sections.length ? sections : [{ id: 'unavailable', title: 'Saved product details', rows: [{ label: 'Details', value: UNKNOWN }] }];
}
