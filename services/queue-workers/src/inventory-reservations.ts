import {
  createSupabaseServiceClient,
  type SupabaseServiceEnv,
} from '@letbuyy/infrastructure/supabase-adapter';

export interface InventoryReservationSweeperEnv extends SupabaseServiceEnv {
  INVENTORY_RESERVATION_SWEEPER_LIMIT?: string;
  // T12 (CAP-C43): grace period, in seconds, before a committed-but-unpaid
  // online-order reservation is released. Separate from the original
  // reservation TTL, which is consumed the instant reserve_inventory's
  // 'active' status transitions to 'committed' at order creation --
  // expires_at on a committed row is no longer meaningful.
  INVENTORY_RESERVATION_UNPAID_GRACE_SECONDS?: string;
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

function unpaidGraceSeconds(env: InventoryReservationSweeperEnv): number {
  const configured = Number(env.INVENTORY_RESERVATION_UNPAID_GRACE_SECONDS || 1800);
  if (!Number.isFinite(configured)) return 1800;
  return Math.min(Math.max(Math.trunc(configured), 60), 604800);
}

/**
 * T12 (CAP-C43): create_order_with_inventory_reservations commits every
 * reservation synchronously at order creation, on both payment rails --
 * before a razorpay order has ever been paid. The original sweep below only
 * ever sees 'active'/'hold' reservations, so a committed reservation behind
 * an abandoned or never-completed online payment had no automatic release
 * path. This now runs a second, additive sweep
 * (expire_unpaid_committed_reservations, migration 211) that releases those
 * specifically -- COD orders are excluded by that RPC's own WHERE clause,
 * since a COD order's commit-at-creation is a deliberate, correct design
 * (there is no future payment event to gate on).
 */
export async function runInventoryReservationSweeper(
  env: InventoryReservationSweeperEnv,
  input: InventoryReservationSweeperInput,
): Promise<{ expired: number; unpaidReleased: number; request_id: string }> {
  const db = createSupabaseServiceClient(env);
  const limit = sweeperLimit(env, input.limit);

  const { data, error } = await db.rpc('expire_inventory_reservations', {
    p_limit: limit,
    p_request_id: input.requestId,
  });

  if (error) {
    throw new Error(`Inventory reservation sweeper failed: ${error.message}`);
  }

  const { data: unpaidData, error: unpaidError } = await db.rpc('expire_unpaid_committed_reservations', {
    p_limit: limit,
    p_grace_seconds: unpaidGraceSeconds(env),
    p_request_id: input.requestId,
  });

  if (unpaidError) {
    throw new Error(`Unpaid committed reservation sweeper failed: ${unpaidError.message}`);
  }

  const expired = typeof data === 'number' ? data : Number(data || 0);
  const unpaidReleased = typeof unpaidData === 'number' ? unpaidData : Number(unpaidData || 0);
  return {
    expired: Number.isFinite(expired) ? expired : 0,
    unpaidReleased: Number.isFinite(unpaidReleased) ? unpaidReleased : 0,
    request_id: input.requestId,
  };
}
