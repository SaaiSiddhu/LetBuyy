import {
  createSupabaseServiceClient,
  type SupabaseServiceEnv,
} from '@letbuyy/infrastructure/supabase-adapter';

// Phase I3 (IRT-4): cleanup for merchant_session_jti_consumptions
// (205_merchant_session_jti_consumption.sql). Mirrors
// runInventoryReservationSweeper's shape exactly -- only ever deletes rows
// already past their own recorded expiry (the token's own exp claim), so it
// can never delete a still-valid consumption record.

export interface MerchantSessionJtiSweeperEnv extends SupabaseServiceEnv {
  MERCHANT_SESSION_JTI_SWEEPER_LIMIT?: string;
}

export interface MerchantSessionJtiSweeperInput {
  requestId: string;
  limit?: number;
}

function sweeperLimit(env: MerchantSessionJtiSweeperEnv, requested?: number): number {
  const configured = requested ?? Number(env.MERCHANT_SESSION_JTI_SWEEPER_LIMIT || 500);
  if (!Number.isFinite(configured)) return 500;
  return Math.min(Math.max(Math.trunc(configured), 1), 5000);
}

export async function runMerchantSessionJtiConsumptionSweeper(
  env: MerchantSessionJtiSweeperEnv,
  input: MerchantSessionJtiSweeperInput,
): Promise<{ expired: number; request_id: string }> {
  const db = createSupabaseServiceClient(env);
  const { data, error } = await db.rpc('expire_merchant_session_jti_consumptions', {
    p_limit: sweeperLimit(env, input.limit),
  });

  if (error) {
    throw new Error(`Merchant session jti consumption sweeper failed: ${error.message}`);
  }

  const expired = typeof data === 'number' ? data : Number(data || 0);
  return {
    expired: Number.isFinite(expired) ? expired : 0,
    request_id: input.requestId,
  };
}
