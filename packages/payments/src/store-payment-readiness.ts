import type { StorePaymentSetup } from '@letbuyy/shared-types';

export interface StorePaymentReadinessInput {
  schemaReady: boolean;
  onlineRequested: boolean;
  accountMode?: 'shared' | 'ownAccount';
  hasCredentials: boolean;
  credentialVerified: boolean;
  /** The server has decrypted and validated the saved credentials for this store. */
  credentialsUsable: boolean;
  environment: 'sandbox' | 'live' | null;
}

/** The current hosted path is sandbox-only. Never infer live KYC/settlement from a valid API key. */
export function deriveStorePaymentSetup(input: StorePaymentReadinessInput): StorePaymentSetup {
  const blocking: StorePaymentSetup['blocking_reasons'] = [];
  if (!input.schemaReady) blocking.push('schema_unavailable');
  if (!input.hasCredentials) blocking.push('credentials_missing');
  else {
    if (input.accountMode !== 'ownAccount') blocking.push('account_model_unresolved');
    if (!input.credentialVerified) blocking.push('credentials_unverified');
    if (input.environment === 'live') blocking.push('live_checkout_not_qualified');
    else if (!input.credentialsUsable || input.environment !== 'sandbox') blocking.push('credentials_unusable');
  }
  const canEnable = blocking.length === 0;
  return {
    connection: input.hasCredentials ? input.accountMode === 'ownAccount' ? 'own_account' : 'unresolved' : 'not_connected',
    environment: input.environment,
    status: !input.schemaReady || !input.hasCredentials ? 'not_configured' : blocking.length > 0
      ? 'action_required' : input.onlineRequested ? 'test_ready' : 'disabled',
    can_enable_online: canEnable,
    online_checkout_available: canEnable && input.onlineRequested,
    blocking_reasons: blocking,
    business_verification: 'not_confirmed',
    bank_verification: 'not_confirmed',
    settlement_status: input.environment === 'sandbox' ? 'not_available_in_test' : 'not_confirmed',
    managed_payments: { available: false, reason: 'provider_approval_required' },
  };
}
