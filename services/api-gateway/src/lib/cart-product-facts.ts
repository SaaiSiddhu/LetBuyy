import { prepareProductFactSnapshot, type PersonalizationCartDraft, type PreparedProductFactSnapshot } from '@letbuyy/commerce-core';
import type { Env } from '../index';
import { withTenantTx } from './tenant-transaction';

const NAMES = ['toys','electronics','food','furniture','gifts','personalization','beauty','sports','books'];
type Row = Record<string, unknown>;
export type CartFactAcceptance = {
    prepared: Extract<PreparedProductFactSnapshot, { ok: true }>;
    catalog_source: { product_facts: Row; variant_facts: unknown; selected_options: Row; images: unknown };
    available: number;
};
/** Private tenant-scoped acceptance load. The public product projection stays unchanged.
 * This is an observation; the order RPC repeats provenance comparisons under row locks.
 */
export async function loadCartFactSources(env: Env, siteId: string, requestId: string, productIds: string[]) {
    return withTenantTx(env, { siteId, requestId }, async sql => {
        const rows = await sql.unsafe(`SELECT p.id,p.version,p.metadata,p.images,
            coalesce((SELECT jsonb_agg(jsonb_build_object('id',v.id,'product_id',v.product_id,'metadata',v.metadata,
              'options',jsonb_strip_nulls(jsonb_build_object(coalesce(n.names[1],'Option 1'),v.option1,
                coalesce(n.names[2],'Option 2'),v.option2,coalesce(n.names[3],'Option 3'),v.option3))) ORDER BY v.id)
              FROM public.product_variants v WHERE v.product_id=p.id AND v.deleted_at IS NULL),'[]'::jsonb) AS variants,
            coalesce((SELECT jsonb_agg(jsonb_build_object('variant_id',level.variant_id,'available',greatest(coalesce(level.available,0)-coalesce(level.reserved,0),0)))
              FROM (SELECT DISTINCT ON (il.variant_id) il.* FROM public.inventory_levels il
                JOIN public.inventory_locations loc ON loc.id=il.location_id
                WHERE il.product_id=p.id AND il.store_id=$1::uuid AND il.deleted_at IS NULL
                  AND loc.store_id=$1::uuid AND loc.status='active' AND loc.deleted_at IS NULL
                ORDER BY il.variant_id,loc.is_default DESC,il.updated_at ASC,il.id) level),'[]'::jsonb) AS inventory
            FROM public.products p LEFT JOIN LATERAL (SELECT array_agg(po.name ORDER BY po.position,po.id) names
              FROM public.product_options po WHERE po.product_id=p.id) n ON true
            WHERE p.store_id=$1::uuid AND p.id IN (SELECT jsonb_array_elements_text($2::text::jsonb)::uuid)
              AND p.deleted_at IS NULL AND p.is_active=true`, [siteId, JSON.stringify(productIds)]);
        return new Map(rows.map(row => [String(row.id), row as Row]));
    });
}
function record(value: unknown): Row { return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {}; }
export async function acceptCartProductFacts(source: Row, variantId: string | null, personalization?: PersonalizationCartDraft): Promise<CartFactAcceptance | Extract<PreparedProductFactSnapshot, { ok: false }>> {
    const variants = Array.isArray(source.variants) ? source.variants.map(record) : [];
    const selected = variants.find(row => row.id === variantId);
    if (variantId && !selected) return { ok: false, error: { code: 'VARIANT_MISMATCH', message: 'The selected variant is unavailable for this product.' } };
    const result = await prepareProductFactSnapshot({ product_id: source.id, product_version: source.version,
        product_metadata: source.metadata, has_variants: variants.length > 0,
        selected_variant: selected ? { id: selected.id, product_id: source.id, metadata: selected.metadata, options: selected.options } : null,
        ...(personalization ? { personalization } : {}),
    });
    if (!result.ok) return result;
    const metadata = record(source.metadata);
    const productFacts = Object.fromEntries(NAMES.filter(name => Object.hasOwn(metadata,name)).map(name => [name,metadata[name]]));
    const inventory = Array.isArray(source.inventory) ? source.inventory.map(record) : [];
    const available = Number(inventory.find(row => (row.variant_id ?? null) === variantId)?.available ?? 0);
    return { prepared: result, catalog_source: { product_facts: productFacts, variant_facts: selected?.metadata ?? {}, selected_options: record(selected?.options), images: source.images ?? [] },
        available: Number.isFinite(available) ? Math.max(0, Math.trunc(available)) : 0 };
}
