import postgres from 'postgres';

import type { Env, JsonRecord } from '../runtime/types';

export async function hyperdriveRows<T extends JsonRecord>(
  env: Env,
  query: string,
  parameters: readonly (string | number | boolean | null)[] = [],
): Promise<readonly T[] | null> {
  if (!env.HYPERDRIVE) {
    return null;
  }

  const sql = postgres(env.HYPERDRIVE.connectionString, {
    max: 5,
    prepare: false,
    fetch_types: false,
  });

  try {
    return await sql.unsafe<T[]>(query, [...parameters]);
  } finally {
    await sql.end({ timeout: 1 });
  }
}
