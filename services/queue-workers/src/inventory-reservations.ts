import {
  createSupabaseServiceClient,
  type SupabaseServiceEnv,
} from '@letbuyy/infrastructure/supabase-adapter';

export interface InventoryReservationSweeperEnv extends SupabaseServiceEnv {
  INVENTORY_RESERVATION_SWEEPER_LIMIT?: string;
}

export interface InventoryReservationSweeperInput {
  requestId: string;
  limit?: number;
}

function sweeperLimit(env: InventoryReservationSweeperEnv, requested?: number): number {
  const configured = requested ?? Number(env.INVENTORY_RESERVATION_SWEEPER_LIMIT || 250);
  if (!Number.isFinite(configured)) return 250;
  return Math.min(Math.max(Math.trunc(configured), 1), 1000);
}

export async function runInventoryReservationSweeper(
  env: InventoryReservationSweeperEnv,
  input: InventoryReservationSweeperInput,
): Promise<{ expired: number; request_id: string }> {
  const db = createSupabaseServiceClient(env);
  const { data, error } = await db.rpc('expire_inventory_reservations', {
    p_limit: sweeperLimit(env, input.limit),
    p_request_id: input.requestId,
  });

  if (error) {
    throw new Error(`Inventory reservation sweeper failed: ${error.message}`);
  }

  const expired = typeof data === 'number' ? data : Number(data || 0);
  return {
    expired: Number.isFinite(expired) ? expired : 0,
    request_id: input.requestId,
  };
}
