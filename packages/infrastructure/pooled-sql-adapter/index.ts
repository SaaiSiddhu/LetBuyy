import postgres from 'postgres';

export type PooledSqlClient = ReturnType<typeof postgres>;

export interface HyperdriveConnectionBinding {
  readonly connectionString: string;
}

export interface PooledSqlEnv {
  HYPERDRIVE?: HyperdriveConnectionBinding;
  DATABASE_URL?: string;
  SUPABASE_DB_URL?: string;
  STOREFRONT_POOLED_SQL?: string;
}

export interface PooledSqlOptions {
  maxConnections?: number;
  idleTimeoutSeconds?: number;
  connectTimeoutSeconds?: number;
}

const pooledClients = new Map<string, PooledSqlClient>();

function normalizedFlag(value: string | undefined): string {
  return (value || 'on').trim().toLowerCase();
}

export function pooledSqlConnectionString(env: PooledSqlEnv): string | null {
  return env.HYPERDRIVE?.connectionString || env.DATABASE_URL || env.SUPABASE_DB_URL || null;
}

export function isPooledSqlEnabled(env: PooledSqlEnv): boolean {
  return normalizedFlag(env.STOREFRONT_POOLED_SQL) !== 'off' && Boolean(pooledSqlConnectionString(env));
}

export function getPooledSql(env: PooledSqlEnv, options: PooledSqlOptions = {}): PooledSqlClient | null {
  if (!isPooledSqlEnabled(env)) return null;
  const connectionString = pooledSqlConnectionString(env);
  if (!connectionString) return null;

  const cacheKey = [
    connectionString,
    options.maxConnections ?? 5,
    options.idleTimeoutSeconds ?? 20,
    options.connectTimeoutSeconds ?? 5,
  ].join('|');

  const existing = pooledClients.get(cacheKey);
  if (existing) return existing;

  const sql = postgres(connectionString, {
    max: options.maxConnections ?? 5,
    idle_timeout: options.idleTimeoutSeconds ?? 20,
    connect_timeout: options.connectTimeoutSeconds ?? 5,
    prepare: false,
    onnotice: () => undefined,
  });
  pooledClients.set(cacheKey, sql);
  return sql;
}

export async function closePooledSqlClients(): Promise<void> {
  const clients = Array.from(pooledClients.values());
  pooledClients.clear();
  await Promise.all(clients.map((client) => client.end({ timeout: 1 })));
}
