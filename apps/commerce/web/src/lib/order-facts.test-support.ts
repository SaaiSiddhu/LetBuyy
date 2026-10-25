/** Synthetic private order facts used only by tests. Never imported by application code. */
import { readProductFactSnapshot } from '@letbuyy/commerce-core';
export function savedFacts() {
    const snapshot = readProductFactSnapshot({ version: 1,
        selected_options: [{ name: 'Shade', value: 'Pink Clay' }],
        facts: {
            beauty: { format: 'Lip tint', ingredients: 'Saved common ingredients', shadeOptionName: 'Shade', shades: [{ value: 'Rosewater', code: 'RW01' }, { value: 'Pink Clay', code: 'PC02', ingredients: 'Saved Pink Clay ingredients' }] },
            books: { kind: 'book', language: 'Hindi', format: 'paperback', edition: 'Saved edition 2' },
            food: { netQuantity: { value: 250, unit: 'g' } },
            personalization: { version: 1, revision: 1, methods: [{ id: 'engrave', label: 'Engrave', min_graphemes: 1, max_graphemes: 20, character_set: 'latin-name', styles: [{ id: 'serif', label: 'Serif' }], placements: [{ id: 'front', label: 'Front' }] }] },
        },
        personalization: { version: 1, facts_revision: 1, method: { id: 'engrave', label: 'Engrave' }, style: { id: 'serif', label: 'Serif' }, placement: { id: 'front', label: 'Front' }, text: 'Asha' },
    });
    if (!snapshot) throw new Error('Synthetic saved order snapshot must be canonical.');
    return snapshot;
}
