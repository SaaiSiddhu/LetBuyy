import type { ProductModel } from '@letbuyy/commerce-core';

/** Controlled form draft; the canonical domain schema validates it before a product write. */
export interface NicheFactsEditorProps {
    value: unknown;
    onChange: (value: unknown | null) => void;
    disabled?: boolean;
    resources?: Pick<ProductModel, 'images' | 'variantOptions'>;
}

/** Override draft for one enclosing variant; its ID stays with the canonical parent variant. */
export interface NicheVariantFactsEditorProps extends NicheFactsEditorProps {
    commonFacts?: unknown;
}
