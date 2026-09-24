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
    if (table === 'sites') return [...new Set([...scopeColumns, 'id', 'subdomain', 'store_name', 'custom_domain'])];
    return scopeColumns;
}

// Which `.filter(column, operator, value)` operators actually narrow a query to a specific
// tenant, as opposed to merely mentioning the scope column. `eq`/`in` are exact matches -- the
// only shapes `.eq()`/`.in()` themselves can express, which is why those two methods never needed
// this check. `filter()` and `or()` accept ANY PostgREST operator as a string, so the column name
// alone proves nothing: `.filter('store_id', 'neq', otherStoreId)` names the scope column but
// EXCLUDES exactly one store and matches every other tenant's rows -- the opposite of scoping.
// Range (`gt`/`gte`/`lt`/`lte`) and pattern (`like`/`ilike`) operators have the same problem: none
// of them names a specific, bounded set of tenants.
//
// The one sanctioned exception is `<scopeColumn> IS NULL`: `middleware/rbac.ts`,
// `routes/operations/rbac.ts` and `routes/internal-console.ts` (APPID-P5b) all use
// `.filter('store_id', 'is', null)` to read PLATFORM employees, a real, narrow, well-defined
// non-tenant category (no store at all) -- not a bypass, because it identifies exactly one fixed
// set of rows, the same as an `eq` would for one store. `IS NOT NULL`/anything else `is` can
// express is not in that set and is refused like every other non-equality operator.
function isSafeFilterOperator(operator: unknown, value: unknown): boolean {
    if (operator === 'eq' || operator === 'in') return true;
    if (operator === 'is' && String(value) === 'null') return true;
    return false;
}

// PostgREST's `or=(a.eq.b,c.is.null)` grammar: comma-separated alternatives, each
// `column.operator.value`. The column is the text before the first dot; the operator is the next
// token (the value may itself legally contain dots -- an ISO timestamp, for instance -- so it is
// never parsed past the operator). An OR is safely scoped only if AT LEAST ONE alternative both
// names a scope column and uses one of the operators above -- exactly mirroring the semantics an
// `eq`/`in` predicate on its own already has, just spread across the OR's branches.
function orIsSafelyScoped(expression: unknown, scopeColumns: readonly string[]): boolean {
    if (typeof expression !== 'string') return false;
    return expression.split(',').some((alternative) => {
        const columnEnd = alternative.indexOf('.');
        if (columnEnd < 0) return false;
        const column = alternative.slice(0, columnEnd);
        if (!scopeColumns.includes(column)) return false;
        const rest = alternative.slice(columnEnd + 1);
        const operatorEnd = rest.indexOf('.');
        const operator = operatorEnd < 0 ? rest : rest.slice(0, operatorEnd);
        const value = operatorEnd < 0 ? '' : rest.slice(operatorEnd + 1);
        return isSafeFilterOperator(operator, value);
    });
}

function markScopeFromCall(
    state: { scoped: boolean },
    table: string,
    scopeColumns: readonly string[],
    method: string,
    args: unknown[],
): void {
    const columns = scopedColumnsForTable(table, scopeColumns);
    if (method === 'eq' || method === 'in') {
        if (typeof args[0] === 'string' && columns.includes(args[0])) state.scoped = true;
        return;
    }
    if (method === 'filter') {
        if (typeof args[0] === 'string' && columns.includes(args[0]) && isSafeFilterOperator(args[1], args[2])) {
            state.scoped = true;
        }
        return;
    }
    if (method === 'match' && args[0] && typeof args[0] === 'object') {
        if (columns.some((column) => Object.prototype.hasOwnProperty.call(args[0] as Record<string, unknown>, column))) {
            state.scoped = true;
        }
        return;
    }
    if (method === 'or') {
        if (orIsSafelyScoped(args[0], columns)) state.scoped = true;
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
