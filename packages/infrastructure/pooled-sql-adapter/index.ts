import { AsyncLocalStorage } from 'node:async_hooks';
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

// The conventional Node/test owner is retained for direct adapter consumers.
// Worker fetch/scheduled entry points MUST establish an invocation scope: driver
// I/O is never reused across invocation maps, even for identical credentials.
const pooledClients = new Map<string, PooledSqlClient>();
interface SqlInvocation {
  clients: Map<string, PooledSqlClient>;
  background: Set<Promise<unknown>>;
  closed: boolean;
}
const invocations = new AsyncLocalStorage<SqlInvocation>();

export async function withPooledSqlScope<T>(
  callback: (trackBackground: (work: Promise<unknown>) => void) => Promise<T>,
  waitUntil?: (work: Promise<unknown>) => void,
): Promise<T> {
  // Nested internal dispatch belongs to the same outer invocation.
  const existing = invocations.getStore();
  if (existing) return callback(work => { existing.background.add(work); });
  const scope: SqlInvocation = { clients: new Map(), background: new Set(), closed: false };
  return invocations.run(scope, async () => {
    let callbackError: unknown;
    let failed = false;
    try {
      return await callback(work => { scope.background.add(work); });
    } catch (error) {
      callbackError = error;
      failed = true;
      throw error;
    } finally {
      const finish = (async () => {
        while (scope.background.size) {
          const batch = [...scope.background];
          scope.background.clear();
          await Promise.allSettled(batch);
        }
        scope.closed = true;
        const clients = [...scope.clients.values()];
        scope.clients.clear();
        const closed = await Promise.allSettled(clients.map(client => client.end({ timeout: 1 })));
        const errors = closed.flatMap(result => result.status === 'rejected' ? [result.reason] : []);
        if (errors.length) throw new AggregateError(errors, 'SQL invocation cleanup failed');
      })();
      if (waitUntil) waitUntil(finish);
      else {
        try { await finish; }
        catch (error) { throw failed ? new AggregateError([callbackError, error], 'SQL operation and cleanup failed') : error; }
      }
    }
  });
}

function normalizedFlag(value: string | undefined): string {
  return (value || 'on').trim().toLowerCase();
}

export function pooledSqlConnectionString(env: PooledSqlEnv): string | null {
  return env.HYPERDRIVE?.connectionString || env.DATABASE_URL || env.SUPABASE_DB_URL || null;
}

export function isPooledSqlEnabled(env: PooledSqlEnv): boolean {
  return normalizedFlag(env.STOREFRONT_POOLED_SQL) !== 'off' && Boolean(pooledSqlConnectionString(env));
}

// Postgres.js unsafe() overrides the constructor with prepare:false. Configure
// only the instances owned by this adapter, including its transaction/reservation
// children. Preserve driver callbacks/options and lazy Query return values.
function preparedHyperdriveClient<T extends object>(client: T): T {
  interface DriverScope {
    unsafe: (text: string, parameters: unknown[], options: Record<string, unknown>) => unknown;
    begin?: (...args: unknown[]) => unknown;
    savepoint?: (...args: unknown[]) => unknown;
    reserve?: (...args: unknown[]) => Promise<object>;
  }
  const configured = new WeakSet<object>();
  function configure<S extends object>(scope: S): S {
    if (configured.has(scope)) return scope;
    configured.add(scope);
    const driver = scope as unknown as DriverScope;
    const unsafe = driver.unsafe.bind(scope);
    driver.unsafe = (text: string, parametersOrOptions: unknown[] | Record<string, unknown> = [], options: Record<string, unknown> = {}) => {
      const parameters = Array.isArray(parametersOrOptions) ? parametersOrOptions : [];
      const queryOptions = Array.isArray(parametersOrOptions) ? options : parametersOrOptions;
      return unsafe(text, parameters, { ...queryOptions, prepare: true, simple: false });
    };
    for (const method of ['begin', 'savepoint'] as const) {
      const original = driver[method]?.bind(scope);
      if (!original) continue;
      driver[method] = (...args: unknown[]) => {
        const last = args.length - 1;
        if (typeof args[last] === 'function') {
          const callback = args[last] as (child: object) => unknown;
          args[last] = (child: object) => callback(configure(child));
        }
        return original(...args);
      };
    }
    const reserve = driver.reserve?.bind(scope);
    if (reserve) driver.reserve = async (...args: unknown[]) => configure(await reserve(...args));
    return scope;
  }
  return configure(client);
}

export function getPooledSql(env: PooledSqlEnv, options: PooledSqlOptions = {}): PooledSqlClient | null {
  if (!isPooledSqlEnabled(env)) return null;
  const connectionString = pooledSqlConnectionString(env);
  if (!connectionString) return null;
  const hyperdrive = Boolean(env.HYPERDRIVE?.connectionString);

  const cacheKey = [
    connectionString,
    hyperdrive ? 'prepared-hyperdrive' : 'direct',
    options.maxConnections ?? 5,
    options.idleTimeoutSeconds ?? 20,
    options.connectTimeoutSeconds ?? 5,
  ].join('|');

  const scope = invocations.getStore();
  if (scope?.closed) throw new Error('SQL invocation has already finished');
  const clients = scope?.clients ?? pooledClients;
  const existing = clients.get(cacheKey);
  if (existing) return existing;

  const sql = postgres(connectionString, {
    max: options.maxConnections ?? 5,
    idle_timeout: options.idleTimeoutSeconds ?? 20,
    connect_timeout: options.connectTimeoutSeconds ?? 5,
    prepare: hyperdrive,
    onnotice: () => undefined,
  });
  const client = hyperdrive ? preparedHyperdriveClient(sql) : sql;
  clients.set(cacheKey, client);
  return client;
}

export async function closePooledSqlClients(): Promise<void> {
  const clients = Array.from(pooledClients.values());
  pooledClients.clear();
  await Promise.all(clients.map((client) => client.end({ timeout: 1 })));
}
