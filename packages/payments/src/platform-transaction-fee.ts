/** PAY-R3 / NEVER-R5: seller transaction rake is permanently zero.
 * Provider charges and separately billed subscriptions are different contracts.
 */
export const PLATFORM_TRANSACTION_FEE_BPS = 0 as const;

/** Reject drift before creating new financial effects; never rewrite historical deductions. */
export function requireZeroPlatformTransactionFee(value: unknown): typeof PLATFORM_TRANSACTION_FEE_BPS {
  if (value !== 0 && value !== '0') throw new Error('Platform transaction fee policy requires review');
  return PLATFORM_TRANSACTION_FEE_BPS;
}
