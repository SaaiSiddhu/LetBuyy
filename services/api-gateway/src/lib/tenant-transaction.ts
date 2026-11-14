import { getPooledSql, type PooledSqlClient } from '@letbuyy/infrastructure/pooled-sql-adapter';
import { tenantGucSetLocalStatement } from '@letbuyy/tenant-core';
import type { Env } from '../index';
import type { TenantContext } from './tenant-context';

export type TenantTxCallback<T> = (sql: PooledSqlClient) => Promise<T>;

export class TenantTransactionUnavailableError extends Error {
    constructor() {
        super('Tenant transaction requires a pooled SQL connection; refusing to fake SET LOCAL app.site_id over Supabase REST');
        this.name = 'TenantTransactionUnavailableError';
    }
}

export async function withTenantTx<T>(
    env: Env,
    tenant: Pick<TenantContext, 'siteId' | 'requestId'>,
    callback: TenantTxCallback<T>,
): Promise<T> {
    const sql = getPooledSql(env, {
        maxConnections: 3,
        idleTimeoutSeconds: 10,
        connectTimeoutSeconds: 5,
    });
    if (!sql) throw new TenantTransactionUnavailableError();

    const statement = tenantGucSetLocalStatement(tenant.siteId);
    const result = await sql.begin(async (tx) => {
        await tx.unsafe('SET LOCAL ROLE app_tenant');
        await tx.unsafe(statement.sql, [...statement.values]);
        await tx.unsafe('SELECT set_config($1, $2, true)', ['app.request_id', tenant.requestId]);
        return callback(tx as unknown as PooledSqlClient);
    });
    return result as T;
}
