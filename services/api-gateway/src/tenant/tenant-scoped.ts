import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import type { TenantContext } from '../lib/tenant-context';
import { tenantTableRegistryEntry } from './tenant-tables.registry';

type TenantScopedDb = Pick<SupabaseClient, 'from'>;

export function tenantScoped(
    db: TenantScopedDb,
    table: string,
    tenant: Pick<TenantContext, 'siteId'>,
) {
    const entry = tenantTableRegistryEntry(table);
    if (!entry) {
        throw new Error(`Table ${table} is not in tenant table registry`);
    }
    if (entry.tenantColumn !== 'site_id' && entry.tenantColumn !== 'store_id') {
        throw new Error(`Table ${table} does not declare a site/store tenant column`);
    }
    return db.from(table).select('*').eq(entry.tenantColumn, tenant.siteId);
}

export function assertTenantScopedTableAccess(
    table: string,
    predicates: readonly string[],
): void {
    const entry = tenantTableRegistryEntry(table);
    if (!entry) return;
    const predicateText = predicates.join(' ');
    const hasScopePredicate = entry.scopeColumns.some((column) => new RegExp(`\\b${column}\\b`).test(predicateText));
    if (!hasScopePredicate) {
        throw new Error(`Tenant table ${table} requires one of: ${entry.scopeColumns.join(', ')}`);
    }
}

function payloadHasScope(value: unknown, scopeColumns: readonly string[]): boolean {
    if (Array.isArray(value)) return value.some((item) => payloadHasScope(item, scopeColumns));
    if (!value || typeof value !== 'object') return false;
    const record = value as Record<string, unknown>;
    return scopeColumns.some((column) => Object.prototype.hasOwnProperty.call(record, column));
}

function scopedColumnsForTable(table: string, scopeColumns: readonly string[]): readonly string[] {
    if (table === 'sites') return [...new Set([...scopeColumns, 'id', 'subdomain', 'custom_domain'])];
    return scopeColumns;
}

function expressionHasScope(value: unknown, scopeColumns: readonly string[]): boolean {
    if (typeof value !== 'string') return false;
    return scopeColumns.some((column) => new RegExp(`\\b${column}\\b`).test(value));
}

function markScopeFromCall(
    state: { scoped: boolean },
    table: string,
    scopeColumns: readonly string[],
    method: string,
    args: unknown[],
): void {
    const columns = scopedColumnsForTable(table, scopeColumns);
    if (method === 'eq' || method === 'in' || method === 'filter') {
        if (typeof args[0] === 'string' && columns.includes(args[0])) state.scoped = true;
        return;
    }
    if (method === 'match' && args[0] && typeof args[0] === 'object') {
        if (columns.some((column) => Object.prototype.hasOwnProperty.call(args[0] as Record<string, unknown>, column))) {
            state.scoped = true;
        }
        return;
    }
    if (method === 'or') {
        if (expressionHasScope(args[0], columns)) state.scoped = true;
        return;
    }
    if (method === 'insert' || method === 'upsert') {
        if (payloadHasScope(args[0], columns)) state.scoped = true;
    }
}

function guardQueryBuilder<T extends object>(
    table: string,
    builder: T,
    scopeColumns: readonly string[],
    state: { scoped: boolean },
): T {
    return new Proxy(builder, {
        get(target, property, receiver) {
            const value = Reflect.get(target, property, receiver);
            if (property === 'then') {
                if (!state.scoped) {
                    return (_onFulfilled: unknown, onRejected?: (reason: unknown) => unknown) => Promise
                        .reject(new Error(`Tenant table ${table} requires a tenant/owner predicate before execution`))
                        .catch(onRejected as never);
                }
                return typeof value === 'function' ? value.bind(target) : value;
            }
            if (property === 'catch' || property === 'finally') {
                return typeof value === 'function' ? value.bind(target) : value;
            }
            if (typeof value !== 'function') return value;
            return (...args: unknown[]) => {
                markScopeFromCall(state, table, scopeColumns, String(property), args);
                const result = value.apply(target, args);
                if (result && typeof result === 'object') {
                    return guardQueryBuilder(table, result, scopeColumns, state);
                }
                return result;
            };
        },
    });
}

export function createTenantGuardedSupabaseClient(client: SupabaseClient): SupabaseClient {
    return new Proxy(client, {
        get(target, property, receiver) {
            if (property !== 'from') return Reflect.get(target, property, receiver);
            return (table: string) => {
                const builder = target.from(table);
                const entry = tenantTableRegistryEntry(table);
                if (!entry) return builder;
                return guardQueryBuilder(table, builder, entry.scopeColumns, { scoped: false });
            };
        },
    }) as SupabaseClient;
}
