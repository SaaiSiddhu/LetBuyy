import { z } from 'zod';
import type { Product, Order, LineItem } from './index';

/** Safe operational projections; canonical commerce entities remain unchanged. */
export type InternalMerchantCatalogRow = Pick<
    Product,
    'id' | 'name' | 'sku' | 'price' | 'status' | 'is_active' | 'updated_at'
>;
export type InternalMerchantOrderRow = Pick<
    Order,
    | 'id'
    | 'order_number'
    | 'status'
    | 'payment_status'
    | 'total'
    | 'currency'
    | 'created_at'
    | 'updated_at'
>;
export type InternalMerchantOrderLine = Pick<
    LineItem,
    'id' | 'name' | 'sku' | 'quantity' | 'unit_price' | 'total'
>;
export const InternalMerchantOperationsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(25),
    q: z.string().trim().max(100).default(''),
    status: z
        .string()
        .trim()
        .regex(/^[a-z_]*$/)
        .max(40)
        .default(''),
});
export interface InternalMerchantOperationsSnapshot {
    observed_at: string;
    site: {
        id: string;
        name: string | null;
        store_name: string | null;
        site_type: string;
        status: string;
        published: boolean;
        currency: string;
        trial_status: string | null;
        trial_ends_at: string | null;
    };
    counts: { products: number | null; orders: number | null };
    saas: {
        authority: 'persisted' | 'unavailable';
        plan: string;
        features: string[];
        limits: Record<string, unknown>;
    };
    usage: Array<{
        id: string;
        meter_name: string;
        quantity: number | string;
        limit_quantity: number | string | null;
        period_start: string;
        period_end: string;
        updated_at: string;
    }>;
    verification: Array<{
        document_type: string;
        status: string;
        provider_mode: string;
        updated_at: string;
    }>;
    unavailable: string[];
}
