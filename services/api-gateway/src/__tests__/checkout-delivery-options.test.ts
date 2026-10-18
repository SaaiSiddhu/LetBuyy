import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import { checkoutDeliveryOptions } from '../lib/checkout-delivery-options';

type Row = Record<string, unknown>;
type DbResponse = { data: Row[]; error: null };

class Query implements PromiseLike<DbResponse> {
    private readonly filters: Array<(row: Row) => boolean> = [];

    constructor(private readonly rows: Row[]) { }

    select(): this { return this; }
    eq(key: string, value: unknown): this {
        this.filters.push((row) => row[key] === value);
        return this;
    }
    is(key: string, value: unknown): this {
        this.filters.push((row) => row[key] === value);
        return this;
    }
    in(key: string, values: unknown[]): this {
        this.filters.push((row) => values.includes(row[key]));
        return this;
    }
    then<TResult1 = DbResponse, TResult2 = never>(
        onfulfilled?: ((value: DbResponse) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
        return Promise.resolve({ data: this.rows.filter((row) => this.filters.every((filter) => filter(row))), error: null })
            .then(onfulfilled, onrejected);
    }
}

function fakeDatabase(zones: Row[], rates: Row[]): SupabaseClient {
    return {
        from(table: string) {
            return new Query(table === 'shipping_zones' ? zones : rates);
        },
    } as unknown as SupabaseClient;
}

test('checkout shipping returns only active COD rates in the matching seller zone', async () => {
    const db = fakeDatabase([
        { id: 'bengaluru', store_id: 'seller-1', site_id: 'seller-1', countries: ['IN'], states: ['Karnataka'], zip_codes: ['560001'], cod_enabled: true, deleted_at: null },
        { id: 'other-pin', store_id: 'seller-1', site_id: 'seller-1', countries: ['IN'], states: ['Karnataka'], zip_codes: ['560002'], cod_enabled: true, deleted_at: null },
        { id: 'other-seller', store_id: 'seller-2', site_id: 'seller-2', countries: ['IN'], states: ['Karnataka'], zip_codes: ['560001'], cod_enabled: true, deleted_at: null },
    ], [
        { id: 'standard', zone_id: 'bengaluru', site_id: 'seller-1', name: 'Standard', type: 'flat', price: 60, is_active: true, cod_enabled: true, deleted_at: null },
        { id: 'free', zone_id: 'bengaluru', site_id: 'seller-1', name: 'Free', type: 'free', price: 0, is_active: true, cod_enabled: true, deleted_at: null },
        { id: 'prepaid', zone_id: 'bengaluru', site_id: 'seller-1', name: 'Prepaid only', type: 'flat', price: 10, is_active: true, cod_enabled: false, deleted_at: null },
        { id: 'weight', zone_id: 'bengaluru', site_id: 'seller-1', name: 'Weight based', type: 'weight_based', price: 10, is_active: true, cod_enabled: true, deleted_at: null },
    ]);

    const rates = await checkoutDeliveryOptions(db, 'seller-1', [
        { quantity: 2, unit_price: 129, line_total: 258 },
    ], { country: 'IN', state: 'Karnataka', pincode: '560001' });
    assert.deepEqual(rates.map((rate) => [rate.id, rate.amount]), [['free', 0], ['standard', 60]]);

    const outsideZone = await checkoutDeliveryOptions(db, 'seller-1', [
        { quantity: 2, unit_price: 129, line_total: 258 },
    ], { country: 'IN', state: 'Karnataka', pincode: '560002' });
    assert.deepEqual(outsideZone, []);
});
